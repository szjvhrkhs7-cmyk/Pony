import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  await prisma.game.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ saved: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.chatMessage.deleteMany({
    where: { thread: { gameId: id } },
  });
  await prisma.chatThread.deleteMany({ where: { gameId: id } });
  await prisma.consolidationSummary.deleteMany({ where: { gameId: id } });
  await prisma.event.deleteMany({ where: { gameId: id } });
  await prisma.action.deleteMany({ where: { gameId: id } });
  await prisma.gamePoint.deleteMany({ where: { gameId: id } });
  await prisma.gameCountry.deleteMany({ where: { gameId: id } });
  await prisma.gameRegion.deleteMany({ where: { gameId: id } });
  await prisma.game.delete({ where: { id } });

  return Response.json({ deleted: true });
}
