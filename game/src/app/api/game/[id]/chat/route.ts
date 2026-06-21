import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { chatWithCountry } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const threads = await prisma.chatThread.findMany({
    where: { gameId: id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  return Response.json(threads);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { targetCountryId, message, threadId } = await request.json();

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const countries = await prisma.gameCountry.findMany({
    where: { gameId: id },
  });
  const targetCountry = countries.find(
    (c) => c.countryId === targetCountryId
  );
  const playerCountry = countries.find(
    (c) => c.countryId === game.playerCountryId
  );

  if (!targetCountry) {
    return Response.json({ error: "Target country not found" }, { status: 404 });
  }

  let thread;
  if (threadId) {
    thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        id: uuid(),
        gameId: id,
        kind: "bilateral",
        participantCountryIds: JSON.stringify([
          game.playerCountryId,
          targetCountryId,
        ]),
      },
      include: { messages: true },
    });
  }

  await prisma.chatMessage.create({
    data: {
      id: uuid(),
      threadId: thread.id,
      round: game.round,
      role: "player",
      speakerCountryId: game.playerCountryId,
      text: message,
    },
  });

  let responseText: string;

  if (isLLMConfigured()) {
    const chatHistory = [
      ...thread.messages.map((m) => {
        const speaker = m.speakerCountryId
          ? countries.find((c) => c.countryId === m.speakerCountryId)?.name
          : m.role;
        return `[${speaker}]: ${m.text}`;
      }),
      `[${playerCountry?.name}]: ${message}`,
    ].join("\n");

    const relations = JSON.parse(targetCountry.relations);
    const scoreToPlayer = relations[game.playerCountryId] ?? 0;

    const ctx = await buildContext(id, {
      targetCountry: targetCountry.name,
      targetCountryRelations: `Score toward player: ${scoreToPlayer}`,
      chatHistory,
    });

    try {
      responseText = await chatWithCountry(ctx);
    } catch {
      responseText = generateStubDiplomacyResponse(
        targetCountry.name,
        targetCountry.leaderName,
        scoreToPlayer
      );
    }
  } else {
    const relations = JSON.parse(targetCountry.relations);
    const scoreToPlayer = relations[game.playerCountryId] ?? 0;
    responseText = generateStubDiplomacyResponse(
      targetCountry.name,
      targetCountry.leaderName,
      scoreToPlayer
    );
  }

  await prisma.chatMessage.create({
    data: {
      id: uuid(),
      threadId: thread.id,
      round: game.round,
      role: "nation",
      speakerCountryId: targetCountryId,
      text: responseText,
    },
  });

  const updatedThread = await prisma.chatThread.findUnique({
    where: { id: thread.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return Response.json(updatedThread);
}

function generateStubDiplomacyResponse(
  countryName: string,
  leaderName: string,
  score: number
): string {
  if (score > 30) {
    return `${leaderName} приветствует вас как друга. ${countryName} ценит наши добрые отношения и готова к сотрудничеству.`;
  }
  if (score > 0) {
    return `${leaderName} внимательно выслушивает ваше предложение. ${countryName} готова рассмотреть взаимовыгодные условия.`;
  }
  if (score > -30) {
    return `${leaderName} сдержанно кивает. ${countryName} будет осторожна в переговорах, но двери для дипломатии открыты.`;
  }
  return `${leaderName} хмурится. Отношения между нашими странами оставляют желать лучшего. Надеемся, что вы пришли с серьёзными намерениями.`;
}
