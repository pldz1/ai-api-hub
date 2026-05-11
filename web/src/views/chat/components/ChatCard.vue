<template>
  <div class="chat-card-container">
    <!-- 显示markdown的问答区域 -->
    <ChatInsTemplate v-show="isShowTemplate" @on-update="onDrawTemplateIns"></ChatInsTemplate>
    <div class="ccdc-messages-container">
      <div id="chat-messages-container" class="cccd-scroll-window" ref="innerRef" @scroll="updateScrollActions"></div>
      <div class="cccd-scroll-actions">
        <AppTooltip text="To top" placement="left">
          <button class="cccd-scroll-action" :class="{ disabled: !canScrollTop }" type="button" aria-label="To top" @click="scrollMessagesToTop">
            <SvgIcon class="cccd-scroll-action-icon" :src="arrowUpIcon" />
          </button>
        </AppTooltip>
        <AppTooltip text="To bottom" placement="left">
          <button class="cccd-scroll-action" :class="{ disabled: !canScrollBottom }" type="button" aria-label="To bottom" @click="scrollMessagesToBottom">
            <SvgIcon class="cccd-scroll-action-icon is-bottom" :src="arrowUpIcon" />
          </button>
        </AppTooltip>
      </div>
    </div>
    <!-- 输入问题 -->
    <div class="cccd-input-area">
      <ChatInputArea
        :is-chatting="isChatting"
        :model-selection-readonly="isModelSelectionReadonly"
        @on-start="onStartChat"
        @on-stop="onStopChat"
      ></ChatInputArea>
    </div>
  </div>
</template>

<script setup>
import { useStore } from "vuex";
import { dsLoading } from "@/utils";
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { ChatDrawer, addChat, getAllMessage } from "@/services";

import AppTooltip from "@/components/base/AppTooltip.vue";
import SvgIcon from "@/components/base/SvgIcon.vue";
import ChatInputArea from "@/views/chat/components/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/components/ChatInsTemplate.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";

const store = useStore();
const isChatting = ref(false);
const innerRef = ref(null);
const canScrollTop = ref(false);
const canScrollBottom = ref(false);

const drawer = new ChatDrawer(true);
const curConversation = computed(() => store.state.curConversation);
const curChatId = computed(() => store.state.curChatId);
const isModelSelectionReadonly = computed(() => Boolean(curConversation.value?.modelSnapshot && (curChatId.value || store.state.messages.length > 0)));
const isShowTemplate = ref(true);

const updateScrollActions = () => {
  const el = innerRef.value;
  if (!el) return;
  canScrollTop.value = el.scrollTop > 4;
  canScrollBottom.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
};

const scrollMessagesToTop = () => {
  if (!innerRef.value) return;
  innerRef.value.scrollTo({ top: 0, behavior: "smooth" });
};

const scrollMessagesToBottom = () => {
  if (!innerRef.value) return;
  innerRef.value.scrollTo({ top: innerRef.value.scrollHeight, behavior: "smooth" });
};

watch(
  () => curChatId.value,
  async (newVal) => {
    dsLoading(true);
    drawer.removeAllElem();
    await nextTick();

    // 判读对话的 id, 来显示不同的内容.
    if (!newVal) {
      // 如果是空的对话 id, 那么就认为是新的对话.
      isShowTemplate.value = true;
    } else {
      isShowTemplate.value = false;
      getAllMessage(drawer.draw);
    }

    await nextTick();
    updateScrollActions();
    dsLoading(false);
  },
);

watch(
  () => curConversation.value?.modelSnapshot?.modelConfigId,
  () => {
    drawer.chatClientInit();
  },
  { immediate: true },
);

/** 向服务器发送数据 */
const onStartChat = async (payload) => {
  isShowTemplate.value = false;
  const message = payload?.message || payload;
  const selectedModel = payload?.model || null;

  // 新建对话
  if (!curChatId.value) {
    await addChat(null, selectedModel);
  }
  isChatting.value = true;
  await drawer.chat(message);
  isChatting.value = false;
  await nextTick();
  updateScrollActions();
};

/**
 * 停止接受消息
 * */
const onStopChat = async () => {
  drawer.stop();
  isChatting.value = false;
};

/**
 * 绘制对话指令的内容, 这个不会放进store
 */
const onDrawTemplateIns = (messages) => {
  drawer.draw(messages);
};

onMounted(() => {
  drawer.init("chat-messages-container");
  updateScrollActions();
});
</script>

<style lang="scss" scoped>
.chat-card-container {
  position: relative;
  width: 100%;
  height: 100%;
  border: 1px solid oklch(var(--bc) / 0.12);
  border-radius: 30px;
  background:
    radial-gradient(circle at top right, oklch(var(--a) / 0.08), transparent 26%),
    radial-gradient(circle at bottom left, oklch(var(--p) / 0.05), transparent 24%), linear-gradient(180deg, oklch(var(--b1) / 0.9), oklch(var(--b2) / 0.86));
  box-shadow: 0 22px 52px oklch(var(--bc) / 0.08);
  overflow: hidden;

  .chat-template-display-card,
  .cccd-input-area {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: min(880px, calc(100% - 72px));
    max-width: min(880px, calc(100% - 72px));
  }

  .ccdc-messages-container {
    position: absolute;
    left: 0;
    right: 0;
    top: 20px;
    width: 100%;
    height: calc(100% - 192px);
    z-index: 100;
  }

  .cccd-scroll-window {
    width: 100%;
    height: 100%;
    max-height: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
    overflow-y: auto;
    padding-inline: max(36px, calc((100% - 880px) / 2));
  }

  .cccd-scroll-actions {
    position: absolute;
    right: 14px;
    bottom: 16px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cccd-scroll-action {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid oklch(var(--bc) / 0.1);
    color: oklch(var(--bc) / 0.66);
    background: oklch(var(--b1) / 0.86);
    box-shadow: 0 10px 24px oklch(var(--bc) / 0.08);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      background-color 0.15s ease,
      opacity 0.15s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: oklch(var(--p) / 0.32);
      color: oklch(var(--p));
      background: oklch(var(--p) / 0.08);
    }

    &.disabled {
      opacity: 0.42;
      pointer-events: none;
    }
  }

  .cccd-scroll-action-icon {
    width: 18px;
    height: 18px;

    &.is-bottom {
      transform: rotate(180deg);
    }
  }

  .cccd-input-area {
    bottom: 18px;
    z-index: 201;
    display: flex;
    justify-content: center;
  }
}
</style>
