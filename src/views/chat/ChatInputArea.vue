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

    <div class="ccia-input-card" :class="{ 'is-home': props.isHome }">
      <div class="ccia-input-area">
        <div class="ccia-imgs-area" id="ccia-chat-input-imgs"></div>

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

        <div class="ccia-capability-row">
          <!-- Right actions -->
          <div class="ccia-right-actions">
            <!-- Select model -->
            <div class="ccia-model-area">
              <select v-if="!isModelSelectionReadonly" class="ccia-model-select" v-model="selectedModel">
                <option disabled :value="null">{{ t("input.selectChatModel") }}</option>
                <option v-for="m in chatModels" :key="m.name" :value="m">
                  {{ m.name }}
                </option>
              </select>
              <!-- Lock model selector. -->
              <div v-else class="ccia-model-lock">
                <AppTooltip :text="t('tooltip.cannotEditModel')" placement="top">
                  {{ lockedModelName }}
                </AppTooltip>
              </div>
            </div>
            <!-- Set model parameters -->
            <AppTooltip :text="t('tooltip.modelSettings')" placement="top">
              <button class="ccia-model-setting-button" type="button" @click="onShowModelSettings">
                <SvgIcon :src="paramIcon" />
              </button>
            </AppTooltip>
          </div>

          <div class="ccia-left-actions">
            <!-- Image read: This operation will trigger a file browser dialog; therefore, it should not be included within a for loop. -->
            <AppTooltip v-if="activeCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
              <button class="ccia-capability-chip" @click="uploadImageFile" type="button">
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
            <!-- Send/stop request. -->
            <AppTooltip :text="t('tooltip.sendOrStop')" placement="top">
              <button class="ccia-send-button" :class="{ stopping: props.isChatting }" @click="onSendInputData" type="button">
                <SvgIcon class="ccia-send-icon" :src="props.isChatting ? pauseIcon : arrowUpIcon" />
              </button>
            </AppTooltip>
          </div>
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

  <ChatSettings />
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
  getSnapshotEnabledCapabilities,
  getSnapshotSupportedCapabilities,
} from "@/models";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import attachIcon from "@/assets/svg/attach24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import webIcon from "@/assets/svg/web24.svg";
import thinkingIcon from "@/assets/svg/thinking24.svg";
import paramIcon from "@/assets/svg/param24.svg";
import ChatSettings from "@/views/chat/ChatSettings.vue";

const props = defineProps({
  isChatting: {
    type: Boolean,
    default: false,
  },
  modelSelectionReadonly: {
    type: Boolean,
    default: false,
  },
  isHome: {
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
const activeSupportedCapabilities = computed(() => getSnapshotSupportedCapabilities(activeSnapshot.value));
const activeEnabledCapabilities = computed(() => getSnapshotEnabledCapabilities(activeSnapshot.value));
const activeCapabilities = computed(() =>
  getEffectiveCapabilities(activeSupportedCapabilities.value, activeEnabledCapabilities.value, inputCapabilities.value),
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
    .filter((key) => Boolean(activeSupportedCapabilities.value?.[key] && activeEnabledCapabilities.value?.[key]))
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

    if (cciaTextareaRef.value) cciaTextareaRef.value.style.height = "";
  } else {
    dsAlert({ type: "error", message: t("toast.invalidQuestion") });
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

const onInputText = async () => {
  if (cciaTextareaRef.value) {
    cciaTextareaRef.value.style.height = "auto";
    cciaTextareaRef.value.style.height = `${cciaTextareaRef.value.scrollHeight}px`;
  }
};

const debounceInputText = debounce(onInputText, 50);

const onEnterKeydown = async (event) => {
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
  global_chat_model_settings.showModal();
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
  max-width: 980px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .ccia-status-sticky {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    z-index: 2;
    width: calc(100% - 16px);
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

  .ccia-status-token {
    color: oklch(var(--bc) / 0.64);
  }

  .ccia-input-card {
    width: min(828px, 100%);
    background: rgba(255, 255, 255, 0.96);
    border-radius: 42px;
    padding: 14px 18px 12px;
    border: 1px solid rgba(27, 39, 51, 0.07);
    box-shadow:
      0 2px 6px rgba(17, 24, 39, 0.05),
      0 4px 8px rgba(17, 24, 39, 0.06);
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
    padding: 0px 4px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    color: #111827;
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ccia-model-select {
    border: 2px solid #e8e8e7;
    background: transparent;
  }

  .ccia-model-lock {
    background: #e8e8e7;
  }

  .ccia-send-button {
    height: 38px;
    width: 38px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: #111827;
    color: #fff;
    border: none;
    box-shadow: 0 8px 20px rgba(17, 24, 39, 0.16);
    transition:
      transform 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(17, 24, 39, 0.22);
    }

    &.stopping {
      background-color: #be123c;
      color: #fff;
      box-shadow: 0 8px 18px rgba(190, 18, 60, 0.2);
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
    border: 1px solid rgba(17, 24, 39, 0.08);
    background: #f7f7f6;
    color: rgba(17, 24, 39, 0.76);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    appearance: none;
    outline: none;

    &.active {
      color: #174466;
      border-color: rgba(35, 95, 143, 0.16);
      background: #eef6ff;
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

  @media (max-width: 640px) {
    .ccia-status-pill {
      flex-wrap: wrap;
      white-space: normal;
    }

    .ccia-input-card {
      border-radius: 28px;
      padding: 10px 12px 12px;
    }

    .ccia-shell {
      align-items: center;
      flex-wrap: wrap;
    }

    .ccia-custom-textarea {
      order: 2;
      width: 100%;
      font-size: 16px;
    }

    .ccia-model-area {
      max-width: 130px;
    }

    .ccia-model-select,
    .ccia-model-lock {
      max-width: 130px;
      font-size: 14px;
    }

    .ccia-capability-row {
      padding-left: 0;
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
  padding-left: 52px;
  margin-bottom: 6px;

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

@media (max-width: 640px) {
  .ccia-imgs-area {
    padding-left: 0;
  }
}
</style>
