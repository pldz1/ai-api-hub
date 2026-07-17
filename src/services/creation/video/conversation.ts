import store from "@/store";
import { tr } from "@/i18n";
import { buildVideoGenerationParams, completeRunSnapshot, createRunSnapshot } from "@/models";
import { urlToDataUrl, videoRepository } from "@/persistence";
import { dsAlert, getUuid } from "@/utils";
import { buildVideoAIParams, generateVideo, resolveVideoModel } from "@/ai-capability";
import { pushVideo } from "./gallery";
import { createCreationConversationLifecycle } from "../conversation-lifecycle";
import { createVideoMessage, emptyVideoUsage, getVideoConversationName, normalizeGeneratedVideos } from "./message";
import type { VideoGenerationParams } from "@/ai-capability";
import type { VideoConversationInfo, VideoConversationMessage, VideoTurnRequest, VideoTurnResponse } from "@/types";

async function persistVideoMessages(vid: string): Promise<boolean> {
  if (!vid) return false;
  const messages = store.state.videoMessagesById?.[vid] || (vid === store.state.curVideoConversationId ? store.state.videoMessages || [] : []);
  try {
    await videoRepository.saveMessages(vid, messages);
    return true;
  } catch (error) {
    console.error("Failed to persist video messages:", error);
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function runVideoConversationTurn(
  request: VideoTurnRequest,
  params?: VideoGenerationParams,
  onStatusUpdate?: (status: string) => void,
): Promise<VideoTurnResponse> {
  const generationParams = params || buildVideoAIParams(request, buildVideoGenerationParams);
  const result = await generateVideo(request.model, generationParams, onStatusUpdate);
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

  const generationParams = buildVideoAIParams(request, buildVideoGenerationParams);
  const resolvedModel = resolveVideoModel(request.model);
  if (!resolvedModel) throw new Error(`Unknown video provider: ${request.model.provider}`);
  const run = createRunSnapshot({
    kind: "video",
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
      imageInput: Boolean(request.first_frame || request.attachments?.some((item) => item.content_type?.startsWith("image/"))),
      audioInput: Boolean(request.attachments?.some((item) => item.content_type?.startsWith("audio/"))),
      videoInput: Boolean(request.attachments?.some((item) => item.content_type?.startsWith("video/"))),
    },
    inputCount: request.attachments?.length || 0,
  });
  const userMessage = createVideoMessage({
    role: "user",
    prompt: request.prompt,
    attachments: request.attachments || [],
  });
  const assistantMessage = createVideoMessage({
    role: "assistant",
    prompt: request.prompt,
    run,
  });

  store.commit("pushVideoMessage", { vid: conversationId, message: userMessage });
  store.commit("pushVideoMessage", { vid: conversationId, message: assistantMessage });
  await persistVideoMessages(conversationId);
  store.commit("setVideoRuntime", {
    vid: conversationId,
    runtime: {
      pending: true,
      completedNotice: false,
      activeRunId: run.id,
      providerStatus: "",
    },
  });

  let lastProviderStatus = "";
  const handlePollStatus = (taskStatus: string) => {
    lastProviderStatus = taskStatus;
    store.commit("setVideoRuntime", { vid: conversationId, runtime: { providerStatus: taskStatus } });
  };

  try {
    const response = await runVideoConversationTurn(request, generationParams, handlePollStatus);
    const completedRun = completeRunSnapshot(run, {
      status: "success",
      usage: response.usage,
      outputCount: response.videos.length,
      providerStatus: lastProviderStatus,
    });
    const completed: VideoConversationMessage = {
      ...assistantMessage,
      videos: response.videos,
      run: completedRun,
    };

    store.commit("updateVideoMessage", { vid: conversationId, message: completed });
    await persistVideoMessages(conversationId);
    store.commit("setVideoRuntime", {
      vid: conversationId,
      runtime: {
        pending: false,
        completedNotice: store.state.curVideoConversationId !== conversationId,
        activeRunId: "",
        providerStatus: undefined,
      },
    });

    for (const video of response.videos) {
      await pushVideo(request.prompt, video.src);
    }

    return completed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedRun = completeRunSnapshot(run, {
      status: "error",
      usage: emptyVideoUsage(),
      outputCount: 0,
      error: errorMessage,
      providerStatus: lastProviderStatus,
    });
    const failed: VideoConversationMessage = {
      ...assistantMessage,
      run: failedRun,
    };

    store.commit("updateVideoMessage", { vid: conversationId, message: failed });
    await persistVideoMessages(conversationId);
    store.commit("setVideoRuntime", {
      vid: conversationId,
      runtime: {
        pending: false,
        completedNotice: store.state.curVideoConversationId !== conversationId,
        activeRunId: "",
        providerStatus: undefined,
      },
    });
    return failed;
  }
}

const videoConversationLifecycle = createCreationConversationLifecycle<VideoConversationInfo, VideoConversationMessage>({
  createId: () => getUuid("vidconv"),
  createName: (name) => name || getVideoConversationName(),
  createItem: (vid, vname) => ({ vid, vname }),
  repository: {
    list: () => videoRepository.listConversations(),
    create: (vid, vname) => videoRepository.createConversation(vid, vname),
    getMessages: (vid) => videoRepository.getMessages(vid),
    delete: (vid) => videoRepository.deleteConversation(vid),
  },
  state: {
    replaceList: (items) => store.commit("resetVideoConversationList", items),
    add: (item) => store.commit("pushVideoConversation", item),
    remove: (vid) => store.commit("deleteVideoConversation", vid),
    setCurrent: (vid) => store.commit("setCurVideoConversationId", vid),
    replaceMessages: (vid, messages) => store.commit("resetVideoMessages", { vid, messages }),
  },
});

export async function getVideoConversationList(): Promise<boolean> {
  try {
    videoConversationLifecycle.loadList();
    return true;
  } catch (error) {
    console.error("Failed to load video conversations:", error);
    store.commit("resetVideoConversationList", []);
    return false;
  }
}

export async function addVideoConversation(name: string = ""): Promise<boolean> {
  try {
    await videoConversationLifecycle.create(name);
    return true;
  } catch (error) {
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function getVideoConversationMessages(vid: string): Promise<boolean> {
  try {
    await videoConversationLifecycle.select(vid);
    return true;
  } catch {
    return false;
  }
}

export async function deleteVideoConversation(vid: string): Promise<boolean> {
  try {
    await videoConversationLifecycle.remove(vid);
    return true;
  } catch (error) {
    console.error("Failed to delete video conversation:", error);
    return false;
  }
}
