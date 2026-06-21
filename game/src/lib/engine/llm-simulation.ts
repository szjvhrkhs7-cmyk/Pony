import { createAdapter, isLLMConfigured } from "./llm-adapter";
import { buildPrompt, PromptContext } from "./prompts";
import { SimulationOutput, SimulationOutputSchema } from "@/lib/schemas";

const MAX_REPAIR_ATTEMPTS = 3;

function extractJSON(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  return text;
}

export async function runLLMSimulation(
  ctx: PromptContext
): Promise<SimulationOutput> {
  if (!isLLMConfigured()) {
    throw new Error("LLM not configured");
  }

  const adapter = createAdapter();
  const { system, user } = buildPrompt("simulation", ctx);

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const messages =
      attempt === 0
        ? [
            { role: "system" as const, content: system },
            { role: "user" as const, content: user },
          ]
        : [
            { role: "system" as const, content: system },
            { role: "user" as const, content: user },
            {
              role: "user" as const,
              content: `Your previous response had invalid JSON. Error: ${lastError}\n\nPlease fix the JSON and respond again with ONLY valid JSON.`,
            },
          ];

    const response = await adapter.chat(messages);
    const jsonStr = extractJSON(response.content);

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = SimulationOutputSchema.parse(parsed);
      return validated;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === MAX_REPAIR_ATTEMPTS) {
        throw new Error(
          `Failed to get valid simulation output after ${MAX_REPAIR_ATTEMPTS} repair attempts. Last error: ${lastError}`
        );
      }
    }
  }

  throw new Error("Unreachable");
}

export async function chatWithCountry(
  ctx: PromptContext
): Promise<string> {
  const adapter = createAdapter();
  const { system, user } = buildPrompt("diplomacy", ctx);
  const response = await adapter.chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return response.content;
}

export async function askAdvisor(ctx: PromptContext): Promise<string> {
  const adapter = createAdapter();
  const { system, user } = buildPrompt("advisor", ctx);
  const response = await adapter.chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return response.content;
}

export async function brainstormActions(ctx: PromptContext): Promise<string> {
  const adapter = createAdapter();
  const { system, user } = buildPrompt("brainstorm", ctx);
  const response = await adapter.chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return response.content;
}

export async function polishAction(ctx: PromptContext): Promise<string> {
  const adapter = createAdapter();
  const { system, user } = buildPrompt("polish", ctx);
  const response = await adapter.chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return response.content;
}

export async function consolidateHistory(
  ctx: PromptContext
): Promise<string> {
  const adapter = createAdapter();
  const { system, user } = buildPrompt("consolidation", ctx);
  const response = await adapter.chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return response.content;
}
