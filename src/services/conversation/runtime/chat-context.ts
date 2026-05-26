import store from "@/store";
import { buildChatCompletionParams, getModelFromSnapshot } from "@/models";
import { chatModelCatalog } from "@/constants";
import type { ChatRequestContext, ChatModelConfig } from "@/ai-capability/chat";

export function getConversationChatModel(chatId: string = ""): ChatModelConfig | null {
  return (
    getModelFromSnapshot(chatId ? store.state.chatConversationsById?.[chatId]?.modelSnapshot : store.state.curConversation?.modelSnapshot) ||
    store.state.curChatModel ||
    store.state.models.chat?.[0] ||
    null
  );
}

export function createChatRequestContext(chatId: string = "", model: ChatModelConfig | null = null): ChatRequestContext {
  const activeModel = model || getConversationChatModel(chatId);
  const settings = chatId ? store.state.chatSettingsById?.[chatId] || store.state.curChatModelSettings : store.state.curChatModelSettings;
  const modelInfo = activeModel
    ? chatModelCatalog.find((item) => item.value === activeModel.model && (!activeModel.provider || item.provider === activeModel.provider))
    : null;

  return {
    model: activeModel,
    settings,
    messageFormat: modelInfo?.messageFormat || "parts",
    buildParams: buildChatCompletionParams,
  };
}
