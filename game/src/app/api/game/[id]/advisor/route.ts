import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { askAdvisor } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { question } = await request.json();

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const countries = await prisma.gameCountry.findMany({
    where: { gameId: id },
  });
  const playerCountry = countries.find(
    (c) => c.countryId === game.playerCountryId
  );

  let response: string;

  if (isLLMConfigured()) {
    try {
      const ctx = await buildContext(id, {
        advisorQuestion: question || "Дайте общую оценку обстановки и рекомендации.",
      });
      response = await askAdvisor(ctx);
    } catch {
      response = generateStubAdvisorResponse(
        playerCountry?.name || "Ваша страна",
        countries.length
      );
    }
  } else {
    response = generateStubAdvisorResponse(
      playerCountry?.name || "Ваша страна",
      countries.length
    );
  }

  return Response.json({ response });
}

function generateStubAdvisorResponse(
  countryName: string,
  totalCountries: number
): string {
  const tips = [
    `Мой государь, ${countryName} находится в устойчивом положении. Рекомендую укреплять экономику и поддерживать дипломатические связи с соседями.`,
    `Ваше величество, советую обратить внимание на военную мощь. ${totalCountries - 1} соседних держав наблюдают за каждым нашим шагом.`,
    `Государь, наша стабильность — залог процветания. Внутренние реформы сейчас принесут больше пользы, чем внешняя экспансия.`,
    `Мой совет — не пренебрегайте дипломатией. Союзники в этом мире дороже золота.`,
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}
