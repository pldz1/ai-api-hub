import type { ModelParamDef, ChatModelEditorState, ChatModelCapabilities, ChatModelProvider } from "@/types";

export { chatProviderKeys } from "@/ai-capability/chat";

export const chatParamPresetList: Partial<ModelParamDef>[] = [
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
    key: "max_completion_tokens",
    label: "max_completion_tokens",
    type: "number",
    descriptionKey: "chat.maxCompletionTokensTip",
    defaultValue: 2000,
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
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: false, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-5.4",
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: false, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-4.1",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: false, imageRead: true },
      },
    ],
  },
  {
    name: "gpt-4o",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    messageFormat: "parts",
    providers: [
      {
        provider: "OpenAI",
        capabilities: { webSearch: true, imageRead: true },
      },
      {
        provider: "Azure OpenAI",
        capabilities: { webSearch: false, imageRead: true },
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
        capabilities: { webSearch: false, imageRead: false },
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
        capabilities: { webSearch: false, imageRead: false },
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
];

export const chatModelTypeList: ChatModelCatalogItem[] = chatModelCatalog;

export const defaultModelCapabilities: ChatModelCapabilities = {
  imageRead: false,
  webSearch: false,
};

export const chatDisplayedCapabilityKeys: (keyof ChatModelCapabilities)[] = ["webSearch", "imageRead"];

export const defaultChatModelEditorState: ChatModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  model: "",
  deployment: "",
  apiVersion: "",
};
