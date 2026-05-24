// @ts-nocheck
import type { ChatPromptContent, ChatPromptMessage, PackedPartChatMessage, PackedTextChatMessage } from "@/services/types";

/**
 * Chat message packing helpers.
 *
 * The UI stores messages in one normalized shape, while older provider configs
 * still expect either plain strings or the OpenAI content-part format.
 */

/**
 * Pack a user message with text and image content.
 */
export function packUserMsg(id: string | string[], texts: string, allowImages: boolean = true): ChatPromptMessage {
  const res: ChatPromptMessage = { role: "user", content: [{ type: "text", text: texts }] };
  if (Array.isArray(id)) {
    if (allowImages) {
      id.forEach((url) => {
        res.content.push({
          type: "image_url",
          image_url: { url, detail: "low" },
        });
      });
    }
    return res;
  }

  const imgContainer = document.getElementById(id);
  if (imgContainer && allowImages) {
    const imgs = imgContainer.getElementsByTagName("img");
    for (let i = 0; i < imgs.length; i++) {
      res.content.push({
        type: "image_url",
        image_url: { url: imgs[i].getAttribute("src") || "", detail: "low" },
      });
    }
    imgContainer.innerHTML = "";
  }
  if (imgContainer && !allowImages) imgContainer.innerHTML = "";
  return res;
}

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
