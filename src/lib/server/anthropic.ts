import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from "$env/static/private";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export async function createClaudeMessage({
  system,
  messages,
  maxTokens = 8000,
  temperature = 0.4,
  model,
  timeoutMs = 55000,
}: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  timeoutMs?: number;
}): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
  const modelName = model || ANTHROPIC_MODEL;
  if (!modelName) {
    throw new Error("Missing ANTHROPIC_MODEL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Claude API request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error: ${text}`);
  }

  const data = await response.json();
  const content = data?.content?.find((block: any) => block.type === "text")?.text;
  if (!content) throw new Error("Claude API returned no content");
  return content;
}
