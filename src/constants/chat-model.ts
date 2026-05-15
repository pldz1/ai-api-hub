import type { ChatModelCapabilities, ChatModelOption, ModelProvider, SelectOption } from "@/types/model";
import { chatModelCatalog } from "./model-list";

export const providerList: SelectOption<ModelProvider>[] = [
  { value: "OpenAI", name: "OpenAI" },
  { value: "Azure OpenAI", name: "Azure OpenAI" },
  { value: "Anthropic", name: "Anthropic Direct" },
  { value: "Azure AI Foundry", name: "Azure AI Foundry" },
];

export const defaultModelCapabilities: ChatModelCapabilities = {
  imageRead: false,
  webSearch: false,
  reasoning: false,
  functionCalling: false,
};

export const chatTurnCapabilityKeys: (keyof ChatModelCapabilities)[] = ["webSearch", "reasoning"];
export const chatDisplayedCapabilityKeys: (keyof ChatModelCapabilities)[] = ["reasoning", "webSearch", "imageRead"];

export const chatModelTypeList: ChatModelOption[] = chatModelCatalog;
