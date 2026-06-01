import store from "@/store";
import { createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import { dsAlert, generateRandomCname, getUuid, isValidChatInfoArray } from "@/utils";
import { tr } from "@/i18n";
import { chatConversationApi, chatMessageApi, chatSettingsApi } from "./data/conversation-api";
import { removeChatSessionRunner } from "./runtime/session-runner";
import type { ChatModelConfig, ChatModelSettings, ChatPromptMessage, ConversationModelSnapshot } from "@/types";

function createChatSettingsPayload(
  modelSnapshot: ConversationModelSnapshot | null,
  settings: Partial<ChatModelSettings> | null | undefined,
  fallbackModel: ChatModelConfig | null = null,
) {
  const fallback = fallbackModel || store.state.curChatModel || store.state.models.chat?.[0] || null;
  const activeSnapshot = modelSnapshot || createConversationModelSnapshot(fallback);
  const model = getModelFromSnapshot(activeSnapshot) || fallback;

  return {
    modelSnapshot: activeSnapshot,
    settings: mergeChatSettingsWithModel(model, settings || {}),
  };
}

export async function resetCurrentChatDraft(): Promise<void> {
  await store.dispatch("setCurChatModelSettings", mergeChatSettingsWithModel(store.state.curChatModel, {}));
  await store.dispatch("setCurChatId", "");
}

export async function getChatList(): Promise<boolean> {
  const response = await chatConversationApi.getList();
  if (!response.flag) {
    await store.dispatch("resetChatList", []);
    console.error("Failed to fetch chat list:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatListFetchFailed", { error: response.log }) });
    return false;
  }

  if (!isValidChatInfoArray(response.data)) {
    await store.dispatch("resetChatList", []);
    console.error("Invalid chat info array:", response.data);
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
    console.error("Failed to fetch chat settings:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatSettingsFetchFailed", { error: response.log }) });
    return false;
  }

  const fallbackModel = store.state.curChatModel || store.state.models.chat?.[0] || null;
  const rawData = response.data;
  const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  const parsedSnapshot =
    parsed && typeof parsed === "object" && "settings" in parsed ? ((parsed as { modelSnapshot?: ConversationModelSnapshot | null }).modelSnapshot || null) : null;
  const parsedSettings = parsed && typeof parsed === "object" && "settings" in parsed ? ((parsed as { settings?: Partial<ChatModelSettings> }).settings || {}) : ((parsed as Partial<ChatModelSettings>) || {});
  const modelSnapshot = parsedSnapshot || createConversationModelSnapshot(fallbackModel);
  const model = getModelFromSnapshot(modelSnapshot) || fallbackModel;

  await store.dispatch("hydrateChatSession", {
    cid,
    conversation: modelSnapshot
      ? {
          id: cid,
          title: store.state.chatList.find((item) => item.cid === cid)?.cname || "",
          modelSnapshot,
        }
      : null,
    settings: mergeChatSettingsWithModel(model, parsedSettings),
  });
  return true;
}

export async function setChatSettings(cid: string = store.state.curChatId): Promise<boolean> {
  if (!cid) return false;

  const response = await chatSettingsApi.set(
    cid,
    createChatSettingsPayload(
      store.state.chatConversationsById?.[cid]?.modelSnapshot || store.state.curConversation?.modelSnapshot || null,
      store.state.chatSettingsById?.[cid] || store.state.curChatModelSettings,
      store.state.curChatModel,
    ),
  );
  if (!response.flag) {
    console.error("Failed to save chat settings:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: response.log }) });
    return false;
  }

  return true;
}

export async function addChat(name: string | null = null, model: ChatModelConfig | null = null): Promise<boolean> {
  const chatId = getUuid("chat");
  const chatName = name || generateRandomCname();
  const modelSnapshot = createConversationModelSnapshot(
    model || store.state.curConversation?.modelSnapshot?.modelConfig || store.state.curChatModel || store.state.models.chat?.[0] || null,
  );
  if (!modelSnapshot) return false;

  const conversation = {
    id: chatId,
    title: chatName,
    modelSnapshot,
  };
  const modelForSettings = getModelFromSnapshot(modelSnapshot) || store.state.curChatModel;
  const settings = store.state.curChatId ? mergeChatSettingsWithModel(modelForSettings, store.state.curChatModelSettings) : store.state.curChatModelSettings;
  const settingsPayload = createChatSettingsPayload(modelSnapshot, settings, model);

  try {
    const addResponse = await chatConversationApi.add(chatId, chatName);
    if (!addResponse.flag) {
      console.error("Failed to add chat:", addResponse.log);
      dsAlert({ type: "error", message: tr("toast.chatAddFailed", { name: chatName, error: addResponse.log }) });
      return false;
    }

    const settingsResponse = await chatSettingsApi.set(chatId, settingsPayload);
    if (!settingsResponse.flag) {
      console.error("Failed to save chat settings:", settingsResponse.log);
      await chatConversationApi.delete(chatId);
      dsAlert({ type: "error", message: tr("toast.chatSettingsSaveFailed", { error: settingsResponse.log }) });
      return false;
    }

    await store.dispatch("resetChatList", [...store.state.chatList, { cid: chatId, cname: chatName }]);
    await store.dispatch("hydrateChatSession", {
      cid: chatId,
      conversation,
      settings,
      messages: [],
      loaded: true,
    });
    await store.dispatch("setCurChatId", chatId);
    return true;
  } catch (error) {
    console.error("Exception occurred while adding chat:", error);
    dsAlert({ type: "error", message: tr("toast.chatAddException", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function deleteChat(cid: string): Promise<boolean> {
  const response = await chatConversationApi.delete(cid);
  if (!response.flag) {
    console.error("Failed to delete chat:", response.log);
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
  }

  removeChatSessionRunner(cid);
  return true;
}

export async function renameChat(cid: string, cname: string): Promise<boolean> {
  const response = await chatConversationApi.rename(cid, cname);
  if (!response.flag) {
    console.error("Failed to rename chat:", response.log);
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

export async function getAllMessage(cid: string = store.state.curChatId): Promise<ChatPromptMessage[]> {
  if (!cid) return [];

  const response = await chatMessageApi.getAll(cid);
  if (!response.flag) {
    console.error("Failed to fetch chat messages:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatMessagesFetchFailed", { error: response.log }) });
    return [];
  }

  let invalidCount = 0;
  const messages = response.data.reduce<ChatPromptMessage[]>((list, record) => {
    try {
      const message = JSON.parse(record.message) as ChatPromptMessage;
      list.push({ ...message, mid: record.mid });
    } catch (error) {
      invalidCount += 1;
      console.warn(`Skipping invalid stored message ${record.mid}:`, error);
    }
    return list;
  }, []);
  await store.dispatch("replaceChatMessages", { cid, messages });

  if (invalidCount > 0) {
    console.warn("Invalid chat messages found:", invalidCount);
    dsAlert({ type: "warn", message: `${tr("toast.invalidMessage")} (${invalidCount})` });
  }

  return messages;
}

export async function addMessage(cid: string = store.state.curChatId, mid: string, message: ChatPromptMessage): Promise<boolean> {
  if (!cid) return false;

  const response = await chatMessageApi.add(cid, mid, message);
  if (!response.flag) {
    console.error("Failed to add chat message:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatMessageAddFailed", { error: response.log }) });
    return false;
  }

  return true;
}

export async function deleteMessage(cid: string = store.state.curChatId, mid: string): Promise<boolean> {
  if (!cid) return false;

  const response = await chatMessageApi.delete(cid, mid);
  if (!response.flag) {
    console.error("Failed to delete chat message:", response.log);
    dsAlert({ type: "error", message: tr("toast.chatMessageDeleteFailed", { error: response.log }) });
    return false;
  }

  return true;
}
