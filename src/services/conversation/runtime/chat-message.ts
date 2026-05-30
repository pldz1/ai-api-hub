import type { ChatPromptContent, ChatPromptMessage, PackedPartChatMessage, PackedTextChatMessage } from "@/types";

/**
 * The app stores messages in one normalized multimodal shape. A conversation
 * turn packs that shape into the provider-ready format selected for the model.
 */
export function packTextMessages(data: ChatPromptMessage[]): PackedTextChatMessage[] {
  return data.map((entry) => ({
    role: entry.role,
    content: entry.content[0]?.type === "text" ? entry.content[0].text : "",
  }));
}

export function packPartMessages(data: ChatPromptMessage[]): PackedPartChatMessage[] {
  return data.map((entry) => ({
    role: entry.role,
    content: entry.content as ChatPromptContent[],
  }));
}
