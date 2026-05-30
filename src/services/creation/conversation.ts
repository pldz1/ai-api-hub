import store from "@/store";
import { tr } from "@/i18n";
import { buildImageGenerationParams } from "@/models";
import { dsAlert, getUuid } from "@/utils";
import { runImageAITurn } from "@/ai-capability";
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

async function persistImageMessages(iid: string): Promise<boolean> {
  if (!iid) return false;
  const messages = store.state.imageMessagesById?.[iid] || (iid === store.state.curImageConversationId ? store.state.imageMessages || [] : []);
  const res = await setImageConversationMessagesAPI(iid, messages);
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

  return {
    mode: request.mode,
    prompt: request.prompt,
    images: payloads,
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
