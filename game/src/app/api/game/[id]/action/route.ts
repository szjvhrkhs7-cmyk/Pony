import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

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

  const action = await prisma.action.create({
    data: {
      id: uuid(),
      gameId: id,
      round: game.round,
      text,
      status: "pending",
    },
  });

  return Response.json(action);
}
