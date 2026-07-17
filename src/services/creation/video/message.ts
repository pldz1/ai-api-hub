import { getUuid } from "@/utils";
import type { TokenUsage, VideoConversationMessage, VideoPayload } from "@/types";

export const emptyVideoUsage = (): TokenUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
});

export function createVideoMessage(payload: Partial<VideoConversationMessage> = {}): VideoConversationMessage {
  return {
    id: payload.id || getUuid("vidmsg"),
    role: payload.role || "assistant",
    prompt: payload.prompt || "",
    videos: payload.videos || [],
    attachments: payload.attachments || [],
    createdAt: payload.createdAt || Date.now(),
    run: payload.run || null,
  };
}

export function normalizeGeneratedVideos(
  prompt: string,
  items: Array<{ type: "url" | "text"; data: string }> = [],
): { payloads: VideoPayload[]; errors: string[] } {
  const payloads: VideoPayload[] = [];
  const errors: string[] = [];

  items.forEach((item) => {
    if (item.type === "url" && item.data) {
      payloads.push({
        id: getUuid("vidout"),
        src: item.data,
        filename: `${prompt.slice(0, 32) || "video"}.mp4`,
        contentType: "video/mp4",
      });
      return;
    }

    if (item.data) errors.push(item.data);
  });

  return { payloads, errors };
}

export function getVideoConversationName(prompt: string = ""): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 28);
  const date = new Date();
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `Video ${monthDay} ${time}`;
}
