import store from "@/store";
import { buildDefaultChatSettings, createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import { apiRequest } from "../app";
import { dsAlert, isValidChatInfoArray, getUuid, generateRandomCname } from "@/utils";
import { tr } from "@/i18n";
import type { ChatListItem, StoredChatMessage } from "@/services/types";
import type { ChatPromptMessage } from "@/services/chat/types";
import type { ChatModelConfig, ChatModelSettings, ConversationModelSnapshot, ExportedChatSessionSettings, PersistedChatSettingsPayload } from "@/types";
import { removeChatSessionRunner } from "./session-runner";

/**
 * Chat conversation service.
 *
 * Owns persisted chat metadata, message history, and per-conversation model
 * settings. Provider requests are handled by `chat-proxy.ts`.
 */

const getChatListAPI = () => apiRequest<ChatListItem[]>("post", "/_api/chat/getChatList", {});
const getChatSettingsAPI = (cid: string) => apiRequest<string>("post", "/_api/chat/getChatSettings", { cid });
const setChatSettingsAPI = (cid: string, data: string) => apiRequest<null>("post", "/_api/chat/setChatSettings", { cid, data });
const addChatAPI = (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/addChat", { cid, cname });
const deleteChatAPI = (cid: string) => apiRequest<null>("post", "/_api/chat/deleteChat", { cid });
const renameChatAPI = (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/renameChat", { cid, cname });
const getAllMessageAPI = (cid: string) => apiRequest<StoredChatMessage[]>("post", "/_api/chat/getAllMessage", { cid });
const addMessageAPI = (cid: string, mid: string, message: string) => apiRequest<null>("post", "/_api/chat/addMessage", { cid, mid, message });
const deleteMessageAPI = (cid: string, mid: string) => apiRequest<null>("post", "/_api/chat/deleteMessage", { cid, mid });

function parseChatSettingsPayload(rawData: string | PersistedChatSettingsPayload | Partial<ChatModelSettings> | null): {
  modelSnapshot: ConversationModelSnapshot | null;
  settings: Partial<ChatModelSettings>;
} {
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

function buildChatSettingsPayloadFromState(
  conversation: { modelSnapshot?: ConversationModelSnapshot | null } | null,
  settings: Partial<ChatModelSettings> | null | undefined,
  fallbackModel: ChatModelConfig | null = null,
): PersistedChatSettingsPayload {
  const modelSnapshot =
    conversation?.modelSnapshot || createConversationModelSnapshot(fallbackModel || store.state.curChatModel || store.state.models.chat?.[0] || null);
  const model = getModelFromSnapshot(modelSnapshot) || fallbackModel || store.state.curChatModel || store.state.models.chat?.[0] || null;

  return {
    version: 2,
    modelSnapshot,
    settings: mergeChatSettingsWithModel(model, settings || {}),
  };
}

function buildChatSettingsPayload(cid: string): PersistedChatSettingsPayload {
  const conversation = store.state.chatConversationsById?.[cid] || store.state.curConversation;
  const settings = store.state.chatSettingsById?.[cid] || store.state.curChatModelSettings;

  return buildChatSettingsPayloadFromState(conversation, settings, store.state.curChatModel);
}

function normalizeChatSettingsPayload(
  rawData: string | PersistedChatSettingsPayload | Partial<ChatModelSettings> | null,
  fallbackModel: ChatModelConfig | null = null,
): PersistedChatSettingsPayload {
  const payload = parseChatSettingsPayload(rawData);
  const modelSnapshot =
    payload.modelSnapshot || createConversationModelSnapshot(fallbackModel || store.state.curChatModel || store.state.models.chat?.[0] || null);
  const model = getModelFromSnapshot(modelSnapshot) || fallbackModel || store.state.curChatModel;

  return {
    version: 2,
    modelSnapshot,
    settings: mergeChatSettingsWithModel(model, payload.settings || {}),
  };
}

export async function resetCurrentChatDraft(): Promise<void> {
  await store.dispatch("setCurChatModelSettings", buildDefaultChatSettings(store.state.curChatModel));
  await store.dispatch("setCurChatId", "");
  await store.dispatch("setCurConversation", null);
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

  const fallbackModel = store.state.models.chat?.[0] || store.state.curChatModel;
  const payload = normalizeChatSettingsPayload(res.data, fallbackModel);
  const modelSnapshot = payload.modelSnapshot || createConversationModelSnapshot(fallbackModel);
  const conversation = modelSnapshot
    ? {
        id: cid,
        title: store.state.chatList.find((item) => item.cid === cid)?.cname || "",
        modelSnapshot,
      }
    : null;
  const validData = payload.settings;

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

export async function exportChatSessionSettings(): Promise<ExportedChatSessionSettings[]> {
  const chatListRes = await getChatListAPI();
  if (!chatListRes.flag || !isValidChatInfoArray(chatListRes.data)) {
    throw new Error(chatListRes.log || tr("toast.chatListInvalid"));
  }

  const fallbackModel = store.state.models.chat?.[0] || store.state.curChatModel;
  const payloads = await Promise.all(
    chatListRes.data.map(async (chat) => {
      const settingsRes = await getChatSettingsAPI(chat.cid);
      if (!settingsRes.flag) {
        throw new Error(settingsRes.log || `Failed to fetch chat settings for ${chat.cid}`);
      }

      return {
        cid: chat.cid,
        cname: chat.cname,
        payload: normalizeChatSettingsPayload(settingsRes.data, fallbackModel),
      } satisfies ExportedChatSessionSettings;
    }),
  );

  return payloads;
}

export async function importChatSessionSettings(entries: ExportedChatSessionSettings[] = []): Promise<void> {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const existingChatListRes = await getChatListAPI();
  const existingChats = existingChatListRes.flag && isValidChatInfoArray(existingChatListRes.data) ? existingChatListRes.data : [];
  const existingChatMap = new Map(existingChats.map((item) => [item.cid, item]));
  const fallbackModel = store.state.models.chat?.[0] || store.state.curChatModel;

  for (const entry of entries) {
    if (!entry?.cid || !entry?.cname || !entry?.payload) continue;

    if (!existingChatMap.has(entry.cid)) {
      const addRes = await addChatAPI(entry.cid, entry.cname);
      if (!addRes.flag) {
        throw new Error(addRes.log || `Failed to create chat ${entry.cid}`);
      }
      existingChatMap.set(entry.cid, { cid: entry.cid, cname: entry.cname });
    } else if (existingChatMap.get(entry.cid)?.cname !== entry.cname) {
      const renameRes = await renameChatAPI(entry.cid, entry.cname);
      if (!renameRes.flag) {
        throw new Error(renameRes.log || `Failed to rename chat ${entry.cid}`);
      }
      existingChatMap.set(entry.cid, { cid: entry.cid, cname: entry.cname });
    }

    const normalizedPayload = normalizeChatSettingsPayload(entry.payload, fallbackModel);
    const setRes = await setChatSettingsAPI(entry.cid, JSON.stringify(normalizedPayload));
    if (!setRes.flag) {
      throw new Error(setRes.log || `Failed to save chat settings for ${entry.cid}`);
    }
  }

  await getChatList();
  if (store.state.curChatId && existingChatMap.has(store.state.curChatId)) {
    await getChatSettings(store.state.curChatId);
  }
}

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
  const settingsPayload = buildChatSettingsPayloadFromState(conversation, settings, model);

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
    const addRes = await addChatAPI(chatId, chatName);
    if (!addRes.flag) {
      dsAlert({ type: "error", message: tr("toast.chatAddFailed", { name: chatName, error: addRes.log }) });
      return false;
    }

    const settingsRes = await setChatSettingsAPI(chatId, JSON.stringify(settingsPayload));
    if (!settingsRes.flag) {
      await deleteChatAPI(chatId);
      dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: settingsRes.log }) });
      return false;
    }

    await updateLocalChatState();
    return true;
  } catch (error) {
    dsAlert({ type: "error", message: tr("toast.chatAddException", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function deleteChat(cid: string): Promise<boolean> {
  const res = await deleteChatAPI(cid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatDeleteFailed", { error: res.log }) });
    return false;
  }

  const chatList = [...store.state.chatList];
  const index = chatList.findIndex((chat) => chat.cid === cid);
  if (index >= 0) chatList.splice(index, 1);

  await store.dispatch("resetChatList", chatList);
  await store.dispatch("removeChatSession", cid);
  if (cid === store.state.curChatId) {
    await store.dispatch("setCurChatId", "");
    await store.dispatch("setCurConversation", null);
  }
  removeChatSessionRunner(cid);
  return true;
}

export async function renameChat(cid: string, cname: string): Promise<boolean> {
  const res = await renameChatAPI(cid, cname);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatRenameFailed", { error: res.log }) });
    return false;
  }

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

  return true;
}

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

  let invalidMessageCount = 0;
  const messages = res.data.reduce<ChatPromptMessage[]>((list, data) => {
    try {
      const message = JSON.parse(data.message) as ChatPromptMessage;
      list.push({ ...message, mid: data.mid });
    } catch (error) {
      invalidMessageCount += 1;
      console.warn(`Skipping invalid stored message ${data.mid}:`, error);
    }
    return list;
  }, []);

  await store.dispatch("replaceChatMessages", { cid, messages });
  await store.dispatch("setChatLoaded", { cid, loaded: true });

  if (invalidMessageCount > 0) {
    dsAlert({ type: "warn", message: `${tr("toast.invalidMessage")} (${invalidMessageCount})` });
  }

  if (callback) {
    for (const message of messages) {
      await callback([message]);
    }
  }

  return messages;
}

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

export async function deleteMessage(cid: string = store.state.curChatId, mid: string): Promise<boolean> {
  if (!cid) return false;

  const res = await deleteMessageAPI(cid, mid);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessageDeleteFailed", { error: res.log }) });
    return false;
  }
  return true;
}
