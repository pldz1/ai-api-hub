import store from "@/store";
import { tr } from "@/i18n";
import { createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import { chatRepository } from "@/persistence";
import { dsAlert, getUuid } from "@/utils";
import { removeChatSessionRunner } from "./runtime/session-runner";
import type { ChatMessageAttachment, ChatModelConfig, ChatModelSettings, ChatPromptMessage, ConversationModelSnapshot, PersistedChatSettings } from "@/types";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createChatSettingsPayload(
  modelSnapshot: ConversationModelSnapshot | null,
  settings: Partial<ChatModelSettings> | null | undefined,
  fallbackModel: ChatModelConfig | null = null,
): PersistedChatSettings {
  const fallback = fallbackModel || store.state.curChatModel || store.state.models.chat?.[0] || null;
  const activeSnapshot = modelSnapshot || createConversationModelSnapshot(fallback);
  const model = getModelFromSnapshot(activeSnapshot) || fallback;
  return {
    modelSnapshot: activeSnapshot,
    settings: mergeChatSettingsWithModel(model, settings || {}),
  };
}

/** Pack one user input into the canonical chat message shape. */
export function packUserMsg(imageUrls: string[], text: string, allowImages = true, attachments: ChatMessageAttachment[] = []): ChatPromptMessage {
  const message: ChatPromptMessage = { role: "user", content: [{ type: "text", text }] };
  if (attachments.length) message.attachments = attachments.map((attachment) => ({ ...attachment }));
  if (allowImages) {
    imageUrls.forEach((url) => message.content.push({ type: "image_url", image_url: { url, detail: "low" } }));
  }
  return message;
}

export async function resetCurrentChatDraft(): Promise<void> {
  store.commit("setCurChatModelSettings", mergeChatSettingsWithModel(store.state.curChatModel, {}));
  store.commit("setCurChatId", "");
}

export async function getChatList(): Promise<boolean> {
  try {
    store.commit("resetChatList", chatRepository.list());
    return true;
  } catch (error) {
    store.commit("resetChatList", []);
    console.error("Failed to load chat list:", error);
    dsAlert({ type: "error", message: tr("toast.chatListFetchFailed", { error: errorText(error) }) });
    return false;
  }
}

export async function getChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;
  try {
    const stored = chatRepository.getSettings(cid);
    const fallbackModel = store.state.curChatModel || store.state.models.chat?.[0] || null;
    const modelSnapshot = stored?.modelSnapshot || createConversationModelSnapshot(fallbackModel);
    const model = getModelFromSnapshot(modelSnapshot) || fallbackModel;
    store.commit("hydrateChatSession", {
      cid,
      conversation: modelSnapshot ? { id: cid, title: store.state.chatList.find((item) => item.cid === cid)?.cname || "", modelSnapshot } : null,
      settings: mergeChatSettingsWithModel(model, stored?.settings || {}),
    });
    return true;
  } catch (error) {
    console.error("Failed to load chat settings:", error);
    dsAlert({ type: "error", message: tr("toast.chatSettingsFetchFailed", { error: errorText(error) }) });
    return false;
  }
}

export async function setChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;
  try {
    chatRepository.saveSettings(
      cid,
      createChatSettingsPayload(
        store.state.chatConversationsById?.[cid]?.modelSnapshot || store.state.curConversation?.modelSnapshot || null,
        store.state.chatSettingsById?.[cid] || store.state.curChatModelSettings,
        store.state.curChatModel,
      ),
    );
    return true;
  } catch (error) {
    console.error("Failed to save chat settings:", error);
    dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: errorText(error) }) });
    return false;
  }
}

export async function addChat(name: string | null = null, model: ChatModelConfig | null = null): Promise<boolean> {
  const chatId = getUuid("chat");
  const chatName = name || getUuid("chat");
  const modelSnapshot = createConversationModelSnapshot(
    model || store.state.curConversation?.modelSnapshot?.modelConfig || store.state.curChatModel || store.state.models.chat?.[0] || null,
  );
  if (!modelSnapshot) return false;

  const conversation = { id: chatId, title: chatName, modelSnapshot };
  const modelForSettings = getModelFromSnapshot(modelSnapshot) || store.state.curChatModel;
  const settings = store.state.curChatId ? mergeChatSettingsWithModel(modelForSettings, store.state.curChatModelSettings) : store.state.curChatModelSettings;

  try {
    await chatRepository.create(chatId, chatName, createChatSettingsPayload(modelSnapshot, settings, model));
    store.commit("resetChatList", [...store.state.chatList, { cid: chatId, cname: chatName }]);
    store.commit("hydrateChatSession", {
      cid: chatId,
      conversation,
      settings,
      messages: [],
      loaded: true,
      inputCapabilities: { ...store.state.inputCapabilities },
    });
    store.commit("setCurChatId", chatId);
    return true;
  } catch (error) {
    console.error("Failed to create chat:", error);
    dsAlert({ type: "error", message: tr("toast.chatAddException", { error: errorText(error) }) });
    return false;
  }
}

export async function deleteChat(cid: string): Promise<boolean> {
  try {
    await chatRepository.delete(cid);
    store.commit(
      "resetChatList",
      store.state.chatList.filter((chat) => chat.cid !== cid),
    );
    store.commit("removeChatSession", cid);
    if (cid === store.state.curChatId) store.commit("setCurChatId", "");
    removeChatSessionRunner(cid);
    return true;
  } catch (error) {
    console.error("Failed to delete chat:", error);
    dsAlert({ type: "error", message: tr("toast.chatDeleteFailed", { error: errorText(error) }) });
    return false;
  }
}

export async function renameChat(cid: string, cname: string): Promise<boolean> {
  try {
    chatRepository.rename(cid, cname);
    store.commit(
      "resetChatList",
      store.state.chatList.map((chat) => (chat.cid === cid ? { ...chat, cname } : chat)),
    );
    const conversation = store.state.chatConversationsById?.[cid];
    if (conversation) store.commit("hydrateChatSession", { cid, conversation: { ...conversation, title: cname } });
    return true;
  } catch (error) {
    console.error("Failed to rename chat:", error);
    dsAlert({ type: "error", message: tr("toast.chatRenameFailed", { error: errorText(error) }) });
    return false;
  }
}

export async function getAllMessage(cid: string = store.state.curChatId): Promise<ChatPromptMessage[]> {
  if (!cid) return [];
  try {
    const messages = await chatRepository.getMessages(cid);
    store.commit("replaceChatMessages", { cid, messages });
    return messages;
  } catch (error) {
    console.error("Failed to load chat messages:", error);
    dsAlert({ type: "error", message: tr("toast.chatMessagesFetchFailed", { error: errorText(error) }) });
    return [];
  }
}

export async function addMessage(cid: string = store.state.curChatId, mid: string, message: ChatPromptMessage): Promise<boolean> {
  if (!cid) return false;
  try {
    await chatRepository.saveMessage(cid, { ...message, mid });
    return true;
  } catch (error) {
    console.error("Failed to save chat message:", error);
    dsAlert({ type: "error", message: tr("toast.chatMessageAddFailed", { error: errorText(error) }) });
    return false;
  }
}

/** Replace the causal history of a Chat conversation as one persistence operation. */
export async function replaceChatHistory(cid: string, messages: ChatPromptMessage[]): Promise<boolean> {
  if (!cid) return false;
  try {
    await chatRepository.saveMessages(cid, messages);
    store.commit("replaceChatMessages", { cid, messages });
    return true;
  } catch (error) {
    console.error("Failed to replace chat history:", error);
    dsAlert({ type: "error", message: tr("toast.chatMessageAddFailed", { error: errorText(error) }) });
    return false;
  }
}

/**
 * Edit one user input and discard everything causally downstream from it.
 * Images and file attachments on the edited input are intentionally preserved.
 */
export async function editChatUserMessage(cid: string, mid: string, text: string): Promise<ChatPromptMessage | null> {
  const messages = store.state.chatMessagesById?.[cid] || [];
  const index = messages.findIndex((message) => message.mid === mid && message.role === "user");
  if (index < 0) return null;

  const source = messages[index];
  const content = source.content.map((part) => (part.type === "text" ? { ...part, text } : part));
  if (!content.some((part) => part.type === "text")) content.unshift({ type: "text", text });
  const edited: ChatPromptMessage = { ...source, content };
  const nextMessages = [...messages.slice(0, index), edited];
  return (await replaceChatHistory(cid, nextMessages)) ? edited : null;
}

/** Discard the selected message and every message after it. */
export async function truncateChatFromMessage(cid: string, mid: string): Promise<boolean> {
  const messages = store.state.chatMessagesById?.[cid] || [];
  const index = messages.findIndex((message) => message.mid === mid);
  if (index < 0) return false;
  return replaceChatHistory(cid, messages.slice(0, index));
}

export async function deleteMessage(cid: string = store.state.curChatId, mid: string): Promise<boolean> {
  if (!cid) return false;
  try {
    await chatRepository.deleteMessage(cid, mid);
    return true;
  } catch (error) {
    console.error("Failed to delete chat message:", error);
    dsAlert({ type: "error", message: tr("toast.chatMessageDeleteFailed", { error: errorText(error) }) });
    return false;
  }
}
