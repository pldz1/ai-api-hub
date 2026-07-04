import store from "@/store";
import { apiRequest } from "@/services/app";
import { getChatFileSource, setChatFileSource } from "@/services/app/storage";
import { getUuid } from "@/utils";
import type { ChatMessageAttachment, ChatPromptMessage, StoredChatMessage } from "@/types";

const ARCHIVE_FORMAT = "ai-api-hub.conversation";
const ARCHIVE_VERSION = 2;

type ArchivedChatMessageAttachment = ChatMessageAttachment & { source?: string };

interface ArchivedChatMessage extends Omit<ChatPromptMessage, "attachments"> {
  attachments?: ArchivedChatMessageAttachment[];
}

interface ChatConversationArchive {
  format: typeof ARCHIVE_FORMAT;
  version: 1 | 2;
  type: "chat";
  exportedAt: string;
  conversation: {
    id: string;
    name: string;
  };
  messages: ArchivedChatMessage[];
}

function safeFilename(value: string, fallback: string): string {
  const name = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
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

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => {
    if (!response.ok) {
      throw new Error("Failed to read data URL.");
    }
    return response.blob();
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file blob."));
    reader.readAsDataURL(blob);
  });
}

function assertChatArchive(value: unknown): asserts value is ChatConversationArchive {
  const archive = value as Partial<ChatConversationArchive>;
  if (
    !archive ||
    archive.format !== ARCHIVE_FORMAT ||
    (archive.version !== 1 && archive.version !== 2) ||
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

  const messages: ChatPromptMessage[] = [];
  for (const record of response.data) {
    try {
      const message = JSON.parse(record.message) as ArchivedChatMessage;
      if (message.attachments?.length) {
        message.attachments = await Promise.all(
          message.attachments.map(async (attachment) => {
            const source = attachment.id ? await getChatFileSource(attachment.id) : null;
            return {
              ...attachment,
              ...(source ? { source: await blobToDataUrl(source) } : {}),
            };
          }),
        );
      }
      messages.push({ ...message, mid: record.mid });
    } catch {
      // Skip malformed records so one bad message does not block the archive.
    }
  }

  return messages;
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
    const attachments = await Promise.all(
      (payload.attachments || []).map(async (attachment) => {
        const { source, ...attachmentPayload } = attachment as ArchivedChatMessageAttachment;
        if (source) {
          await setChatFileSource(attachmentPayload.id, await dataUrlToBlob(source));
        }
        return attachmentPayload;
      }),
    );
    const nextPayload = { ...payload, attachments };
    const response = await apiRequest<null>("post", "/_api/chat/addMessage", { cid, mid, message: JSON.stringify(nextPayload) });
    if (!response.flag) throw new Error(response.log || "Failed to save chat message.");
    importedMessages.push({ ...nextPayload, mid } as ChatPromptMessage);
  }

  await store.dispatch("resetChatList", [...store.state.chatList, { cid, cname }]);
  await store.dispatch("replaceChatMessages", { cid, messages: importedMessages });
  return cid;
}
