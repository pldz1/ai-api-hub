<template>
  <div class="component-chat-input-area" id="component-chat-input-area">
    <div v-show="isShowStatusSticky" class="ccia-status-sticky">
      <div class="ccia-status-pill">
        <span class="ccia-status-time">({{ t("chat.timeCost") + " : " + elapsedSeconds }}s)</span>
        <span class="ccia-status-token">
          {{ t("input.tokenUsage", { total: formattedTokens.total, input: formattedTokens.input, output: formattedTokens.output }) }}
        </span>
      </div>
    </div>

    <div class="ccia-input-card">
      <div class="ccia-input-area">
        <div class="ccia-imgs-area" id="ccia-chat-input-imgs"></div>
        <textarea
          ref="cciaTextareaRef"
          v-model="inputText"
          class="textarea ccia-custom-textarea"
          :placeholder="t('input.chatPlaceholder')"
          @input="debounceInputText"
          @keydown.enter="onEnterKeydown"
        ></textarea>
      </div>

      <div class="ccia-input-footer">
        <div class="ccia-footer-line">
          <div class="ccia-footer-line-left ccia-input-tools">
            <select v-if="!isModelSelectionReadonly" class="select" v-model="selectedModel">
              <option disabled :value="null">{{ t("input.selectChatModel") }}</option>
              <option v-for="m in chatModels" :key="m.name" :value="m">
                {{ m.name }}
              </option>
            </select>
            <div v-else class="ccia-model-lock">
              {{ lockedModelName }}
            </div>
          </div>

          <div class="ccia-footer-line-right ccia-capability-group">
            <AppTooltip v-if="activeCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
              <button class="ccia-capability-chip ccia-capability-status ccia-image-upload-chip active" @click="uploadImageFile" type="button">
                <SvgIcon class="ccia-capability-icon" :src="attachIcon" />
                <span>{{ t("input.capabilities.imageRead") }}</span>
              </button>
            </AppTooltip>
            <span v-else class="ccia-capability-chip ccia-capability-status disabled">
              {{ t("input.capabilities.imageRead") }}
            </span>
            <AppTooltip v-for="item in visibleTurnCapabilities" :key="item.key" :text="item.tooltip" placement="top">
              <button
                class="ccia-capability-chip"
                :class="{ active: inputCapabilities[item.key] }"
                :aria-pressed="inputCapabilities[item.key]"
                type="button"
                @click="onToggleCapability(item.key, !inputCapabilities[item.key])"
              >
                <SvgIcon class="ccia-capability-icon" :src="item.icon" />
                <span>{{ item.label }}</span>
              </button>
            </AppTooltip>
          </div>

          <AppTooltip :text="t('tooltip.sendOrStop')" placement="top">
            <button class="ccia-send-button" :class="{ stopping: props.isChatting }" @click="onSendInputData" type="button">
              <SvgIcon class="ccia-send-icon" :src="props.isChatting ? pauseIcon : arrowUpIcon" />
            </button>
          </AppTooltip>
        </div>
      </div>
    </div>

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
          <button class="btn btn-ghost" type="button" @click="resolveStartChatConfirmation(false)">
            {{ t("input.confirmStartChatCancel") }}
          </button>
          <button class="btn btn-primary" type="button" @click="resolveStartChatConfirmation(true)">
            {{ t("input.confirmStartChatConfirm") }}
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { useStore } from "vuex";
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { addPasteEvent, removePasteEvent, uploadImageFile, isValidUserMsg, dsAlert } from "@/utils";
import { packUserMsg } from "@/services";
import { debounce } from "@/utils";
import {
  buildDefaultChatSettings,
  chatTurnCapabilityKeys,
  createConversationModelSnapshot,
  getEffectiveCapabilities,
  getModelDeployment,
  getModelRequestId,
} from "@/models";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import attachIcon from "@/assets/svg/attach24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import webIcon from "@/assets/svg/web24.svg";
import thinkingIcon from "@/assets/svg/thinking24.svg";

const props = defineProps({
  isChatting: {
    type: Boolean,
    default: false,
  },
  modelSelectionReadonly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["on-start", "on-stop"]);
const inputText = ref("");
const cciaTextareaRef = ref(null);
const startChatConfirmDialogRef = ref(null);
let startChatConfirmResolve = null;

const store = useStore();
const { t } = useI18n();
const chatModels = computed(() => store.state.models.chat);
const curChatId = computed(() => store.state.curChatId);
const curConversation = computed(() => store.state.curConversation);
const inputCapabilities = computed(() => store.state.inputCapabilities);
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const sessionTokenUsage = computed(() => store.state.sessionTokenUsage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const selectedModel = ref(null);
const elapsedMs = ref(0);
let timerIntervalId = null;

const isModelSelectionReadonly = computed(() => Boolean(props.modelSelectionReadonly || curChatId.value));
const draftSnapshot = computed(() => createConversationModelSnapshot(selectedModel.value));
const activeSnapshot = computed(() => curConversation.value?.modelSnapshot || draftSnapshot.value);
const activeCapabilities = computed(() =>
  getEffectiveCapabilities(activeSnapshot.value?.supportedCapabilities, activeSnapshot.value?.enabledCapabilities, inputCapabilities.value),
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

/**
 * Using key-value to dynamic show the model capabilities.
 */
const capabilityLabelKeys = {
  webSearch: "input.capabilities.webSearch",
  reasoning: "input.capabilities.reasoning",
};
const capabilityTooltipKeys = {
  reasoning: "tooltip.reasoning",
};
const capabilityIcons = {
  webSearch: webIcon,
  reasoning: thinkingIcon,
};

const visibleTurnCapabilities = computed(() =>
  chatTurnCapabilityKeys
    .filter((key) => key !== "imageRead")
    .filter((key) => Boolean(activeSnapshot.value?.supportedCapabilities?.[key] && activeSnapshot.value?.enabledCapabilities?.[key]))
    .map((key) => ({
      key,
      label: t(capabilityLabelKeys[key] || `input.capabilities.${key}`),
      tooltip: t(capabilityTooltipKeys[key] || capabilityLabelKeys[key] || `input.capabilities.${key}`),
      icon: capabilityIcons[key],
    })),
);
const getModelSelectionKey = (model) => [model?.provider, model?.name, getModelRequestId(model), getModelDeployment(model)].join("|");

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
      await store.dispatch("setCurChatModelSettings", buildDefaultChatSettings(model));
    }
  },
  { immediate: true },
);

/**
 * Send a valid question, or pause the conversation.
 */
const onSendInputData = async () => {
  if (props.isChatting) {
    emit("on-stop");
    return;
  }

  if (!curChatId.value && !selectedModel.value) {
    dsAlert({ type: "warn", message: t("input.selectChatModel") });
    return;
  }

  if (!curChatId.value && !draftSnapshot.value) {
    dsAlert({ type: "warn", message: t("toast.modelInitCheck") });
    return;
  }

  if (curChatId.value && !curConversation.value?.modelSnapshot) {
    dsAlert({ type: "warn", message: t("toast.modelInitCheck") });
    return;
  }

  if (!curChatId.value) {
    const confirmed = await requestStartChatConfirmation();
    if (!confirmed) return;
  }

  const data = packUserMsg("ccia-chat-input-imgs", inputText.value, activeCapabilities.value.imageRead);
  const flag = isValidUserMsg(data);
  if (flag) {
    inputText.value = "";
    emit("on-start", {
      message: {
        ...data,
        meta: {
          usedCapabilities: {
            ...activeCapabilities.value,
            reasoning: Boolean(inputCapabilities.value.reasoning),
          },
        },
      },
      model: selectedModel.value,
    });

    // The input box will revert the original size.
    if (cciaTextareaRef.value) cciaTextareaRef.value.style.height = "";
  } else {
    dsAlert({ type: "error", message: t("toast.invalidQuestion") });
    return;
  }
};

const onToggleCapability = async (key, value) => {
  await store.dispatch("setInputCapability", { key, value });
};

const requestStartChatConfirmation = () =>
  new Promise((resolve) => {
    const dialog = startChatConfirmDialogRef.value;
    if (!dialog?.showModal) {
      resolve(false);
      return;
    }

    startChatConfirmResolve = resolve;
    dialog.showModal();
  });

const resolveStartChatConfirmation = (confirmed) => {
  if (startChatConfirmResolve) {
    startChatConfirmResolve(Boolean(confirmed));
    startChatConfirmResolve = null;
  }

  const dialog = startChatConfirmDialogRef.value;
  if (dialog?.open) dialog.close();
};

const clearRequestIntervals = () => {
  if (timerIntervalId) {
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

/**
 * 🎥 Monitoring the input and dynamically adjusting the size of the input box is a workaround,
 * but it meets the requirements of the scenario.
 */
const onInputText = async () => {
  if (cciaTextareaRef.value) {
    cciaTextareaRef.value.style.height = "auto";
    cciaTextareaRef.value.style.height = `${cciaTextareaRef.value.scrollHeight}px`;
  }
};

/**
 * Implement debounce operation to save a small amount of resources.
 */
const debounceInputText = debounce(onInputText, 50);

/**
 * Keyboard shortcut for input box
 */
const onEnterKeydown = async (event) => {
  // Enter and Shift means line break operation
  if (event.key === "Enter" && !event.shiftKey) {
    // Prevent default behavior (line break) and send the content.
    event.preventDefault();
    await onSendInputData();
  }
};

onMounted(() => {
  if (activeCapabilities.value.imageRead) addPasteEvent("component-chat-input-area");
});

onBeforeUnmount(() => {
  removePasteEvent("component-chat-input-area");
  clearRequestIntervals();
  resolveStartChatConfirmation(false);
});

watch(
  () => activeCapabilities.value.imageRead,
  (enabled) => {
    removePasteEvent("component-chat-input-area");
    if (enabled) addPasteEvent("component-chat-input-area");
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
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .ccia-status-sticky {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    z-index: 2;
    width: calc(100% - 40px);
    transform: translateX(-50%);
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
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

  .ccia-status-time,
  .ccia-status-token {
    min-width: 0;
  }

  .ccia-status-token {
    color: oklch(var(--bc) / 0.64);
  }

  @media (max-width: 640px) {
    .ccia-status-pill {
      flex-wrap: wrap;
      white-space: normal;
    }
  }

  .ccia-input-card {
    width: calc(100% - 40px);
    background-color: oklch(var(--b1) / 0.92);
    border-radius: 22px;
    padding: 14px 16px 10px;
    border: 1px solid oklch(var(--bc) / 0.18);
    box-shadow: 0 18px 42px oklch(var(--bc) / 0.08);

    .ccia-custom-textarea {
      padding: 4px 6px 8px;
      border: none;
      outline: none;
      background-color: transparent;
      resize: none;
      box-shadow: initial;
      border-radius: initial;
      min-height: 52px;
      max-height: 208px;
      line-height: 1.5;
      font-size: 15px;
    }

    .ccia-input-footer {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 2px 4px 0;
    }

    .ccia-footer-line {
      width: 100%;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .ccia-footer-line-left,
    .ccia-footer-line-right {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ccia-footer-line-left {
      justify-content: flex-start;
    }

    .ccia-footer-line-right {
      justify-content: flex-end;
      margin-left: auto;
    }

    .ccia-input-tools {
      flex: 0 0 auto;
      flex-wrap: nowrap;
    }

    .ccia-capability-group {
      flex: 1 1 auto;
    }

    .select {
      height: 34px;
      width: 236px;
      flex: 0 1 236px;
      min-width: 0;
      min-height: 0;
      max-width: 240px;
      border-radius: 17px;
      border: 1px solid oklch(var(--bc) / 0.14);
      background-color: transparent;
      text-align: center;
    }

    .ccia-model-lock {
      max-width: 220px;
      height: 30px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      border-radius: 15px;
      border: 1px solid oklch(var(--bc) / 0.1);
      color: oklch(var(--bc) / 0.72);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: oklch(var(--b2) / 0.64);
    }

    .ccia-send-button {
      height: 34px;
      width: 34px;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: oklch(var(--p));
      color: oklch(var(--b1));
      border: none;
      box-shadow: 0 8px 18px oklch(var(--p) / 0.24);
      transition:
        transform 0.15s ease,
        background-color 0.15s ease,
        box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px oklch(var(--p) / 0.28);
      }

      &.stopping {
        background-color: oklch(var(--er));
        color: oklch(var(--b1));
        box-shadow: 0 8px 18px oklch(var(--er) / 0.2);
      }
    }

    .ccia-input-area {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .ccia-capability-chip {
      height: 30px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      border-radius: 15px;
      border: 1px solid oklch(var(--bc) / 0.1);
      background: oklch(var(--b2) / 0.36);
      color: oklch(var(--bc) / 0.62);
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
      appearance: none;
      outline: none;

      &.active {
        color: oklch(var(--p));
        border-color: oklch(var(--p) / 0.34);
        background: oklch(var(--p) / 0.08);
      }

      &.disabled {
        opacity: 0.58;
      }
    }

    .ccia-capability-status {
      cursor: default;
      user-select: none;
    }

    .ccia-image-upload-chip {
      cursor: pointer;

      &:hover {
        cursor: pointer;
        border-color: oklch(var(--p) / 0.46);
        background: oklch(var(--p) / 0.12);
      }
    }

    .ccia-capability-icon {
      width: 16px;
      height: 16px;
    }

    @media (max-width: 640px) {
      .ccia-footer-line {
        align-items: flex-start;
      }

      .ccia-capability-group {
        flex: 1;
      }

      .ccia-input-tools {
        flex: 0 1 auto;
      }

      .select {
        width: min(180px, calc(100vw - 112px));
        flex-basis: min(180px, calc(100vw - 112px));
      }

      .ccia-model-lock {
        flex: 1 1 160px;
        max-width: none;
      }
    }

    .ccia-send-icon {
      width: 20px;
      height: 20px;
    }
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
}
</style>

<style lang="scss">
.ccia-imgs-area {
  display: flex;
  flex-direction: row;
  max-height: 60px;
  gap: 6px;
  max-width: 100%;
  overflow-y: hidden;
  overflow-x: auto;

  .ccia-item {
    height: 50px;
    width: 50px;
    min-height: 50px;
    min-width: 50px;
    z-index: 1;

    .ccia-image {
      height: 50px;
      width: 50px;
      object-fit: cover;
    }

    .ccia-hover-item {
      display: none;
      position: absolute;
      z-index: 2;

      .ccia-hover-button {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 50px;
        width: 50px;
      }
    }

    &:hover {
      .ccia-image {
        opacity: 0.7;
      }

      .ccia-hover-item {
        display: block;
      }
    }
  }
}

.ccia-imgs-area::-webkit-scrollbar {
  height: 4px;
}
</style>
