import store from "@/store";
import { buildDefaultChatSettings, createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import { dsAlert, generateRandomCname, getUuid, isValidChatInfoArray } from "@/utils";
import { tr } from "@/i18n";
import type { ChatListItem } from "@/services/types";
import type { ChatModelConfig, ChatPromptMessage } from "@/ai-capability/chat/types";
import type { ExportedChatSessionSettings } from "@/types";
import { chatConversationApi, chatMessageApi, chatSettingsApi } from "./data/conversation-api";
import { createChatSettingsPayload, createChatSettingsPayloadForSession, normalizeChatSettingsPayload } from "./data/settings-payload";
import { removeChatSessionRunner } from "./runtime/session-runner";

type MessageReplayCallback = (messages: ChatPromptMessage[]) => void | Promise<void>;

function getDefaultChatModel(): ChatModelConfig | null {
  return store.state.models.chat?.[0] || store.state.curChatModel || null;
}

function createConversation(chatId: string, title: string, model: ChatModelConfig | null) {
  const modelSnapshot = createConversationModelSnapshot(model || store.state.curConversation?.modelSnapshot?.modelConfig || store.state.curChatModel || getDefaultChatModel());
  if (!modelSnapshot) return null;

  return {
    id: chatId,
    title,
    modelSnapshot,
  };
}

function createConversationFromSettings(chatId: string, title: string, payload: ReturnType<typeof normalizeChatSettingsPayload>) {
  if (!payload.modelSnapshot) return null;

  return {
    id: chatId,
    title,
    modelSnapshot: payload.modelSnapshot,
  };
}

function getChatTitle(chatList: ChatListItem[], chatId: string): string {
  return chatList.find((item) => item.cid === chatId)?.cname || "";
}

async function hydrateActiveSession(chatId: string, conversation: ReturnType<typeof createConversation>, settings: unknown): Promise<void> {
  await store.dispatch("hydrateChatSession", {
    cid: chatId,
    conversation,
    settings,
  });

  if (chatId === store.state.curChatId) {
    await store.dispatch("setCurConversation", conversation);
    await store.dispatch("setCurChatModelSettings", settings);
  }
}

async function applyNewChatLocally(chatId: string, chatName: string, conversation: ReturnType<typeof createConversation>, settings: unknown): Promise<void> {
  await store.dispatch("resetChatList", [...store.state.chatList, { cid: chatId, cname: chatName }]);
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
}

function parseStoredMessages(records: { mid: string; message: string }[]): {
  messages: ChatPromptMessage[];
  invalidCount: number;
} {
  let invalidCount = 0;
  const messages = records.reduce<ChatPromptMessage[]>((list, record) => {
    try {
      const message = JSON.parse(record.message) as ChatPromptMessage;
      list.push({ ...message, mid: record.mid });
    } catch (error) {
      invalidCount += 1;
      console.warn(`Skipping invalid stored message ${record.mid}:`, error);
    }
    return list;
  }, []);

  return { messages, invalidCount };
}

export async function resetCurrentChatDraft(): Promise<void> {
  await store.dispatch("setCurChatModelSettings", buildDefaultChatSettings(store.state.curChatModel));
  await store.dispatch("setCurChatId", "");
  await store.dispatch("setCurConversation", null);
}

export async function getChatList(): Promise<boolean> {
  const response = await chatConversationApi.getList();
  if (!response.flag) {
    await store.dispatch("resetChatList", []);
    dsAlert({ type: "error", message: tr("toast.chatListFetchFailed", { error: response.log }) });
    return false;
  }

  if (!isValidChatInfoArray(response.data)) {
    await store.dispatch("resetChatList", []);
    dsAlert({ type: "error", message: tr("toast.chatListInvalid") });
    return false;
  }

  await store.dispatch("resetChatList", response.data);
  return true;
}

export async function getChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;

  const response = await chatSettingsApi.get(cid);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatSettingsFetchFailed", { error: response.log }) });
    return false;
  }

  const payload = normalizeChatSettingsPayload(response.data, getDefaultChatModel());
  const conversation = createConversationFromSettings(cid, getChatTitle(store.state.chatList, cid), payload);

  await hydrateActiveSession(cid, conversation, payload.settings);
  return true;
}

export async function setChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;

  const response = await chatSettingsApi.set(cid, createChatSettingsPayloadForSession(cid));
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: response.log }) });
    return false;
  }

  return true;
}

export async function exportChatSessionSettings(): Promise<ExportedChatSessionSettings[]> {
  const chatListResponse = await chatConversationApi.getList();
  if (!chatListResponse.flag || !isValidChatInfoArray(chatListResponse.data)) {
    throw new Error(chatListResponse.log || tr("toast.chatListInvalid"));
  }

  const fallbackModel = getDefaultChatModel();
  return Promise.all(
    chatListResponse.data.map(async (chat) => {
      const settingsResponse = await chatSettingsApi.get(chat.cid);
      if (!settingsResponse.flag) {
        throw new Error(settingsResponse.log || `Failed to fetch chat settings for ${chat.cid}`);
      }

      return {
        cid: chat.cid,
        cname: chat.cname,
        payload: normalizeChatSettingsPayload(settingsResponse.data, fallbackModel),
      } satisfies ExportedChatSessionSettings;
    }),
  );
}

export async function importChatSessionSettings(entries: ExportedChatSessionSettings[] = []): Promise<void> {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const existingChatListResponse = await chatConversationApi.getList();
  const existingChats = existingChatListResponse.flag && isValidChatInfoArray(existingChatListResponse.data) ? existingChatListResponse.data : [];
  const existingChatMap = new Map(existingChats.map((item) => [item.cid, item]));
  const fallbackModel = getDefaultChatModel();

  for (const entry of entries) {
    if (!entry?.cid || !entry?.cname || !entry?.payload) continue;

    const existingChat = existingChatMap.get(entry.cid);
    if (!existingChat) {
      const addResponse = await chatConversationApi.add(entry.cid, entry.cname);
      if (!addResponse.flag) throw new Error(addResponse.log || `Failed to create chat ${entry.cid}`);
      existingChatMap.set(entry.cid, { cid: entry.cid, cname: entry.cname });
    } else if (existingChat.cname !== entry.cname) {
      const renameResponse = await chatConversationApi.rename(entry.cid, entry.cname);
      if (!renameResponse.flag) throw new Error(renameResponse.log || `Failed to rename chat ${entry.cid}`);
      existingChatMap.set(entry.cid, { cid: entry.cid, cname: entry.cname });
    }

    const normalizedPayload = normalizeChatSettingsPayload(entry.payload, fallbackModel);
    const saveResponse = await chatSettingsApi.set(entry.cid, normalizedPayload);
    if (!saveResponse.flag) throw new Error(saveResponse.log || `Failed to save chat settings for ${entry.cid}`);
  }

  await getChatList();
  if (store.state.curChatId && existingChatMap.has(store.state.curChatId)) {
    await getChatSettings(store.state.curChatId);
  }
}

export async function addChat(name: string | null = null, model: ChatModelConfig | null = null): Promise<boolean> {
  const chatId = getUuid("chat");
  const chatName = name || generateRandomCname();
  const conversation = createConversation(chatId, chatName, model);
  const modelForSettings = getModelFromSnapshot(conversation?.modelSnapshot) || store.state.curChatModel;
  const settings = store.state.curChatId ? mergeChatSettingsWithModel(modelForSettings, store.state.curChatModelSettings) : store.state.curChatModelSettings;
  const settingsPayload = createChatSettingsPayload(conversation, settings, model);

  try {
    const addResponse = await chatConversationApi.add(chatId, chatName);
    if (!addResponse.flag) {
      dsAlert({ type: "error", message: tr("toast.chatAddFailed", { name: chatName, error: addResponse.log }) });
      return false;
    }

    const settingsResponse = await chatSettingsApi.set(chatId, settingsPayload);
    if (!settingsResponse.flag) {
      await chatConversationApi.delete(chatId);
      dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: settingsResponse.log }) });
      return false;
    }

    await applyNewChatLocally(chatId, chatName, conversation, settings);
    return true;
  } catch (error) {
    dsAlert({ type: "error", message: tr("toast.chatAddException", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function deleteChat(cid: string): Promise<boolean> {
  const response = await chatConversationApi.delete(cid);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatDeleteFailed", { error: response.log }) });
    return false;
  }

  await store.dispatch(
    "resetChatList",
    store.state.chatList.filter((chat) => chat.cid !== cid),
  );
  await store.dispatch("removeChatSession", cid);

  if (cid === store.state.curChatId) {
    await store.dispatch("setCurChatId", "");
    await store.dispatch("setCurConversation", null);
  }

  removeChatSessionRunner(cid);
  return true;
}

export async function renameChat(cid: string, cname: string): Promise<boolean> {
  const response = await chatConversationApi.rename(cid, cname);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatRenameFailed", { error: response.log }) });
    return false;
  }

  await store.dispatch(
    "resetChatList",
    store.state.chatList.map((chat) => (chat.cid === cid ? { ...chat, cname } : chat)),
  );

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

export async function getAllMessage(cid: string = store.state.curChatId, callback: MessageReplayCallback | null = null): Promise<ChatPromptMessage[]> {
  if (!cid) return [];

  const response = await chatMessageApi.getAll(cid);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessagesFetchFailed", { error: response.log }) });
    return [];
  }

  const { messages, invalidCount } = parseStoredMessages(response.data);
  await store.dispatch("replaceChatMessages", { cid, messages });
  await store.dispatch("setChatLoaded", { cid, loaded: true });

  if (invalidCount > 0) {
    dsAlert({ type: "warn", message: `${tr("toast.invalidMessage")} (${invalidCount})` });
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

  const response = await chatMessageApi.add(cid, mid, message);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessageAddFailed", { error: response.log }) });
    return false;
  }

  return true;
}

export async function deleteMessage(cid: string = store.state.curChatId, mid: string): Promise<boolean> {
  if (!cid) return false;

  const response = await chatMessageApi.delete(cid, mid);
  if (!response.flag) {
    dsAlert({ type: "error", message: tr("toast.chatMessageDeleteFailed", { error: response.log }) });
    return false;
  }

  return true;
}
