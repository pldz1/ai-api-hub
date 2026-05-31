import type { ModelParamDef, ChatModelEditorState, ChatModelCapabilities } from "@/types";

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
  family: string;
  messageFormat: "text" | "parts";
  chatParamKeys: string[];
};

export const chatModelCatalog: ChatModelCatalogItem[] = [
  {
    name: "gpt-5.5",
    family: "openai",
    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    name: "gpt-5.4",
    family: "openai",
    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    name: "gpt-4.1",
    family: "openai",
    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  },
  {
    name: "gpt-4o",
    family: "openai",
    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  },
  {
    name: "deepseek-v4-flash",
    family: "deepseek",
    messageFormat: "text",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
  },
  {
    name: "deepseek-v4-pro",
    family: "deepseek",
    messageFormat: "text",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
  },
  {
    name: "qwen3.7-max-2026-05-17",
    family: "qwen",
    messageFormat: "text",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
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
