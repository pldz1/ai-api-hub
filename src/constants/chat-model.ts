import type {
  ChatModelParamDef,
  ChatModelCapabilities,
  ChatModelCapabilityProfile,
  ChatModelEditorState,
  ChatModelOption,
  ChatModelProvider,
  ChatSelectOption,
} from "@/types";

type LooseParamDef = Partial<ChatModelParamDef> & { key?: string };

export const chatParamPresetList: LooseParamDef[] = [
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
    key: "verbosity",
    label: "verbosity",
    type: "string",
    descriptionKey: "chat.verbosityTip",
    defaultValue: "medium",
    placeholder: "low / medium / high",
  },
];

export type ChatModelCatalogItem = ChatModelOption & {
  provider?: ChatModelProvider;
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
    value: "gpt-5.5",
    name: "gpt-5.5",
    isReasonModel: true,
    msgTypeVersion: "v2",
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
    value: "gpt-5.4",
    name: "gpt-5.4",
    isReasonModel: true,
    msgTypeVersion: "v2",
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
    value: "gpt-4.1",
    name: "gpt-4.1",
    isReasonModel: false,
    msgTypeVersion: "v2",
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
    value: "gpt-4o",
    name: "gpt-4o",
    isReasonModel: false,
    msgTypeVersion: "v2",
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
    value: "gpt-4o-mini",
    name: "gpt-4o-mini",
    isReasonModel: false,
    msgTypeVersion: "v2",
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
    capabilities: { webSearch: false, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, functionCalling: true },
    },
  },
  {
    value: "claude-opus-4-7",
    name: "claude-opus-4-7",
    isReasonModel: false,
    msgTypeVersion: "v2",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
    capabilities: { webSearch: false, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, functionCalling: true, computerUse: true },
    },
  },
  {
    value: "claude-sonnet-4-6",
    name: "claude-sonnet-4-6",
    isReasonModel: false,
    msgTypeVersion: "v2",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
    capabilities: { webSearch: false, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, functionCalling: true, computerUse: true },
    },
  },
  {
    value: "claude-haiku-4-5",
    name: "claude-haiku-4-5",
    isReasonModel: false,
    msgTypeVersion: "v2",
    chatParamKeys: ["max_tokens", "temperature", "top_p"],
    capabilities: { webSearch: false, imageRead: true },
    capabilityProfile: {
      ...baseCapabilityProfile,
      modalities: { ...baseCapabilityProfile.modalities, imageInput: true },
      features: { ...baseCapabilityProfile.features, structuredOutputs: true },
      tools: { ...baseCapabilityProfile.tools, functionCalling: true },
    },
  },
];

export const chatModelTypeList: ChatModelOption[] = chatModelCatalog;

export const providerList: ChatSelectOption<ChatModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
  { value: "Anthropic", name: "Anthropic Direct" },
  { value: "Azure AI Foundry", name: "Azure AI Foundry" },
];

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
  enabledCapabilitiesMode: "inherit",
  enabledCapabilities: {},
};
