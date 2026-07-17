import store from "@/store";
import { chatRepository, getChatFileSource, setChatFileSource } from "@/persistence";
import { getUuid } from "@/utils";
import type { ChatMessageAttachment, ChatPromptMessage } from "@/types";

const ARCHIVE_FORMAT = "ai-api-hub.conversation";
const ARCHIVE_VERSION = 3;

type ArchivedChatMessageAttachment = ChatMessageAttachment & { source?: string };

interface ArchivedChatMessage extends Omit<ChatPromptMessage, "attachments"> {
  attachments?: ArchivedChatMessageAttachment[];
}

interface ChatConversationArchive {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
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
    archive.version !== ARCHIVE_VERSION ||
    archive.type !== "chat" ||
    !archive.conversation ||
    !Array.isArray(archive.messages)
  ) {
    throw new Error("Invalid chat conversation archive.");
  }
}

async function getChatMessagesRaw(cid: string): Promise<ChatPromptMessage[]> {
  return Promise.all(
    (await chatRepository.getMessages(cid)).map(async (stored) => {
      const message = { ...stored } as ArchivedChatMessage;
      if (message.attachments?.length) {
        message.attachments = await Promise.all(
          message.attachments.map(async (attachment) => {
            const source = attachment.id ? await getChatFileSource(attachment.id) : null;
            return { ...attachment, ...(source ? { source: await blobToDataUrl(source) } : {}) };
          }),
        );
      }
      return message as ChatPromptMessage;
    }),
  );
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
  const settings = { modelSnapshot: null, settings: store.state.curChatModelSettings };
  await chatRepository.create(cid, cname, settings);

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
    const importedMessage = { ...nextPayload, mid } as ChatPromptMessage;
    await chatRepository.saveMessage(cid, importedMessage);
    importedMessages.push(importedMessage);
  }

  store.commit("resetChatList", [...store.state.chatList, { cid, cname }]);
  store.commit("replaceChatMessages", { cid, messages: importedMessages });
  return cid;
}
