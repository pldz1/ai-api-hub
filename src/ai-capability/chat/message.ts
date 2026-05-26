import type { ChatPromptContent, ChatPromptMessage, PackedPartChatMessage, PackedTextChatMessage } from "./types";

/**
 * Chat message packing helpers.
 *
 * The app stores messages in one normalized shape, while older provider configs
 * still expect either plain strings or the OpenAI content-part format.
 */

/** Pack messages for older text-only chat completion providers. */
export function packMessageV1(data: ChatPromptMessage[]): PackedTextChatMessage[] {
  const messages = data.map((entry) => ({
    role: entry.role,
    content: entry.content[0]?.type === "text" ? entry.content[0].text : "",
  }));

  return messages;
}

/** Pack messages with OpenAI-style content parts, including image inputs. */
export function packMessageV2(data: ChatPromptMessage[]): PackedPartChatMessage[] {
  const messages = data.map((entry) => ({
    role: entry.role,
    content: entry.content as ChatPromptContent[],
  }));

  return messages;
}
