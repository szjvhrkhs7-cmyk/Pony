import { prisma } from "@/lib/db";
import { PromptContext } from "./prompts";

export async function buildContext(
  gameId: string,
  overrides?: Partial<PromptContext>
): Promise<PromptContext> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { preset: true },
  });

  const countries = await prisma.gameCountry.findMany({
    where: { gameId },
  });
  const regions = await prisma.gameRegion.findMany({
    where: { gameId },
  });
  const points = await prisma.gamePoint.findMany({
    where: { gameId },
  });

  const playerCountry = countries.find(
    (c) => c.countryId === game.playerCountryId
  );

  const recentEvents = await prisma.event.findMany({
    where: { gameId },
    orderBy: { round: "desc" },
    take: 30,
  });

  const consolidations = await prisma.consolidationSummary.findMany({
    where: { gameId },
    orderBy: { fromRound: "asc" },
  });

  const pendingActions = await prisma.action.findMany({
    where: { gameId, round: game.round, status: "pending" },
  });

  const chatThreads = await prisma.chatThread.findMany({
    where: { gameId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  const mapState = countries
    .map((c) => {
      const ownedRegions = regions
        .filter((r) => r.ownerCountryId === c.countryId)
        .map((r) => r.name);
      const ownedPoints = points
        .filter((p) => p.ownerCountryId === c.countryId)
        .map((p) => `${p.label} (${p.type}${p.strength ? `, ${p.strength}` : ""})`);
      const stats = JSON.parse(c.stats);
      return `${c.name} (${c.leaderName}): regions=[${ownedRegions.join(", ")}], points=[${ownedPoints.join(", ")}], stats=${JSON.stringify(stats)}`;
    })
    .join("\n");

  const relationsStr = countries
    .map((c) => {
      const rels = JSON.parse(c.relations);
      const relEntries = Object.entries(rels)
        .map(([targetId, score]) => {
          const target = countries.find((t) => t.countryId === targetId);
          return `${target?.name || targetId}: ${score}`;
        })
        .join(", ");
      return `${c.name}: {${relEntries}}`;
    })
    .join("\n");

  const recentEventsStr = recentEvents
    .map(
      (e) => `[R${e.round} ${e.date}] ${e.category}: ${e.title} — ${e.body}`
    )
    .join("\n");

  const consolidatedStr = consolidations
    .map((c) => `[Rounds ${c.fromRound}-${c.toRound}]: ${c.summaryText}`)
    .join("\n");

  const allEventsWithConsolidation = consolidatedStr
    ? `${consolidatedStr}\n\n--- Recent (raw) ---\n${recentEventsStr}`
    : recentEventsStr || "No events yet.";

  const actionsStr = pendingActions.map((a) => `- ${a.text}`).join("\n");

  const chatHistoryStr = chatThreads
    .flatMap((t) =>
      t.messages.map((m) => {
        const speaker = m.speakerCountryId
          ? countries.find((c) => c.countryId === m.speakerCountryId)?.name ||
            m.speakerCountryId
          : m.role;
        return `[${speaker}]: ${m.text}`;
      })
    )
    .join("\n");

  return {
    playerCountry: playerCountry?.name || "Unknown",
    currentDate: game.currentDate,
    simulationRules: game.preset.simulationRules,
    worldLore: game.preset.worldLore,
    recentEvents: recentEventsStr,
    allEventsWithConsolidation,
    relations: relationsStr,
    actions: actionsStr || "No actions this turn.",
    chatHistory: chatHistoryStr || "No recent chats.",
    mapState,
    difficulty: game.difficulty,
    ...overrides,
  };
}
