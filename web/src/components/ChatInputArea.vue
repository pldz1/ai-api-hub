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

      <div class="ccia-input-opts">
        <!-- 丰富对话功能 -->
        <div class="ccia-chat-opts">
          <!-- 上传图片 -->
          <AppTooltip v-if="activeCapabilities.imageInput" :text="t('tooltip.uploadImage')" placement="top">
            <button class="ccia-opts-button" @click="uploadImageFile">
              <SvgIcon class="ccia-icon" :src="attachIcon" />
            </button>
          </AppTooltip>
          <!-- 对话 -->
          <div v-if="false" class="tooltip tooltip-top" :data-tip="t('tooltip.sendOrStop')">
            <button class="ccia-opts-button">
              <SvgIcon class="ccia-icon" :src="realTimeVoiceIcon" />
            </button>
          </div>
        </div>

        <!-- 对话内容的发送或者暂停按钮位置 -->
        <div class="ccia-chat-model-info">
          <select v-if="!curChatId" class="select" v-model="selectedModel">
            <option disabled :value="null">{{ t("input.selectChatModel") }}</option>
            <option v-for="m in chatModels" :key="m.name" :value="m">
              {{ m.name }}
            </option>
          </select>
          <div v-else class="ccia-model-lock">
            {{ lockedModelName }}
          </div>

          <div class="ccia-chat-button">
            <AppTooltip :text="t('tooltip.sendOrStop')" placement="top">
              <button class="ccia-send-button" @click="onSendInputData">
                <!-- send chat button -->
                <span v-if="!props.isChatting" class="ccia-svg-icon">
                  <SvgIcon :src="arrowUpIcon" />
                </span>
                <!-- pause chat button -->
                <span v-else class="ccia-svg-icon">
                  <SvgIcon :src="pauseIcon" />
                </span>
              </button>
            </AppTooltip>
          </div>
        </div>
      </div>

      <div class="ccia-capability-bar">
        <div class="ccia-capability-summary">
          <span class="ccia-capability-label">{{ curChatId ? "Model" : "New chat model" }}</span>
          <span class="ccia-capability-model">{{ capabilityModelName }}</span>
        </div>
        <div class="ccia-capability-actions">
          <label v-for="item in visibleTurnCapabilities" :key="item.key" class="ccia-capability-chip" :class="{ active: inputCapabilities[item.key] }">
            <input type="checkbox" :checked="inputCapabilities[item.key]" @change="onToggleCapability(item.key, $event.target.checked)" />
            <span>{{ item.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useStore } from "vuex";
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import attachIcon from "@/assets/svg/attach24.svg";
import realTimeVoiceIcon from "@/assets/svg/realTimeVoice24.svg";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import { addPasteEvent, removePasteEvent, uploadImageFile, isValidUserMsg, dsAlert } from "@/utils";
import { packUserMsg } from "@/services";
import { debounce } from "@/utils";
import { capabilityLabels, chatTurnCapabilityKeys, createConversationModelSnapshot, getEffectiveCapabilities } from "@/constants";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";

const props = defineProps({
  isChatting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["on-start", "on-stop"]);
const inputText = ref("");
const cciaTextareaRef = ref(null);

/**
 * 这些都是用于显示模型的标签的数据
 */
const store = useStore();
const { t } = useI18n();
const chatModels = computed(() => store.state.models.chat);
const curChatId = computed(() => store.state.curChatId);
const curConversation = computed(() => store.state.curConversation);
const inputCapabilities = computed(() => store.state.inputCapabilities);
const selectedModel = ref(null);
const draftSnapshot = computed(() => createConversationModelSnapshot(selectedModel.value));
const activeSnapshot = computed(() => curConversation.value?.modelSnapshot || draftSnapshot.value);
const activeCapabilities = computed(() =>
  getEffectiveCapabilities(activeSnapshot.value?.supportedCapabilities, activeSnapshot.value?.enabledCapabilities, inputCapabilities.value),
);
const lockedModelName = computed(() => curConversation.value?.modelSnapshot?.displayName || "Locked model");
const capabilityModelName = computed(() => activeSnapshot.value?.displayName || "No model selected");
const visibleTurnCapabilities = computed(() =>
  chatTurnCapabilityKeys
    .filter((key) => key !== "imageInput")
    .filter((key) => Boolean(activeSnapshot.value?.supportedCapabilities?.[key] && activeSnapshot.value?.enabledCapabilities?.[key]))
    .map((key) => ({ key, label: capabilityLabels[key] })),
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
    const confirmed = window.confirm(`Start this chat with "${draftSnapshot.value.displayName}"? This model cannot be changed later in this conversation.`);
    if (!confirmed) return;
  }

  const data = packUserMsg("ccia-chat-input-imgs", inputText.value, activeCapabilities.value.imageInput);
  const flag = isValidUserMsg(data);
  if (flag) {
    inputText.value = "";
    emit("on-start", {
      message: {
        ...data,
        meta: {
          usedCapabilities: activeCapabilities.value,
        },
      },
      model: selectedModel.value,
    });
    await store.dispatch("resetInputCapabilities");

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
  if (activeCapabilities.value.imageInput) addPasteEvent("component-chat-input-area");
});

onBeforeUnmount(() => {
  removePasteEvent("component-chat-input-area");
});

watch(
  () => activeCapabilities.value.imageInput,
  (enabled) => {
    removePasteEvent("component-chat-input-area");
    if (enabled) addPasteEvent("component-chat-input-area");
  },
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
    background-color: oklch(var(--b2));
    border-radius: 24px;
    padding: 8px 20px;
    border: 1px solid oklch(var(--bc) / 0.5);

    .ccia-custom-textarea {
      padding: 8px 0px 4px 0px;
      border: none;
      outline: none;
      background-color: oklch(var(--b2));
      resize: none;
      box-shadow: initial;
      border-radius: initial;
      min-height: 54px;
      max-height: 208px;
      line-height: 1.5;
      font-size: 14px;
    }

    .ccia-chat-model-info {
      height: 36px;
      width: 360px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;

      .select {
        height: 36px;
        min-width: 0px;
        min-height: 0px;
        width: fit-content;
        border-radius: 36px;
        border: 1px solid oklch(var(--bc) / 0.2);
        background-color: transparent;
        text-align: center;
      }

      .ccia-model-lock {
        max-width: 220px;
        height: 32px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        border-radius: 18px;
        border: 1px solid oklch(var(--bc) / 0.16);
        color: oklch(var(--bc) / 0.72);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: oklch(var(--b1) / 0.54);
      }

      .ccia-chat-button {
        margin-left: 8px;
      }
    }

    .ccia-send-button {
      height: 32;
      width: 32;
      border-radius: 16px;
      background-color: transparent;
      border: none;
    }

    .ccia-input-area {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .ccia-capability-bar {
      min-height: 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 6px 0 2px 0;
      color: oklch(var(--bc) / 0.62);
      font-size: 12px;
    }

    .ccia-capability-summary {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .ccia-capability-label {
      color: oklch(var(--bc) / 0.45);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .ccia-capability-model {
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      color: oklch(var(--bc) / 0.72);
    }

    .ccia-capability-actions {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      flex-wrap: wrap;
    }

    .ccia-capability-chip {
      height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid oklch(var(--bc) / 0.1);
      background: transparent;
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
    }

    .ccia-input-opts {
      display: flex;
      justify-content: space-between;
      flex-direction: row;
      align-items: center;

      .ccia-opts-button {
        height: 32px;
        width: 32px;
        background-color: transparent;
        border: none;
        margin-left: 8px;

        .ccia-icon {
          min-width: 32px;
          min-height: 32px;
          max-width: 32px;
          max-height: 32px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          color: oklch(var(--bc));
        }
      }
    }

    .ccia-svg-icon {
      color: oklch(var(--bc));
      background-color: oklch(var(--b3));
      min-width: 32px;
      min-height: 32px;
      max-width: 32px;
      max-height: 32px;
      border-radius: 16px;
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
