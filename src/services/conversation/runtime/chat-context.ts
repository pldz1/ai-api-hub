import store from "@/store";
import { buildChatCompletionParams, findChatModelCatalogItem, getModelFromSnapshot } from "@/models";
import type { ChatRequestContext, ChatModelConfig } from "@/types";

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
  const modelInfo = activeModel ? findChatModelCatalogItem(activeModel.model) : null;

  return {
    model: activeModel,
    settings,
    messageFormat: modelInfo?.messageFormat || "parts",
    buildParams: buildChatCompletionParams,
  };
}
