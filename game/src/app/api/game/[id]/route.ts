import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      preset: true,
      events: { orderBy: { round: "desc" }, take: 50 },
      actions: { orderBy: { round: "desc" }, take: 20 },
    },
  });

  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const regions = await prisma.gameRegion.findMany({ where: { gameId: id } });
  const countries = await prisma.gameCountry.findMany({
    where: { gameId: id },
  });
  const points = await prisma.gamePoint.findMany({ where: { gameId: id } });

  return Response.json({
    ...game,
    regions,
    countries,
    points,
  });
}
