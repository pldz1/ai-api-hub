<template>
  <section ref="pageRef" class="video-chat-page">
    <div ref="messageScrollRef" class="video-message-scroll">
      <div v-if="messages.length === 0" class="video-empty-state">
        <div class="video-empty-mark">
          <SvgIcon :src="navVideoIcon" />
        </div>
        <h1>{{ t("video.workspaceTitle") }}</h1>
        <p>{{ t("video.workspaceDescription") }}</p>
      </div>

      <div v-else class="video-message-list">
        <article
          v-for="message in messages"
          :key="message.id"
          class="video-message"
          :class="[`is-${message.role}`, `is-${message.status}`]"
        >
          <div class="video-message-body">
            <div v-if="message.role !== 'user'" class="video-message-meta">
              <span>{{ message.modelName }}</span>
              <span v-if="message.resolution">{{ message.resolution }}</span>
              <span v-if="getMessageElapsedMs(message) !== null">{{ formatElapsedMs(getMessageElapsedMs(message)!) }}</span>
            </div>

            <p v-if="message.prompt && message.role === 'user'" class="video-message-prompt">{{ message.prompt }}</p>

            <div v-if="message.attachments?.length" class="video-attachment-row">
              <div v-for="att in message.attachments" :key="att.id" class="video-attachment">
                <img v-if="att.content_type?.startsWith('image/')" :src="att.previewUrl" :alt="att.filename" />
                <span v-else class="video-audio-badge">{{ att.filename }}</span>
              </div>
            </div>

            <div v-if="message.status === 'loading'" class="video-loading-card">
              <div class="video-loading-preview"></div>
              <span>{{ t("video.processingRequest") }}</span>
            </div>

            <div v-if="message.videos.length" class="video-output-grid">
              <figure v-for="video in message.videos" :key="video.id" class="video-output-card">
                <video :src="video.src" controls playsinline preload="metadata" />
              </figure>
            </div>

            <div v-if="message.error" class="video-error-message">{{ message.error }}</div>

            <div v-if="message.usage" class="video-usage-row">
              <span>Input {{ message.usage.input_tokens || 0 }}</span>
              <span>Output {{ message.usage.output_tokens || 0 }}</span>
              <span>Total {{ message.usage.total_tokens || 0 }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div class="video-composer-wrap">
      <div
        ref="composerRef"
        class="video-composer"
        :class="{ 'has-media': firstFrame || lastFrame || drivingAudio }"
        @paste="onPaste"
      >
        <!-- Media slots: first frame + last frame + driving audio -->
        <div class="video-media-slots">
          <!-- First frame slot -->
          <div class="video-media-slot" :class="{ filled: !!firstFrame }" @click="openFirstFramePicker">
            <div v-if="firstFrame" class="video-media-preview">
              <img :src="firstFrame.previewUrl" :alt="firstFrame.filename" />
              <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="firstFrame = null">×</button>
              <span class="video-media-tag">{{ t("video.firstFrame") }}</span>
            </div>
            <div v-else class="video-media-empty">
              <SvgIcon :src="imageIcon" class="video-media-empty-icon" />
              <span>{{ t("video.firstFrameHint") }}</span>
            </div>
          </div>

          <!-- Last frame slot -->
          <div class="video-media-slot" :class="{ filled: !!lastFrame }" @click="openLastFramePicker">
            <div v-if="lastFrame" class="video-media-preview">
              <img :src="lastFrame.previewUrl" :alt="lastFrame.filename" />
              <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="lastFrame = null">×</button>
              <span class="video-media-tag">{{ t("video.lastFrame") }}</span>
            </div>
            <div v-else class="video-media-empty">
              <SvgIcon :src="imageIcon" class="video-media-empty-icon" />
              <span>{{ t("video.lastFrameHint") }}</span>
            </div>
          </div>

          <!-- Driving audio slot -->
          <div class="video-media-slot" :class="{ filled: !!drivingAudio }" @click="openAudioPicker">
            <div v-if="drivingAudio" class="video-media-preview">
              <span class="video-media-audio-name">{{ drivingAudio.filename }}</span>
              <button class="video-media-remove" type="button" :aria-label="t('video.removeAttachment')" @click.stop="drivingAudio = null">×</button>
              <span class="video-media-tag">{{ t("video.drivingAudio") }}</span>
            </div>
            <div v-else class="video-media-empty">
              <SvgIcon :src="audioIcon" class="video-media-empty-icon" />
              <span>{{ t("video.drivingAudioHint") }}</span>
            </div>
          </div>
        </div>

        <textarea
          ref="textareaRef"
          v-model="prompt"
          class="video-prompt-input"
          :placeholder="t('video.generatePromptPlaceholder')"
          rows="1"
          @input="resizeTextarea"
          @keydown.enter="onEnter"
        ></textarea>

        <div class="video-composer-actions">
          <div class="video-left-actions">
            <select
              v-model="selectedModelIndex"
              class="video-model-select"
              :disabled="isCurrentConversationSubmitting || availableModels.length === 0"
            >
              <option :value="-1" disabled>
                {{ availableModels.length ? t("video.selectModel") : t("video.videoModelNotConfigured") }}
              </option>
              <option v-for="(model, index) in availableModels" :key="`${model.name}-${index}`" :value="index">
                {{ model.name || model.model }}
              </option>
            </select>

            <AppTooltip :text="t('tooltip.modelSettings')" placement="top">
              <button class="video-settings-button" type="button" @click="onShowModelSettings">
                <SvgIcon :src="paramIcon" />
              </button>
            </AppTooltip>
          </div>

          <div class="video-right-actions">
            <button class="video-send-button" type="button" :disabled="isSendDisabled" @click="send">
              <SvgIcon :src="arrowUpIcon" />
            </button>
          </div>
        </div>
      </div>
      <input ref="firstFrameInputRef" class="video-file-input" type="file" accept="image/*" @change="onFirstFrameChange" />
      <input ref="lastFrameInputRef" class="video-file-input" type="file" accept="image/*" @change="onLastFrameChange" />
      <input ref="audioInputRef" class="video-file-input" type="file" accept="audio/*" @change="onAudioFileChange" />
    </div>
    <VideoSettings ref="videoSettingsRef" :model="selectedModel" :settings="videoSettings" @close="onVideoSettingsClose" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import VideoSettings from "@/views/video/VideoSettings.vue";
import type { VideoSettingsData } from "@/views/video/VideoSettings.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import audioIcon from "@/assets/svg/attach24.svg";
import imageIcon from "@/assets/svg/navImage24.svg";
import navVideoIcon from "@/assets/svg/navImage24.svg";
import paramIcon from "@/assets/svg/param24.svg";
import { addVideoConversation, getVideoConversationMessages, submitVideoMessage } from "@/services/creation";
import { dsAlert, getUuid } from "@/utils";
import type { VideoConversationMessage, VideoInputAttachment, VideoModelConfig } from "@/types";

const MAX_MEDIA_MB = 20;

const store = useStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const prompt = ref("");
const selectedModelIndex = ref(-1);
const firstFrame = ref<VideoInputAttachment | null>(null);
const lastFrame = ref<VideoInputAttachment | null>(null);
const drivingAudio = ref<VideoInputAttachment | null>(null);
const isSubmitting = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const firstFrameInputRef = ref<HTMLInputElement | null>(null);
const lastFrameInputRef = ref<HTMLInputElement | null>(null);
const audioInputRef = ref<HTMLInputElement | null>(null);
const messageScrollRef = ref<HTMLElement | null>(null);
const pageRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLElement | null>(null);
const videoSettingsRef = ref<{ openDialog: () => void } | null>(null);
const videoSettings = ref<VideoSettingsData>({ resolution: "720P", duration: 5 });
let runtimeTimer: number | null = null;
let composerResizeObserver: ResizeObserver | null = null;

const messages = computed<VideoConversationMessage[]>(() => store.state.videoMessages || []);
const routeVideoId = computed(() => (typeof route.params.vid === "string" ? route.params.vid : ""));
const activeVideoRuntime = computed(() =>
  routeVideoId.value ? store.state.videoRuntimeById?.[routeVideoId.value] || null : store.state.videoRuntime || null,
);
const runtimeTick = ref(Date.now());
const availableModels = computed<VideoModelConfig[]>(() => store.state.models.video || []);
const selectedModel = computed<VideoModelConfig | null>(() => availableModels.value[selectedModelIndex.value] || null);
const isCurrentConversationSubmitting = computed(
  () => Boolean(activeVideoRuntime.value?.pending || activeVideoRuntime.value?.status === "loading"),
);
const isSendDisabled = computed(
  () => isCurrentConversationSubmitting.value || !prompt.value.trim() || !selectedModel.value,
);

function resizeTextarea() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function updateComposerHeight() {
  const page = pageRef.value;
  const composer = composerRef.value;
  if (!page || !composer) return;
  const height = Math.ceil(composer.getBoundingClientRect().height);
  if (height > 0) page.style.setProperty("--video-composer-height", `${height}px`);
}

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
      if (width > height) { height = Math.round(height * (MAX_IMAGE_DIM / width)); width = MAX_IMAGE_DIM; }
      else { width = Math.round(width * (MAX_IMAGE_DIM / height)); height = MAX_IMAGE_DIM; }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
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
  nextTick(() => textareaRef.value?.focus());
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

function formatElapsedMs(elapsedMs: number) {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function getMessageElapsedMs(message: VideoConversationMessage): number | null {
  if (message.status === "loading") {
    if (message.role !== "assistant") return null;
    const startedAt = Number(activeVideoRuntime.value?.startedAt || message.createdAt || 0);
    if (!startedAt) return null;
    return Math.max(0, runtimeTick.value - startedAt);
  }

  if (typeof message.elapsedMs === "number" && message.elapsedMs > 0) {
    return message.elapsedMs;
  }

  return null;
}

function buildAttachments(): VideoInputAttachment[] {
  const atts: VideoInputAttachment[] = [];
  if (firstFrame.value) atts.push(firstFrame.value);
  if (lastFrame.value) atts.push(lastFrame.value);
  if (drivingAudio.value) atts.push(drivingAudio.value);
  return atts;
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
  nextTick(() => resizeTextarea());

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

  if (result?.status === "error") {
    dsAlert({ type: "error", message: result.error || t("video.videoRequestFailed") });
  }

  isSubmitting.value = false;
  scrollToBottom();
}

function onEnter(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

watch(
  () => routeVideoId.value,
  async (id) => {
    if (!id) {
      await getVideoConversationMessages(id);
      await store.dispatch("resetVideoRuntime");
      isSubmitting.value = false;
      prompt.value = "";
      firstFrame.value = null;
      lastFrame.value = null;
      drivingAudio.value = null;
      resizeTextarea();
    } else if (store.state.videoLoadedById?.[id]) {
      await store.dispatch("setCurVideoConversationId", id);
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
  () => activeVideoRuntime.value?.pending || activeVideoRuntime.value?.status === "loading",
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

onMounted(() => {
  nextTick(updateComposerHeight);
  if (window.ResizeObserver && composerRef.value) {
    composerResizeObserver = new ResizeObserver(updateComposerHeight);
    composerResizeObserver.observe(composerRef.value);
  }
});

onBeforeUnmount(() => {
  composerResizeObserver?.disconnect();
  composerResizeObserver = null;
  if (runtimeTimer !== null) window.clearInterval(runtimeTimer);
});
</script>

<style lang="scss" scoped>
.video-chat-page {
  --video-page-max-width: 1080px;
  --video-side-gap: max(24px, calc((100% - var(--video-page-max-width)) / 2));
  --video-top-gap: 28px;
  --video-composer-height: 126px;
  --video-scroll-tail-gap: 32px;
  --video-bottom-gap: calc(var(--video-composer-height) + var(--video-composer-bottom) + var(--video-scroll-tail-gap));
  --video-composer-bottom: 18px;
  --video-composer-shell-gap: 18px;
  position: relative;
  width: 100%;
  height: 100%;
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
  padding: var(--video-top-gap) var(--video-side-gap) var(--video-bottom-gap);
  box-sizing: border-box;
}

.video-empty-state {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: oklch(var(--bc));

  h1 { margin: 18px 0 8px; font-size: 32px; font-weight: 700; }
  p { width: min(520px, 100%); margin: 0; line-height: 1.7; }
}

.video-empty-mark {
  width: 74px; height: 74px;
  display: grid; place-items: center;
  border-radius: 24px;
  background: #f3f4f6;
  :deep(.svg-icon) { width: 34px; height: 34px; }
}

.video-message-list { display: flex; flex-direction: column; gap: 22px; }

.video-message {
  display: flex;
  &.is-user { justify-content: flex-end; .video-message-body { max-width: min(560px, 82%); border-radius: 30px; background: #f1f1f0; } }
  &.is-assistant { justify-content: flex-start; .video-message-body { width: min(720px, 100%); border-radius: 8px; background: transparent; } }
}

.video-message-body { min-width: 0; padding: 16px 18px; }

.video-message-meta, .video-usage-row {
  display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px;
  span { min-height: 24px; display: inline-flex; align-items: center; padding: 0 9px; border-radius: 999px; background: rgba(17, 24, 39, 0.05); }
}

.video-message-prompt { margin: 4px 0 0; color: oklch(var(--bc)); line-height: 1.7; white-space: pre-wrap; }

.video-attachment-row, .video-output-grid { margin-top: 14px; }
.video-attachment-row { display: flex; flex-wrap: wrap; gap: 10px; }
.video-attachment { width: 96px; height: 96px; overflow: hidden; border-radius: 8px; border: 1px solid rgba(17, 24, 39, 0.08);
  img { width: 100%; height: 100%; object-fit: cover; }
}
.video-audio-badge { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 12px; color: oklch(var(--bc)); background: oklch(var(--b2)); }

.video-output-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.video-output-card { margin: 0; overflow: hidden; border-radius: 8px; background: #000;
  video { display: block; width: 100%; max-height: 400px; }
}

.video-loading-card { width: min(360px, 100%); margin-top: 14px; color: oklch(var(--b1)); font-size: 13px; }
.video-loading-preview { width: 100%; aspect-ratio: 16 / 9; margin-bottom: 10px; border-radius: 8px; background: #e5e7eb; }
.video-error-message { margin-top: 12px; padding: 12px 14px; border-radius: 8px; background: #fef2f2; color: #b91c1c; line-height: 1.6; }
.video-usage-row { margin-top: 12px; }

.video-composer-wrap {
  position: absolute; left: 0; right: 0; bottom: var(--video-composer-bottom); z-index: 6;
  display: flex; justify-content: center; padding: 0 var(--video-composer-shell-gap); pointer-events: none;
}

.video-composer {
  position: relative; z-index: 1; width: min(100%, 742px); pointer-events: auto;
  max-height: min(68vh, 620px); overflow-y: auto;
  padding: 14px 18px 12px;
  border: 1px solid oklch(var(--bc) / 0.27); border-radius: 42px;
  background: oklch(var(--b1) / 0.96);
}

/* ---- media slots ---- */
.video-media-slots {
  display: flex; gap: 10px; margin-bottom: 10px;
}

.video-media-slot {
  flex: 1; min-width: 0; height: 64px;
  border: 2px dashed oklch(var(--bc) / 0.16); border-radius: 12px;
  cursor: pointer; overflow: hidden;
  transition: border-color 0.16s;
  &:hover { border-color: oklch(var(--p) / 0.4); }
  &.filled { border-style: solid; border-color: oklch(var(--bc) / 0.12); cursor: default; }
}

.video-media-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 2px; color: oklch(var(--bc) / 0.45); font-size: 12px;
  .video-media-empty-icon { width: 20px; height: 20px; opacity: 0.5; }
}

.video-media-preview {
  position: relative; width: 100%; height: 100%;
  img { width: 100%; height: 100%; object-fit: cover; }
}

.video-media-audio-name {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; font-size: 13px; font-weight: 600;
  color: oklch(var(--bc)); background: oklch(var(--b2));
  padding: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.video-media-remove {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px; border: none; border-radius: 999px;
  background: oklch(var(--bc) / 0.72); color: oklch(var(--nc));
  line-height: 18px; font-size: 14px; cursor: pointer;
}

.video-media-tag {
  position: absolute; left: 6px; bottom: 4px;
  height: 20px; padding: 0 8px; display: inline-flex; align-items: center;
  border-radius: 999px; background: oklch(var(--b1) / 0.9);
  color: oklch(var(--bc)); font-size: 11px; font-weight: 600;
  box-shadow: 0 1px 3px oklch(var(--bc) / 0.12);
}

.video-prompt-input {
  width: 100%; min-height: 36px; max-height: 188px;
  padding: 8px 0 6px; border: none; outline: none; resize: none;
  background: transparent; color: oklch(var(--bc)); font-size: 16px; line-height: 1.5;
}

.video-composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 2px; }
.video-left-actions, .video-right-actions { display: flex; align-items: center; gap: 8px; min-width: 0; }

.video-send-button {
  width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background-color: oklch(var(--n)); color: oklch(var(--nc));
  box-shadow: 0 8px 20px oklch(var(--bc) / 0.16);
  &:disabled { opacity: 0.36; cursor: not-allowed; }
  :deep(.svg-icon) { width: 20px; height: 20px; }
}

.video-settings-button {
  width: 24px; height: 24px; flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; background: transparent;
  color: oklch(var(--bc) / 0.6); cursor: pointer;
  &:hover { color: oklch(var(--bc)); }
  :deep(.svg-icon) { width: 18px; height: 18px; }
}

.video-model-select {
  height: 32px; min-width: 0; max-width: 180px;
  border: 2px solid oklch(var(--bc) / 0.08); border-radius: 8px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.96), oklch(var(--b2) / 0.94)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%23111827' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      no-repeat right 9px center / 12px 12px;
  color: oklch(var(--bc)); font-size: 16px; padding: 0 30px 0 4px; appearance: none;
}

.video-file-input { display: none; }

@media (max-width: 640px) {
  .video-chat-page {
    --video-side-gap: 12px; --video-top-gap: 60px;
    --video-composer-bottom: max(12px, env(safe-area-inset-bottom));
    --video-composer-shell-gap: 6px; --video-scroll-tail-gap: 26px;
  }
  .video-composer { border-radius: 28px; padding: 12px; }
  .video-media-slots { flex-direction: column; }
}
</style>
