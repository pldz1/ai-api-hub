import store from "@/store";
import { tr } from "@/i18n";
import { buildImageGenerationParams } from "@/models";
import { apiRequest } from "../app";
import { dsAlert, getUuid } from "@/utils";
import { generateImageByProvider } from "./providers";
import type { ApiResponse, ImageConversationListItem, ImageDataItem } from "@/services/types";
import type { TokenUsage } from "@/services/chat/types";
import type { ImageConversationInfo, ImageConversationMessage, ImageInputAttachment, ImagePayload, ImageTurnRequest, ImageTurnResponse } from "@/types";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel } from "./types";

/**
 * Image service.
 *
 * Owns image generation entrypoints, image conversations, and the persisted
 * gallery list. Provider request details live under `image/providers`.
 */

const emptyUsage = (): TokenUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
});

const getImageListAPI = (): Promise<ApiResponse<ImageDataItem[]>> => apiRequest("post", "/_api/image/getImageList", {});

const pushImageAPI = (id: string, prompt: string, url: string): Promise<ApiResponse<ImageDataItem>> =>
  apiRequest("post", "/_api/image/pushImage", {
    image_id: id,
    image_prompt: prompt,
    image_url: url,
  });

const deleteImageAPI = (id: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/deleteImage", {
    image_id: id,
  });

const getImageConversationListAPI = (): Promise<ApiResponse<ImageConversationListItem[]>> => apiRequest("post", "/_api/image/getConversationList", {});

const addImageConversationAPI = (iid: string, iname: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/image/addConversation", { iid, iname });

const deleteImageConversationAPI = (iid: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/image/deleteConversation", { iid });

const getImageConversationMessagesAPI = (iid: string): Promise<ApiResponse<string>> => apiRequest("post", "/_api/image/getConversationMessages", { iid });

const setImageConversationMessagesAPI = (iid: string, messages: ImageConversationMessage[]): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/setConversationMessages", {
    iid,
    messages: JSON.stringify(messages),
  });

function createImageMessage(payload: Partial<ImageConversationMessage> = {}): ImageConversationMessage {
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

function attachmentParams(mode: ImageTurnRequest["mode"], attachments: ImageInputAttachment[] = []) {
  if (mode !== "edit" || attachments.length === 0) return {};
  const [image, mask] = attachments;

  return {
    image: image
      ? {
          filename: image.filename,
          content_type: image.content_type,
          data: image.data,
        }
      : undefined,
    mask: mask
      ? {
          filename: mask.filename,
          content_type: mask.content_type,
          data: mask.data,
        }
      : undefined,
  };
}

function normalizeGeneratedImages(prompt: string, images: Array<{ type: "url" | "text"; data: string }> = []): { payloads: ImagePayload[]; errors: string[] } {
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

function getImageConversationName(prompt = ""): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 28);
  const date = new Date();
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `Image ${monthDay} ${time}`;
}

async function persistImageMessages(iid: string): Promise<boolean> {
  if (!iid) return false;
  const messages = store.state.imageMessagesById?.[iid] || (iid === store.state.curImageConversationId ? store.state.imageMessages || [] : []);
  const res = await setImageConversationMessagesAPI(iid, messages);
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.imagePushFailed", { error: res.log }) });
    return false;
  }
  return true;
}

export async function generateImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImageByProvider(model, params);
}

export async function runImageConversationTurn(request: ImageTurnRequest): Promise<ImageTurnResponse> {
  const baseParams = buildImageGenerationParams(request.model, {
    model: request.model,
    prompt: request.prompt,
    size: request.size || "1024x1024",
    n: request.n || 1,
    quality: request.quality || "auto",
    output_format: request.outputFormat || "png",
    ...attachmentParams(request.mode, request.attachments || []),
  });

  const result = await generateImageByProvider(request.model, {
    ...baseParams,
    prompt: request.prompt,
    size: request.size || "1024x1024",
    n: request.n || 1,
    quality: request.quality || String(baseParams.quality || "auto"),
    outputFormat: request.outputFormat || String(baseParams.output_format || "png"),
  });

  const { payloads, errors } = normalizeGeneratedImages(request.prompt, result.images || []);
  if (errors.length > 0 && payloads.length === 0) throw new Error(errors.join("\n"));

  return {
    mode: request.mode,
    prompt: request.prompt,
    images: payloads,
    usage: result.usage || emptyUsage(),
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
      usage: emptyUsage(),
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
    const messages = JSON.parse(res.data || "[]");
    await store.dispatch("setCurImageConversationId", iid);
    await store.dispatch("resetImageMessages", { iid, messages: Array.isArray(messages) ? messages : [] });
    return true;
  } catch {
    await store.dispatch("setCurImageConversationId", iid);
    await store.dispatch("resetImageMessages", { iid, messages: [] });
    return false;
  }
}

export async function deleteImageConversation(iid: string): Promise<boolean> {
  const res = await deleteImageConversationAPI(iid);
  if (!res.flag) return false;
  await store.dispatch("deleteImageConversation", iid);
  return true;
}

export async function getImageList(): Promise<boolean> {
  const res = await getImageListAPI();
  if (!res.flag) {
    await store.dispatch("resetImageList", []);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: res.log }) });
    return false;
  }

  if (!Array.isArray(res.data)) {
    await store.dispatch("resetImageList", []);
    dsAlert({
      type: "error",
      message: tr("toast.imageListInvalid"),
    });
    return false;
  }

  const reversed = res.data.slice().reverse();
  await store.dispatch("resetImageList", reversed);
  return true;
}

export async function pushImage(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("img");
  const res = await pushImageAPI(id, prompt, url);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("pushImage", res.data?.id ? res.data : { id, prompt, src: url });

  return true;
}

export async function deleteImage(id: string): Promise<boolean> {
  const res = await deleteImageAPI(id);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("deleteImage", id);
  return true;
}
