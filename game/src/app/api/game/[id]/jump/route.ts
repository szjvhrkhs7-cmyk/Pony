import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { runStubSimulation } from "@/lib/engine/stub";
import { applyDeltas } from "@/lib/engine/apply-deltas";
import { SimulationOutputSchema, SimulationOutput, Delta } from "@/lib/schemas";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { runLLMSimulation } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { timeJump } = await request.json();

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const actions = await prisma.action.findMany({
    where: { gameId: id, round: game.round, status: "pending" },
  });

  const regions = await prisma.gameRegion.findMany({ where: { gameId: id } });
  const countries = await prisma.gameCountry.findMany({
    where: { gameId: id },
  });
  const points = await prisma.gamePoint.findMany({ where: { gameId: id } });

  let validated: SimulationOutput;

  if (isLLMConfigured()) {
    try {
      const ctx = await buildContext(id);
      validated = await runLLMSimulation(ctx);
    } catch (e) {
      console.error("LLM simulation failed, falling back to stub:", e);
      const stubResult = runStubSimulation({
        gameId: id,
        currentDate: game.currentDate,
        round: game.round,
        actions: actions.map((a) => ({ id: a.id, text: a.text })),
        regions: regions.map((r) => ({
          id: r.id,
          regionId: r.regionId,
          ownerCountryId: r.ownerCountryId,
        })),
        countries: countries.map((c) => ({
          id: c.id,
          countryId: c.countryId,
          name: c.name,
          stats: c.stats,
          relations: c.relations,
        })),
        points: points.map((p) => ({
          id: p.id,
          pointId: p.pointId,
          type: p.type,
          regionId: p.regionId,
          ownerCountryId: p.ownerCountryId,
        })),
        playerCountryId: game.playerCountryId,
        timeJump,
      });
      validated = SimulationOutputSchema.parse(stubResult);
    }
  } else {
    const stubResult = runStubSimulation({
      gameId: id,
      currentDate: game.currentDate,
      round: game.round,
      actions: actions.map((a) => ({ id: a.id, text: a.text })),
      regions: regions.map((r) => ({
        id: r.id,
        regionId: r.regionId,
        ownerCountryId: r.ownerCountryId,
      })),
      countries: countries.map((c) => ({
        id: c.id,
        countryId: c.countryId,
        name: c.name,
        stats: c.stats,
        relations: c.relations,
      })),
      points: points.map((p) => ({
        id: p.id,
        pointId: p.pointId,
        type: p.type,
        regionId: p.regionId,
        ownerCountryId: p.ownerCountryId,
      })),
      playerCountryId: game.playerCountryId,
      timeJump,
    });
    validated = SimulationOutputSchema.parse(stubResult);
  }

  const allDeltas: Delta[] = [];
  for (const event of validated.events) {
    allDeltas.push(...event.deltas);
    await prisma.event.create({
      data: {
        id: uuid(),
        gameId: id,
        round: game.round,
        date: validated.newDate,
        category: event.category,
        title: event.title,
        body: event.body,
        appliedDeltas: JSON.stringify(event.deltas),
      },
    });
  }

  await applyDeltas(id, allDeltas);

  for (const action of actions) {
    await prisma.action.update({
      where: { id: action.id },
      data: { status: "simulated" },
    });
  }

  for (const voided of validated.voidedActions) {
    await prisma.action.updateMany({
      where: { id: voided.actionId },
      data: { status: "voided" },
    });
  }

  await prisma.game.update({
    where: { id },
    data: {
      currentDate: validated.newDate,
      round: game.round + 1,
    },
  });

  const updatedRegions = await prisma.gameRegion.findMany({
    where: { gameId: id },
  });
  const updatedCountries = await prisma.gameCountry.findMany({
    where: { gameId: id },
  });
  const updatedPoints = await prisma.gamePoint.findMany({
    where: { gameId: id },
  });

  return Response.json({
    newDate: validated.newDate,
    newRound: game.round + 1,
    events: validated.events,
    voidedActions: validated.voidedActions,
    regions: updatedRegions,
    countries: updatedCountries,
    points: updatedPoints,
  });
}
