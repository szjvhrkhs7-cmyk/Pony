import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { polishAction } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = await request.json();

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  let polished: string;

  if (isLLMConfigured()) {
    try {
      const ctx = await buildContext(id, { actions: text });
      polished = await polishAction(ctx);
    } catch {
      polished = text;
    }
  } else {
    polished = text;
  }

  return Response.json({ polished });
}
