import type { ChatListItem, ChatPromptMessage, PersistedChatSettings } from "@/types";
import { deleteChatFileSource } from "./blobs";
import { deleteChatMessageRecords, getChatMessageRecords, setChatMessageRecords } from "./records";
import { readBrowserWorkspace, updateBrowserWorkspace } from "./state";

function requireChat(cid: string) {
  const chat = readBrowserWorkspace().chats.find((item) => item.cid === cid);
  if (!chat) throw new Error(`Chat conversation not found: ${cid}`);
  return chat;
}

function attachmentIds(messages: ChatPromptMessage[]): string[] {
  return [...new Set(messages.flatMap((message) => (message.attachments || []).map((attachment) => attachment.id).filter(Boolean)))];
}

export const chatRepository = {
  list(): ChatListItem[] {
    return readBrowserWorkspace().chats.map(({ cid, cname }) => ({ cid, cname }));
  },

  async create(cid: string, cname: string, settings: PersistedChatSettings): Promise<void> {
    if (readBrowserWorkspace().chats.some((item) => item.cid === cid)) throw new Error(`Chat conversation already exists: ${cid}`);
    await setChatMessageRecords(cid, []);
    updateBrowserWorkspace((state) => {
      if (state.chats.some((item) => item.cid === cid)) throw new Error(`Chat conversation already exists: ${cid}`);
      state.chats.push({ cid, cname, settings });
    });
  },

  async delete(cid: string): Promise<void> {
    requireChat(cid);
    const messages = await getChatMessageRecords(cid);
    updateBrowserWorkspace((state) => {
      state.chats = state.chats.filter((item) => item.cid !== cid);
    });
    await Promise.allSettled([deleteChatMessageRecords(cid), ...attachmentIds(messages).map(deleteChatFileSource)]);
  },

  rename(cid: string, cname: string): void {
    updateBrowserWorkspace((state) => {
      const chat = state.chats.find((item) => item.cid === cid);
      if (!chat) throw new Error(`Chat conversation not found: ${cid}`);
      chat.cname = cname;
    });
  },

  getSettings(cid: string): PersistedChatSettings | null {
    return requireChat(cid).settings;
  },

  saveSettings(cid: string, settings: PersistedChatSettings): void {
    updateBrowserWorkspace((state) => {
      const chat = state.chats.find((item) => item.cid === cid);
      if (!chat) throw new Error(`Chat conversation not found: ${cid}`);
      chat.settings = settings;
    });
  },

  async getMessages(cid: string): Promise<ChatPromptMessage[]> {
    requireChat(cid);
    return getChatMessageRecords(cid);
  },

  async saveMessage(cid: string, message: ChatPromptMessage): Promise<void> {
    if (!message.mid) throw new Error("Chat message id is required.");
    requireChat(cid);
    const messages = await getChatMessageRecords(cid);
    const index = messages.findIndex((item) => item.mid === message.mid);
    if (index >= 0) messages[index] = message;
    else messages.push(message);
    await setChatMessageRecords(cid, messages);
  },

  async saveMessages(cid: string, messages: ChatPromptMessage[]): Promise<void> {
    requireChat(cid);
    const previousMessages = await getChatMessageRecords(cid);
    const retainedAttachmentIds = new Set(attachmentIds(messages));
    const removedAttachmentIds = attachmentIds(previousMessages).filter((id) => !retainedAttachmentIds.has(id));
    await setChatMessageRecords(cid, messages);
    await Promise.allSettled(removedAttachmentIds.map(deleteChatFileSource));
  },

  async deleteMessage(cid: string, mid: string): Promise<void> {
    requireChat(cid);
    const messages = await getChatMessageRecords(cid);
    const target = messages.find((item) => item.mid === mid);
    await setChatMessageRecords(
      cid,
      messages.filter((item) => item.mid !== mid),
    );
    await Promise.allSettled(attachmentIds(target ? [target] : []).map(deleteChatFileSource));
  },
};
