import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const PRESET_ID = "preset-medieval-europe";

const countries = [
  {
    id: "country-francia",
    name: "Франция",
    color: "#3B82F6",
    leaderName: "Филипп II",
    capitalRegionId: "region-ile-de-france",
    stats: { economy: 60, military: 55, stability: 65 },
    relations: {
      "country-england": -30,
      "country-hre": 10,
      "country-castile": 20,
      "country-byzantium": 5,
    },
  },
  {
    id: "country-england",
    name: "Англия",
    color: "#EF4444",
    leaderName: "Ричард I",
    capitalRegionId: "region-england",
    stats: { economy: 55, military: 60, stability: 50 },
    relations: {
      "country-francia": -30,
      "country-hre": 0,
      "country-castile": 10,
      "country-byzantium": -5,
    },
  },
  {
    id: "country-hre",
    name: "Священная Римская империя",
    color: "#F59E0B",
    leaderName: "Фридрих Барбаросса",
    capitalRegionId: "region-rhineland",
    stats: { economy: 50, military: 65, stability: 40 },
    relations: {
      "country-francia": 10,
      "country-england": 0,
      "country-castile": 5,
      "country-byzantium": -10,
    },
  },
  {
    id: "country-castile",
    name: "Кастилия",
    color: "#10B981",
    leaderName: "Альфонсо VIII",
    capitalRegionId: "region-castile",
    stats: { economy: 45, military: 50, stability: 60 },
    relations: {
      "country-francia": 20,
      "country-england": 10,
      "country-hre": 5,
      "country-byzantium": 0,
    },
  },
  {
    id: "country-byzantium",
    name: "Византия",
    color: "#8B5CF6",
    leaderName: "Исаак II Ангел",
    capitalRegionId: "region-thrace",
    stats: { economy: 65, military: 45, stability: 35 },
    relations: {
      "country-francia": 5,
      "country-england": -5,
      "country-hre": -10,
      "country-castile": 0,
    },
  },
];

const regions = [
  {
    id: "region-england",
    name: "Англия",
    type: "coastal",
    ownerCountryId: "country-england",
    geometry: JSON.stringify([
      [180, 80],
      [230, 60],
      [260, 80],
      [250, 130],
      [220, 150],
      [190, 140],
      [170, 110],
    ]),
    neighborIds: ["region-normandy"],
  },
  {
    id: "region-normandy",
    name: "Нормандия",
    type: "coastal",
    ownerCountryId: "country-francia",
    geometry: JSON.stringify([
      [210, 170],
      [260, 160],
      [280, 180],
      [270, 210],
      [230, 220],
      [200, 200],
    ]),
    neighborIds: [
      "region-england",
      "region-ile-de-france",
      "region-brittany",
    ],
  },
  {
    id: "region-brittany",
    name: "Бретань",
    type: "coastal",
    ownerCountryId: "country-francia",
    geometry: JSON.stringify([
      [150, 190],
      [200, 200],
      [210, 230],
      [180, 260],
      [140, 250],
      [130, 220],
    ]),
    neighborIds: ["region-normandy", "region-ile-de-france", "region-aquitaine"],
  },
  {
    id: "region-ile-de-france",
    name: "Иль-де-Франс",
    type: "land",
    ownerCountryId: "country-francia",
    geometry: JSON.stringify([
      [260, 160],
      [320, 150],
      [340, 190],
      [320, 230],
      [270, 230],
      [250, 200],
    ]),
    neighborIds: [
      "region-normandy",
      "region-brittany",
      "region-aquitaine",
      "region-burgundy",
    ],
  },
  {
    id: "region-aquitaine",
    name: "Аквитания",
    type: "coastal",
    ownerCountryId: "country-francia",
    geometry: JSON.stringify([
      [180, 260],
      [270, 230],
      [300, 270],
      [290, 330],
      [240, 360],
      [190, 340],
      [160, 300],
    ]),
    neighborIds: [
      "region-brittany",
      "region-ile-de-france",
      "region-burgundy",
      "region-castile",
    ],
  },
  {
    id: "region-burgundy",
    name: "Бургундия",
    type: "land",
    ownerCountryId: "country-francia",
    geometry: JSON.stringify([
      [320, 150],
      [380, 140],
      [400, 190],
      [380, 240],
      [320, 250],
      [300, 210],
    ]),
    neighborIds: [
      "region-ile-de-france",
      "region-aquitaine",
      "region-rhineland",
      "region-swabia",
    ],
  },
  {
    id: "region-rhineland",
    name: "Рейнланд",
    type: "land",
    ownerCountryId: "country-hre",
    geometry: JSON.stringify([
      [380, 80],
      [440, 70],
      [460, 110],
      [450, 160],
      [400, 170],
      [370, 140],
    ]),
    neighborIds: [
      "region-burgundy",
      "region-swabia",
      "region-saxony",
    ],
  },
  {
    id: "region-swabia",
    name: "Швабия",
    type: "land",
    ownerCountryId: "country-hre",
    geometry: JSON.stringify([
      [400, 170],
      [460, 160],
      [480, 200],
      [470, 250],
      [420, 260],
      [390, 230],
    ]),
    neighborIds: [
      "region-burgundy",
      "region-rhineland",
      "region-bavaria",
    ],
  },
  {
    id: "region-saxony",
    name: "Саксония",
    type: "land",
    ownerCountryId: "country-hre",
    geometry: JSON.stringify([
      [440, 50],
      [520, 40],
      [540, 80],
      [530, 130],
      [470, 140],
      [450, 100],
    ]),
    neighborIds: ["region-rhineland", "region-bavaria"],
  },
  {
    id: "region-bavaria",
    name: "Бавария",
    type: "land",
    ownerCountryId: "country-hre",
    geometry: JSON.stringify([
      [470, 140],
      [540, 130],
      [560, 180],
      [540, 230],
      [480, 240],
      [460, 200],
    ]),
    neighborIds: [
      "region-saxony",
      "region-swabia",
      "region-thrace",
    ],
  },
  {
    id: "region-castile",
    name: "Кастилия",
    type: "land",
    ownerCountryId: "country-castile",
    geometry: JSON.stringify([
      [140, 370],
      [220, 360],
      [260, 400],
      [240, 450],
      [180, 470],
      [120, 440],
      [110, 400],
    ]),
    neighborIds: ["region-aquitaine", "region-aragon"],
  },
  {
    id: "region-aragon",
    name: "Арагон",
    type: "coastal",
    ownerCountryId: "country-castile",
    geometry: JSON.stringify([
      [260, 350],
      [320, 340],
      [350, 380],
      [330, 430],
      [280, 440],
      [250, 410],
    ]),
    neighborIds: ["region-castile", "region-aquitaine"],
  },
  {
    id: "region-thrace",
    name: "Фракия",
    type: "coastal",
    ownerCountryId: "country-byzantium",
    geometry: JSON.stringify([
      [580, 300],
      [640, 280],
      [670, 310],
      [660, 360],
      [620, 380],
      [580, 360],
      [570, 330],
    ]),
    neighborIds: ["region-anatolia", "region-greece"],
  },
  {
    id: "region-anatolia",
    name: "Анатолия",
    type: "coastal",
    ownerCountryId: "country-byzantium",
    geometry: JSON.stringify([
      [660, 280],
      [740, 270],
      [770, 310],
      [750, 370],
      [690, 380],
      [660, 350],
    ]),
    neighborIds: ["region-thrace"],
  },
  {
    id: "region-greece",
    name: "Греция",
    type: "coastal",
    ownerCountryId: "country-byzantium",
    geometry: JSON.stringify([
      [570, 360],
      [620, 380],
      [630, 420],
      [610, 460],
      [570, 450],
      [550, 410],
    ]),
    neighborIds: ["region-thrace"],
  },
];

const points = [
  {
    id: "point-paris",
    type: "capital",
    regionId: "region-ile-de-france",
    coordX: 290,
    coordY: 190,
    ownerCountryId: "country-francia",
    label: "Париж",
    locked: true,
  },
  {
    id: "point-london",
    type: "capital",
    regionId: "region-england",
    coordX: 220,
    coordY: 105,
    ownerCountryId: "country-england",
    label: "Лондон",
    locked: true,
  },
  {
    id: "point-aachen",
    type: "capital",
    regionId: "region-rhineland",
    coordX: 420,
    coordY: 120,
    ownerCountryId: "country-hre",
    label: "Ахен",
    locked: true,
  },
  {
    id: "point-toledo",
    type: "capital",
    regionId: "region-castile",
    coordX: 190,
    coordY: 420,
    ownerCountryId: "country-castile",
    label: "Толедо",
    locked: true,
  },
  {
    id: "point-constantinople",
    type: "capital",
    regionId: "region-thrace",
    coordX: 630,
    coordY: 330,
    ownerCountryId: "country-byzantium",
    label: "Константинополь",
    locked: true,
  },
  {
    id: "point-rouen",
    type: "city",
    regionId: "region-normandy",
    coordX: 240,
    coordY: 190,
    ownerCountryId: "country-francia",
    label: "Руан",
    locked: true,
  },
  {
    id: "point-bordeaux",
    type: "city",
    regionId: "region-aquitaine",
    coordX: 230,
    coordY: 300,
    ownerCountryId: "country-francia",
    label: "Бордо",
    locked: true,
  },
  {
    id: "point-munich",
    type: "city",
    regionId: "region-bavaria",
    coordX: 510,
    coordY: 185,
    ownerCountryId: "country-hre",
    label: "Мюнхен",
    locked: true,
  },
  {
    id: "point-french-army",
    type: "battalion",
    regionId: "region-ile-de-france",
    coordX: 305,
    coordY: 205,
    ownerCountryId: "country-francia",
    label: "Армия Франции",
    strength: 5000,
    locked: false,
  },
  {
    id: "point-english-army",
    type: "battalion",
    regionId: "region-england",
    coordX: 235,
    coordY: 115,
    ownerCountryId: "country-england",
    label: "Армия Англии",
    strength: 4500,
    locked: false,
  },
  {
    id: "point-hre-army",
    type: "battalion",
    regionId: "region-rhineland",
    coordX: 435,
    coordY: 130,
    ownerCountryId: "country-hre",
    label: "Имперская армия",
    strength: 6000,
    locked: false,
  },
];

async function main() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.consolidationSummary.deleteMany();
  await prisma.event.deleteMany();
  await prisma.action.deleteMany();
  await prisma.gamePoint.deleteMany();
  await prisma.gameCountry.deleteMany();
  await prisma.gameRegion.deleteMany();
  await prisma.game.deleteMany();
  await prisma.point.deleteMany();
  await prisma.country.deleteMany();
  await prisma.region.deleteMany();
  await prisma.preset.deleteMany();

  await prisma.preset.create({
    data: {
      id: PRESET_ID,
      name: "Средневековая Европа",
      description:
        "Европа XII века. Франция, Англия, Священная Римская империя, Кастилия и Византия борются за влияние.",
      startDate: "1190-01-01",
      simulationRules:
        "Реалистичная средневековая симуляция. Армии перемещаются медленно. Осады длятся месяцы. Дипломатия играет ключевую роль. Религия влияет на политику.",
      worldLore:
        "Эпоха крестовых походов. Третий крестовый поход только что завершился. Европейские державы возвращаются к внутренним делам и соперничеству.",
      defaultDifficulty: "normal",
    },
  });

  for (const c of countries) {
    await prisma.country.create({
      data: {
        id: c.id,
        presetId: PRESET_ID,
        name: c.name,
        color: c.color,
        leaderName: c.leaderName,
        capitalRegionId: c.capitalRegionId,
        stats: JSON.stringify(c.stats),
        relations: JSON.stringify(c.relations),
      },
    });
  }

  for (const r of regions) {
    await prisma.region.create({
      data: {
        id: r.id,
        presetId: PRESET_ID,
        name: r.name,
        type: r.type,
        geometry: r.geometry,
        ownerCountryId: r.ownerCountryId,
        neighborIds: JSON.stringify(r.neighborIds),
      },
    });
  }

  for (const p of points) {
    await prisma.point.create({
      data: {
        id: p.id,
        presetId: PRESET_ID,
        type: p.type,
        regionId: p.regionId,
        coordX: p.coordX,
        coordY: p.coordY,
        ownerCountryId: p.ownerCountryId,
        label: p.label,
        strength: p.strength ?? 0,
        locked: p.locked,
      },
    });
  }

  console.log("Seed complete: Medieval Europe preset created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
