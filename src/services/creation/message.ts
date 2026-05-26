import { getUuid } from "@/utils";
import type { TokenUsage } from "@/ai-capability/common";
import type { ImageConversationMessage, ImagePayload } from "@/types";

export const emptyImageUsage = (): TokenUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
});

export function createImageMessage(payload: Partial<ImageConversationMessage> = {}): ImageConversationMessage {
  return {
    id: payload.id || getUuid("imgmsg"),
    role: payload.role || "assistant",
    mode: payload.mode || "generation",
    prompt: payload.prompt || "",
    images: payload.images || [],
    attachments: payload.attachments || [],
    status: payload.status || "ready",
    createdAt: payload.createdAt || Date.now(),
    elapsedMs: payload.elapsedMs || 0,
    usage: payload.usage || null,
    error: payload.error || "",
    modelName: payload.modelName || "",
    size: payload.size || "",
  };
}

export function normalizeGeneratedImages(
  prompt: string,
  images: Array<{ type: "url" | "text"; data: string }> = [],
): { payloads: ImagePayload[]; errors: string[] } {
  const payloads: ImagePayload[] = [];
  const errors: string[] = [];

  images.forEach((item) => {
    if (item.type === "url" && item.data) {
      payloads.push({
        id: getUuid("imgout"),
        src: item.data,
        filename: `${prompt.slice(0, 32) || "image"}.png`,
        contentType: item.data.startsWith("data:") ? item.data.slice(5, item.data.indexOf(";")) : "",
      });
      return;
    }

    if (item.data) errors.push(item.data);
  });

  return { payloads, errors };
}

export function getImageConversationName(prompt = ""): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 28);
  const date = new Date();
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `Image ${monthDay} ${time}`;
}
