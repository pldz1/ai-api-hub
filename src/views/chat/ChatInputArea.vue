<template>
  <!-- This view renders the chat input box, capabilities, and send controls. -->
  <div id="component-chat-input-area" class="component-chat-input-area" @paste="onPaste">
    <!-- Wrap the editable prompt area and action controls in a single composer card. -->
    <div class="ccia-input-card" :class="{ 'is-home': props.isHome }">
      <div class="ccia-input-area">
        <!-- Preview uploaded images before sending the message. -->
        <div v-if="inputImages.length" class="ccia-imgs-area">
          <div v-for="image in inputImages" :key="image.id" class="ccia-item">
            <button class="ccia-image-button" type="button" :aria-label="t('image.viewMask')" @click="previewInputImage(image.src)">
              <img class="ccia-image" :src="image.src" :alt="image.name" />
            </button>
            <button class="ccia-remove-button" type="button" :aria-label="t('image.removeImage')" @click.stop="removeInputImage(image.id)">x</button>
          </div>
        </div>

        <!-- Let the user compose a multi-line prompt with auto-resizing behavior. -->
        <div class="ccia-shell">
          <textarea
            ref="cciaTextareaRef"
            v-model="inputText"
            class="textarea ccia-custom-textarea"
            :placeholder="t('input.chatPlaceholder')"
            @input="debounceInputText"
            @keydown.enter="onEnterKeydown"
          ></textarea>
        </div>

        <!-- Split model controls from per-message capability toggles and send actions. -->
        <div class="ccia-capability-row">
          <!-- Keep the model selector and settings entry point together. -->
          <div class="ccia-right-actions">
            <div class="ccia-model-area">
              <select v-if="!isModelSelectionReadonly" v-model="selectedModel" class="ccia-model-select">
                <option disabled :value="null">{{ t("input.selectChatModel") }}</option>
                <option v-for="m in chatModels" :key="m.name" :value="m">
                  {{ m.name }}
                </option>
              </select>
              <div v-else class="ccia-model-lock">
                <AppTooltip :text="t('tooltip.cannotEditModel')" placement="top">
                  {{ lockedModelName }}
                </AppTooltip>
              </div>
            </div>
            <AppTooltip :text="t('tooltip.modelSettings')" placement="top">
              <button class="ccia-model-setting-button" type="button" @click="onShowModelSettings">
                <SvgIcon :src="paramIcon" />
              </button>
            </AppTooltip>
          </div>

          <!-- Surface per-turn capabilities and the send or stop trigger. -->
          <div class="ccia-left-actions">
            <AppTooltip v-if="supportedCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
              <button class="ccia-capability-chip" type="button" @click="openImageFilePicker">
                <SvgIcon class="ccia-capability-icon" :src="attachIcon" />
                <span>{{ t("input.capabilities.imageRead") }}</span>
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
                <span>{{ t("input.capabilities.webSearch") }}</span>
              </button>
            </AppTooltip>
            <AppTooltip :text="t('tooltip.sendOrStop')" placement="top">
              <button class="ccia-send-button" :class="{ stopping: props.isChatting }" type="button" @click="onSendInputData">
                <SvgIcon class="ccia-send-icon" :src="props.isChatting ? pauseIcon : arrowUpIcon" />
              </button>
            </AppTooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm the selected model before starting a brand-new chat session. -->
    <dialog
      ref="startChatConfirmDialogRef"
      class="modal ccia-start-chat-confirm"
      @cancel.prevent="resolveStartChatConfirmation(false)"
      @close="resolveStartChatConfirmation(false)"
    >
      <div class="modal-box">
        <h3 class="ccia-confirm-title">{{ t("input.confirmStartChatTitle") }}</h3>
        <p class="ccia-confirm-message">{{ t("input.confirmStartChat", { model: draftSnapshot?.displayName || "" }) }}</p>
        <div class="modal-action ccia-confirm-actions">
          <button class="btn btn-primary" type="button" @click="resolveStartChatConfirmation(true)">
            {{ t("input.confirmStartChatConfirm") }}
          </button>
          <button class="btn btn-ghost" type="button" @click="resolveStartChatConfirmation(false)">
            {{ t("input.confirmStartChatCancel") }}
          </button>
        </div>
      </div>
    </dialog>
    <input ref="imageFileInputRef" class="ccia-file-input" type="file" accept="image/*" multiple @change="onImageFileChange" />
  </div>

  <!-- Mount the model settings dialog next to the composer for local control. -->
  <ChatSettings ref="chatSettingsRef" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import attachIcon from "@/assets/svg/attach24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import paramIcon from "@/assets/svg/param24.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import webIcon from "@/assets/svg/web24.svg";
import { defaultModelCapabilities } from "@/constants";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import { createConversationModelSnapshot, getChatModelCapabilities, mergeChatSettingsWithModel, getModelFromSnapshot } from "@/models";
import { packUserMsg } from "@/services";
import { dsAlert, getUuid, isValidUserMsg } from "@/utils";
import ChatSettings from "@/views/chat/ChatSettings.vue";

type InputCapabilityKey = string;

type StartChatPayload = {
  message: ChatPromptMessage;
  model: ChatModelConfig | null;
};

type ChatSettingsExpose = {
  openDialog: () => void;
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
    modelSelectionReadonly?: boolean;
    isHome?: boolean;
  }>(),
  {
    isChatting: false,
    modelSelectionReadonly: false,
    isHome: false,
  },
);

const emit = defineEmits<{
  "on-start": [payload: StartChatPayload];
  "on-stop": [];
}>();

const inputText = ref("");
const cciaTextareaRef = ref<HTMLTextAreaElement | null>(null);
const startChatConfirmDialogRef = ref<HTMLDialogElement | null>(null);
const chatSettingsRef = ref<ChatSettingsExpose | null>(null);
const imageFileInputRef = ref<HTMLInputElement | null>(null);
const inputImages = ref<ChatInputImage[]>([]);
let startChatConfirmResolve: ((confirmed: boolean) => void) | null = null;

const store = useStore();
const { t } = useI18n();
const chatModels = computed<ChatModelConfig[]>(() => store.state.models.chat || []);
const curChatId = computed<string>(() => store.state.curChatId || "");
const curConversation = computed(() => store.state.curConversation);
const inputCapabilities = computed<Record<string, boolean>>(() => store.state.inputCapabilities || {});
const selectedModel = ref<ChatModelConfig | null>(null);

const isModelSelectionReadonly = computed(() => Boolean(props.modelSelectionReadonly || curChatId.value));
const draftSnapshot = computed(() => createConversationModelSnapshot(selectedModel.value));
const activeSnapshot = computed(() => curConversation.value?.modelSnapshot || draftSnapshot.value);
const supportedCapabilities = computed(() => {
  const model = getModelFromSnapshot(activeSnapshot.value);
  return model ? getChatModelCapabilities(model) : { ...defaultModelCapabilities };
});
const activeCapabilities = computed(() => ({
  imageRead: supportedCapabilities.value.imageRead,
  webSearch: Boolean(supportedCapabilities.value.webSearch && inputCapabilities.value.webSearch),
}));
const lockedModelName = computed(() => curConversation.value?.modelSnapshot?.displayName || t("input.lockedModel"));

const getModelSelectionKey = (model: ChatModelConfig | null) => [model?.provider, model?.name, model?.model, model?.baseURL].join("|");

watch(
  () => chatModels.value,
  (models) => {
    if (!selectedModel.value && models.length > 0) selectedModel.value = models[0];
  },
  { deep: true, immediate: true },
);

watch(
  () => selectedModel.value,
  async (model, previousModel) => {
    if (curChatId.value || !model) return;

    await store.dispatch("setCurChatModel", model);

    if (!previousModel || getModelSelectionKey(previousModel) !== getModelSelectionKey(model)) {
      await store.dispatch("setCurChatModelSettings", mergeChatSettingsWithModel(model, {}));
      await store.dispatch("resetInputCapabilities");
    }
  },
  { immediate: true },
);

const onSendInputData = async () => {
  if (props.isChatting) {
    emit("on-stop");
    return;
  }

  if (!curChatId.value && !selectedModel.value) {
    console.warn("No chat ID and no selected model found.");
    dsAlert({ type: "warn", message: t("input.selectChatModel") });
    return;
  }

  if (!curChatId.value && !draftSnapshot.value) {
    console.warn("No chat ID and no draft model snapshot available.");
    dsAlert({ type: "warn", message: t("toast.modelInitCheck") });
    return;
  }

  if (curChatId.value && !curConversation.value?.modelSnapshot) {
    console.warn("Existing chat without a model snapshot.");
    dsAlert({ type: "warn", message: t("toast.modelInitCheck") });
    return;
  }

  if (!curChatId.value) {
    const confirmed = await requestStartChatConfirmation();
    if (!confirmed) return;
  }

  const imageUrls = inputImages.value.map((item) => item.src);
  const data = packUserMsg(imageUrls, inputText.value, activeCapabilities.value.imageRead);
  if (isValidUserMsg(data)) {
    inputText.value = "";
    inputImages.value = [];
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

    if (cciaTextareaRef.value) cciaTextareaRef.value.style.height = "";
  } else {
    console.error("Invalid user message data:", data);
    dsAlert({ type: "error", message: t("toast.invalidQuestion") });
  }
};

const onToggleCapability = async (key: InputCapabilityKey, value: boolean) => {
  await store.dispatch("setInputCapability", { key, value });
};

const requestStartChatConfirmation = () =>
  new Promise<boolean>((resolve) => {
    const dialog = startChatConfirmDialogRef.value;
    if (!dialog?.showModal) {
      resolve(false);
      return;
    }

    startChatConfirmResolve = resolve;
    dialog.showModal();
  });

const resolveStartChatConfirmation = (confirmed: boolean) => {
  if (startChatConfirmResolve) {
    startChatConfirmResolve(Boolean(confirmed));
    startChatConfirmResolve = null;
  }

  const dialog = startChatConfirmDialogRef.value;
  if (dialog?.open) dialog.close();
};

/* When the browser supports field-sizing:content natively we skip the manual
   height dance entirely — zero jitter. Older engines fall back to JS resize. */
const supportsFieldSizing = CSS.supports("field-sizing", "content");

const onInputText = () => {
  if (supportsFieldSizing) return;
  const textarea = cciaTextareaRef.value;
  if (!textarea) return;
  /* Hide overflow during measurement so the height-auto → scrollHeight
     recalculation doesn't produce visible jank. */
  textarea.style.overflowY = "hidden";
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
  textarea.style.overflowY = "";
};

const debounce = (fn: Function, delay: number, immediate: boolean = false) => {
  let timer: number | null;
  return function (...args: any) {
    if (immediate && !timer) {
      fn.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!immediate) fn.apply(this, args);
      timer = null;
    }, delay);
  };
};

/* immediate:true — first keystroke resizes instantly, trailing calls are
   batched at most every 50ms so rapid typing stays responsive. */
const debounceInputText = debounce(onInputText, 50, true);

const onEnterKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await onSendInputData();
  }
};

const onShowModelSettings = () => {
  if (!selectedModel.value) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  chatSettingsRef.value?.openDialog();
};

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

async function addImageFiles(files: FileList | File[]) {
  if (!supportedCapabilities.value.imageRead) return;
  const nextImages = await Promise.all(Array.from(files).map((file) => readFileAsInputImage(file)));
  inputImages.value = [...inputImages.value, ...(nextImages.filter(Boolean) as ChatInputImage[])];
}

function openImageFilePicker() {
  if (!supportedCapabilities.value.imageRead) return;
  imageFileInputRef.value?.click();
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
  await store.dispatch("setModalImage", src);
  const dialog = document.getElementById("global_image_preview_modal") as HTMLDialogElement | null;
  dialog?.showModal();
}

function removeInputImage(id: string) {
  inputImages.value = inputImages.value.filter((item) => item.id !== id);
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
  cciaTextareaRef.value?.focus();
}

onMounted(() => {
  document.addEventListener("keydown", onGlobalKeydown);
});

onBeforeUnmount(() => {
  resolveStartChatConfirmation(false);
  document.removeEventListener("keydown", onGlobalKeydown);
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

  .ccia-input-card {
    position: relative;
    z-index: 1;
    width: 100%;
    background: oklch(var(--b1) / 0.96);
    border-radius: 42px;
    padding: 14px 18px 12px;
    border: 1px solid oklch(var(--bc) / 0.27);
  }

  .ccia-input-area {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .ccia-shell {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .ccia-model-setting-button {
    width: 24px;
    height: 24px;
  }

  .ccia-custom-textarea {
    flex: 1 1 auto;
    padding: 8px 0 6px;
    border: none;
    outline: none;
    background-color: transparent;
    resize: none;
    box-shadow: initial;
    border-radius: initial;
    min-height: 36px;
    max-height: 188px;
    line-height: 1.5;
    font-size: 16px;
    field-sizing: content;
  }

  .ccia-model-area {
    min-width: 0;
    max-width: 220px;
  }

  .ccia-model-select,
  .ccia-model-lock {
    width: 160px;
    height: 32px;
    padding: 0 4px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    color: oklch(var(--bc));
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ccia-model-select {
    border: 2px solid oklch(var(--bc) / 0.08);
    appearance: none;
    padding-right: 30px;

    &:hover:not(:disabled) {
      border-color: oklch(var(--bc) / 0.16);
    }

    &:focus {
      border-color: oklch(var(--p) / 0.42);
      outline: none;
    }
  }

  .ccia-model-lock {
    background: oklch(var(--b2));
  }

  .ccia-send-button {
    height: 38px;
    width: 38px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: oklch(var(--n));
    color: oklch(var(--nc));
    border: none;

    &.stopping {
      background-color: oklch(var(--er));
      color: oklch(var(--nc));
    }
  }

  .ccia-capability-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    padding: 4px 0 0 8px;
    justify-content: space-between;
  }

  .ccia-right-actions,
  .ccia-left-actions {
    display: flex;
    align-items: center;
    gap: 8px;
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

  .ccia-send-icon {
    width: 20px;
    height: 20px;
  }

  .ccia-start-chat-confirm {
    .modal-box {
      max-width: 420px;
      border: 1px solid oklch(var(--bc) / 0.12);
      background: oklch(var(--b1));
      border-radius: 8px;
    }

    .ccia-confirm-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: oklch(var(--bc));
    }

    .ccia-confirm-message {
      margin: 12px 0 0;
      line-height: 1.55;
      color: oklch(var(--bc) / 0.72);
    }

    .ccia-confirm-actions {
      gap: 8px;
    }
  }

  .ccia-file-input {
    display: none;
  }

  @media (max-width: 640px) {
    &::before {
      left: -12px;
      right: -12px;
      bottom: -12px;
      height: 92px;
      box-shadow: none;
    }

    .ccia-input-card {
      width: 100%;
      border-radius: 24px;
      padding: 12px 14px;
      border: 1px solid oklch(var(--bc) / 0.27);
    }

    .ccia-shell {
      align-items: center;
      flex-wrap: wrap;
    }

    .ccia-custom-textarea {
      order: 2;
      width: 100%;
      font-size: 14px;
      min-height: 32px;
    }

    .ccia-model-area {
      max-width: 130px;
    }

    .ccia-model-select,
    .ccia-model-lock {
      max-width: 120px;
      font-size: 13px;
    }

    .ccia-capability-row {
      padding: 8px 0 0;
      gap: 6px;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .ccia-right-actions,
    .ccia-left-actions {
      gap: 6px;
      flex-wrap: wrap;
    }

    .ccia-capability-chip {
      height: 26px;
      padding: 0 8px;
      font-size: 11px;
    }

    .ccia-send-button {
      width: 36px;
      height: 36px;
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
