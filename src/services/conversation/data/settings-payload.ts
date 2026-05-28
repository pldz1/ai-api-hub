import store from "@/store";
import { createConversationModelSnapshot, getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import type { ChatModelConfig, ChatModelSettings, ConversationModelSnapshot, PersistedChatSettings } from "@/types";

type ConversationLike = {
  modelSnapshot?: ConversationModelSnapshot | null;
} | null;

type RawChatSettingsPayload = string | PersistedChatSettings | Partial<ChatModelSettings> | null;

function getFallbackChatModel(model: ChatModelConfig | null = null): ChatModelConfig | null {
  return model || store.state.curChatModel || store.state.models.chat?.[0] || null;
}

export function parseChatSettingsPayload(rawData: RawChatSettingsPayload): {
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

export function createChatSettingsPayload(
  conversation: ConversationLike,
  settings: Partial<ChatModelSettings> | null | undefined,
  fallbackModel: ChatModelConfig | null = null,
): PersistedChatSettings {
  const fallback = getFallbackChatModel(fallbackModel);
  const modelSnapshot = conversation?.modelSnapshot || createConversationModelSnapshot(fallback);
  const model = getModelFromSnapshot(modelSnapshot) || fallback;

  return {
    modelSnapshot,
    settings: mergeChatSettingsWithModel(model, settings || {}),
  };
}

export function createChatSettingsPayloadForSession(cid: string): PersistedChatSettings {
  const conversation = store.state.chatConversationsById?.[cid] || store.state.curConversation;
  const settings = store.state.chatSettingsById?.[cid] || store.state.curChatModelSettings;

  return createChatSettingsPayload(conversation, settings, store.state.curChatModel);
}

export function normalizeChatSettingsPayload(rawData: RawChatSettingsPayload, fallbackModel: ChatModelConfig | null = null): PersistedChatSettings {
  const parsedPayload = parseChatSettingsPayload(rawData);
  const fallback = getFallbackChatModel(fallbackModel);
  const modelSnapshot = parsedPayload.modelSnapshot || createConversationModelSnapshot(fallback);
  const model = getModelFromSnapshot(modelSnapshot) || fallback;

  return {
    modelSnapshot,
    settings: mergeChatSettingsWithModel(model, parsedPayload.settings || {}),
  };
}
