import store from "@/store";
import { buildChatCompletionParams, findChatModelCatalogItem, getModelFromSnapshot } from "@/models";
import type { ChatRequest, ChatModelConfig, ChatMessageFormat, ChatPromptMessage, PackedChatMessage } from "@/types";
import { packPartMessages, packTextMessages } from "./chat-message";

export function getConversationChatModel(chatId: string = ""): ChatModelConfig | null {
  return (
    getModelFromSnapshot(chatId ? store.state.chatConversationsById?.[chatId]?.modelSnapshot : store.state.curConversation?.modelSnapshot) ||
    store.state.curChatModel ||
    store.state.models.chat?.[0] ||
    null
  );
}

export function createChatRequest(chatId: string = "", model: ChatModelConfig | null = null): ChatRequest {
  const activeModel = model || getConversationChatModel(chatId);
  const settings = chatId ? store.state.chatSettingsById?.[chatId] || store.state.curChatModelSettings : store.state.curChatModelSettings;

  return {
    model: activeModel,
    params: buildChatCompletionParams(activeModel, settings),
  };
}

export function getConversationMessageFormat(model: ChatModelConfig | null = null): ChatMessageFormat {
  const modelInfo = model ? findChatModelCatalogItem(model.model) : null;
  return modelInfo?.messageFormat || "parts";
}

export function getConversationSystemPrompts(chatId: string = ""): ChatPromptMessage[] {
  const settings = chatId ? store.state.chatSettingsById?.[chatId] || store.state.curChatModelSettings : store.state.curChatModelSettings;
  return settings?.prompts || [];
}

export function createChatTurnMessages(
  messages: ChatPromptMessage[],
  systemPrompts: ChatPromptMessage[] = [],
  messageFormat: ChatMessageFormat = "parts",
): PackedChatMessage[] {
  const firstPromptContent = systemPrompts?.[0]?.content?.[0];
  const hasSystemPrompt = firstPromptContent?.type === "text" && Boolean(firstPromptContent.text);
  const combinedMessages = hasSystemPrompt ? [...systemPrompts, ...messages] : messages;

  if (messageFormat === "text") {
    return packTextMessages(combinedMessages);
  }
  return packPartMessages(combinedMessages);
}
