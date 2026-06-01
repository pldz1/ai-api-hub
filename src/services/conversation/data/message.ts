import type { ChatPromptMessage } from "@/types";

/**
 * Pack a user message from the input state.
 */
export function packUserMsg(imageUrls: string[], text: string, allowImages: boolean = true): ChatPromptMessage {
  const res: ChatPromptMessage = { role: "user", content: [{ type: "text", text }] };
  if (!allowImages) return res;

  imageUrls.forEach((url) => {
    res.content.push({
      type: "image_url",
      image_url: { url, detail: "low" },
    });
  });

  return res;
}
