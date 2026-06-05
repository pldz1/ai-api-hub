import store from "@/store";
import { tr } from "@/i18n";
import { buildImageGenerationParams } from "@/models";
import { dsAlert, getUuid } from "@/utils";
import { runImageAITurn } from "@/ai-capability";
import { urlToDataUrl, setImageSource, getImageSource, deleteImageSource } from "@/services/app/storage";
import {
  addImageConversationAPI,
  deleteImageConversationAPI,
  getImageConversationListAPI,
  getImageConversationMessagesAPI,
  setImageConversationMessagesAPI,
} from "./api";
import { pushImage } from "./gallery";
import { createImageMessage, emptyImageUsage, getImageConversationName, normalizeGeneratedImages } from "./message";
import type { ImageConversationInfo, ImageConversationMessage, ImageTurnRequest, ImageTurnResponse } from "@/types";

const IDB_SRC_PREFIX = "idb:";

/**
 * Offload generated image src and attachment previewUrls to IndexedDB.
 * Replaces data URLs with "idb:{key}" placeholders safe for localStorage.
 */
async function sanitizeImageMessagesForPersist(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      // Offload generated image srcs.
      let sanitizedImages = msg.images;
      if (msg.images?.length) {
        sanitizedImages = await Promise.all(
          msg.images.map(async (image) => {
            const src = image.src || "";
            if (!src || src.startsWith(IDB_SRC_PREFIX) || !src.startsWith("data:")) return image;
            await setImageSource(image.id, src);
            return { ...image, src: `${IDB_SRC_PREFIX}${image.id}` };
          }),
        );
      }

      // Offload attachment previewUrls; strip raw data field.
      let sanitizedAttachments = msg.attachments;
      if (msg.attachments?.length) {
        sanitizedAttachments = await Promise.all(
          msg.attachments.map(async (att) => {
            const previewUrl = att.previewUrl || "";
            const idbKey = `${att.id}-preview`;
            const nextPreviewUrl =
              previewUrl && !previewUrl.startsWith(IDB_SRC_PREFIX) && previewUrl.startsWith("data:")
                ? (await setImageSource(idbKey, previewUrl), `${IDB_SRC_PREFIX}${idbKey}`)
                : att.previewUrl;
            return { ...att, data: "", previewUrl: nextPreviewUrl };
          }),
        );
      }

      return { ...msg, images: sanitizedImages, attachments: sanitizedAttachments };
    }),
  );
}

/**
 * Resolve "idb:{key}" placeholders back to data URLs from IndexedDB.
 */
async function resolveImageMessageSources(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      const resolvedImages = msg.images?.length
        ? await Promise.all(
            msg.images.map(async (image) => {
              const src = image.src || "";
              if (!src.startsWith(IDB_SRC_PREFIX)) return image;
              const resolved = await getImageSource(src.slice(IDB_SRC_PREFIX.length));
              return { ...image, src: resolved || src };
            }),
          )
        : msg.images;

      const resolvedAttachments = msg.attachments?.length
        ? await Promise.all(
            msg.attachments.map(async (att) => {
              const previewUrl = att.previewUrl || "";
              if (!previewUrl.startsWith(IDB_SRC_PREFIX)) return att;
              const resolved = await getImageSource(previewUrl.slice(IDB_SRC_PREFIX.length));
              return { ...att, previewUrl: resolved || previewUrl };
            }),
          )
        : msg.attachments;

      return { ...msg, images: resolvedImages, attachments: resolvedAttachments };
    }),
  );
}

/** Delete IDB entries for all media in the given messages (best-effort). */
async function cleanupImageMessageSources(messages: ImageConversationMessage[]): Promise<void> {
  await Promise.allSettled([
    ...messages.flatMap((msg) => (msg.images || []).filter((img) => img.src?.startsWith(IDB_SRC_PREFIX) || img.id).map((img) => deleteImageSource(img.id))),
    ...messages.flatMap((msg) => (msg.attachments || []).map((att) => deleteImageSource(`${att.id}-preview`))),
  ]);
}

async function persistImageMessages(iid: string): Promise<boolean> {
  if (!iid) return false;
  const messages = store.state.imageMessagesById?.[iid] || (iid === store.state.curImageConversationId ? store.state.imageMessages || [] : []);
  const sanitized = await sanitizeImageMessagesForPersist(messages);
  const res = await setImageConversationMessagesAPI(iid, sanitized);
  if (!res.flag) {
    console.error("Failed to persist image messages:", res.log);
    dsAlert({ type: "error", message: tr("toast.imagePushFailed", { error: res.log }) });
    return false;
  }
  return true;
}

export async function runImageConversationTurn(request: ImageTurnRequest): Promise<ImageTurnResponse> {
  const result = await runImageAITurn(request, buildImageGenerationParams);
  const { payloads, errors } = normalizeGeneratedImages(request.prompt, result.images || []);
  if (errors.length > 0 && payloads.length === 0) throw new Error(errors.join("\n"));

  // Convert remote URLs to inline data URLs so conversation messages never
  // reference third-party origins (avoids Tracking Prevention warnings and
  // signed-URL expiry for OSS-hosted images).
  const resolvedPayloads = await Promise.all(
    payloads.map(async (p) => {
      try {
        return { ...p, src: await urlToDataUrl(p.src) };
      } catch {
        return p; // keep the original URL as fallback
      }
    }),
  );

  return {
    mode: request.mode,
    prompt: request.prompt,
    images: resolvedPayloads,
    usage: result.usage || emptyImageUsage(),
    raw: result.raw,
  };
}

export async function submitImageMessage(request: ImageTurnRequest): Promise<ImageConversationMessage | null> {
  let conversationId = store.state.curImageConversationId || "";
  if (!conversationId) {
    const created = await addImageConversation(getImageConversationName(request.prompt));
    if (!created) return null;
    conversationId = store.state.curImageConversationId || "";
  }

  const mode = request.attachments?.length ? "edit" : "generation";
  const userMessage = createImageMessage({
    role: "user",
    mode,
    prompt: request.prompt,
    attachments: request.attachments || [],
    status: "success",
    modelName: request.model?.name || request.model?.model || "",
    size: request.size,
  });
  const assistantMessage = createImageMessage({
    role: "assistant",
    mode,
    prompt: request.prompt,
    status: "loading",
    modelName: request.model?.name || request.model?.model || "",
    size: request.size,
  });

  await store.dispatch("pushImageMessage", { iid: conversationId, message: userMessage });
  await store.dispatch("pushImageMessage", { iid: conversationId, message: assistantMessage });
  await persistImageMessages(conversationId);
  await store.dispatch("setImageRuntime", {
    iid: conversationId,
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
    const response = await runImageConversationTurn({
      ...request,
      mode,
    });
    const elapsedMs = performance.now() - startedAt;
    const completed = {
      ...assistantMessage,
      images: response.images,
      status: "success" as const,
      usage: response.usage,
      elapsedMs,
    };

    await store.dispatch("updateImageMessage", { iid: conversationId, message: completed });
    await persistImageMessages(conversationId);
    await store.dispatch("setImageRuntime", {
      iid: conversationId,
      runtime: {
        pending: false,
        status: "success",
        completedNotice: store.state.curImageConversationId !== conversationId,
        elapsedMs,
        error: "",
      },
    });

    for (const image of response.images) {
      await pushImage(request.prompt, image.src);
    }

    return completed;
  } catch (error) {
    const elapsedMs = performance.now() - startedAt;
    const failed = {
      ...assistantMessage,
      status: "error" as const,
      error: error instanceof Error ? error.message : String(error),
      usage: emptyImageUsage(),
      elapsedMs,
    };

    await store.dispatch("updateImageMessage", { iid: conversationId, message: failed });
    await persistImageMessages(conversationId);
    await store.dispatch("setImageRuntime", {
      iid: conversationId,
      runtime: {
        pending: false,
        status: "error",
        completedNotice: store.state.curImageConversationId !== conversationId,
        elapsedMs,
        error: failed.error,
      },
    });
    return failed;
  }
}

export async function getImageConversationList(): Promise<boolean> {
  const res = await getImageConversationListAPI();
  if (!res.flag || !Array.isArray(res.data)) {
    await store.dispatch("resetImageConversationList", []);
    return false;
  }
  await store.dispatch("resetImageConversationList", res.data);
  return true;
}

export async function addImageConversation(name = ""): Promise<boolean> {
  const iid = getUuid("imgconv");
  const iname = name || getImageConversationName();
  const res = await addImageConversationAPI(iid, iname);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.imagePushFailed", { error: res.log }) });
    return false;
  }
  const item: ImageConversationInfo = { iid, iname };
  await store.dispatch("pushImageConversation", item);
  await store.dispatch("setCurImageConversationId", iid);
  await store.dispatch("resetImageMessages", { iid, messages: [] });
  return true;
}

export async function getImageConversationMessages(iid: string): Promise<boolean> {
  if (!iid) {
    await store.dispatch("setCurImageConversationId", "");
    return true;
  }

  const res = await getImageConversationMessagesAPI(iid);
  if (!res.flag) return false;
  try {
    const raw = JSON.parse(res.data || "[]");
    const messages = await resolveImageMessageSources(Array.isArray(raw) ? raw : []);
    await store.dispatch("setCurImageConversationId", iid);
    await store.dispatch("resetImageMessages", { iid, messages });
    return true;
  } catch {
    await store.dispatch("setCurImageConversationId", iid);
    await store.dispatch("resetImageMessages", { iid, messages: [] });
    return false;
  }
}

export async function deleteImageConversation(iid: string): Promise<boolean> {
  const msgRes = await getImageConversationMessagesAPI(iid);
  if (msgRes.flag) {
    try {
      const messages = JSON.parse(msgRes.data || "[]") as ImageConversationMessage[];
      await cleanupImageMessageSources(messages);
    } catch {
      // Best-effort — don't block deletion on cleanup failure.
    }
  }

  const res = await deleteImageConversationAPI(iid);
  if (!res.flag) return false;
  await store.dispatch("deleteImageConversation", iid);
  return true;
}
