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
              <span v-if="message.elapsedMs">{{ (message.elapsedMs / 1000).toFixed(1) }}s</span>
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
              <option v-for="item in imageModelSize" :key="item.value" :value="item.value">
                {{ item.name }}
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

const messages = computed<ImageConversationMessage[]>(() => store.state.imageMessages || []);
const routeImageId = computed(() => (typeof route.params.iid === "string" ? route.params.iid : ""));
const activeImageRuntime = computed(() => (routeImageId.value ? store.state.imageRuntimeById?.[routeImageId.value] || null : store.state.imageRuntime || null));
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

onBeforeUnmount(() => {
  attachments.value.forEach((item) => {
    if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
  });
});
</script>

<style lang="scss" scoped>
.image-chat-page {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: radial-gradient(circle at 12% 0%, rgba(59, 130, 246, 0.05), transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.image-chat-page::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 210px;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.92) 46%, #f8fafc 68%, #f8fafc 100%);
}

.image-message-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 28px max(24px, calc((100% - 900px) / 2)) 230px;
}

.image-empty-state {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #111827;

  h1 {
    margin: 18px 0 8px;
    font-size: 32px;
    font-weight: 700;
  }

  p {
    width: min(520px, 100%);
    margin: 0;
    color: #6b7280;
    line-height: 1.7;
  }
}

.image-empty-mark {
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: #f3f4f6;
  color: #111827;

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
  color: #6b7280;
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
  color: #111827;
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
    color: #111827;
    font-size: 13px;
  }
}

.image-loading-card {
  width: min(360px, 100%);
  margin-top: 14px;
  color: #6b7280;
  font-size: 13px;
}

.image-loading-preview {
  width: 100%;
  aspect-ratio: 1;
  margin-bottom: 10px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6);
  background-size: 220% 100%;
  animation: imageShimmer 1.35s linear infinite;
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
  bottom: 18px;
  z-index: 6;
  display: flex;
  justify-content: center;
  padding: 0 18px;
}

.image-composer {
  width: min(828px, 100%);
  max-height: min(68vh, 620px);
  overflow-y: auto;
  padding: 14px 18px 12px;
  border: 1px solid rgba(27, 39, 51, 0.07);
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 2px 6px rgba(17, 24, 39, 0.05),
    0 4px 8px rgba(17, 24, 39, 0.06);
  backdrop-filter: blur(16px);
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
    background: rgba(17, 24, 39, 0.72);
    color: #fff;
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
    background: rgba(255, 255, 255, 0.9);
    color: #111827;
    font-size: 12px;
    line-height: 22px;
    box-shadow: 0 2px 8px rgba(17, 24, 39, 0.18);
  }
}

.image-input-preview-button {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 8px;
  padding: 0;
  background: #fff;
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
  color: #111827;
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
  background: #f7f7f6;
  color: #111827;
}

.image-send-button {
  background: #111827;
  color: #ffffff;

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
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 13px;
}

.image-size-select {
  max-width: 122px;
}

.image-mode-pill {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 11px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 700;

  &.edit {
    background: #ecfdf5;
    color: #047857;
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
    padding: 18px 14px 240px;
  }

  .image-message.is-user .image-message-body {
    max-width: 94%;
  }

  .image-composer {
    border-radius: 26px;
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
</style>
