import store from "@/store";
import { createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import { apiRequest } from "../../transport/request";
import { dsAlert, isValidChatInfoArray, getUuid, generateRandomCname } from "@/utils";
import { tr } from "@/i18n";
import type { ChatListItem, ChatPromptMessage, StoredChatMessage } from "@/services/types";
import type { ChatModelConfig, ChatModelSettings, ConversationModelSnapshot } from "@/types/model";

/**
 * Chat conversation service.
 *
 * Owns persisted chat metadata, message history, and per-conversation model
 * settings. Provider requests are handled by `chat-proxy.ts`.
 */

export const getChatListAPI = () => apiRequest<ChatListItem[]>("post", "/_api/chat/getChatList", {});
export const getChatSettingsAPI = (cid: string) => apiRequest<string>("post", "/_api/chat/getChatSettings", { cid });
export const setChatSettingsAPI = (cid: string, data: string) => apiRequest<null>("post", "/_api/chat/setChatSettings", { cid, data });
export const addChatAPI = (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/addChat", { cid, cname });
export const deleteChatAPI = (cid: string) => apiRequest<null>("post", "/_api/chat/deleteChat", { cid });
export const renameChatAPI = (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/renameChat", { cid, cname });
export const getAllMessageAPI = (cid: string) => apiRequest<StoredChatMessage[]>("post", "/_api/chat/getAllMessage", { cid });
export const addMessageAPI = (cid: string, mid: string, message: string) => apiRequest<null>("post", "/_api/chat/addMessage", { cid, mid, message });
export const deleteMessageAPI = (cid: string, mid: string) => apiRequest<null>("post", "/_api/chat/deleteMessage", { cid, mid });

interface ChatSettingsPayload {
  modelSnapshot: ConversationModelSnapshot | null;
  settings: Partial<ChatModelSettings>;
}

function parseChatSettingsPayload(rawData: string | ChatSettingsPayload | Partial<ChatModelSettings> | null): ChatSettingsPayload {
  if (!rawData) return { modelSnapshot: null, settings: {} };
  const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (parsed && typeof parsed === "object" && "settings" in parsed) {
    return {
      modelSnapshot: parsed.modelSnapshot || null,
      settings: parsed.settings || {},
    };
  }
  return { modelSnapshot: null, settings: parsed || {} };
}

function buildChatSettingsPayload(cid: string): { version: 2; modelSnapshot: ConversationModelSnapshot | null; settings: ChatModelSettings } {
  const conversation = store.state.chatConversationsById?.[cid] || store.state.curConversation;
  const settings = store.state.chatSettingsById?.[cid] || store.state.curChatModelSettings;

  return {
    version: 2,
    modelSnapshot: conversation?.modelSnapshot || createConversationModelSnapshot(store.state.curChatModel),
    settings,
  };
}

export async function getChatList(): Promise<boolean> {
  const res = await getChatListAPI();
  if (!res.flag) {
    await store.dispatch("resetChatList", []);
    dsAlert({ type: "error", message: tr("toast.chatListFetchFailed", { error: res.log }) });
    return false;
  }

  const isValidData = isValidChatInfoArray(res.data);
  if (!isValidData) {
    await store.dispatch("resetChatList", []);
    dsAlert({ type: "error", message: tr("toast.chatListInvalid") });
    return false;
  }

  await store.dispatch("resetChatList", res.data);
  return true;
}

export async function getChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;

  const res = await getChatSettingsAPI(cid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatSettingsFetchFailed", { error: res.log }) });
    return false;
  }

  const payload = parseChatSettingsPayload(res.data);
  const fallbackModel = store.state.models.chat?.[0] || store.state.curChatModel;
  const modelSnapshot = payload.modelSnapshot || createConversationModelSnapshot(fallbackModel);
  const conversation = modelSnapshot
    ? {
        id: cid,
        title: store.state.chatList.find((item) => item.cid === cid)?.cname || "",
        modelSnapshot,
      }
    : null;
  const model = getModelFromSnapshot(modelSnapshot) || store.state.curChatModel;
  const validData = mergeChatSettingsWithModel(model, payload.settings || {});

  await store.dispatch("hydrateChatSession", {
    cid,
    conversation,
    settings: validData,
  });

  if (cid === store.state.curChatId) {
    await store.dispatch("setCurConversation", conversation);
    await store.dispatch("setCurChatModelSettings", validData);
  }

  return true;
}

export async function setChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;

  const data = JSON.stringify(buildChatSettingsPayload(cid));
  const res = await setChatSettingsAPI(cid, data);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: res.log }) });
    return false;
  }

  return true;
}

/**
 * Add a new conversation and update the local state and server data.
 */
export async function addChat(name: string | null = null, model: ChatModelConfig | null = null): Promise<boolean> {
  const chatId = getUuid("chat");
  const chatName = name || generateRandomCname();
  const modelSnapshot = createConversationModelSnapshot(
    model || store.state.curConversation?.modelSnapshot?.modelConfig || store.state.curChatModel || store.state.models.chat?.[0],
  );
  const conversation = modelSnapshot
    ? {
        id: chatId,
        title: chatName,
        modelSnapshot,
      }
    : null;
  const settings = store.state.curChatId
    ? mergeChatSettingsWithModel(getModelFromSnapshot(modelSnapshot) || store.state.curChatModel, store.state.curChatModelSettings)
    : store.state.curChatModelSettings;

  const chatList = [...store.state.chatList, { cid: chatId, cname: chatName }];
  const updateLocalChatState = async () => {
    await store.dispatch("resetChatList", chatList);
    await store.dispatch("hydrateChatSession", {
      cid: chatId,
      conversation,
      settings,
      messages: [],
      loaded: true,
    });
    await store.dispatch("setCurChatId", chatId);
    await store.dispatch("setCurConversation", conversation);
    await store.dispatch("setCurChatModelSettings", settings);
  };

  try {
    const res = await addChatAPI(chatId, chatName);
    await updateLocalChatState();

    if (!res.flag) {
      dsAlert({ type: "error", message: tr("toast.chatAddFailed", { name: chatName, error: res.log }) });
      return false;
    }

    await setChatSettings(chatId);
    return true;
  } catch (error) {
    dsAlert({ type: "error", message: tr("toast.chatAddException", { error: error.message || error }) });
    await updateLocalChatState();
    return false;
  }
}

/**
 * Delete a conversation and sync local state with storage.
 */
export async function deleteChat(cid: string): Promise<boolean> {
  const chatList = [...store.state.chatList];
  const index = chatList.findIndex((chat) => chat.cid === cid);
  if (index >= 0) chatList.splice(index, 1);

  await store.dispatch("resetChatList", chatList);
  await store.dispatch("removeChatSession", cid);

  const res = await deleteChatAPI(cid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatDeleteFailed", { error: res.log }) });
    return false;
  }

  return true;
}

/**
 * Rename a conversation.
 */
export async function renameChat(cid: string, cname: string): Promise<boolean> {
  const chatList = [...store.state.chatList];
  const index = chatList.findIndex((chat) => chat.cid === cid);
  if (index >= 0) chatList[index].cname = cname;
  await store.dispatch("resetChatList", chatList);

  const conversation = store.state.chatConversationsById?.[cid];
  if (conversation) {
    await store.dispatch("hydrateChatSession", {
      cid,
      conversation: {
        ...conversation,
        title: cname,
      },
    });
  }

  const res = await renameChatAPI(cid, cname);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatRenameFailed", { error: res.log }) });
    return false;
  }

  return true;
}

/**
 * Get all messages from the chat conversation.
 */
export async function getAllMessage(
  cid: string = store.state.curChatId,
  callback: ((messages: ChatPromptMessage[]) => void | Promise<void>) | null = null,
): Promise<ChatPromptMessage[]> {
  if (!cid) return [];

  const res = await getAllMessageAPI(cid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessagesFetchFailed", { error: res.log }) });
    return [];
  }

  const messages = res.data.map((data) => {
    const message = JSON.parse(data.message) as ChatPromptMessage;
    return { ...message, mid: data.mid };
  });

  await store.dispatch("replaceChatMessages", { cid, messages });
  await store.dispatch("setChatLoaded", { cid, loaded: true });

  if (callback) {
    for (const message of messages) {
      await callback([message]);
    }
  }

  return messages;
}

/**
 * Add a message to the current conversation.
 */
export async function addMessage(cid: string = store.state.curChatId, mid: string, message: ChatPromptMessage): Promise<boolean> {
  if (!cid) return false;

  const msgStr = JSON.stringify(message);
  const res = await addMessageAPI(cid, mid, msgStr);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessageAddFailed", { error: res.log }) });
    return false;
  }
  return true;
}

/**
 * Delete a message by ID.
 */
export async function deleteMessage(cid: string = store.state.curChatId, mid: string): Promise<boolean> {
  if (!cid) return false;

  const res = await deleteMessageAPI(cid, mid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessageDeleteFailed", { error: res.log }) });
    return false;
  }
  return true;
}
