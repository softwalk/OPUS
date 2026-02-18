import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

if (process.env.NODE_ENV !== "production") globalForAnthropic.anthropic = anthropic;

export const MODELS = {
  discovery: "claude-sonnet-4-5-20250929",
  architecture: "claude-opus-4-6",
  codegen: "claude-sonnet-4-5-20250929",
  review: "claude-opus-4-6",
  classification: "claude-haiku-4-5-20251001",
} as const;

export const MODEL_CONFIG = {
  discovery: { temperature: 0.4, max_tokens: 4096 },
  architecture: { temperature: 0.2, max_tokens: 16384 },
  codegen: { temperature: 0.1, max_tokens: 8192 },
  review: { temperature: 0, max_tokens: 4096 },
  classification: { temperature: 0, max_tokens: 1024 },
} as const;

export type AgentRole = keyof typeof MODELS;

export async function callAgent(
  role: AgentRole,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const model = MODELS[role];
  const config = MODEL_CONFIG[role];

  const response = await anthropic.messages.create({
    model,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from agent");
  }

  return textBlock.text;
}

export async function callAgentJSON<T>(
  role: AgentRole,
  systemPrompt: string,
  userMessage: string
): Promise<T> {
  const text = await callAgent(role, systemPrompt, userMessage);

  // Extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    throw new Error(`Failed to parse agent response as JSON: ${text.substring(0, 200)}`);
  }
}
