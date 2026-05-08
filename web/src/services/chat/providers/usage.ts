/**
 * Normalize provider token accounting into the shape consumed by chat history.
 */
import type { TokenUsage } from "@/services/types";

export function normalizeUsage(usage: Record<string, unknown> | null | undefined): TokenUsage {
  if (!usage) return null;

  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);

  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return null;

  return {
    input_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    output_tokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    total_tokens: totalTokens,
  };
}
