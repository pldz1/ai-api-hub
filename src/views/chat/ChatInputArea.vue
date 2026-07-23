<template>
  <!-- This view renders the chat input box, capabilities, and send controls. -->
  <div id="component-chat-input-area" class="component-chat-input-area">
    <CreationComposer
      ref="composerRef"
      v-model="inputText"
      :root-class="['chat-composer', { 'is-home': props.isHome }]"
      :model-index="modelIndex"
      :model-options="modelOptions"
      :model-placeholder="t('input.selectChatModel')"
      :model-disabled="modelDisabled || modelOptions.length === 0"
      :placeholder="t('input.chatPlaceholder')"
      :send-button-class="{ 'is-stopping': props.isChatting }"
      :send-tooltip="t('tooltip.sendOrStop')"
      :settings-tooltip="t('tooltip.modelSettings')"
      @update:model-index="emit('update:modelIndex', $event)"
      @settings="emit('settings')"
      @paste="onPaste"
      @send="onSendInputData"
    >
      <template #media>
        <div v-if="inputFiles.length" class="ccia-files-area">
          <div v-for="file in inputFiles" :key="file.id" class="ccia-file-item">
            <div class="ccia-file-card" :title="file.name">
              <div class="ccia-file-name">{{ file.name }}</div>
              <div class="ccia-file-meta">
                <span>{{ file.kindLabel }}</span>
                <span>{{ formatChatFileSize(file.size) }}</span>
                <span>{{ file.contentType || "text/plain" }}</span>
              </div>
              <div v-if="file.truncated" class="ccia-file-note">{{ t("toast.fileContentTruncated") }}</div>
            </div>
            <button
              class="ccia-remove-button ccia-file-remove-button"
              type="button"
              :aria-label="t('tooltip.removeAttachment')"
              @click.stop="removeInputFile(file.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div v-if="inputImages.length" class="ccia-imgs-area">
          <div v-for="image in inputImages" :key="image.id" class="ccia-item">
            <button class="ccia-image-button" type="button" :aria-label="t('image.viewMask')" @click="previewInputImage(image.src)">
              <img class="ccia-image" :src="image.src" :alt="image.name" />
            </button>
            <button class="ccia-remove-button" type="button" :aria-label="t('image.removeImage')" @click.stop="removeInputImage(image.id)">x</button>
          </div>
        </div>
      </template>

      <template #right-actions-extra>
        <AppTooltip :text="t('tooltip.uploadFile')" placement="top">
          <button class="ccia-capability-chip" type="button" @click="openFilePicker">
            <SvgIcon class="ccia-capability-icon" :src="attachIcon" />
            <span class="ccia-capability-label">{{ t("input.capabilities.fileContext") }}</span>
          </button>
        </AppTooltip>
        <AppTooltip v-if="supportedCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
          <button class="ccia-capability-chip" type="button" @click="openImageSourceDialog">
            <SvgIcon class="ccia-capability-icon" :src="imageIcon" />
            <span class="ccia-capability-label">{{ t("input.capabilities.imageRead") }}</span>
          </button>
        </AppTooltip>
        <AppTooltip v-if="supportedCapabilities.webSearch" :text="t('input.capabilities.webSearch')" placement="top">
          <button
            class="ccia-capability-chip"
            :class="{ active: inputCapabilities.webSearch }"
            type="button"
            @click="onToggleCapability('webSearch', !inputCapabilities.webSearch)"
          >
            <SvgIcon class="ccia-capability-icon" :src="webIcon" />
            <span class="ccia-capability-label">{{ t("input.capabilities.webSearch") }}</span>
          </button>
        </AppTooltip>
      </template>

      <template #send-icon>
        <SvgIcon :src="props.isChatting ? pauseIcon : arrowUpIcon" />
      </template>
    </CreationComposer>

    <input ref="imageFileInputRef" class="ccia-file-input" type="file" accept="image/*" multiple @change="onImageFileChange" />
    <input ref="chatFileInputRef" class="ccia-file-input" type="file" :accept="chatFileAccept" multiple @change="onChatFileChange" />
    <ImageSourceDialog ref="imageSourceDialogRef" @select="addAssetImage" @local="openImageFilePicker" />
  </div>

</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import attachIcon from "@/assets/svg/attach24.svg";
import imageIcon from "@/assets/svg/navImage24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import webIcon from "@/assets/svg/web24.svg";
import { defaultModelCapabilities } from "@/constants";
import type { AppSelectOption } from "@/components/AppSelect.vue";
import AppTooltip from "@/components/AppTooltip.vue";
import CreationComposer from "@/components/CreationComposer.vue";
import ImageSourceDialog from "@/components/ImageSourceDialog.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import { getChatModelCapabilities } from "@/models";
import { packUserMsg } from "@/services";
import { setChatFileSource, deleteChatFileSource } from "@/persistence";
import {
  CHAT_INPUT_FILE_MAX_MB,
  formatChatFileSize,
  getChatInputFileAccept,
  parseChatInputFile,
  type ChatInputAttachment,
} from "@/services/conversation/chat-files";
import { dsAlert, getUuid } from "@/utils";

type InputCapabilityKey = string;

type StartChatPayload = {
  message: ChatPromptMessage;
  model: ChatModelConfig;
};

type CreationComposerExpose = {
  focus: () => void;
  resizeTextarea: () => void;
};

type ChatInputImage = {
  id: string;
  name: string;
  src: string;
};

const MAX_IMAGE_MB = 20;

const props = withDefaults(
  defineProps<{
    isChatting?: boolean;
    isHome?: boolean;
    modelOptions?: AppSelectOption[];
    modelIndex?: number | null;
    modelDisabled?: boolean;
  }>(),
  {
    isChatting: false,
    isHome: false,
    modelOptions: () => [],
    modelIndex: null,
    modelDisabled: false,
  },
);

const emit = defineEmits<{
  "update:modelIndex": [value: number];
  settings: [];
  "on-start": [payload: StartChatPayload];
  "on-stop": [];
}>();

const inputText = ref("");
const composerRef = ref<CreationComposerExpose | null>(null);

const imageSourceDialogRef = ref<{ open: () => void } | null>(null);
const imageFileInputRef = ref<HTMLInputElement | null>(null);
const chatFileInputRef = ref<HTMLInputElement | null>(null);
const inputImages = ref<ChatInputImage[]>([]);
const inputFiles = ref<ChatInputAttachment[]>([]);

const store = useAppStore();
const { t } = useI18n();
const inputCapabilities = computed<Record<string, boolean>>(() => store.state.inputCapabilities || {});
const selectedModel = computed<ChatModelConfig | null>(() => store.state.curChatModel || null);
const supportedCapabilities = computed(() => {
  const model = selectedModel.value;
  return model ? getChatModelCapabilities(model) : { ...defaultModelCapabilities };
});
const activeCapabilities = computed(() => ({
  imageRead: supportedCapabilities.value.imageRead,
  webSearch: Boolean(supportedCapabilities.value.webSearch && inputCapabilities.value.webSearch),
}));
const chatFileAccept = getChatInputFileAccept();

const onSendInputData = async () => {
  if (props.isChatting) {
    emit("on-stop");
    return;
  }

  if (!selectedModel.value) {
    console.warn("No chat ID and no selected model found.");
    dsAlert({ type: "warn", message: t("input.selectChatModel") });
    return;
  }

  const imageUrls = inputImages.value.map((item) => item.src);
  const data = packUserMsg(imageUrls, inputText.value, activeCapabilities.value.imageRead, inputFiles.value);
  inputText.value = "";
  inputImages.value = [];
  inputFiles.value = [];
  emit("on-start", {
    message: {
      ...data,
      meta: {
        usedCapabilities: {
          ...activeCapabilities.value,
        },
      },
    },
    model: selectedModel.value,
  });

  nextTick(() => composerRef.value?.resizeTextarea());
};

const onToggleCapability = async (key: InputCapabilityKey, value: boolean) => {
  store.commit("setInputCapability", { key, value });
};

const readFileAsChatAttachment = async (file: File): Promise<ChatInputAttachment | null> => {
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > CHAT_INPUT_FILE_MAX_MB) {
    dsAlert({ type: "error", message: t("toast.fileTooLarge", { max: CHAT_INPUT_FILE_MAX_MB }) });
    return null;
  }

  try {
    const attachment = await parseChatInputFile(file);
    if (!attachment) {
      dsAlert({ type: "error", message: t("toast.fileUnsupported") });
      return null;
    }

    const nextAttachment = {
      ...attachment,
      id: getUuid("chatfile"),
    };
    await setChatFileSource(nextAttachment.id, file);
    return nextAttachment;
  } catch (error) {
    console.error("Failed to read chat file:", error);
    dsAlert({
      type: "error",
      message: t("toast.fileParseFailed", { error: String(error instanceof Error ? error.message : error || "") }),
    });
    return null;
  }
};

async function addChatFiles(files: FileList | File[]) {
  const nextFiles: ChatInputAttachment[] = [];
  for (const file of Array.from(files)) {
    const attachment = await readFileAsChatAttachment(file);
    if (attachment) nextFiles.push(attachment);
  }
  inputFiles.value = [...inputFiles.value, ...nextFiles];
}

function readFileAsInputImage(file: File): Promise<ChatInputImage | null> {
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
      resolve({
        id: getUuid("chatimg"),
        name: file.name || "input-image.png",
        src: String(reader.result || ""),
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

function openFilePicker() {
  chatFileInputRef.value?.click();
}

async function addImageFiles(files: FileList | File[]) {
  if (!supportedCapabilities.value.imageRead) return;
  const nextImages = await Promise.all(Array.from(files).map((file) => readFileAsInputImage(file)));
  inputImages.value = [...inputImages.value, ...(nextImages.filter(Boolean) as ChatInputImage[])];
}

function openImageFilePicker() {
  if (!supportedCapabilities.value.imageRead) return;
  imageFileInputRef.value?.click();
}

function openImageSourceDialog() {
  if (!supportedCapabilities.value.imageRead) return;
  imageSourceDialogRef.value?.open();
}

async function addAssetImage(file: File) {
  await addImageFiles([file]);
}

async function onImageFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!supportedCapabilities.value.imageRead) {
    target.value = "";
    return;
  }
  if (target.files?.length) await addImageFiles(target.files);
  target.value = "";
}

async function onChatFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) await addChatFiles(target.files);
  target.value = "";
}

async function onPaste(event: ClipboardEvent) {
  if (!supportedCapabilities.value.imageRead) return;
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean) as File[];

  if (!files.length) return;
  event.preventDefault();
  await addImageFiles(files);
}

async function previewInputImage(src: string) {
  store.commit("setModalImage", src);
  const dialog = document.getElementById("global_image_preview_modal") as HTMLDialogElement | null;
  dialog?.showModal();
}

function removeInputImage(id: string) {
  inputImages.value = inputImages.value.filter((item) => item.id !== id);
}

function removeInputFile(id: string) {
  void deleteChatFileSource(id);
  inputFiles.value = inputFiles.value.filter((item) => item.id !== id);
}

/* ---- global shortcut: Ctrl+/ → focus the chat input ---- */
function onGlobalKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key !== "/") return;

  const el = e.target as HTMLElement | null;
  const tag = el?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;

  e.preventDefault();
  composerRef.value?.focus();
}

onMounted(() => {
  document.addEventListener("keydown", onGlobalKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onGlobalKeydown);
  void Promise.allSettled(inputFiles.value.map((file) => deleteChatFileSource(file.id)));
});

watch(
  () => supportedCapabilities.value.imageRead,
  (enabled) => {
    if (!enabled) inputImages.value = [];
  },
);
</script>

<style lang="scss" scoped>
.component-chat-input-area {
  position: relative;
  width: min(100%, 742px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .ccia-files-area {
    display: flex;
    gap: 10px;
    max-width: 100%;
    margin-bottom: 8px;
    overflow-y: hidden;
    overflow-x: auto;
    padding: 0 4px 2px 8px;

    .ccia-file-item {
      position: relative;
      width: 184px;
      height: 72px;
      flex: 0 0 auto;
    }

    .ccia-file-card {
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 1;
      border: 1px solid oklch(var(--bc) / 0.08);
      border-radius: 10px;
      background: linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b1) / 0.92) 100%);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      overflow: hidden;
    }

    .ccia-file-name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ccia-file-meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: oklch(var(--bc) / 0.72);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ccia-file-note {
      font-size: 11px;
      line-height: 1.3;
      color: oklch(var(--wa));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ccia-file-remove-button {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 2;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 999px;
      background: oklch(var(--bc) / 0.72);
      color: oklch(var(--nc));
      font-size: 14px;
      line-height: 18px;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transform: scale(0.9);
      transition:
        opacity 0.15s ease,
        transform 0.15s ease;
    }

    .ccia-file-item:hover .ccia-file-remove-button,
    .ccia-file-item:focus-within .ccia-file-remove-button {
      opacity: 1;
      pointer-events: auto;
      transform: scale(1);
    }

    @media (hover: none), (pointer: coarse) {
      .ccia-file-remove-button {
        opacity: 1;
        pointer-events: auto;
        transform: scale(1);
      }
    }
  }

  .ccia-capability-chip {
    height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid oklch(var(--bc) / 0.08);
    background: oklch(var(--b2));
    color: oklch(var(--bc) / 0.76);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    appearance: none;
    outline: none;

    &.active {
      color: oklch(var(--p));
      border-color: oklch(var(--p) / 0.16);
      background: oklch(var(--p) / 0.12);
    }
  }

  .ccia-capability-icon {
    width: 16px;
    height: 16px;
  }

  .ccia-file-input {
    display: none;
  }

  @media (max-width: 640px) {
    .ccia-capability-chip {
      width: 28px;
      height: 26px;
      justify-content: center;
      padding: 0;
      font-size: 11px;
    }

    .ccia-capability-icon {
      width: 15px;
      height: 15px;
    }

    .ccia-capability-label {
      display: none;
    }
  }
}
</style>

<style lang="scss">
.ccia-imgs-area {
  display: flex;
  gap: 8px;
  max-width: 100%;
  margin-bottom: 8px;
  overflow-y: hidden;
  overflow-x: auto;
  padding: 0 4px 2px 8px;

  .ccia-item {
    position: relative;
    width: 72px;
    height: 72px;
    flex: 0 0 auto;
  }

  .ccia-image-button {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 1px solid oklch(var(--bc) / 0.08);
    border-radius: 8px;
    padding: 0;
    background: oklch(var(--b1));
    cursor: pointer;

    .ccia-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .ccia-remove-button {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 999px;
    background: oklch(var(--bc) / 0.72);
    color: oklch(var(--nc));
    font-size: 14px;
    line-height: 18px;
    cursor: pointer;
  }
}

.ccia-imgs-area::-webkit-scrollbar {
  height: 4px;
}

@media (max-width: 640px) {
  .ccia-imgs-area {
    padding-left: 0;
  }
}
</style>
