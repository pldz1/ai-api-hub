import store from "@/store";
import { tr } from "@/i18n";
import { buildImageGenerationParams, completeRunSnapshot, createRunSnapshot } from "@/models";
import { imageRepository, urlToDataUrl } from "@/persistence";
import { dsAlert, getUuid } from "@/utils";
import { buildImageAIParams, generateImage, resolveImageModel } from "@/ai-capability";
import { pushImage } from "./gallery";
import { createCreationConversationLifecycle } from "../conversation-lifecycle";
import { createImageMessage, emptyImageUsage, getImageConversationName, normalizeGeneratedImages } from "./message";
import type { ImageGenerationParams } from "@/ai-capability";
import type { ImageConversationInfo, ImageConversationMessage, ImageTurnRequest, ImageTurnResponse } from "@/types";

async function persistImageMessages(iid: string): Promise<boolean> {
  if (!iid) return false;
  const messages = store.state.imageMessagesById?.[iid] || (iid === store.state.curImageConversationId ? store.state.imageMessages || [] : []);
  try {
    await imageRepository.saveMessages(iid, messages);
    return true;
  } catch (error) {
    console.error("Failed to persist image messages:", error);
    dsAlert({ type: "error", message: tr("toast.imagePushFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function runImageConversationTurn(request: ImageTurnRequest, params?: ImageGenerationParams): Promise<ImageTurnResponse> {
  const generationParams = params || buildImageAIParams(request, buildImageGenerationParams);
  const result = await generateImage(request.model, generationParams);
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

  const mode: ImageTurnRequest["mode"] = request.attachments?.length ? "edit" : "generation";
  const normalizedRequest: ImageTurnRequest = { ...request, mode };
  const generationParams = buildImageAIParams(normalizedRequest, buildImageGenerationParams);
  const resolvedModel = resolveImageModel(request.model);
  if (!resolvedModel) throw new Error(`Unknown image provider: ${request.model.provider}`);
  const run = createRunSnapshot({
    kind: "image",
    route: {
      knownModel: resolvedModel.knownModel,
      bindingKey: resolvedModel.binding.key,
      provider: resolvedModel.config.provider,
      model: resolvedModel.config.model,
      adapterId: resolvedModel.binding.adapterId,
      connectionURL: resolvedModel.config.baseURL,
    },
    params: generationParams,
    capabilities: {
      imageInput: mode === "edit" && Boolean(request.attachments?.length),
      maskInput: mode === "edit" && Number(request.attachments?.length || 0) > 1,
    },
    inputCount: request.attachments?.length || 0,
  });
  const userMessage = createImageMessage({
    role: "user",
    mode,
    prompt: request.prompt,
    attachments: request.attachments || [],
  });
  const assistantMessage = createImageMessage({
    role: "assistant",
    mode,
    prompt: request.prompt,
    run,
  });

  store.commit("pushImageMessage", { iid: conversationId, message: userMessage });
  store.commit("pushImageMessage", { iid: conversationId, message: assistantMessage });
  await persistImageMessages(conversationId);
  store.commit("setImageRuntime", {
    iid: conversationId,
    runtime: {
      pending: true,
      completedNotice: false,
      activeRunId: run.id,
    },
  });

  try {
    const response = await runImageConversationTurn(normalizedRequest, generationParams);
    const completedRun = completeRunSnapshot(run, {
      status: "success",
      usage: response.usage,
      outputCount: response.images.length,
    });
    const completed = {
      ...assistantMessage,
      images: response.images,
      run: completedRun,
    };

    store.commit("updateImageMessage", { iid: conversationId, message: completed });
    await persistImageMessages(conversationId);
    store.commit("setImageRuntime", {
      iid: conversationId,
      runtime: {
        pending: false,
        completedNotice: store.state.curImageConversationId !== conversationId,
        activeRunId: "",
      },
    });

    for (const image of response.images) {
      await pushImage(request.prompt, image.src);
    }

    return completed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedRun = completeRunSnapshot(run, {
      status: "error",
      usage: emptyImageUsage(),
      outputCount: 0,
      error: errorMessage,
    });
    const failed = {
      ...assistantMessage,
      run: failedRun,
    };

    store.commit("updateImageMessage", { iid: conversationId, message: failed });
    await persistImageMessages(conversationId);
    store.commit("setImageRuntime", {
      iid: conversationId,
      runtime: {
        pending: false,
        completedNotice: store.state.curImageConversationId !== conversationId,
        activeRunId: "",
      },
    });
    return failed;
  }
}

const imageConversationLifecycle = createCreationConversationLifecycle<ImageConversationInfo, ImageConversationMessage>({
  createId: () => getUuid("imgconv"),
  createName: (name) => name || getImageConversationName(),
  createItem: (iid, iname) => ({ iid, iname }),
  repository: {
    list: () => imageRepository.listConversations(),
    create: (iid, iname) => imageRepository.createConversation(iid, iname),
    getMessages: (iid) => imageRepository.getMessages(iid),
    delete: (iid) => imageRepository.deleteConversation(iid),
  },
  state: {
    replaceList: (items) => store.commit("resetImageConversationList", items),
    add: (item) => store.commit("pushImageConversation", item),
    remove: (iid) => store.commit("deleteImageConversation", iid),
    setCurrent: (iid) => store.commit("setCurImageConversationId", iid),
    replaceMessages: (iid, messages) => store.commit("resetImageMessages", { iid, messages }),
  },
});

export async function getImageConversationList(): Promise<boolean> {
  try {
    imageConversationLifecycle.loadList();
    return true;
  } catch (error) {
    console.error("Failed to load image conversations:", error);
    store.commit("resetImageConversationList", []);
    return false;
  }
}

export async function addImageConversation(name = ""): Promise<boolean> {
  try {
    await imageConversationLifecycle.create(name);
    return true;
  } catch (error) {
    dsAlert({ type: "error", message: tr("toast.imagePushFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function getImageConversationMessages(iid: string): Promise<boolean> {
  try {
    await imageConversationLifecycle.select(iid);
    return true;
  } catch {
    return false;
  }
}

export async function deleteImageConversation(iid: string): Promise<boolean> {
  try {
    await imageConversationLifecycle.remove(iid);
    return true;
  } catch (error) {
    console.error("Failed to delete image conversation:", error);
    return false;
  }
}
