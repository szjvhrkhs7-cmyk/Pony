import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }
  return Response.json({
    difficulty: game.difficulty,
    aiModel: game.aiModel,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, string> = {};
  if (body.difficulty) updates.difficulty = body.difficulty;
  if (body.aiModel) updates.aiModel = body.aiModel;

  const game = await prisma.game.update({
    where: { id },
    data: updates,
  });

  return Response.json({
    difficulty: game.difficulty,
    aiModel: game.aiModel,
  });
}
