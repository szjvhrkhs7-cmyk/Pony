import { prisma } from "@/lib/db";
import { Delta } from "@/lib/schemas";
import { v4 as uuid } from "uuid";

export async function applyDeltas(gameId: string, deltas: Delta[]) {
  for (const delta of deltas) {
    switch (delta.type) {
      case "region_owner_change": {
        await prisma.gameRegion.updateMany({
          where: { gameId, regionId: delta.regionId },
          data: { ownerCountryId: delta.newOwnerId },
        });
        break;
      }
      case "point_add": {
        await prisma.gamePoint.create({
          data: {
            id: uuid(),
            gameId,
            pointId: uuid(),
            type: delta.pointType,
            regionId: delta.regionId,
            coordX: delta.coordX,
            coordY: delta.coordY,
            ownerCountryId: delta.ownerCountryId,
            label: delta.label,
            strength: delta.strength ?? 0,
            locked: false,
          },
        });
        break;
      }
      case "point_move": {
        await prisma.gamePoint.updateMany({
          where: { gameId, pointId: delta.pointId },
          data: {
            regionId: delta.newRegionId,
            coordX: delta.newCoordX,
            coordY: delta.newCoordY,
          },
        });
        break;
      }
      case "point_remove": {
        const point = await prisma.gamePoint.findFirst({
          where: { gameId, pointId: delta.pointId },
        });
        if (point && !point.locked) {
          await prisma.gamePoint.delete({ where: { id: point.id } });
        }
        break;
      }
      case "relation_change": {
        const country = await prisma.gameCountry.findFirst({
          where: { gameId, countryId: delta.countryId },
        });
        if (country) {
          const relations = JSON.parse(country.relations);
          relations[delta.targetCountryId] = delta.newScore;
          await prisma.gameCountry.update({
            where: { id: country.id },
            data: { relations: JSON.stringify(relations) },
          });
        }
        break;
      }
      case "stat_change": {
        const c = await prisma.gameCountry.findFirst({
          where: { gameId, countryId: delta.countryId },
        });
        if (c) {
          const stats = JSON.parse(c.stats);
          stats[delta.stat] = delta.newValue;
          await prisma.gameCountry.update({
            where: { id: c.id },
            data: { stats: JSON.stringify(stats) },
          });
        }
        break;
      }
      case "country_add": {
        await prisma.gameCountry.create({
          data: {
            id: uuid(),
            gameId,
            countryId: delta.countryId,
            name: delta.name,
            color: delta.color,
            leaderName: delta.leaderName ?? "",
            stats: JSON.stringify({ economy: 30, military: 30, stability: 50 }),
            relations: "{}",
          },
        });
        break;
      }
      case "country_remove": {
        await prisma.gameCountry.deleteMany({
          where: { gameId, countryId: delta.countryId },
        });
        await prisma.gameRegion.updateMany({
          where: { gameId, ownerCountryId: delta.countryId },
          data: { ownerCountryId: null },
        });
        await prisma.gamePoint.deleteMany({
          where: { gameId, ownerCountryId: delta.countryId },
        });
        break;
      }
    }
  }
}
