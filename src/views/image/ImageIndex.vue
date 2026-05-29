<template>
  <section class="image-chat-page">
    <div ref="messageScrollRef" class="image-message-scroll">
      <div v-if="messages.length === 0" class="image-empty-state">
        <div class="image-empty-mark">
          <SvgIcon :src="navImageIcon" />
        </div>
        <h1>{{ t("image.workspaceTitle") }}</h1>
        <p>{{ t("image.workspaceDescription") }}</p>
      </div>

      <div v-else class="image-message-list">
        <article v-for="message in messages" :key="message.id" class="image-message" :class="[`is-${message.role}`, `is-${message.status}`]">
          <div class="image-message-body">
            <div v-if="message.role !== 'user'" class="image-message-meta">
              <span>{{ message.mode === "edit" ? t("image.modeEdit") : t("image.modeGeneration") }}</span>
              <span v-if="message.modelName">{{ message.modelName }}</span>
              <span v-if="getMessageElapsedMs(message) !== null">{{ formatElapsedMs(getMessageElapsedMs(message)!) }}</span>
            </div>

            <p v-if="message.prompt" class="image-message-prompt">{{ message.prompt }}</p>

            <div v-if="message.attachments?.length" class="image-attachment-row">
              <div v-for="attachment in message.attachments" :key="attachment.id" class="image-attachment">
                <img :src="attachment.previewUrl" :alt="attachment.filename" />
              </div>
            </div>

            <div v-if="message.status === 'loading'" class="image-loading-card">
              <div class="image-loading-preview"></div>
              <span>{{ t("image.processingRequest") }}</span>
            </div>

            <div v-if="message.images.length" class="image-output-grid">
              <figure v-for="image in message.images" :key="image.id" class="image-output-card" @click="openEditDialog(image)">
                <img :src="image.src" :alt="message.prompt" />
              </figure>
            </div>

            <div v-if="message.error" class="image-error-message">{{ message.error }}</div>

            <div v-if="message.usage" class="image-usage-row">
              <span>Input {{ message.usage.input_tokens || 0 }}</span>
              <span>Output {{ message.usage.output_tokens || 0 }}</span>
              <span>Total {{ message.usage.total_tokens || 0 }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div class="image-composer-wrap">
      <div class="image-composer" :class="{ 'has-images': attachments.length > 0 }" @paste="onPaste">
        <div v-if="attachments.length" class="image-input-preview-row">
          <div v-for="attachment in attachments" :key="attachment.id" class="image-input-preview">
            <button
              class="image-input-preview-button"
              type="button"
              :aria-label="attachment.id === attachments[0]?.id ? t('image.openMaskEditor') : t('image.viewMask')"
              @click="attachment.id === attachments[0]?.id && openEditDialog()"
            >
              <img :src="attachment.previewUrl" :alt="attachment.filename" />
              <span v-if="attachment.id === attachments[0]?.id" class="image-input-edit">
                {{ hasEditedMask ? t("image.maskEdited") : t("image.maskLabel") }}
              </span>
            </button>
            <button class="image-input-remove" type="button" :aria-label="t('image.removeImage')" @click.stop="removeAttachment(attachment.id)">×</button>
          </div>
        </div>

        <textarea
          ref="textareaRef"
          v-model="prompt"
          class="image-prompt-input"
          :placeholder="mode === 'edit' ? t('image.editPromptPlaceholderShort') : t('image.generatePromptPlaceholderShort')"
          rows="1"
          @input="resizeTextarea"
          @keydown.enter="onEnter"
        ></textarea>

        <div class="image-composer-actions">
          <div class="image-left-actions">
            <AppTooltip :text="t('tooltip.uploadImage')">
              <button class="image-icon-button" type="button" @click="openFilePicker">
                <SvgIcon :src="attachIcon" />
              </button>
            </AppTooltip>

            <select v-model="selectedModelIndex" class="image-model-select" :disabled="isCurrentConversationSubmitting || availableModels.length === 0">
              <option :value="-1" disabled>{{ availableModels.length ? t("image.selectModel") : t("image.imageModelNotConfigured") }}</option>
              <option v-for="(model, index) in availableModels" :key="`${model.name}-${index}`" :value="index">
                {{ model.name || model.model }}
              </option>
            </select>

            <select v-model="size" class="image-size-select" :disabled="isCurrentConversationSubmitting">
              <option v-for="item in imageModelSize" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </div>

          <div class="image-right-actions">
            <span class="image-mode-pill" :class="{ edit: mode === 'edit' }">
              {{ mode === "edit" ? t("image.modeEdit") : t("image.modeGeneration") }}
            </span>
            <button class="image-send-button" type="button" :disabled="isSendDisabled" @click="send">
              <SvgIcon :src="arrowUpIcon" />
            </button>
          </div>
        </div>
      </div>
      <input ref="fileInputRef" class="image-file-input" type="file" accept="image/*" multiple @change="onFileChange" />
    </div>
    <ImageEditDialog ref="imageEditDialogRef" @apply="applyBrushEdit" @close="focusPromptInput" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import ImageEditDialog from "@/views/image/ImageEditDialog.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import attachIcon from "@/assets/svg/attach24.svg";
import navImageIcon from "@/assets/svg/navImage24.svg";
import { imageModelSize } from "@/constants";
import { addImageConversation, getImageConversationMessages, submitImageMessage } from "@/services/creation";
import { dsAlert, getUuid, saveToLocal } from "@/utils";
import type { ImageConversationMessage, ImageInputAttachment, ImagePayload, ImageModelConfig } from "@/types";

const MAX_IMAGE_MB = 20;

const store = useStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const prompt = ref("");
const size = ref("1024x1024");
const selectedModelIndex = ref(-1);
const attachments = ref<ImageInputAttachment[]>([]);
const isSubmitting = ref(false);
const hasEditedMask = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const messageScrollRef = ref<HTMLElement | null>(null);
const imageEditDialogRef = ref<{ open: (image: ImageInputAttachment) => void } | null>(null);
let runtimeTimer: number | null = null;

const messages = computed<ImageConversationMessage[]>(() => store.state.imageMessages || []);
const routeImageId = computed(() => (typeof route.params.iid === "string" ? route.params.iid : ""));
const activeImageRuntime = computed(() => (routeImageId.value ? store.state.imageRuntimeById?.[routeImageId.value] || null : store.state.imageRuntime || null));
const runtimeTick = ref(Date.now());
const mode = computed(() => (attachments.value.length > 0 ? "edit" : "generation"));
const availableModels = computed<ImageModelConfig[]>(() => store.state.models.image || []);
const selectedModel = computed<ImageModelConfig | null>(() => availableModels.value[selectedModelIndex.value] || null);
const isCurrentConversationSubmitting = computed(() => Boolean(activeImageRuntime.value?.pending || activeImageRuntime.value?.status === "loading"));
const isSendDisabled = computed(() => isCurrentConversationSubmitting.value || !prompt.value.trim() || !selectedModel.value);

function resizeTextarea() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function scrollToBottom() {
  nextTick(() => {
    const el = messageScrollRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  });
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return {
    contentType: match?.[1] || "image/png",
    data: match?.[2] || dataUrl,
  };
}

function readFileAsAttachment(file: File): Promise<ImageInputAttachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    if (file.size / (1024 * 1024) > MAX_IMAGE_MB) {
      dsAlert({ type: "error", message: t("toast.imageTooLarge", { max: MAX_IMAGE_MB }) });
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = String(reader.result || "");
      const { contentType, data } = splitDataUrl(previewUrl);
      resolve({
        id: getUuid("imginput"),
        filename: file.name || "input-image.png",
        content_type: contentType,
        data,
        previewUrl,
      });
    };
    reader.onerror = () => {
      dsAlert({ type: "error", message: t("image.imageReadFailed") });
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

async function addFiles(files: FileList | File[]) {
  const nextAttachments = await Promise.all(Array.from(files).map((file) => readFileAsAttachment(file)));
  attachments.value = [...attachments.value, ...(nextAttachments.filter(Boolean) as ImageInputAttachment[])];
}

function openFilePicker() {
  fileInputRef.value?.click();
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) await addFiles(target.files);
  target.value = "";
}

async function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean) as File[];

  if (!files.length) return;
  event.preventDefault();
  await addFiles(files);
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((item) => item.id !== id);
  if (attachments.value.length < 2) hasEditedMask.value = false;
}

async function imagePayloadToAttachment(image: ImagePayload): Promise<ImageInputAttachment> {
  const response = await fetch(image.src);
  const blob = await response.blob();
  const file = new File([blob], image.filename || "edit-input.png", { type: blob.type || image.contentType || "image/png" });
  const attachment = await readFileAsAttachment(file);
  if (!attachment) throw new Error("Invalid image");
  return attachment;
}

async function openEditDialog(image?: ImagePayload) {
  if (image) {
    try {
      const attachment = await imagePayloadToAttachment(image);
      attachments.value = [attachment];
      hasEditedMask.value = false;
      imageEditDialogRef.value?.open(attachment);
    } catch (error) {
      dsAlert({ type: "error", message: t("image.loadMaskEditFailed", { error: String(error) }) });
    }
    return;
  }

  if (!attachments.value[0]) return;
  imageEditDialogRef.value?.open(attachments.value[0]);
}

function applyBrushEdit(payload: { image: ImageInputAttachment; mask: ImageInputAttachment }) {
  const image = {
    ...payload.image,
    id: attachments.value[0]?.id || getUuid("imginput"),
    previewUrl: `data:${payload.image.content_type || "image/png"};base64,${payload.image.data}`,
  };
  const mask = {
    ...payload.mask,
    id: getUuid("imgmask"),
    previewUrl: `data:${payload.mask.content_type || "image/png"};base64,${payload.mask.data}`,
  };
  attachments.value = [image, mask];
  hasEditedMask.value = true;
  dsAlert({ type: "success", message: t("image.maskApplied") });
  focusPromptInput();
}

function focusPromptInput() {
  nextTick(() => textareaRef.value?.focus());
}

function formatElapsedMs(elapsedMs: number) {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function getMessageElapsedMs(message: ImageConversationMessage): number | null {
  if (message.status === "loading") {
    if (message.role !== "assistant") return null;
    const startedAt = Number(activeImageRuntime.value?.startedAt || message.createdAt || 0);
    if (!startedAt) return null;
    return Math.max(0, runtimeTick.value - startedAt);
  }

  if (typeof message.elapsedMs === "number" && message.elapsedMs > 0) {
    return message.elapsedMs;
  }

  return null;
}

async function send() {
  if (isSendDisabled.value || !selectedModel.value) return;

  const currentPrompt = prompt.value.trim();
  const currentAttachments = attachments.value.slice();
  isSubmitting.value = true;
  prompt.value = "";
  attachments.value = [];
  hasEditedMask.value = false;
  resizeTextarea();

  if (!routeImageId.value) {
    const created = await addImageConversation(currentPrompt.slice(0, 28));
    if (!created || !store.state.curImageConversationId) {
      isSubmitting.value = false;
      return;
    }
    await router.replace({ name: "image", params: { iid: store.state.curImageConversationId } });
  }

  const result = await submitImageMessage({
    mode: currentAttachments.length ? "edit" : "generation",
    prompt: currentPrompt,
    model: selectedModel.value,
    size: size.value,
    n: 1,
    attachments: currentAttachments,
  });

  if (result?.status === "error") {
    dsAlert({ type: "error", message: result.error || t("image.imageRequestFailed") });
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

async function downloadImage(src: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = async () => {
    await saveToLocal(image);
  };
  image.src = src;
}

async function useImageForEdit(image: ImagePayload) {
  try {
    const response = await fetch(image.src);
    const blob = await response.blob();
    const file = new File([blob], image.filename || "edit-input.png", { type: blob.type || "image/png" });
    await addFiles([file]);
    scrollToBottom();
  } catch (error) {
    dsAlert({ type: "error", message: t("image.loadEditImageFailed", { error: String(error) }) });
  }
}

watch(
  () => routeImageId.value,
  async (id) => {
    if (!id) {
      await getImageConversationMessages(id);
      await store.dispatch("resetImageRuntime");
      isSubmitting.value = false;
      prompt.value = "";
      attachments.value = [];
      hasEditedMask.value = false;
      resizeTextarea();
    } else if (store.state.imageLoadedById?.[id]) {
      await store.dispatch("setCurImageConversationId", id);
    } else {
      await getImageConversationMessages(id);
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
  () => mode.value,
  () => {
    selectedModelIndex.value = availableModels.value.length ? 0 : -1;
  },
);

watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

watch(
  () => activeImageRuntime.value?.pending || activeImageRuntime.value?.status === "loading",
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
  attachments.value.forEach((item) => {
    if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
  });
});
</script>

<style lang="scss" scoped>
.image-chat-page {
  --image-page-max-width: 1080px;
  --image-side-gap: max(24px, calc((100% - var(--image-page-max-width)) / 2));
  --image-top-gap: 28px;
  --image-bottom-gap: 230px;
  --image-composer-bottom: 18px;
  --image-composer-shell-gap: 18px;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 280px;
    z-index: 5;
    pointer-events: none;
    background: linear-gradient(180deg, oklch(var(--b1) / 0) 0%, oklch(var(--b1) / 0.9) 28%, oklch(var(--b1)) 72%, oklch(var(--b1)) 100%);
    box-shadow: inset 0 -84px 96px oklch(var(--b1) / 0.34);
  }
}

.image-message-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--image-top-gap) var(--image-side-gap) var(--image-bottom-gap);
  box-sizing: border-box;
}

.image-empty-state {
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
    margin: 18px 0 8px;
    font-size: 32px;
    font-weight: 700;
  }

  p {
    width: min(520px, 100%);
    margin: 0;
    line-height: 1.7;
  }
}

.image-empty-mark {
  position: relative;
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: #f3f4f6;

  :deep(.svg-icon) {
    width: 34px;
    height: 34px;
  }
}

.image-message-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.image-message {
  display: flex;

  &.is-user {
    justify-content: flex-end;

    .image-message-body {
      max-width: min(560px, 82%);
      border-radius: 30px;
      background: #f1f1f0;
    }
  }

  &.is-assistant {
    justify-content: flex-start;

    .image-message-body {
      width: min(720px, 100%);
      border-radius: 8px;
      background: transparent;
    }
  }
}

.image-message-body {
  min-width: 0;
  padding: 16px 18px;
}

.image-message-meta,
.image-usage-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.image-message-meta span,
.image-usage-row span {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.05);
}

.image-message-prompt {
  margin: 4px 0 0;
  color: oklch(var(--bc));
  line-height: 1.7;
  white-space: pre-wrap;
}

.image-attachment-row,
.image-output-grid {
  margin-top: 14px;
}

.image-attachment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-attachment {
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.08);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.image-output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 360px));
  gap: 14px;
  align-items: start;
}

.image-output-card {
  width: min(100%, 360px);
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(17, 24, 39, 0.08);
  cursor: pointer;

  img {
    display: block;
    width: 100%;
    max-height: 360px;
    aspect-ratio: 1;
    object-fit: contain;
    background:
      linear-gradient(45deg, rgba(17, 24, 39, 0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(17, 24, 39, 0.04) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(17, 24, 39, 0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(17, 24, 39, 0.04) 75%);
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
    background-size: 16px 16px;
  }

  figcaption {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px;
  }

  button {
    height: 32px;
    padding: 0 12px;
    border: 1px solid rgba(17, 24, 39, 0.1);
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
  }
}

.image-loading-card {
  width: min(360px, 100%);
  margin-top: 14px;
  color: oklch(var(--b1));
  font-size: 13px;
}

.image-loading-preview {
  width: 100%;
  aspect-ratio: 1;
  margin-bottom: 10px;
  border-radius: 8px;
  background: #e5e7eb;
}

.image-error-message {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  line-height: 1.6;
}

.image-usage-row {
  margin-top: 12px;
}

.image-composer-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--image-composer-bottom);
  z-index: 6;
  display: flex;
  justify-content: center;
  padding: 0 var(--image-composer-shell-gap);
  pointer-events: none;
}

.image-composer {
  position: relative;
  z-index: 1;
  width: min(960px, 100%);
  pointer-events: auto;
  max-height: min(68vh, 620px);
  overflow-y: auto;
  padding: 14px 18px 12px;
  border: 1px solid oklch(var(--bc) / 0.07);
  border-radius: 42px;
  background: oklch(var(--b1));
  box-shadow:
    0 2px 6px oklch(var(--bc) / 0.05),
    0 4px 8px oklch(var(--bc) / 0.06);
}

.image-input-preview-row {
  display: flex;
  gap: 8px;
  max-width: 100%;
  margin-bottom: 8px;
  overflow-x: auto;
}

.image-input-preview {
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 auto;

  .image-input-remove {
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
  }

  .image-input-edit {
    position: absolute;
    left: 5px;
    bottom: 5px;
    width: auto;
    height: 22px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid oklch(var(--bc) / 0.08);
    background: oklch(var(--b1) / 0.92);
    color: oklch(var(--bc));
    font-size: 12px;
    line-height: 22px;
    box-shadow: 0 1px 3px oklch(var(--bc) / 0.08);
  }
}

.image-input-preview-button {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  padding: 0;
  background: oklch(var(--b1));
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.image-prompt-input {
  width: 100%;
  min-height: 38px;
  max-height: 180px;
  padding: 8px 6px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: oklch(var(--bc));
  font-size: 18px;
  line-height: 1.45;
}

.image-composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 2px;
}

.image-left-actions,
.image-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.image-icon-button,
.image-send-button {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
}

.image-icon-button {
  background: oklch(var(--b2));
  color: oklch(var(--bc));
}

.image-send-button {
  background-color: oklch(var(--n));
  color: oklch(var(--nc));
  box-shadow: 0 8px 20px oklch(var(--bc) / 0.16);

  &:disabled {
    opacity: 0.36;
    cursor: not-allowed;
  }

  :deep(.svg-icon) {
    width: 20px;
    height: 20px;
  }
}

.image-model-select,
.image-size-select {
  height: 32px;
  min-width: 0;
  max-width: 180px;
  border: 2px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  background:
    linear-gradient(180deg, oklch(var(--b1) / 0.96), oklch(var(--b2) / 0.94)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%23111827' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      no-repeat right 9px center / 12px 12px;
  color: oklch(var(--bc));
  font-size: 16px;
  padding: 0 30px 0 4px;
  appearance: none;
  box-shadow: 0 6px 18px oklch(var(--bc) / 0.06);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;

  &:hover:not(:disabled) {
    border-color: oklch(var(--bc) / 0.16);
    transform: translateY(-1px);
  }

  &:focus {
    border-color: oklch(var(--p) / 0.42);
    box-shadow:
      0 0 0 3px oklch(var(--p) / 0.12),
      0 10px 24px oklch(var(--bc) / 0.08);
    outline: none;
  }
}

.image-size-select {
  max-width: 122px;
  padding-right: 28px;
}

.image-mode-pill {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 11px;
  border-radius: 999px;
  background: oklch(var(--p) / 0.12);
  color: oklch(var(--p));
  font-size: 12px;
  font-weight: 700;

  &.edit {
    background: oklch(var(--su) / 0.12);
    color: oklch(var(--su));
  }
}

.image-file-input {
  display: none;
}

@keyframes imageShimmer {
  from {
    background-position: 0 0;
  }
  to {
    background-position: -220% 0;
  }
}

@media (max-width: 720px) {
  .image-message-scroll {
    padding: 22px 14px 236px;
  }

  .image-message.is-user .image-message-body {
    max-width: 94%;
  }

  .image-composer {
    width: 100%;
    border-radius: 28px;
    padding: 12px;
  }

  .image-input-preview-row {
    padding-left: 0;
  }

  .image-composer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .image-left-actions,
  .image-right-actions {
    width: 100%;
  }

  .image-model-select {
    flex: 1 1 auto;
    max-width: none;
  }

  .image-right-actions {
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .image-chat-page {
    --image-side-gap: 12px;
    --image-top-gap: 60px;
    --image-bottom-gap: 232px;
    --image-composer-bottom: max(12px, env(safe-area-inset-bottom));
    --image-composer-shell-gap: 6px;
  }

  .image-message-scroll {
    padding-top: var(--image-top-gap);
    padding-bottom: var(--image-bottom-gap);
  }

  .image-message.is-user .image-message-body {
    max-width: 78%;
  }

  .image-composer-wrap {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .image-composer {
    max-height: none;
  }
}
</style>
