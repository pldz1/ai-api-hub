import type { ChatModelCapabilities, ChatModelProvider } from "./types";

export interface ChatModelParamDef {
  key: string;
  label: string;
  type: any;
  descriptionKey: string;
  placeholder: string;
  defaultValue: any;
  min: number;
  max: number;
  step: number;
}

export const chatParamList: Partial<ChatModelParamDef>[] = [
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number",
    defaultValue: 2000,
    min: 0,
    max: 12800,
    step: 1,
  },
  {
    key: "max_output_tokens",
    label: "max_output_tokens",
    type: "number",
    defaultValue: 12800,
    min: 0,
    max: 128000,
    step: 1,
  },
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "top_p",
    label: "top_p",
    type: "number",
    defaultValue: 0.95,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "frequency_penalty",
    label: "frequency_penalty",
    type: "number",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "presence_penalty",
    label: "presence_penalty",
    type: "number",
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.01,
  },
  {
    key: "reasoning_effort",
    label: "reasoning_effort",
    type: "string",
    defaultValue: "medium",
    placeholder: "none / low / medium / high / xhigh",
  },
  {
    key: "thinking",
    label: "thinking",
    type: "object",
    defaultValue: { type: "enabled" },
    placeholder: '{"type":"enabled"}',
  },
  {
    key: "verbosity",
    label: "verbosity",
    type: "string",
    defaultValue: "medium",
    placeholder: "low / medium / high",
  },
];

export type ChatModelCatalogItem = {
  name: string;
  chatParamKeys: string[];
  messageFormat: "text" | "parts";
  providers: {
    provider: ChatModelProvider;
    capabilities: ChatModelCapabilities;
  }[];
};

export const chatModelCatalog: ChatModelCatalogItem[] = [
  {
    name: "gpt-5.5",
    chatParamKeys: ["max_output_tokens", "reasoning_effort", "verbosity"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-5.4",
    chatParamKeys: ["max_output_tokens", "reasoning_effort", "verbosity"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-4.1",
    chatParamKeys: ["max_output_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-4o",
    chatParamKeys: ["max_output_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
    ],
  },
  {
    name: "deepseek-v4-flash",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    messageFormat: "text",
    providers: [
      {
        provider: "DeepSeek",
        capabilities: { webSearch: true, imageRead: false },
      },
      {
        provider: "DashScope",
        capabilities: { webSearch: true, imageRead: false },
      },
    ],
  },
  {
    name: "deepseek-v4-pro",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    messageFormat: "text",
    providers: [
      {
        provider: "DeepSeek",
        capabilities: { webSearch: true, imageRead: false },
      },
      {
        provider: "DashScope",
        capabilities: { webSearch: true, imageRead: false },
      },
    ],
  },
  {
    name: "qwen3.7-max-2026-05-17",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
    messageFormat: "text",
    providers: [
      {
        provider: "DashScope",
        capabilities: { webSearch: true, imageRead: false },
      },
    ],
  },
  {
    name: "qwen3.7-plus",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
    messageFormat: "parts",
    providers: [
      {
        provider: "DashScope",
        capabilities: { webSearch: true, imageRead: true },
      },
    ],
  },
];

export const chatModelTypeList: ChatModelCatalogItem[] = chatModelCatalog;

export function findChatModelCatalogItems(model = ""): ChatModelCatalogItem[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return chatModelCatalog.filter((item) => item.name.toLowerCase() === targetModel);
}

export function findChatModelCatalogItem(model = "", provider?: ChatModelProvider | null): ChatModelCatalogItem | null {
  const catalogItems = findChatModelCatalogItems(model);
  if (!catalogItems.length) return null;
  if (!provider) return catalogItems[0] || null;
  return catalogItems.find((item) => item.providers.some((itemProvider) => itemProvider.provider === provider)) || catalogItems[0] || null;
}

export function findChatModelCatalogProvider(model = "", provider?: ChatModelProvider | null): ChatModelCatalogItem["providers"][number] | null {
  const catalogItem = findChatModelCatalogItem(model, provider);
  if (!catalogItem) return null;
  if (!provider) return catalogItem.providers[0] || null;
  return catalogItem.providers.find((itemProvider) => itemProvider.provider === provider) || catalogItem.providers[0] || null;
}

export const defaultModelCapabilities: ChatModelCapabilities = {
  imageRead: false,
  webSearch: false,
};

export const chatDisplayedCapabilityKeys: (keyof ChatModelCapabilities)[] = ["webSearch", "imageRead"];
