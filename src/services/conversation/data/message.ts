// @ts-nocheck
import type { ChatPromptMessage } from "@/ai-capability/chat/types";

/**
 * Pack a user message from App input state, including DOM-managed image chips.
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
