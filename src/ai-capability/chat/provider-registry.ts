export type ChatProviderRoute = "openai" | "azure-openai" | "anthropic" | "deepseek";
export type ChatProviderConnectionField = "baseURL" | "endpoint" | "deployment" | "apiVersion";

export interface ChatProviderDefinition {
  name: string;
  route: ChatProviderRoute;
  connectionFields: readonly ChatProviderConnectionField[];
  defaultBaseURL?: string;
  modelFamily: string;
  modelFamilyLabel?: string;
  modelFamilyLabelKey?: string;
  modelPatterns?: readonly RegExp[];
}

const chatProviderRegistryConfig = {
  OpenAI: {
    name: "OpenAI",
    route: "openai",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.openai.com/v1",
    modelFamily: "openai",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.openai",
    modelPatterns: [/^(gpt-|o\d)/],
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    route: "azure-openai",
    connectionFields: ["endpoint", "deployment", "apiVersion"],
    modelFamily: "openai",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.openai",
    modelPatterns: [/^(gpt-|o\d)/],
  },
  Anthropic: {
    name: "Anthropic Direct",
    route: "anthropic",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.anthropic.com",
    modelFamily: "claude",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.claude",
    modelPatterns: [/^claude-/],
  },
  "Azure AI Foundry": {
    name: "Azure AI Foundry",
    route: "anthropic",
    connectionFields: ["baseURL"],
    modelFamily: "claude",
    modelFamilyLabelKey: "user.modelCard.suggestionGroups.claude",
    modelPatterns: [/^claude-/],
  },
  DeepSeek: {
    name: "DeepSeek",
    route: "deepseek",
    connectionFields: ["baseURL"],
    defaultBaseURL: "https://api.deepseek.com",
    modelFamily: "deepseek",
    modelFamilyLabel: "DeepSeek",
    modelPatterns: [/^deepseek-/],
  },
} as const satisfies Record<string, ChatProviderDefinition>;

export type ChatProviderKey = keyof typeof chatProviderRegistryConfig;

export const chatProviderRegistry: Record<ChatProviderKey, ChatProviderDefinition> = chatProviderRegistryConfig;

export const chatProviderKeys = Object.keys(chatProviderRegistry) as ChatProviderKey[];

export function isChatModelProvider(value: unknown): value is ChatProviderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(chatProviderRegistry, value);
}

export function getChatProviderDefinition(provider: unknown): ChatProviderDefinition | null {
  return isChatModelProvider(provider) ? chatProviderRegistry[provider] : null;
}

export function getChatProviderConnectionFields(provider: unknown): readonly ChatProviderConnectionField[] {
  return getChatProviderDefinition(provider)?.connectionFields || chatProviderRegistry.OpenAI.connectionFields;
}

export function chatProviderUsesField(provider: unknown, field: ChatProviderConnectionField): boolean {
  return getChatProviderConnectionFields(provider).includes(field);
}

export function getChatProviderDefaultBaseURL(provider: unknown): string {
  return getChatProviderDefinition(provider)?.defaultBaseURL || "";
}

export function getKnownChatProviderDefaultBaseURLs(): string[] {
  return chatProviderKeys.map((provider) => chatProviderRegistry[provider].defaultBaseURL || "").filter(Boolean);
}

export function getChatProviderModelFamily(model = ""): string {
  const normalizedModel = model.trim().toLowerCase();
  const matchedProvider = chatProviderKeys.find((provider) =>
    (chatProviderRegistry[provider].modelPatterns || []).some((pattern) => pattern.test(normalizedModel)),
  );
  return matchedProvider ? chatProviderRegistry[matchedProvider].modelFamily : "custom";
}

export function getChatProvidersForModel(model = ""): ChatProviderKey[] {
  const family = getChatProviderModelFamily(model);
  if (family === "custom") return chatProviderKeys;
  return chatProviderKeys.filter((provider) => chatProviderRegistry[provider].modelFamily === family);
}

export function getChatProviderModelFamilies(): { key: string; label?: string; labelKey?: string }[] {
  const seen = new Set<string>();
  const families: { key: string; label?: string; labelKey?: string }[] = [];

  chatProviderKeys.forEach((provider) => {
    const definition = chatProviderRegistry[provider];
    if (seen.has(definition.modelFamily)) return;
    seen.add(definition.modelFamily);
    families.push({
      key: definition.modelFamily,
      label: definition.modelFamilyLabel,
      labelKey: definition.modelFamilyLabelKey,
    });
  });

  return families;
}
