<template>
  <!-- This view renders the chat input box, capabilities, and send controls. -->
  <div id="component-chat-input-area" class="component-chat-input-area" @paste="onPaste">
    <!-- Show live request timing and token usage when a session is active. -->
    <div v-show="isShowStatusSticky" class="ccia-status-sticky">
      <div class="ccia-status-pill">
        <span class="ccia-status-time">({{ t("chat.timeCost") + " : " + elapsedSeconds }}s)</span>
        <span class="ccia-status-token">
          {{ t("input.tokenUsage", { total: formattedTokens.total, input: formattedTokens.input, output: formattedTokens.output }) }}
        </span>
      </div>
    </div>

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
            <AppTooltip v-if="activeCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
              <button class="ccia-capability-chip" type="button" @click="openImageFilePicker">
                <SvgIcon class="ccia-capability-icon" :src="attachIcon" />
                <span>{{ t("input.capabilities.imageRead") }}</span>
              </button>
            </AppTooltip>
            <AppTooltip v-for="item in visibleTurnCapabilities" :key="item.key" :text="item.tooltip" placement="top">
              <button
                class="ccia-capability-chip"
                :class="{ active: inputCapabilities[item.key] }"
                type="button"
                @click="onToggleCapability(item.key, !inputCapabilities[item.key])"
              >
                <SvgIcon class="ccia-capability-icon" :src="item.icon" />
                <span>{{ item.label }}</span>
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
import {
  createConversationModelSnapshot,
  getEffectiveCapabilities,
  getChatModelCapabilities,
  getModelDeployment,
  mergeChatSettingsWithModel,
  getModelFromSnapshot,
} from "@/models";
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
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const sessionTokenUsage = computed(() => store.state.sessionTokenUsage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const selectedModel = ref<ChatModelConfig | null>(null);
const elapsedMs = ref(0);
let timerIntervalId: number | null = null;

const isModelSelectionReadonly = computed(() => Boolean(props.modelSelectionReadonly || curChatId.value));
const draftSnapshot = computed(() => createConversationModelSnapshot(selectedModel.value));
const activeSnapshot = computed(() => curConversation.value?.modelSnapshot || draftSnapshot.value);
const activeModelConfig = computed(() => getModelFromSnapshot(activeSnapshot.value));
const activeSupportedCapabilities = computed(() =>
  activeModelConfig.value ? getChatModelCapabilities(activeModelConfig.value.model) : { ...defaultModelCapabilities },
);
const activeCapabilities = computed(() =>
  getEffectiveCapabilities(activeSupportedCapabilities.value, activeSupportedCapabilities.value, inputCapabilities.value),
);
const lockedModelName = computed(() => curConversation.value?.modelSnapshot?.displayName || t("input.lockedModel"));
const elapsedSeconds = computed(() => (elapsedMs.value / 1000).toFixed(1));
const formattedTokens = computed(() => ({
  input: Number(sessionTokenUsage.value.input_tokens || 0).toLocaleString(),
  output: Number(sessionTokenUsage.value.output_tokens || 0).toLocaleString(),
  total: Number(sessionTokenUsage.value.total_tokens || 0).toLocaleString(),
}));
const isChatRunning = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status || "")));
const isShowStatusSticky = computed(() => isChatRunning.value || Number(sessionTokenUsage.value.total_tokens || 0) > 0);
const capabilityLabelKeys: Record<string, string> = {
  webSearch: "input.capabilities.webSearch",
};

const capabilityIcons: Record<string, string> = {
  webSearch: webIcon,
};

const visibleTurnCapabilities = computed(() => {
  const supported = activeSupportedCapabilities.value;

  return Object.keys(capabilityLabelKeys)
    .filter((key) => key !== "imageRead" && supported?.[key])
    .map((key) => {
      const translationKey = capabilityLabelKeys[key];
      const text = t(translationKey);
      return {
        key,
        label: text,
        tooltip: text,
        icon: capabilityIcons[key] || undefined,
      };
    });
});

const getModelSelectionKey = (model: ChatModelConfig | null) => [model?.provider, model?.name, model?.model, getModelDeployment(model)].join("|");

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

const clearRequestIntervals = () => {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
};

const startRequestTimer = () => {
  clearRequestIntervals();
  elapsedMs.value = 0;
  const startTime = performance.now();
  timerIntervalId = window.setInterval(() => {
    elapsedMs.value = performance.now() - startTime;
  }, 100);
};

const onInputText = async () => {
  const textarea = cciaTextareaRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
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

const debounceInputText = debounce(onInputText, 50);

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
  const nextImages = await Promise.all(Array.from(files).map((file) => readFileAsInputImage(file)));
  inputImages.value = [...inputImages.value, ...(nextImages.filter(Boolean) as ChatInputImage[])];
}

function openImageFilePicker() {
  imageFileInputRef.value?.click();
}

async function onImageFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) await addImageFiles(target.files);
  target.value = "";
}

async function onPaste(event: ClipboardEvent) {
  if (!activeCapabilities.value.imageRead) return;
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

onBeforeUnmount(() => {
  clearRequestIntervals();
  resolveStartChatConfirmation(false);
});

watch(
  () => activeCapabilities.value.imageRead,
  (enabled) => {
    if (!enabled) inputImages.value = [];
  },
);

watch(
  () => isChatRunning.value,
  (pending) => {
    if (pending) {
      startRequestTimer();
      return;
    }
    clearRequestIntervals();
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.component-chat-input-area {
  position: relative;
  width: 100%;
  max-width: 1040px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &::before {
    content: "";
    position: absolute;
    left: -24px;
    right: -24px;
    bottom: -20px;
    height: 168px;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(180deg, oklch(var(--b1) / 0) 0%, oklch(var(--b1) / 0.78) 42%, oklch(var(--b1)) 78%, oklch(var(--b1)) 100%);
    box-shadow: inset 0 -56px 72px oklch(var(--b1) / 0.32);
  }

  .ccia-status-sticky {
    position: absolute;
    right: 5%;
    bottom: calc(100% + 10px);
    z-index: 2;
    display: flex;
    justify-content: center;
    padding: 0 12px;
    box-sizing: border-box;
  }

  .ccia-status-pill {
    max-width: 100%;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 16px;
    border: 1px solid oklch(var(--p) / 0.2);
    color: oklch(var(--p));
    background: oklch(var(--b1) / 0.86);
    box-shadow: 0 10px 28px oklch(var(--bc) / 0.08);
    backdrop-filter: blur(10px);
    font-size: 12px;
    line-height: 1.25;
    white-space: nowrap;
  }

  .ccia-status-token {
    color: oklch(var(--bc) / 0.64);
  }

  .ccia-input-card {
    position: relative;
    z-index: 1;
    width: min(960px, 100%);
    background: oklch(var(--b1) / 0.96);
    border-radius: 42px;
    padding: 14px 18px 12px;
    border: 1px solid oklch(var(--bc) / 0.07);
    box-shadow:
      0 2px 6px oklch(var(--bc) / 0.05),
      0 4px 8px oklch(var(--bc) / 0.06);
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
    line-height: 1.4;
    font-size: 18px;
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
    background:
      linear-gradient(180deg, oklch(var(--b1) / 0.96), oklch(var(--b2) / 0.94)),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
        no-repeat right 10px center / 12px 12px;
    appearance: none;
    padding-right: 30px;
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
    box-shadow: 0 8px 20px oklch(var(--bc) / 0.16);

    &.stopping {
      background-color: oklch(var(--er));
      color: oklch(var(--nc));
      box-shadow: 0 8px 18px oklch(var(--er) / 0.2);
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
      box-shadow: 0 18px 48px oklch(var(--bc) / 0.16);
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
      background: linear-gradient(180deg, oklch(var(--b1) / 0) 0%, oklch(var(--b1) / 0.58) 54%, oklch(var(--b1)) 100%);
      box-shadow: none;
    }

    .ccia-status-sticky {
      bottom: calc(100% + 6px);
      justify-content: center;
      padding: 0 8px;
      pointer-events: none;
    }

    .ccia-status-pill {
      width: min(100%, 320px);
      min-height: 22px;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 8px;
      border-color: oklch(var(--bc) / 0.08);
      color: oklch(var(--bc) / 0.58);
      background: oklch(var(--b1) / 0.84);
      box-shadow: 0 6px 18px oklch(var(--bc) / 0.06);
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
    }

    .ccia-status-time,
    .ccia-status-token {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ccia-input-card {
      width: 100%;
      border-radius: 24px;
      padding: 12px 14px;
      border: 1px solid oklch(var(--bc) / 0.07);
      box-shadow:
        0 2px 8px oklch(var(--bc) / 0.05),
        0 10px 24px oklch(var(--bc) / 0.08);
    }

    .ccia-shell {
      align-items: center;
      flex-wrap: wrap;
    }

    .ccia-custom-textarea {
      order: 2;
      width: 100%;
      font-size: 16px;
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
