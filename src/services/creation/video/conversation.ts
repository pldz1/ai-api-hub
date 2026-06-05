import store from "@/store";
import { tr } from "@/i18n";
import { buildVideoGenerationParams } from "@/models";
import { dsAlert, getUuid } from "@/utils";
import { runVideoAITurn } from "@/ai-capability";
import { urlToDataUrl, setVideoSource, getVideoSource, deleteVideoSource } from "@/services/app/storage";
import {
  addVideoConversationAPI,
  deleteVideoConversationAPI,
  getVideoConversationListAPI,
  getVideoConversationMessagesAPI,
  setVideoConversationMessagesAPI,
} from "./api";
import { pushVideo } from "./gallery";
import { createVideoMessage, emptyVideoUsage, getVideoConversationName, normalizeGeneratedVideos } from "./message";
import type { VideoConversationInfo, VideoConversationMessage, VideoTurnRequest, VideoTurnResponse } from "@/types";

// Marker prefix written into VideoPayload.src when the actual data is in IDB.
const IDB_SRC_PREFIX = "idb:";

/**
 * Offload video data URLs to IndexedDB and replace src with an "idb:{id}"
 * reference. Also strips raw attachment data that is only needed at submit
 * time. The result is safe to write into localStorage.
 */
async function sanitizeMessagesForPersist(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      let sanitizedAttachments = msg.attachments?.length ? msg.attachments.map((att) => ({ ...att, data: "" })) : msg.attachments;

      let sanitizedVideos = msg.videos;
      if (msg.videos?.length) {
        sanitizedVideos = await Promise.all(
          msg.videos.map(async (video) => {
            const src = video.src || "";
            if (!src || src.startsWith(IDB_SRC_PREFIX) || !src.startsWith("data:")) return video;
            await setVideoSource(video.id, src);
            return { ...video, src: `${IDB_SRC_PREFIX}${video.id}` };
          }),
        );
      }

      // Offload attachment previewUrls (first_frame / last_frame thumbnails).
      if (msg.attachments?.length) {
        sanitizedAttachments = await Promise.all(
          (sanitizedAttachments || msg.attachments).map(async (att) => {
            const previewUrl = att.previewUrl || "";
            const idbKey = `${att.id}-preview`;
            const nextPreviewUrl =
              previewUrl && !previewUrl.startsWith(IDB_SRC_PREFIX) && previewUrl.startsWith("data:")
                ? (await setVideoSource(idbKey, previewUrl), `${IDB_SRC_PREFIX}${idbKey}`)
                : att.previewUrl;
            return { ...att, previewUrl: nextPreviewUrl };
          }),
        );
      }

      return { ...msg, attachments: sanitizedAttachments, videos: sanitizedVideos };
    }),
  );
}

/**
 * Resolve "idb:{id}" placeholders back to data URLs from IndexedDB.
 * Called after loading messages from localStorage.
 */
async function resolveVideoMessageSources(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      const resolvedVideos = msg.videos?.length
        ? await Promise.all(
            msg.videos.map(async (video) => {
              const src = video.src || "";
              if (!src.startsWith(IDB_SRC_PREFIX)) return video;
              const resolved = await getVideoSource(src.slice(IDB_SRC_PREFIX.length));
              return { ...video, src: resolved || src };
            }),
          )
        : msg.videos;

      const resolvedAttachments = msg.attachments?.length
        ? await Promise.all(
            msg.attachments.map(async (att) => {
              const previewUrl = att.previewUrl || "";
              if (!previewUrl.startsWith(IDB_SRC_PREFIX)) return att;
              const resolved = await getVideoSource(previewUrl.slice(IDB_SRC_PREFIX.length));
              return { ...att, previewUrl: resolved || previewUrl };
            }),
          )
        : msg.attachments;

      return { ...msg, videos: resolvedVideos, attachments: resolvedAttachments };
    }),
  );
}

/** Delete IDB entries for all videos and attachment previews (best-effort). */
async function cleanupVideoMessageSources(messages: VideoConversationMessage[]): Promise<void> {
  await Promise.allSettled([
    ...messages.flatMap((msg) => (msg.videos || []).map((v) => deleteVideoSource(v.id))),
    ...messages.flatMap((msg) => (msg.attachments || []).map((att) => deleteVideoSource(`${att.id}-preview`))),
  ]);
}

async function persistVideoMessages(vid: string): Promise<boolean> {
  if (!vid) return false;
  const messages = store.state.videoMessagesById?.[vid] || (vid === store.state.curVideoConversationId ? store.state.videoMessages || [] : []);
  const sanitized = await sanitizeMessagesForPersist(messages);
  const res = await setVideoConversationMessagesAPI(vid, sanitized);
  if (!res.flag) {
    console.error("Failed to persist video messages:", res.log);
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: res.log }) });
    return false;
  }
  return true;
}

export async function runVideoConversationTurn(request: VideoTurnRequest, onStatusUpdate?: (status: string) => void): Promise<VideoTurnResponse> {
  const result = await runVideoAITurn(request, buildVideoGenerationParams, onStatusUpdate);
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

  const handlePollStatus = (taskStatus: string) => {
    store.dispatch("setVideoRuntime", { vid: conversationId, runtime: { taskStatus } });
  };

  try {
    const response = await runVideoConversationTurn(request, handlePollStatus);
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
        taskStatus: undefined,
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
        taskStatus: undefined,
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
    const raw = JSON.parse(res.data || "[]");
    const messages = await resolveVideoMessageSources(Array.isArray(raw) ? raw : []);
    await store.dispatch("setCurVideoConversationId", vid);
    await store.dispatch("resetVideoMessages", { vid, messages });
    return true;
  } catch {
    await store.dispatch("setCurVideoConversationId", vid);
    await store.dispatch("resetVideoMessages", { vid, messages: [] });
    return false;
  }
}

export async function deleteVideoConversation(vid: string): Promise<boolean> {
  // Clean up IDB video sources before removing the conversation record.
  const msgRes = await getVideoConversationMessagesAPI(vid);
  if (msgRes.flag) {
    try {
      const messages = JSON.parse(msgRes.data || "[]") as VideoConversationMessage[];
      await cleanupVideoMessageSources(messages);
    } catch {
      // Best-effort — don't block deletion on cleanup failure.
    }
  }

  const res = await deleteVideoConversationAPI(vid);
  if (!res.flag) return false;
  await store.dispatch("deleteVideoConversation", vid);
  return true;
}
