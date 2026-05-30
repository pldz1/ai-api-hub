import type { ModelParamDef, ChatModelEditorState, ChatModelCapabilities, ChatModelCapabilityProfile } from "@/types";

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
  messageFormat: "text" | "parts";
  chatParamKeys: string[];
  capabilities: ChatModelCapabilities;
  capabilityProfile: ChatModelCapabilityProfile;
};

export const baseCapabilityProfile: ChatModelCapabilityProfile = {
  modalities: {
    textInput: true,
    textOutput: true,
    imageInput: false,
    imageOutput: false,
    audioInput: false,
    audioOutput: false,
    videoInput: false,
    videoOutput: false,
  },
  features: {
    streaming: true,
    structuredOutputs: false,
    fineTuning: false,
    reasoning: false,
  },
  tools: {
    webSearch: false,
    imageGeneration: false,
    fileSearch: false,
    codeInterpreter: false,
    hostedShell: false,
    skills: false,
    mcp: false,
    applyPatch: false,
    computerUse: false,
    toolSearch: false,
    functionCalling: false,
  },
};

export const chatModelCatalog: ChatModelCatalogItem[] = [
  {
    name: "gpt-5.5",

    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
    capabilities: { webSearch: true, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, reasoning: true, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, webSearch: true, functionCalling: true },
    },
  },
  {
    name: "gpt-5.4",

    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
    capabilities: { webSearch: true, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, reasoning: true, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, webSearch: true, functionCalling: true },
    },
  },
  {
    name: "gpt-4.1",
    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    capabilities: { webSearch: true, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, webSearch: true, functionCalling: true },
    },
  },
  {
    name: "gpt-4o",

    messageFormat: "parts",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    capabilities: { webSearch: true, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, webSearch: true, functionCalling: true },
    },
  },
  {
    name: "deepseek-v4-flash",

    messageFormat: "text",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    capabilities: { webSearch: false, imageRead: false },
    capabilityProfile: {
      ...baseCapabilityProfile,
      features: { ...baseCapabilityProfile.features, reasoning: true },
    },
  },
  {
    name: "deepseek-v4-pro",

    messageFormat: "text",
    chatParamKeys: ["thinking", "reasoning_effort", "temperature", "top_p"],
    capabilities: { webSearch: false, imageRead: false },
    capabilityProfile: {
      ...baseCapabilityProfile,
      features: { ...baseCapabilityProfile.features, reasoning: true },
    },
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
