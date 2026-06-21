import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { consolidateHistory } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

const CONSOLIDATION_BLOCK_SIZE = 5;
const CONSOLIDATION_THRESHOLD = 15;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const lastConsolidation = await prisma.consolidationSummary.findFirst({
    where: { gameId: id },
    orderBy: { toRound: "desc" },
  });
  const startRound = lastConsolidation ? lastConsolidation.toRound + 1 : 1;
  const unconsolidatedRounds = game.round - startRound;

  if (unconsolidatedRounds < CONSOLIDATION_THRESHOLD) {
    return Response.json({
      message: "Not enough rounds to consolidate",
      unconsolidatedRounds,
      threshold: CONSOLIDATION_THRESHOLD,
    });
  }

  const blocksToConsolidate = Math.floor(
    unconsolidatedRounds / CONSOLIDATION_BLOCK_SIZE
  );
  const summaries: { fromRound: number; toRound: number; text: string }[] = [];

  for (let i = 0; i < blocksToConsolidate; i++) {
    const fromRound = startRound + i * CONSOLIDATION_BLOCK_SIZE;
    const toRound = fromRound + CONSOLIDATION_BLOCK_SIZE - 1;

    const events = await prisma.event.findMany({
      where: { gameId: id, round: { gte: fromRound, lte: toRound } },
      orderBy: { round: "asc" },
    });

    const eventsStr = events
      .map(
        (e) => `[R${e.round} ${e.date}] ${e.category}: ${e.title} — ${e.body}`
      )
      .join("\n");

    let summaryText: string;

    if (isLLMConfigured()) {
      try {
        const ctx = await buildContext(id, { recentEvents: eventsStr });
        summaryText = await consolidateHistory(ctx);
      } catch {
        summaryText = `Раунды ${fromRound}-${toRound}: ${events.map((e) => e.title).join("; ")}`;
      }
    } else {
      summaryText = `Раунды ${fromRound}-${toRound}: ${events.map((e) => e.title).join("; ")}`;
    }

    await prisma.consolidationSummary.create({
      data: {
        id: uuid(),
        gameId: id,
        fromRound,
        toRound,
        summaryText,
      },
    });

    summaries.push({ fromRound, toRound, text: summaryText });
  }

  return Response.json({
    consolidated: summaries.length,
    summaries,
  });
}
