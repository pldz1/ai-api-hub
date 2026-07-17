import type { ModelParamDef } from "../common";
import { chatProviderRegistry } from "./types";
import type { ChatAdapterId, ChatModelCapabilities, ChatModelConfig, ChatModelProvider, ChatProviderDefinition } from "./types";

/** Parameter definitions shared by catalog bindings and the settings UI. */
export const chatParamList: Partial<ModelParamDef>[] = [
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number",
    descriptionKey: "chat.maxTokensTip",
    defaultValue: 2000,
    min: 0,
    max: 12800,
    step: 1,
  },
  {
    key: "max_output_tokens",
    label: "max_output_tokens",
    type: "number",
    descriptionKey: "chat.maxCompletionTokensTip",
    defaultValue: 12800,
    min: 0,
    max: 128000,
    step: 1,
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    descriptionKey: "chat.temperatureTip",
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "top_p",
    label: "top_p",
    type: "number",
    descriptionKey: "chat.topPTip",
    defaultValue: 0.95,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "frequency_penalty",
    label: "frequency_penalty",
    type: "number",
    descriptionKey: "chat.frequencyPenaltyTip",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "presence_penalty",
    label: "presence_penalty",
    type: "number",
    descriptionKey: "chat.presencePenaltyTip",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "reasoning_effort",
    label: "reasoning_effort",
    type: "string",
    descriptionKey: "chat.reasoningEffortTip",
    defaultValue: "medium",
    placeholder: "none / low / medium / high / xhigh",
  },
  {
    key: "thinking",
    label: "thinking",
    type: "object",
    description: "DeepSeek thinking configuration.",
    defaultValue: { type: "enabled" },
    placeholder: '{"type":"enabled"}',
  },
  {
    key: "verbosity",
    label: "verbosity",
    type: "string",
    descriptionKey: "chat.verbosityTip",
    defaultValue: "medium",
    placeholder: "low / medium / high",
  },
];

/**
 * One explicit model/provider combination.
 *
 * Fields that can vary between providers live on the binding instead of the
 * model family. This is the canonical source consumed by both UI and runtime.
 */
export interface ChatModelBinding {
  key: string;
  model: string;
  provider: ChatModelProvider;
  adapterId: ChatAdapterId;
  adapterOptions?: Record<string, unknown>;
  paramKeys: string[];
  messageFormat: "text" | "parts";
  capabilities: ChatModelCapabilities;
}

export interface ResolvedChatModel {
  config: ChatModelConfig;
  provider: ChatProviderDefinition;
  binding: ChatModelBinding;
  knownModel: boolean;
}

type SharedBindingSpec = Pick<ChatModelBinding, "paramKeys" | "messageFormat" | "capabilities">;

function defineBindings(
  models: readonly string[],
  providers: readonly ChatModelProvider[],
  spec: SharedBindingSpec,
): ChatModelBinding[] {
  return models.flatMap((model) =>
    providers.map((provider) => ({
      key: `${provider}:${model}`,
      model,
      provider,
      adapterId: chatProviderRegistry[provider].adapterId,
      paramKeys: [...spec.paramKeys],
      messageFormat: spec.messageFormat,
      capabilities: { ...spec.capabilities },
    })),
  );
}

const openAIProviders = ["OpenAI", "Azure OpenAI"] as const satisfies readonly ChatModelProvider[];

export const chatModelBindings: ChatModelBinding[] = [
  ...defineBindings(
    ["gpt-5.5-pro", "gpt-5.5", "gpt-5.4-pro", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
    openAIProviders,
    {
      paramKeys: ["max_output_tokens", "reasoning_effort", "verbosity"],
      messageFormat: "parts",
      capabilities: { webSearch: true, imageRead: true },
    },
  ),
  ...defineBindings(["gpt-4.1", "gpt-4o"], openAIProviders, {
    paramKeys: ["max_output_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    messageFormat: "parts",
    capabilities: { webSearch: true, imageRead: true },
  }),
  ...defineBindings(["deepseek-v4-flash", "deepseek-v4-pro"], ["DeepSeek"], {
    paramKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    messageFormat: "text",
    capabilities: { webSearch: true, imageRead: false },
  }),
  ...defineBindings(["deepseek-v4-flash", "deepseek-v4-pro"], ["DashScope"], {
    paramKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    messageFormat: "text",
    capabilities: { webSearch: true, imageRead: false },
  }).map((binding) => ({
    ...binding,
    adapterOptions: { reasoningEffortMode: "deepseek-v4" },
  })),
  ...defineBindings(["qwen3.7-max-2026-05-17"], ["DashScope"], {
    paramKeys: ["max_tokens", "temperature", "top_p"],
    messageFormat: "text",
    capabilities: { webSearch: true, imageRead: false },
  }),
  ...defineBindings(["qwen3.7-plus", "glm-5.2"], ["DashScope"], {
    paramKeys: ["max_tokens", "temperature", "top_p"],
    messageFormat: "parts",
    capabilities: { webSearch: true, imageRead: true },
  }),
];

export const chatCatalogModelIds = [...new Set(chatModelBindings.map((binding) => binding.model))];

export function findChatModelBindings(model = ""): ChatModelBinding[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return chatModelBindings.filter((binding) => binding.model.toLowerCase() === targetModel);
}

/** Exact lookup. A requested provider never falls back to another provider. */
export function findChatModelBinding(model = "", provider?: ChatModelProvider | null): ChatModelBinding | null {
  const bindings = findChatModelBindings(model);
  if (!bindings.length) return null;
  if (!provider) return bindings[0] || null;
  return bindings.find((binding) => binding.provider === provider) || null;
}

/**
 * Resolve user-owned configuration into the single model description consumed
 * by settings and execution. Unknown custom models use conservative capability
 * defaults and the selected provider's adapter; they are never mistaken for a
 * known catalog combination.
 */
export function resolveChatModel(config: ChatModelConfig): ResolvedChatModel | null {
  const provider = chatProviderRegistry[config.provider];
  if (!provider) return null;

  const knownBinding = findChatModelBinding(config.model, config.provider);
  const binding: ChatModelBinding =
    knownBinding ||
    {
      key: `${config.provider}:${config.model || "custom"}`,
      model: config.model,
      provider: config.provider,
      adapterId: provider.adapterId,
      paramKeys: [],
      messageFormat: "text",
      capabilities: { ...defaultModelCapabilities },
    };

  return {
    config: {
      ...config,
      baseURL: config.baseURL || provider.defaultBaseURL || "",
    },
    provider,
    binding,
    knownModel: Boolean(knownBinding),
  };
}

export const defaultModelCapabilities: ChatModelCapabilities = {
  imageRead: false,
  webSearch: false,
};

export const chatDisplayedCapabilityKeys: (keyof ChatModelCapabilities)[] = ["webSearch", "imageRead"];
