import store from "@/store";
import { apiRequest } from "@/services/app";
import { getUuid } from "@/utils";
import type { ChatPromptMessage, StoredChatMessage } from "@/types";

const ARCHIVE_FORMAT = "ai-api-hub.conversation";
const ARCHIVE_VERSION = 1;

interface ChatConversationArchive {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  type: "chat";
  exportedAt: string;
  conversation: {
    id: string;
    name: string;
  };
  messages: ChatPromptMessage[];
}

function safeFilename(value: string, fallback: string): string {
  const name = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return (name || fallback).slice(0, 80);
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function assertChatArchive(value: unknown): asserts value is ChatConversationArchive {
  const archive = value as Partial<ChatConversationArchive>;
  if (
    !archive ||
    archive.format !== ARCHIVE_FORMAT ||
    archive.version !== ARCHIVE_VERSION ||
    archive.type !== "chat" ||
    !archive.conversation ||
    !Array.isArray(archive.messages)
  ) {
    throw new Error("Invalid chat conversation archive.");
  }
}

async function getChatMessagesRaw(cid: string): Promise<ChatPromptMessage[]> {
  const response = await apiRequest<StoredChatMessage[]>("post", "/_api/chat/getAllMessage", { cid });
  if (!response.flag || !Array.isArray(response.data)) {
    throw new Error(response.log || "Failed to read chat messages.");
  }

  return response.data.reduce<ChatPromptMessage[]>((messages, record) => {
    try {
      messages.push({ ...(JSON.parse(record.message) as ChatPromptMessage), mid: record.mid });
    } catch {
      // Skip malformed records so one bad message does not block the archive.
    }
    return messages;
  }, []);
}

export async function exportChatConversationArchive(cid: string): Promise<void> {
  const item = store.state.chatList.find((chat: { cid: string }) => chat.cid === cid);
  if (!cid || !item) throw new Error("Chat conversation not found.");

  const archive: ChatConversationArchive = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    type: "chat",
    exportedAt: new Date().toISOString(),
    conversation: {
      id: cid,
      name: item.cname || cid,
    },
    messages: await getChatMessagesRaw(cid),
  };

  downloadJson(archive, `${safeFilename(archive.conversation.name, "chat")}.aihub-chat.json`);
}

export async function importChatConversationArchive(file: File): Promise<string> {
  const archive = await readJsonFile(file);
  assertChatArchive(archive);

  const cid = getUuid("chat");
  const cname = archive.conversation.name || "Imported chat";
  const addResponse = await apiRequest<null>("post", "/_api/chat/addChat", { cid, cname });
  if (!addResponse.flag) throw new Error(addResponse.log || "Failed to create chat conversation.");

  const settings = { modelSnapshot: null, settings: store.state.curChatModelSettings };
  const settingsResponse = await apiRequest<null>("post", "/_api/chat/setChatSettings", { cid, data: JSON.stringify(settings) });
  if (!settingsResponse.flag) throw new Error(settingsResponse.log || "Failed to save chat settings.");

  const importedMessages: ChatPromptMessage[] = [];
  for (const message of archive.messages) {
    const mid = getUuid("msg");
    const { mid: _oldMid, ...payload } = message as ChatPromptMessage & { mid?: string };
    const response = await apiRequest<null>("post", "/_api/chat/addMessage", { cid, mid, message: JSON.stringify(payload) });
    if (!response.flag) throw new Error(response.log || "Failed to save chat message.");
    importedMessages.push({ ...payload, mid } as ChatPromptMessage);
  }

  await store.dispatch("resetChatList", [...store.state.chatList, { cid, cname }]);
  await store.dispatch("replaceChatMessages", { cid, messages: importedMessages });
  return cid;
}
