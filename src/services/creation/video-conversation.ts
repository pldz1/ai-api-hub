import store from "@/store";
import { tr } from "@/i18n";
import { buildVideoGenerationParams } from "@/models";
import { dsAlert, getUuid } from "@/utils";
import { runVideoAITurn } from "@/ai-capability";
import { urlToDataUrl } from "@/services/app/storage";
import {
  addVideoConversationAPI,
  deleteVideoConversationAPI,
  getVideoConversationListAPI,
  getVideoConversationMessagesAPI,
  setVideoConversationMessagesAPI,
} from "./video-api";
import { pushVideo } from "./video-gallery";
import { createVideoMessage, emptyVideoUsage, getVideoConversationName, normalizeGeneratedVideos } from "./video-message";
import type { VideoConversationInfo, VideoConversationMessage, VideoTurnRequest, VideoTurnResponse } from "@/types";

/**
 * Strip the raw `data` field from attachments before persisting.
 * The `data` field (raw base64 without data-URL prefix) is only used for API
 * submission. Keeping it in localStorage would waste quota. `previewUrl`
 * stays so the UI can always render attachment thumbnails.
 */
function sanitizeMessagesForPersist(messages: VideoConversationMessage[]): VideoConversationMessage[] {
  return messages.map((msg) => {
    if (!msg.attachments?.length) return msg;
    return {
      ...msg,
      attachments: msg.attachments.map((att) => ({ ...att, data: "" })),
    };
  });
}

async function persistVideoMessages(vid: string): Promise<boolean> {
  if (!vid) return false;
  const messages = store.state.videoMessagesById?.[vid] ||
    (vid === store.state.curVideoConversationId ? store.state.videoMessages || [] : []);
  const res = await setVideoConversationMessagesAPI(vid, sanitizeMessagesForPersist(messages));
  if (!res.flag) {
    console.error("Failed to persist video messages:", res.log);
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: res.log }) });
    return false;
  }
  return true;
}

export async function runVideoConversationTurn(request: VideoTurnRequest): Promise<VideoTurnResponse> {
  const result = await runVideoAITurn(request, buildVideoGenerationParams);
  const { payloads, errors } = normalizeGeneratedVideos(request.prompt, result.videos || []);
  if (errors.length > 0 && payloads.length === 0) throw new Error(errors.join("\n"));

  // Convert remote URLs to inline data URLs so conversation messages never
  // reference third-party origins.
  const resolvedPayloads = await Promise.all(
    payloads.map(async (p) => {
      try {
        return { ...p, src: await urlToDataUrl(p.src) };
      } catch {
        return p;
      }
    }),
  );

  return {
    prompt: request.prompt,
    videos: resolvedPayloads,
    usage: result.usage || emptyVideoUsage(),
    raw: result.raw,
  };
}

export async function submitVideoMessage(request: VideoTurnRequest): Promise<VideoConversationMessage | null> {
  let conversationId = store.state.curVideoConversationId || "";
  if (!conversationId) {
    const created = await addVideoConversation(getVideoConversationName(request.prompt));
    if (!created) return null;
    conversationId = store.state.curVideoConversationId || "";
  }

  const userMessage = createVideoMessage({
    role: "user",
    prompt: request.prompt,
    attachments: request.attachments || [],
    status: "success",
    modelName: request.model?.name || request.model?.model || "",
    resolution: request.resolution,
  });
  const assistantMessage = createVideoMessage({
    role: "assistant",
    prompt: request.prompt,
    status: "loading",
    modelName: request.model?.name || request.model?.model || "",
    resolution: request.resolution,
  });

  await store.dispatch("pushVideoMessage", { vid: conversationId, message: userMessage });
  await store.dispatch("pushVideoMessage", { vid: conversationId, message: assistantMessage });
  await persistVideoMessages(conversationId);
  await store.dispatch("setVideoRuntime", {
    vid: conversationId,
    runtime: {
      pending: true,
      status: "loading",
      completedNotice: false,
      startedAt: Date.now(),
      elapsedMs: 0,
      error: "",
    },
  });

  const startedAt = performance.now();

  try {
    const response = await runVideoConversationTurn(request);
    const elapsedMs = performance.now() - startedAt;
    const completed: VideoConversationMessage = {
      ...assistantMessage,
      videos: response.videos,
      status: "success",
      usage: response.usage,
      elapsedMs,
    };

    await store.dispatch("updateVideoMessage", { vid: conversationId, message: completed });
    await persistVideoMessages(conversationId);
    await store.dispatch("setVideoRuntime", {
      vid: conversationId,
      runtime: {
        pending: false,
        status: "success",
        completedNotice: store.state.curVideoConversationId !== conversationId,
        elapsedMs,
        error: "",
      },
    });

    for (const video of response.videos) {
      await pushVideo(request.prompt, video.src);
    }

    return completed;
  } catch (error) {
    const elapsedMs = performance.now() - startedAt;
    const failed: VideoConversationMessage = {
      ...assistantMessage,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      usage: emptyVideoUsage(),
      elapsedMs,
    };

    await store.dispatch("updateVideoMessage", { vid: conversationId, message: failed });
    await persistVideoMessages(conversationId);
    await store.dispatch("setVideoRuntime", {
      vid: conversationId,
      runtime: {
        pending: false,
        status: "error",
        completedNotice: store.state.curVideoConversationId !== conversationId,
        elapsedMs,
        error: failed.error || "",
      },
    });
    return failed;
  }
}

export async function getVideoConversationList(): Promise<boolean> {
  const res = await getVideoConversationListAPI();
  if (!res.flag || !Array.isArray(res.data)) {
    await store.dispatch("resetVideoConversationList", []);
    return false;
  }
  await store.dispatch("resetVideoConversationList", res.data);
  return true;
}

export async function addVideoConversation(name: string = ""): Promise<boolean> {
  const vid = getUuid("vidconv");
  const vname = name || getVideoConversationName();
  const res = await addVideoConversationAPI(vid, vname);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: res.log }) });
    return false;
  }
  const item: VideoConversationInfo = { vid, vname };
  await store.dispatch("pushVideoConversation", item);
  await store.dispatch("setCurVideoConversationId", vid);
  await store.dispatch("resetVideoMessages", { vid, messages: [] });
  return true;
}

export async function getVideoConversationMessages(vid: string): Promise<boolean> {
  if (!vid) {
    await store.dispatch("setCurVideoConversationId", "");
    return true;
  }

  const res = await getVideoConversationMessagesAPI(vid);
  if (!res.flag) return false;
  try {
    const messages = JSON.parse(res.data || "[]");
    await store.dispatch("setCurVideoConversationId", vid);
    await store.dispatch("resetVideoMessages", { vid, messages: Array.isArray(messages) ? messages : [] });
    return true;
  } catch {
    await store.dispatch("setCurVideoConversationId", vid);
    await store.dispatch("resetVideoMessages", { vid, messages: [] });
    return false;
  }
}

export async function deleteVideoConversation(vid: string): Promise<boolean> {
  const res = await deleteVideoConversationAPI(vid);
  if (!res.flag) return false;
  await store.dispatch("deleteVideoConversation", vid);
  return true;
}
