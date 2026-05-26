import type { ChatPromptContent, ChatPromptMessage, PackedPartChatMessage, PackedTextChatMessage } from "./types";

/**
 * Chat message packing helpers.
 *
 * The app stores messages in one normalized multimodal shape, while providers
 * may still expect either plain text content or structured content parts.
 */

/** Pack messages as plain text strings. */
export function packTextMessages(data: ChatPromptMessage[]): PackedTextChatMessage[] {
  const messages = data.map((entry) => ({
    role: entry.role,
    content: entry.content[0]?.type === "text" ? entry.content[0].text : "",
  }));

  return messages;
}

/** Pack messages as structured content parts, including image inputs. */
export function packPartMessages(data: ChatPromptMessage[]): PackedPartChatMessage[] {
  const messages = data.map((entry) => ({
    role: entry.role,
    content: entry.content as ChatPromptContent[],
  }));

  return messages;
}
