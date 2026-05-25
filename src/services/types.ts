export type ApiMethod = "get" | "post" | "put" | "patch" | "delete";
export type RequestBody = Record<string, unknown>;
export type RequestHeaders = Record<string, string>;

export interface ApiResponse<TData = unknown> {
  flag: boolean;
  log: string;
  data: TData;
}

export interface ChatListItem {
  cid: string;
  cname: string;
}

export interface StoredChatMessage {
  mid: string;
  message: string;
}

export interface ImageDataItem {
  id: string;
  prompt: string;
  src: string;
}

export interface ImageConversationListItem {
  iid: string;
  iname: string;
}

export interface StoredImageConversation {
  iid: string;
  iname: string;
  messages: string;
}
