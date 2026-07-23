import type { RunKind, RunRouteSnapshot, RunSnapshot, RunStatus, TokenUsage } from "@/types";
import { getUuid } from "@/utils";

const emptyUsage = (): TokenUsage => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const sensitiveKeyPattern = /^(api[-_]?key|authorization|access[-_]?token|token|secret|password)$/i;

export function sanitizeRunConnectionURL(value = ""): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return raw.split(/[?#]/, 1)[0];
  }
}

function sanitizeRunValue(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (typeof value === "string" && (value.startsWith("data:") || value.length > 4096)) return "[content omitted]";
  if (Array.isArray(value)) return value.map((item) => sanitizeRunValue(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      childKey === "data" ? "[binary omitted]" : sanitizeRunValue(childValue, childKey),
    ]),
  );
}

export function sanitizeRunParams(params: Record<string, unknown> = {}): Record<string, unknown> {
  return sanitizeRunValue(params) as Record<string, unknown>;
}

export function sumTokenUsage(usages: Array<TokenUsage | null | undefined>): TokenUsage {
  return usages.reduce<TokenUsage>(
    (total, usage) => ({
      input_tokens: total.input_tokens + Number(usage?.input_tokens || 0),
      output_tokens: total.output_tokens + Number(usage?.output_tokens || 0),
      total_tokens: total.total_tokens + Number(usage?.total_tokens || 0),
    }),
    emptyUsage(),
  );
}

export function createRunSnapshot(input: {
  kind: RunKind;
  route: RunRouteSnapshot;
  params?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
  inputCount?: number;
  startedAt?: number;
}): RunSnapshot {
  return {
    id: getUuid("run"),
    kind: input.kind,
    status: "running",
    startedAt: input.startedAt || Date.now(),
    completedAt: 0,
    durationMs: 0,
    route: {
      ...input.route,
      connectionURL: sanitizeRunConnectionURL(input.route.connectionURL),
    },
    request: {
      params: sanitizeRunParams(input.params),
      capabilities: { ...(input.capabilities || {}) },
      inputCount: Math.max(0, Number(input.inputCount || 0)),
    },
    result: {
      usage: emptyUsage(),
      outputCount: 0,
    },
  };
}

export function completeRunSnapshot(
  run: RunSnapshot,
  input: {
    status: Exclude<RunStatus, "running">;
    usage?: TokenUsage | null;
    outputCount?: number;
    error?: string;
    providerStatus?: string;
    completedAt?: number;
  },
): RunSnapshot {
  const completedAt = input.completedAt || Date.now();
  return {
    ...run,
    status: input.status,
    completedAt,
    durationMs: Math.max(0, completedAt - run.startedAt),
    result: {
      usage: input.usage ? { ...input.usage } : emptyUsage(),
      outputCount: Math.max(0, Number(input.outputCount || 0)),
      ...(input.providerStatus ? { providerStatus: input.providerStatus } : {}),
    },
    ...(input.error ? { error: input.error } : {}),
  };
}
