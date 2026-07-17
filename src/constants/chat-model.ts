import type { ChatModelEditorState } from "@/types";

export const defaultChatModelEditorState: ChatModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  apiKey: "",
  model: "",
};

export { chatProviderKeys, chatModelBindings, chatCatalogModelIds, defaultModelCapabilities, chatDisplayedCapabilityKeys } from "@/ai-capability/chat";
