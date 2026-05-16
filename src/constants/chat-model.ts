import type { ChatModelCapabilities, ChatModelOption, ChatModelProvider, SelectOption } from "@/types/chat";
import { chatModelCatalog } from "./model-list";

export const providerList: SelectOption<ChatModelProvider>[] = [
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
