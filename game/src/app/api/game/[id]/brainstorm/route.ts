import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { isLLMConfigured } from "@/lib/engine/llm-adapter";
import { brainstormActions } from "@/lib/engine/llm-simulation";
import { buildContext } from "@/lib/engine/context-builder";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  let suggestions: string;

  if (isLLMConfigured()) {
    try {
      const ctx = await buildContext(id);
      suggestions = await brainstormActions(ctx);
    } catch {
      suggestions = getStubSuggestions();
    }
  } else {
    suggestions = getStubSuggestions();
  }

  return Response.json({ suggestions });
}

function getStubSuggestions(): string {
  return `1. Укрепить армию и провести военные учения на границе
2. Отправить послов к соседним державам для улучшения отношений
3. Вложить средства в развитие экономики и торговых путей
4. Провести внутренние реформы для повышения стабильности
5. Основать новый город в стратегически важном регионе`;
}
