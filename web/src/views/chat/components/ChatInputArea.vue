<template>
  <div class="component-chat-input-area" id="component-chat-input-area">
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
        <div class="ccia-footer-left">
          <AppTooltip v-if="activeCapabilities.imageRead" :text="t('tooltip.uploadImage')" placement="top">
            <button class="ccia-icon-button" @click="uploadImageFile" type="button">
              <SvgIcon class="ccia-icon" :src="attachIcon" />
            </button>
          </AppTooltip>
          <div class="ccia-model-status">
            <select v-if="!isModelSelectionReadonly" class="select" v-model="selectedModel">
              <option disabled :value="null">{{ t("input.selectChatModel") }}</option>
              <option v-for="m in chatModels" :key="m.name" :value="m">
                {{ m.name }}
              </option>
            </select>
            <div v-else class="ccia-model-lock">
              {{ lockedModelName }}
            </div>
            <div class="ccia-live-timer">({{ elapsedSeconds }}s)</div>
            <div class="ccia-token-total">
              {{ t("input.tokenUsage", { total: formattedTokens.total, input: formattedTokens.input, output: formattedTokens.output }) }}
            </div>
          </div>
        </div>

        <div class="ccia-footer-right">
          <span class="ccia-capability-chip ccia-capability-status" :class="{ active: activeCapabilities.imageRead, disabled: !activeCapabilities.imageRead }">
            {{ t("input.capabilities.imageRead") }}
          </span>
          <label v-for="item in visibleTurnCapabilities" :key="item.key" class="ccia-capability-chip" :class="{ active: inputCapabilities[item.key] }">
            <input type="checkbox" :checked="inputCapabilities[item.key]" @change="onToggleCapability(item.key, $event.target.checked)" />
            <span>{{ item.label }}</span>
          </label>
          <AppTooltip :text="t('tooltip.sendOrStop')" placement="top">
            <button class="ccia-send-button" :class="{ stopping: props.isChatting }" @click="onSendInputData" type="button">
              <SvgIcon class="ccia-send-icon" :src="props.isChatting ? pauseIcon : arrowUpIcon" />
            </button>
          </AppTooltip>
        </div>
      </div>
    </div>

    <dialog ref="startChatConfirmDialogRef" class="modal ccia-start-chat-confirm" @cancel.prevent="resolveStartChatConfirmation(false)" @close="resolveStartChatConfirmation(false)">
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
import { chatTurnCapabilityKeys, createConversationModelSnapshot, getEffectiveCapabilities } from "@/constants";
import AppTooltip from "@/components/base/AppTooltip.vue";
import SvgIcon from "@/components/base/SvgIcon.vue";
import attachIcon from "@/assets/svg/attach24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import pauseIcon from "@/assets/svg/pause32.svg";

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

/**
 * 这些都是用于显示模型的标签的数据
 */
const store = useStore();
const { t } = useI18n();
const chatModels = computed(() => store.state.models.chat);
const curChatId = computed(() => store.state.curChatId);
const curConversation = computed(() => store.state.curConversation);
const inputCapabilities = computed(() => store.state.inputCapabilities);
const isRequestPending = computed(() => store.state.llmRequestPending);
const sessionTokenUsage = computed(() => store.state.sessionTokenUsage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const selectedModel = ref(null);
const elapsedMs = ref(0);
let timerIntervalId = null;
const capabilityLabelKeys = {
  webSearch: "input.capabilities.webSearch",
  reasoning: "input.capabilities.reasoning",
};
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
const visibleTurnCapabilities = computed(() =>
  chatTurnCapabilityKeys
    .filter((key) => key !== "imageRead")
    .filter((key) => Boolean(activeSnapshot.value?.supportedCapabilities?.[key] && activeSnapshot.value?.enabledCapabilities?.[key]))
    .map((key) => ({ key, label: t(capabilityLabelKeys[key] || `input.capabilities.${key}`) })),
);
watch(
  () => chatModels.value,
  (models) => {
    if (!selectedModel.value && models.length > 0) selectedModel.value = models[0];
  },
  { deep: true, immediate: true },
);

/**
 * 发送有效的问题, 或者是暂停对话
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

    // 输入框回退原来大小
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
 * 监听输入的内容, 动态的调整输入框的大小, 是一个 workaround, 但是能满足场景
 */
const onInputText = async () => {
  if (cciaTextareaRef.value) {
    cciaTextareaRef.value.style.height = "auto";
    cciaTextareaRef.value.style.height = `${cciaTextareaRef.value.scrollHeight}px`;
  }
};

/**
 * 加入防抖的操作, 节约一点点的资源
 */
const debounceInputText = debounce(onInputText, 50);

/**
 * 输入框的按键组合键
 *  */
const onEnterKeydown = async (event) => {
  // Enter 和 Shift 键表示换行的操作
  if (event.key === "Enter" && !event.shiftKey) {
    // 阻止默认行为（换行）并发送内容
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
  () => isRequestPending.value,
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
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  justify-content: center;

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
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .ccia-footer-left,
    .ccia-footer-right {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ccia-footer-left {
      justify-content: flex-start;
    }

    .ccia-footer-right {
      justify-content: flex-end;
    }

    .ccia-model-status {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .select {
      height: 34px;
      min-width: 0px;
      min-height: 0px;
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

    .ccia-live-timer,
    .ccia-token-total {
      height: 30px;
      display: inline-flex;
      align-items: center;
      border-radius: 15px;
      padding: 0 10px;
      border: 1px solid oklch(var(--bc) / 0.08);
      font-size: 12px;
      white-space: nowrap;
    }

    .ccia-live-timer {
      color: oklch(var(--p));
      background: oklch(var(--p) / 0.08);
      border-color: oklch(var(--p) / 0.22);
    }

    .ccia-token-total {
      color: oklch(var(--bc) / 0.64);
      background: oklch(var(--b2) / 0.4);
    }

    .ccia-send-button {
      height: 34px;
      width: 34px;
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
      cursor: pointer;
      user-select: none;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;

      input {
        width: 12px;
        height: 12px;
        accent-color: oklch(var(--p));
      }

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

    .ccia-icon-button {
      height: 32px;
      width: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: transparent;
      border: 1px solid transparent;
      color: oklch(var(--bc) / 0.72);

      &:hover {
        background-color: oklch(var(--b2) / 0.72);
        border-color: oklch(var(--bc) / 0.08);
      }

      .ccia-icon {
        width: 22px;
        height: 22px;
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
