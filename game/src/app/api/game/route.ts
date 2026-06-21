import { prisma } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function POST(request: Request) {
  const { presetId, playerCountryId } = await request.json();

  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: { regions: true, countries: true, points: true },
  });

  if (!preset) {
    return Response.json({ error: "Preset not found" }, { status: 404 });
  }

  const gameId = uuid();

  await prisma.game.create({
    data: {
      id: gameId,
      presetId,
      playerCountryId,
      currentDate: preset.startDate,
      round: 1,
      difficulty: preset.defaultDifficulty,
    },
  });

  for (const r of preset.regions) {
    await prisma.gameRegion.create({
      data: {
        id: uuid(),
        gameId,
        regionId: r.id,
        name: r.name,
        type: r.type,
        geometry: r.geometry,
        ownerCountryId: r.ownerCountryId,
        neighborIds: r.neighborIds,
      },
    });
  }

  for (const c of preset.countries) {
    await prisma.gameCountry.create({
      data: {
        id: uuid(),
        gameId,
        countryId: c.id,
        name: c.name,
        color: c.color,
        flag: c.flag,
        capitalRegionId: c.capitalRegionId,
        leaderName: c.leaderName,
        stats: c.stats,
        relations: c.relations,
      },
    });
  }

  for (const p of preset.points) {
    await prisma.gamePoint.create({
      data: {
        id: uuid(),
        gameId,
        pointId: p.id,
        type: p.type,
        regionId: p.regionId,
        coordX: p.coordX,
        coordY: p.coordY,
        ownerCountryId: p.ownerCountryId,
        label: p.label,
        strength: p.strength,
        locked: p.locked,
      },
    });
  }

  return Response.json({ gameId });
}
