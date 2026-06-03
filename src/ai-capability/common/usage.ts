/**
 * Normalize provider token accounting into the shape consumed by chat history.
 *
 * Returns `null` when the usage data is missing or clearly invalid — callers
 * should treat `null` as "no usage data available".
 */
import type { TokenUsage } from "./types";

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

/**
 * Normalize provider token accounting for image generation.
 *
 * Unlike {@link normalizeUsage} this always returns a valid `TokenUsage`
 * object — callers never need to null-check the result. Missing or malformed
 * usage data is represented as zeros.
 */
export function normalizeImageUsage(usage: Record<string, unknown> | null = null): TokenUsage {
  if (!usage || typeof usage !== "object") {
    return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  }

  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);

  return {
    ...usage,
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}
