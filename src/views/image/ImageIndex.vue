<template>
  <section class="image-chat-page">
    <div ref="messageScrollRef" class="image-message-scroll">
      <div v-if="messages.length === 0" class="image-empty-state">
        <h1>{{ t("image.workspaceTitle") }}</h1>
        <p>{{ t("image.workspaceDescription") }}</p>
      </div>

      <ImageMessageList
        v-else
        :messages="messages"
        :runtime-tick="runtimeTick"
        :reuse-disabled="isCurrentConversationSubmitting"
        @reuse="reuseInput"
        @edit-output="openEditDialog"
      />
    </div>

    <ComposerDock>
      <CreationComposer
        ref="composerRef"
        v-model="prompt"
        v-model:model-index="selectedModelIndex"
        :root-class="['image-composer', { 'has-images': attachments.length > 0 }]"
        :model-options="imageModelOptions"
        :model-placeholder="availableModels.length ? t('image.selectModel') : t('image.imageModelNotConfigured')"
        :model-disabled="isCurrentConversationSubmitting || availableModels.length === 0"
        :placeholder="mode === 'edit' ? t('image.editPromptPlaceholderShort') : t('image.generatePromptPlaceholderShort')"
        :send-disabled="isSendDisabled"
        :settings-tooltip="t('tooltip.modelSettings')"
        @paste="onPaste"
        @send="send"
        @settings="onShowModelSettings"
      >
        <template #media>
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
              <button class="image-input-remove" type="button" :aria-label="t('image.removeImage')" @click.stop="removeAttachment(attachment.id)">
                &times;
              </button>
            </div>
          </div>
        </template>

        <template #left-actions>
          <AppTooltip :text="t('tooltip.uploadImage')">
            <button class="image-icon-button" type="button" @click="openFilePicker">
              <SvgIcon :src="attachIcon" />
            </button>
          </AppTooltip>
        </template>

        <template #right-actions-extra>
          <span class="image-mode-pill" :class="{ edit: mode === 'edit' }">
            {{ mode === "edit" ? t("image.modeEdit") : t("image.modeGeneration") }}
          </span>
        </template>
      </CreationComposer>
      <input ref="fileInputRef" class="image-file-input" type="file" accept="image/*" multiple @change="onFileChange" />
    </ComposerDock>
    <ImageEditDialog ref="imageEditDialogRef" @apply="applyBrushEdit" @close="focusPromptInput" />
    <ImageModal />
    <ImageSettings ref="imageSettingsRef" :model="selectedModel" :settings="imageSettings" @close="onImageSettingsClose" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/store";
import AppTooltip from "@/components/AppTooltip.vue";
import ComposerDock from "@/components/ComposerDock.vue";
import CreationComposer from "@/components/CreationComposer.vue";
import ImageModal from "@/components/ImageModal.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import ImageEditDialog from "@/views/image/ImageEditDialog.vue";
import ImageMessageList from "@/views/image/ImageMessageList.vue";
import ImageSettings from "@/views/image/ImageSettings.vue";
import type { ImageSettingsData } from "@/views/image/ImageSettings.vue";
import attachIcon from "@/assets/svg/attach24.svg";
import { addImageConversation, getImageConversationMessages, submitImageMessage } from "@/services/creation";
import { dsAlert, getUuid, saveToLocal } from "@/utils";
import type { ImageConversationMessage, ImageInputAttachment, ImagePayload, ImageModelConfig } from "@/types";

const MAX_IMAGE_MB = 20;
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
const attachments = ref<ImageInputAttachment[]>([]);
const isSubmitting = ref(false);
const hasEditedMask = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const messageScrollRef = ref<HTMLElement | null>(null);
const composerRef = ref<CreationComposerRef | null>(null);
const imageEditDialogRef = ref<{ open: (image: ImageInputAttachment) => void } | null>(null);
const imageSettingsRef = ref<{ openDialog: () => void } | null>(null);
const imageSettings = ref<ImageSettingsData>({ size: "1024x1024", n: 1 });
let runtimeTimer: number | null = null;

const messages = computed<ImageConversationMessage[]>(() => store.state.imageMessages || []);
const routeImageId = computed(() => (typeof route.params.iid === "string" ? route.params.iid : ""));
const activeImageRuntime = computed(() => (routeImageId.value ? store.state.imageRuntimeById?.[routeImageId.value] || null : store.state.imageRuntime || null));
const runtimeTick = ref(Date.now());
const mode = computed(() => (attachments.value.length > 0 ? "edit" : "generation"));
const availableModels = computed<ImageModelConfig[]>(() => store.state.models.image || []);
const imageModelOptions = computed(() =>
  availableModels.value.map((model, index) => ({
    label: model.name || model.model,
    value: index,
  })),
);
const selectedModel = computed<ImageModelConfig | null>(() => availableModels.value[selectedModelIndex.value] || null);
const isCurrentConversationSubmitting = computed(() => Boolean(activeImageRuntime.value?.pending));
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

function readFileAsAttachment(file: File): Promise<ImageInputAttachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    if (file.size / (1024 * 1024) > MAX_IMAGE_MB) {
      console.error("Image file is too large:", file.size / (1024 * 1024));
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
      console.error("Failed to read image file:", reader.error);
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
      imageEditDialogRef.value?.open(attachment);
    } catch (error) {
      console.error("Failed to load image for editing:", error);
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
  nextTick(() => composerRef.value?.focus());
}

function onShowModelSettings() {
  if (!selectedModel.value) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  imageSettingsRef.value?.openDialog();
}

function onImageSettingsClose(settings: ImageSettingsData) {
  imageSettings.value = settings;
}

function reuseInput(message: ImageConversationMessage) {
  if (message.role !== "user" || isCurrentConversationSubmitting.value) return;
  prompt.value = message.prompt;
  attachments.value = (message.attachments || []).map((attachment) => ({ ...attachment }));
  hasEditedMask.value = attachments.value.length > 1;

  const index = messages.value.findIndex((item) => item.id === message.id);
  const run = messages.value[index + 1]?.role === "assistant" ? messages.value[index + 1].run : null;
  if (run) {
    const modelIndex = availableModels.value.findIndex((model) => model.provider === run.route.provider && model.model === run.route.model);
    if (modelIndex >= 0) selectedModelIndex.value = modelIndex;
    imageSettings.value = {
      ...imageSettings.value,
      ...run.request.params,
      size: String(run.request.params.size || imageSettings.value.size),
      n: Number(run.request.params.n || imageSettings.value.n || 1),
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
  const currentAttachments = attachments.value.slice();
  isSubmitting.value = true;
  prompt.value = "";
  attachments.value = [];
  hasEditedMask.value = false;
  nextTick(() => composerRef.value?.resizeTextarea());

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
    size: imageSettings.value.size,
    n: imageSettings.value.n ?? 1,
    quality: (imageSettings.value.quality as string) || undefined,
    outputFormat: (imageSettings.value.output_format as string) || undefined,
    attachments: currentAttachments,
  });

  if (result?.run?.status === "error") {
    console.error("Failed to submit image message:", result.run.error);
    dsAlert({ type: "error", message: result.run.error || t("image.imageRequestFailed") });
  }

  isSubmitting.value = false;
  scrollToBottom();
}

watch(
  () => routeImageId.value,
  async (id) => {
    if (!id) {
      await getImageConversationMessages(id);
      store.commit("resetImageRuntime");
      isSubmitting.value = false;
      prompt.value = "";
      attachments.value = [];
      hasEditedMask.value = false;
      composerRef.value?.resizeTextarea();
    } else if (store.state.imageLoadedById?.[id]) {
      store.commit("setCurImageConversationId", id);
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
    // Only auto-select the first model when nothing is selected yet.
    // A model can handle both generation and edit; switching modes should
    // not reset the user's choice.
    if (selectedModelIndex.value < 0 && availableModels.value.length) {
      selectedModelIndex.value = 0;
    }
  },
);

watch(
  () => messages.value.length,
  () => {
    if (isNearScrollBottom()) scrollToBottom();
  },
);

watch(
  () => activeImageRuntime.value?.pending,
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
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
}

.image-message-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.24) transparent;
  padding: var(--image-top-gap) var(--image-side-gap) 20px;
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

.image-icon-button {
  width: var(--creation-composer-control-size, 38px);
  height: var(--creation-composer-control-size, 38px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: oklch(var(--b2));
  color: oklch(var(--bc));
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

@media (max-width: 640px) {
  .image-mode-pill {
    height: 26px;
    padding: 0 8px;
    font-size: 11px;
  }

  .image-chat-page {
    --image-side-gap: 12px;
    --image-top-gap: 16px;
  }

  .image-message-scroll {
    padding-top: var(--image-top-gap);
    padding-bottom: 12px;
  }
}
</style>
