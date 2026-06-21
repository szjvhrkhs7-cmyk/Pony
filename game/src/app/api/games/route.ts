import { prisma } from "@/lib/db";

export async function GET() {
  const games = await prisma.game.findMany({
    include: { preset: true },
    orderBy: { updatedAt: "desc" },
  });

  const result = await Promise.all(
    games.map(async (g) => {
      const playerCountry = await prisma.gameCountry.findFirst({
        where: { gameId: g.id, countryId: g.playerCountryId },
      });
      return {
        id: g.id,
        presetName: g.preset.name,
        playerCountryName: playerCountry?.name || "???",
        playerCountryColor: playerCountry?.color || "#666",
        currentDate: g.currentDate,
        round: g.round,
        updatedAt: g.updatedAt,
      };
    })
  );

  return Response.json(result);
}
