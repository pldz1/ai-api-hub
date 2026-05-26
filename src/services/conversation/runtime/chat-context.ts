import store from "@/store";
import { buildChatCompletionParams, getChatModelInfo, getModelFromSnapshot } from "@/models";
import type { ChatRequestContext } from "@/ai-capability/chat";
import type { ChatModelConfig } from "@/ai-capability/chat/types";

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
  const modelInfo = activeModel ? getChatModelInfo(activeModel.model, activeModel.provider) : null;

  return {
    model: activeModel,
    settings,
    msgTypeVersion: modelInfo?.msgTypeVersion || "v2",
    buildParams: buildChatCompletionParams,
  };
}
