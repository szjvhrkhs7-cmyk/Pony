export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
}

export interface LLMAdapter {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
}

function getProvider(): string {
  return process.env.LLM_PROVIDER || "stub";
}

function getModel(): string {
  return process.env.LLM_MODEL || "";
}

function getApiKey(): string {
  const provider = getProvider();
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || "";
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || "";
  return "";
}

function getBaseUrl(): string | undefined {
  const provider = getProvider();
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  if (provider === "openai") return "https://api.openai.com/v1";
  return process.env.LLM_BASE_URL || undefined;
}

async function chatOpenAICompatible(
  messages: LLMMessage[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<LLMResponse> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { content: data.choices[0].message.content };
}

async function chatAnthropic(
  messages: LLMMessage[],
  apiKey: string,
  model: string
): Promise<LLMResponse> {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const nonSystem = messages.filter((m) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: nonSystem.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { content: data.content[0].text };
}

export function createAdapter(): LLMAdapter {
  const provider = getProvider();
  const model = getModel();
  const apiKey = getApiKey();

  return {
    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
      if (provider === "stub") {
        throw new Error(
          "Stub provider does not support chat. Use runStubSimulation instead."
        );
      }
      if (provider === "anthropic") {
        return chatAnthropic(messages, apiKey, model);
      }
      const baseUrl = getBaseUrl()!;
      return chatOpenAICompatible(messages, baseUrl, apiKey, model);
    },
  };
}

export function isLLMConfigured(): boolean {
  const provider = getProvider();
  if (provider === "stub") return false;
  return !!getApiKey() && !!getModel();
}
