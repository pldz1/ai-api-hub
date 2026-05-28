import type { ChatListItem, StoredChatMessage, ChatPromptMessage, PersistedChatSettings } from "@/types";
import { apiRequest } from "../../app";

export const chatConversationApi = {
  getList: () => apiRequest<ChatListItem[]>("post", "/_api/chat/getChatList", {}),
  add: (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/addChat", { cid, cname }),
  delete: (cid: string) => apiRequest<null>("post", "/_api/chat/deleteChat", { cid }),
  rename: (cid: string, cname: string) => apiRequest<null>("post", "/_api/chat/renameChat", { cid, cname }),
};

export const chatSettingsApi = {
  get: (cid: string) => apiRequest<string>("post", "/_api/chat/getChatSettings", { cid }),
  set: (cid: string, payload: PersistedChatSettings) =>
    apiRequest<null>("post", "/_api/chat/setChatSettings", {
      cid,
      data: JSON.stringify(payload),
    }),
};

export const chatMessageApi = {
  getAll: (cid: string) => apiRequest<StoredChatMessage[]>("post", "/_api/chat/getAllMessage", { cid }),
  add: (cid: string, mid: string, message: ChatPromptMessage) =>
    apiRequest<null>("post", "/_api/chat/addMessage", {
      cid,
      mid,
      message: JSON.stringify(message),
    }),
  delete: (cid: string, mid: string) => apiRequest<null>("post", "/_api/chat/deleteMessage", { cid, mid }),
};
