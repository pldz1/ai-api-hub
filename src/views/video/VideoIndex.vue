<template>
  <section class="video-chat-page">
    <div ref="messageScrollRef" class="video-message-scroll">
      <div v-if="messages.length === 0" class="video-empty-state">
        <h1>{{ t("video.workspaceTitle") }}</h1>
        <p>{{ t("video.workspaceDescription") }}</p>
      </div>

      <VideoMessageList
        v-else
        :messages="messages"
        :runtime-tick="runtimeTick"
        :loading-status-text="loadingStatusText"
        :reuse-disabled="isCurrentConversationSubmitting"
        @reuse="reuseInput"
      />
    </div>

    <ComposerDock>
      <CreationComposer
        ref="composerRef"
        v-model="prompt"
        v-model:model-index="selectedModelIndex"
        :root-class="['video-composer', { 'has-media': Boolean(firstFrame || lastFrame || drivingAudio) }]"
        :model-options="videoModelOptions"
        :model-placeholder="availableModels.length ? t('video.selectModel') : t('video.videoModelNotConfigured')"
        :model-disabled="isCurrentConversationSubmitting || availableModels.length === 0"
        :placeholder="t('video.generatePromptPlaceholder')"
        :send-disabled="isSendDisabled"
        :settings-tooltip="t('tooltip.modelSettings')"
        @paste="onPaste"
        @send="send"
        @settings="onShowModelSettings"
      >
        <template #media>
          <!-- Media slots: shown/hidden based on model capabilities -->
          <div v-if="activeCapabilities.imageInput || activeCapabilities.audioInput" class="video-media-slots">
            <!-- First frame slot (image-to-video / reference-to-video) -->
            <div v-if="activeCapabilities.imageInput" class="video-media-slot" :class="{ filled: !!firstFrame }" @click="openFirstFramePicker">
              <div v-if="firstFrame" class="video-media-preview">
                <img :src="firstFrame.previewUrl" :alt="firstFrame.filename" />
                <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="firstFrame = null">&times;</button>
                <span class="video-media-tag">{{ t("video.firstFrame") }}</span>
              </div>
              <div v-else class="video-media-empty">
                <SvgIcon :src="imageIcon" class="video-media-empty-icon" />
                <span>{{ t("video.firstFrameHint") }}</span>
              </div>
            </div>

            <!-- Last frame slot (image-to-video / reference-to-video) -->
            <div v-if="activeCapabilities.imageInput" class="video-media-slot" :class="{ filled: !!lastFrame }" @click="openLastFramePicker">
              <div v-if="lastFrame" class="video-media-preview">
                <img :src="lastFrame.previewUrl" :alt="lastFrame.filename" />
                <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="lastFrame = null">&times;</button>
                <span class="video-media-tag">{{ t("video.lastFrame") }}</span>
              </div>
              <div v-else class="video-media-empty">
                <SvgIcon :src="imageIcon" class="video-media-empty-icon" />
                <span>{{ t("video.lastFrameHint") }}</span>
              </div>
            </div>

            <!-- Driving audio slot -->
            <div v-if="activeCapabilities.audioInput" class="video-media-slot" :class="{ filled: !!drivingAudio }" @click="openAudioPicker">
              <div v-if="drivingAudio" class="video-media-preview">
                <span class="video-media-audio-name">{{ drivingAudio.filename }}</span>
                <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="drivingAudio = null">&times;</button>
                <span class="video-media-tag">{{ t("video.drivingAudio") }}</span>
              </div>
              <div v-else class="video-media-empty">
                <SvgIcon :src="audioIcon" class="video-media-empty-icon" />
                <span>{{ t("video.drivingAudioHint") }}</span>
              </div>
            </div>
          </div>
        </template>
      </CreationComposer>
      <input ref="firstFrameInputRef" class="video-file-input" type="file" accept="image/*" @change="onFirstFrameChange" />
      <input ref="lastFrameInputRef" class="video-file-input" type="file" accept="image/*" @change="onLastFrameChange" />
      <input ref="audioInputRef" class="video-file-input" type="file" accept="audio/*" @change="onAudioFileChange" />
    </ComposerDock>
    <ImageModal />
    <VideoSettings ref="videoSettingsRef" :model="selectedModel" :settings="videoSettings" @close="onVideoSettingsClose" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/store";
import ComposerDock from "@/components/ComposerDock.vue";
import CreationComposer from "@/components/CreationComposer.vue";
import ImageModal from "@/components/ImageModal.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import VideoMessageList from "@/views/video/VideoMessageList.vue";
import VideoSettings from "@/views/video/VideoSettings.vue";
import type { VideoSettingsData } from "@/views/video/VideoSettings.vue";
import audioIcon from "@/assets/svg/attach24.svg";
import imageIcon from "@/assets/svg/navImage24.svg";
import { addVideoConversation, getVideoConversationMessages, submitVideoMessage } from "@/services/creation";
import { getVideoModelCapabilities, getVideoModelType } from "@/models";
import { dsAlert, getUuid } from "@/utils";
import type { VideoConversationMessage, VideoInputAttachment, VideoModelConfig } from "@/types";

const MAX_MEDIA_MB = 20;
type CreationComposerRef = {
  focus: () => void;
  resizeTextarea: () => void;
};

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const prompt = ref("");
const selectedModelIndex = ref(-1);
const firstFrame = ref<VideoInputAttachment | null>(null);
const lastFrame = ref<VideoInputAttachment | null>(null);
const drivingAudio = ref<VideoInputAttachment | null>(null);
const isSubmitting = ref(false);
const firstFrameInputRef = ref<HTMLInputElement | null>(null);
const lastFrameInputRef = ref<HTMLInputElement | null>(null);
const audioInputRef = ref<HTMLInputElement | null>(null);
const messageScrollRef = ref<HTMLElement | null>(null);
const composerRef = ref<CreationComposerRef | null>(null);
const videoSettingsRef = ref<{ openDialog: () => void } | null>(null);
const videoSettings = ref<VideoSettingsData>({ resolution: "720P", duration: 5 });
let runtimeTimer: number | null = null;

const messages = computed<VideoConversationMessage[]>(() => store.state.videoMessages || []);
const routeVideoId = computed(() => (typeof route.params.vid === "string" ? route.params.vid : ""));
const activeVideoRuntime = computed(() => (routeVideoId.value ? store.state.videoRuntimeById?.[routeVideoId.value] || null : store.state.videoRuntime || null));
const runtimeTick = ref(Date.now());
const availableModels = computed<VideoModelConfig[]>(() => store.state.models.video || []);
const selectedModel = computed<VideoModelConfig | null>(() => availableModels.value[selectedModelIndex.value] || null);

const activeCapabilities = computed(() => getVideoModelCapabilities(selectedModel.value));

const modelGroups = computed(() => {
  const t2v: { model: VideoModelConfig; index: number }[] = [];
  const i2v: { model: VideoModelConfig; index: number }[] = [];
  const r2v: { model: VideoModelConfig; index: number }[] = [];
  availableModels.value.forEach((model, index) => {
    const type = getVideoModelType(model);
    if (type === "r2v") r2v.push({ model, index });
    else if (type === "i2v") i2v.push({ model, index });
    else t2v.push({ model, index });
  });
  return { t2v, i2v, r2v };
});
const videoModelOptions = computed(() => {
  const hasGroups = modelGroups.value.t2v.length || modelGroups.value.i2v.length || modelGroups.value.r2v.length;
  if (!hasGroups) {
    return availableModels.value.map((model, index) => ({
      label: model.name || model.model,
      value: index,
    }));
  }
  return [
    ...modelGroups.value.t2v.map(({ model, index }) => ({ label: model.name || model.model, value: index, group: t("video.modelType.t2v") })),
    ...modelGroups.value.i2v.map(({ model, index }) => ({ label: model.name || model.model, value: index, group: t("video.modelType.i2v") })),
    ...modelGroups.value.r2v.map(({ model, index }) => ({ label: model.name || model.model, value: index, group: t("video.modelType.r2v") })),
  ];
});

const loadingStatusText = computed(() => {
  const ts = activeVideoRuntime.value?.providerStatus;
  if (ts === "PENDING") return t("video.taskStatus.pending");
  if (ts === "RUNNING") return t("video.taskStatus.running");
  return t("video.processingRequest");
});

const isCurrentConversationSubmitting = computed(() => Boolean(activeVideoRuntime.value?.pending));
const isSendDisabled = computed(() => isCurrentConversationSubmitting.value || !prompt.value.trim() || !selectedModel.value);

function isNearScrollBottom(threshold = 120) {
  const el = messageScrollRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function scrollToBottom(behavior: ScrollBehavior = "auto") {
  nextTick(() => {
    const el = messageScrollRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  });
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return {
    contentType: match?.[1] || "image/png",
    data: match?.[2] || dataUrl,
  };
}

const MAX_IMAGE_DIM = 1024;

function resizeImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= MAX_IMAGE_DIM && height <= MAX_IMAGE_DIM) {
        resolve(dataUrl);
        return;
      }
      if (width > height) {
        height = Math.round(height * (MAX_IMAGE_DIM / width));
        width = MAX_IMAGE_DIM;
      } else {
        width = Math.round(width * (MAX_IMAGE_DIM / height));
        height = MAX_IMAGE_DIM;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readFileAsAttachment(file: File): Promise<VideoInputAttachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
      resolve(null);
      return;
    }

    if (file.size / (1024 * 1024) > MAX_MEDIA_MB) {
      dsAlert({ type: "error", message: t("toast.fileTooLarge", { max: MAX_MEDIA_MB }) });
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        let previewUrl = String(reader.result || "");
        // Resize large images to keep the base64 payload within API limits.
        if (file.type.startsWith("image/")) {
          previewUrl = await resizeImageDataUrl(previewUrl);
        }
        const { contentType, data } = splitDataUrl(previewUrl);
        resolve({
          id: getUuid("vidinput"),
          filename: file.name || "media",
          content_type: contentType,
          data,
          previewUrl,
        });
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => {
      dsAlert({ type: "error", message: t("video.mediaReadFailed") });
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

function openFirstFramePicker() {
  firstFrameInputRef.value?.click();
}

function openLastFramePicker() {
  lastFrameInputRef.value?.click();
}

function openAudioPicker() {
  audioInputRef.value?.click();
}

async function onFirstFrameChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) {
    const att = await readFileAsAttachment(target.files[0]);
    if (att && att.content_type?.startsWith("image/")) {
      firstFrame.value = att;
    }
  }
  target.value = "";
}

async function onLastFrameChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) {
    const att = await readFileAsAttachment(target.files[0]);
    if (att && att.content_type?.startsWith("image/")) {
      lastFrame.value = att;
    }
  }
  target.value = "";
}

async function onAudioFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) {
    const att = await readFileAsAttachment(target.files[0]);
    if (att) {
      drivingAudio.value = att;
    }
  }
  target.value = "";
}

async function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(Boolean) as File[];

  if (!files.length) return;
  event.preventDefault();

  for (const file of files) {
    const att = await readFileAsAttachment(file);
    if (!att) continue;
    if (att.content_type?.startsWith("image/")) {
      if (!firstFrame.value) firstFrame.value = att;
      else if (!lastFrame.value) lastFrame.value = att;
    } else if (att.content_type?.startsWith("audio/") && !drivingAudio.value) {
      drivingAudio.value = att;
    }
  }
}

function focusPromptInput() {
  nextTick(() => composerRef.value?.focus());
}

function onShowModelSettings() {
  if (!selectedModel.value) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  videoSettingsRef.value?.openDialog();
}

function onVideoSettingsClose(settings: VideoSettingsData) {
  videoSettings.value = settings;
}

function buildAttachments(): VideoInputAttachment[] {
  const atts: VideoInputAttachment[] = [];
  if (firstFrame.value) atts.push(firstFrame.value);
  if (lastFrame.value) atts.push(lastFrame.value);
  if (drivingAudio.value) atts.push(drivingAudio.value);
  return atts;
}

function reuseInput(message: VideoConversationMessage) {
  if (message.role !== "user" || isCurrentConversationSubmitting.value) return;
  prompt.value = message.prompt;
  const sourceAttachments = (message.attachments || []).map((attachment) => ({ ...attachment }));
  const imageAttachments = sourceAttachments.filter((attachment) => attachment.content_type?.startsWith("image/"));
  firstFrame.value = imageAttachments[0] || null;
  lastFrame.value = imageAttachments[1] || null;
  drivingAudio.value = sourceAttachments.find((attachment) => attachment.content_type?.startsWith("audio/")) || null;

  const index = messages.value.findIndex((item) => item.id === message.id);
  const run = messages.value[index + 1]?.role === "assistant" ? messages.value[index + 1].run : null;
  if (run) {
    const modelIndex = availableModels.value.findIndex((model) => model.provider === run.route.provider && model.model === run.route.model);
    if (modelIndex >= 0) selectedModelIndex.value = modelIndex;
    videoSettings.value = {
      ...videoSettings.value,
      ...run.request.params,
      resolution: String(run.request.params.resolution || videoSettings.value.resolution),
      duration: Number(run.request.params.duration || videoSettings.value.duration),
    };
  }
  nextTick(() => {
    composerRef.value?.resizeTextarea();
    composerRef.value?.focus();
  });
}

async function send() {
  if (isSendDisabled.value || !selectedModel.value) return;

  const currentPrompt = prompt.value.trim();
  const currentFirstFrame = firstFrame.value;
  const currentLastFrame = lastFrame.value;
  const currentDrivingAudio = drivingAudio.value;
  const currentAttachments = buildAttachments();

  isSubmitting.value = true;
  prompt.value = "";
  firstFrame.value = null;
  lastFrame.value = null;
  drivingAudio.value = null;
  nextTick(() => composerRef.value?.resizeTextarea());

  if (!routeVideoId.value) {
    const created = await addVideoConversation(currentPrompt.slice(0, 28));
    if (!created || !store.state.curVideoConversationId) {
      isSubmitting.value = false;
      return;
    }
    await router.replace({ name: "video", params: { vid: store.state.curVideoConversationId } });
  }

  const result = await submitVideoMessage({
    prompt: currentPrompt,
    model: selectedModel.value,
    resolution: videoSettings.value.resolution,
    duration: videoSettings.value.duration,
    promptExtend: (videoSettings.value.prompt_extend as boolean) ?? true,
    watermark: (videoSettings.value.watermark as boolean) ?? true,
    attachments: currentAttachments,
    first_frame: currentFirstFrame || undefined,
    last_frame: currentLastFrame || undefined,
  });

  if (result?.run?.status === "error") {
    dsAlert({ type: "error", message: result.run.error || t("video.videoRequestFailed") });
  }

  isSubmitting.value = false;
  scrollToBottom();
}

watch(
  () => routeVideoId.value,
  async (id) => {
    if (!id) {
      await getVideoConversationMessages(id);
      store.commit("resetVideoRuntime");
      isSubmitting.value = false;
      prompt.value = "";
      firstFrame.value = null;
      lastFrame.value = null;
      drivingAudio.value = null;
      composerRef.value?.resizeTextarea();
    } else if (store.state.videoLoadedById?.[id]) {
      store.commit("setCurVideoConversationId", id);
    } else {
      await getVideoConversationMessages(id);
    }
    scrollToBottom();
  },
  { immediate: true },
);

watch(
  availableModels,
  (models) => {
    if (!models.length) {
      selectedModelIndex.value = -1;
      return;
    }
    if (selectedModelIndex.value < 0 || selectedModelIndex.value >= models.length) {
      selectedModelIndex.value = 0;
    }
  },
  { immediate: true },
);

watch(
  () => messages.value.length,
  () => {
    if (isNearScrollBottom()) scrollToBottom();
  },
);

watch(
  () => activeVideoRuntime.value?.pending,
  (running, _oldValue, onCleanup) => {
    if (runtimeTimer !== null) {
      window.clearInterval(runtimeTimer);
      runtimeTimer = null;
    }

    if (running) {
      runtimeTick.value = Date.now();
      runtimeTimer = window.setInterval(() => {
        runtimeTick.value = Date.now();
      }, 100);
    }

    onCleanup(() => {
      if (runtimeTimer !== null) {
        window.clearInterval(runtimeTimer);
        runtimeTimer = null;
      }
    });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (runtimeTimer !== null) window.clearInterval(runtimeTimer);
});
</script>

<style lang="scss" scoped>
.video-chat-page {
  --video-page-max-width: 1080px;
  --video-side-gap: max(24px, calc((100% - var(--video-page-max-width)) / 2));
  --video-top-gap: 28px;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
}

.video-message-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.24) transparent;
  padding: var(--video-top-gap) var(--video-side-gap) 20px;
  box-sizing: border-box;
  contain: layout paint style;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: oklch(var(--bc) / 0.2);
  }
}

.video-empty-state {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: oklch(var(--bc));

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 45%;
    z-index: -1;
    pointer-events: none;
    border-radius: 999px;
    transform: translate(-50%, -50%);
  }

  &::before {
    width: min(560px, 88vw);
    aspect-ratio: 1;
    background: radial-gradient(circle, oklch(var(--p) / 0.16) 0%, oklch(var(--p) / 0.07) 36%, oklch(var(--p) / 0) 70%);
    filter: blur(8px);
  }

  &::after {
    width: min(340px, 64vw);
    aspect-ratio: 1;
    background: radial-gradient(circle, oklch(var(--p) / 0.12) 0%, oklch(var(--p) / 0.05) 44%, oklch(var(--p) / 0) 74%);
  }

  h1 {
    margin: 0;
    font-size: clamp(36px, 4vw, 48px);
    font-weight: 400;
    letter-spacing: -0.04em;
  }
  p {
    width: min(520px, 100%);
    margin: 10px 0 0;
    color: oklch(var(--bc) / 0.68);
    font-size: 16px;
    line-height: 1.7;
  }
}

/* ---- media slots ---- */
.video-media-slots {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.video-media-slot {
  flex: 1;
  min-width: 0;
  height: 64px;
  border: 2px dashed oklch(var(--bc) / 0.16);
  border-radius: 12px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.16s;
  &:hover {
    border-color: oklch(var(--p) / 0.4);
  }
  &.filled {
    border-style: solid;
    border-color: oklch(var(--bc) / 0.12);
    cursor: default;
  }
}

.video-media-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 2px;
  color: oklch(var(--bc) / 0.45);
  font-size: 12px;
  .video-media-empty-icon {
    width: 20px;
    height: 20px;
    opacity: 0.5;
  }
}

.video-media-preview {
  position: relative;
  width: 100%;
  height: 100%;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.video-media-audio-name {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 13px;
  font-weight: 600;
  color: oklch(var(--bc));
  background: oklch(var(--b2));
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-media-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: oklch(var(--bc) / 0.72);
  color: oklch(var(--nc));
  line-height: 18px;
  font-size: 14px;
  cursor: pointer;
}

.video-media-tag {
  position: absolute;
  left: 6px;
  bottom: 4px;
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: oklch(var(--b1) / 0.9);
  color: oklch(var(--bc));
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 1px 3px oklch(var(--bc) / 0.12);
}

.video-file-input {
  display: none;
}

@media (max-width: 640px) {
  .video-chat-page {
    --video-side-gap: 12px;
    --video-top-gap: 16px;
  }
  .video-message-scroll { padding-bottom: 12px; scrollbar-gutter: auto; }
  .video-media-slots {
    flex-direction: column;
  }
}
</style>
