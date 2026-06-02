<template>
  <!-- This view renders the chat message area and input composer. -->
  <section ref="containerRef" class="chat-card-container">
    <!-- Header bar with session status, question-list toggle and panel. -->
    <ChatHeaderBar :scroll-container="innerRef" :container-el="containerRef" />

    <!-- Show starter templates as an empty-state layer above the message surface. -->
    <div v-show="isShowTemplate" class="ccdc-template-layer">
      <ChatInsTemplate @on-update="onDrawTemplateIns" />
    </div>

    <!-- Render the live message list and its floating scroll shortcuts. -->
    <div class="ccdc-messages-container" :class="{ active: !isShowTemplate }">
      <div ref="innerRef" class="cccd-scroll-window" @scroll="updateScrollActions"></div>
      <ChatScrollActions
        v-show="!isShowTemplate"
        :can-scroll-top="canScrollTop"
        :can-scroll-bottom="canScrollBottom"
        @scroll-top="scrollMessagesToTop"
        @scroll-bottom="scrollMessagesToBottom"
      />
    </div>

    <!-- Keep the chat composer fixed at the bottom of the view. -->
    <div class="cccd-bottom">
      <div ref="inputAreaRef" class="cccd-input-area">
        <ChatInputArea
          :is-chatting="isChatting"
          :model-selection-readonly="isModelSelectionReadonly"
          :is-home="isShowTemplate"
          @on-start="onStartChat"
          @on-stop="onStopChat"
        />
      </div>
    </div>
  </section>
  <!-- Click image to view -->
  <ImageModal />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import { dsLoading } from "@/utils";
import { createChatDrawer, addChat, getAllMessage, getChatSettings, getChatSessionRunner, resetCurrentChatDraft, stopChatSession } from "@/services";
import ChatHeaderBar from "@/views/chat/ChatHeaderBar.vue";
import ChatInputArea from "@/views/chat/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/ChatInsTemplate.vue";
import ChatScrollActions from "@/views/chat/ChatScrollActions.vue";
import ImageModal from "@/views/chat/ImageModal.vue";

type ChatStartPayload = {
  message: ChatPromptMessage;
  model: ChatModelConfig | null;
};

const store = useStore();
const route = useRoute();
const router = useRouter();
const innerRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const inputAreaRef = ref<HTMLElement | null>(null);
const canScrollTop = ref(false);
const canScrollBottom = ref(false);
let scrollActionsFrame = 0;
let composerResizeObserver: ResizeObserver | null = null;

const drawer = createChatDrawer();
let activeRunnerChatId: string | null = null;
let autoScrolledDraftMessageId = "";
const curChatId = computed<string>(() => store.state.curChatId || "");
const curConversation = computed(() => (curChatId.value ? store.state.chatConversationsById?.[curChatId.value] || null : null));
const activeMessages = computed<ChatPromptMessage[]>(() => (curChatId.value ? store.state.chatMessagesById?.[curChatId.value] || [] : []));
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const routeChatId = computed(() => (typeof route.params.cid === "string" ? route.params.cid : ""));
const isChatting = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status)));
const isModelSelectionReadonly = computed(() => Boolean(curConversation.value?.modelSnapshot && (curChatId.value || activeMessages.value.length > 0)));
const isShowTemplate = computed(() => !routeChatId.value && activeMessages.value.length === 0);

const readScrollActions = () => {
  const el = innerRef.value;
  if (!el) return;
  canScrollTop.value = el.scrollTop > 4;
  canScrollBottom.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
};

const updateScrollActions = () => {
  if (scrollActionsFrame) return;
  scrollActionsFrame = requestAnimationFrame(() => {
    scrollActionsFrame = 0;
    readScrollActions();
  });
};

const scrollMessagesToTop = () => {
  innerRef.value?.scrollTo({ top: 0, behavior: "smooth" });
};

const scrollMessagesToBottom = (behavior: ScrollBehavior = "smooth") => {
  const el = innerRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
};

const scrollOnceForDraft = (created: boolean, messageId: string) => {
  if (!created || !messageId || autoScrolledDraftMessageId === messageId) return;
  autoScrolledDraftMessageId = messageId;
  nextTick(() => scrollMessagesToBottom("auto"));
};

const updateComposerHeight = () => {
  const container = containerRef.value;
  const composer = inputAreaRef.value;
  if (!container || !composer) return;
  const height = Math.ceil(composer.getBoundingClientRect().height);
  if (height > 0) container.style.setProperty("--chat-composer-height", `${height}px`);
};

const renderCurrentConversation = async ({ stickToBottom = false, reset = false }: { stickToBottom?: boolean; reset?: boolean } = {}) => {
  drawer.renderConversation(activeMessages.value, { reset });
  drawer.syncDraftAssistant(activeRuntime.value);
  await nextTick();
  updateScrollActions();
  if (stickToBottom) scrollMessagesToBottom("auto");
};

const syncConversationFromRoute = async (nextRouteChatId: string) => {
  dsLoading(true);

  if (!nextRouteChatId) {
    await resetCurrentChatDraft();
    await renderCurrentConversation({ reset: true });
    dsLoading(false);
    return;
  }

  if (nextRouteChatId !== curChatId.value) {
    // Clear old runner callbacks so background streams don't leak into the new session
    if (activeRunnerChatId) {
      const prevRunner = getChatSessionRunner(activeRunnerChatId);
      if (prevRunner) {
        prevRunner.onDraftUpdate = null;
        prevRunner.onDraftRemove = null;
        prevRunner.onMessagePersisted = null;
        prevRunner.onRuntimeUpdate = null;
      }
      activeRunnerChatId = null;
    }
    await store.dispatch("setCurChatId", nextRouteChatId);
  }

  const isLoaded = Boolean(store.state.chatLoadedById?.[nextRouteChatId]);
  const hasConversation = Boolean(store.state.chatConversationsById?.[nextRouteChatId]);
  let hasValidConversation = hasConversation;

  if (!hasConversation) {
    hasValidConversation = await getChatSettings(nextRouteChatId);
  }

  if (!hasValidConversation) {
    dsLoading(false);
    await router.replace({ name: "chat" });
    return;
  }

  if (!isLoaded) await getAllMessage(nextRouteChatId);

  await renderCurrentConversation({ reset: true });
  dsLoading(false);
};

watch(
  () => routeChatId.value,
  async (nextRouteChatId) => {
    await syncConversationFromRoute(nextRouteChatId);
  },
  { immediate: true },
);

const onStartChat = async (payload: ChatStartPayload) => {
  const { message, model: selectedModel } = payload;

  if (!curChatId.value) {
    const created = await addChat(null, selectedModel);
    if (!created || !store.state.curChatId) return;
    await router.replace({ name: "chat", params: { cid: store.state.curChatId } });
  }

  const nextChatId = store.state.curChatId;
  const runner = getChatSessionRunner(nextChatId);
  if (!runner) return;

  const isActiveRunner = () => runner.chatId === curChatId.value;

  runner.onRuntimeUpdate = (runtime) => {
    if (!isActiveRunner()) return;
    const messageId = String(runtime?.draftMessageId || "");
    const createdDraft = drawer.syncDraftAssistant(runtime);
    scrollOnceForDraft(createdDraft, messageId);
    nextTick(updateScrollActions);
  };

  runner.onDraftUpdate = (content) => {
    if (!isActiveRunner()) return;
    const messageId = runner.getStream().getMessageId();
    const createdDraft = drawer.updateDraftContent(content, messageId, activeRuntime.value?.status === "error");
    scrollOnceForDraft(createdDraft, messageId);
  };

  runner.onDraftRemove = () => {
    if (!isActiveRunner()) return;
    drawer.removeTempAssistantElem();
  };

  runner.onMessagePersisted = async () => {
    if (!isActiveRunner()) return;
    await renderCurrentConversation();
  };

  activeRunnerChatId = nextChatId;
  await runner.chat(message);
};

const onStopChat = async () => {
  if (!curChatId.value) return;
  stopChatSession(curChatId.value);
};

const onDrawTemplateIns = (messages: ChatPromptMessage[]) => {
  drawer.renderConversation(messages, { reset: true });
};

onMounted(() => {
  drawer.init(innerRef.value);
  drawer.onAfterRender = updateScrollActions;
  drawer.onMessageDeleted = async () => {
    await renderCurrentConversation();
  };
  renderCurrentConversation({ reset: true });
  updateScrollActions();
  nextTick(updateComposerHeight);
  if (window.ResizeObserver && inputAreaRef.value) {
    composerResizeObserver = new ResizeObserver(updateComposerHeight);
    composerResizeObserver.observe(inputAreaRef.value);
  }
});

onBeforeUnmount(() => {
  composerResizeObserver?.disconnect();
  composerResizeObserver = null;
  if (scrollActionsFrame) {
    cancelAnimationFrame(scrollActionsFrame);
    scrollActionsFrame = 0;
  }
  drawer.onMessageDeleted = null;
  if (activeRunnerChatId) {
    const runner = getChatSessionRunner(activeRunnerChatId);
    if (runner) {
      runner.onDraftUpdate = null;
      runner.onDraftRemove = null;
      runner.onMessagePersisted = null;
      runner.onRuntimeUpdate = null;
    }
    activeRunnerChatId = null;
  }
});
</script>

<style lang="scss" scoped>
.chat-card-container {
  --chat-page-max-width: 1080px;
  --chat-side-gap: max(180px, calc((100% - var(--chat-page-max-width)) / 2));
  --chat-top-gap: 16px;
  --chat-composer-height: 126px;
  --chat-scroll-tail-gap: 32px;
  --chat-bottom-gap: calc(var(--chat-composer-height) + var(--chat-input-bottom) + var(--chat-scroll-tail-gap));
  --chat-input-bottom: 18px;
  --chat-input-shell-gap: 18px;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at 50% 0%, oklch(var(--in) / 0.12), oklch(var(--b1) / 0) 48%),
    linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.42) 100%);
}

.ccdc-messages-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  opacity: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.ccdc-template-layer {
  position: absolute;
  inset: 44px 0 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--chat-top-gap) var(--chat-side-gap) var(--chat-bottom-gap);
  box-sizing: border-box;
  pointer-events: none;
}

.ccdc-template-layer > * {
  pointer-events: auto;
}

.ccdc-messages-container.active {
  opacity: 1;
  pointer-events: auto;
}

.cccd-scroll-window {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-gutter: stable;
  padding: var(--chat-top-gap) var(--chat-side-gap) var(--chat-bottom-gap);
  scroll-padding-bottom: calc(var(--chat-bottom-gap) - 24px);
  box-sizing: border-box;
  contain: layout paint style;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: oklch(var(--bc) / 0.12);
  }
}

.cccd-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--chat-input-bottom);
  z-index: 6;
  display: flex;
  justify-content: center;
  padding: 0 var(--chat-input-shell-gap);
  pointer-events: none;
}

.cccd-bottom::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--chat-input-bottom) * -1);
  height: clamp(170px, 30vh, 252px);
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(180deg, oklch(var(--b1) / 0) 0%, oklch(var(--b1) / 0.76) 46%, oklch(var(--b1)) 82%, oklch(var(--b1)) 100%);
}

.cccd-input-area {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  max-width: calc(var(--chat-page-max-width) + var(--chat-input-shell-gap) * 2);
  pointer-events: auto;
  contain: layout paint;
}

.chat-card-container :deep(.chat-md-bubble-assistant),
.chat-card-container :deep(.chat-md-bubble-user) {
  contain: layout style;
}

@media (max-width: 1100px) {
  .chat-card-container {
    --chat-side-gap: 20px;
  }
}

@media (max-width: 900px) {
  .chat-card-container {
    --chat-side-gap: 16px;
    --chat-top-gap: 14px;
    --chat-input-bottom: 14px;
    --chat-input-shell-gap: 14px;
    --chat-scroll-tail-gap: 30px;
  }

  .cccd-scroll-window {
    scroll-padding-bottom: calc(var(--chat-bottom-gap) - 20px);
  }

  .chat-card-container :deep(.chat-md-bubble-assistant),
  .chat-card-container :deep(.chat-md-bubble-user) {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .chat-card-container {
    --chat-side-gap: 28px;
    --chat-top-gap: 12px;
    --chat-input-bottom: max(12px, env(safe-area-inset-bottom));
    --chat-input-shell-gap: 18px;
    --chat-scroll-tail-gap: 28px;
  }

  .cccd-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .ccdc-template-layer {
    align-items: center;
    padding-top: calc(var(--chat-top-gap) + 6px);
  }
}

@media (max-width: 640px) {
  .chat-card-container {
    --chat-side-gap: 26px;
    --chat-top-gap: 10px;
    --chat-input-shell-gap: 18px;
    --chat-scroll-tail-gap: 26px;
  }

  .ccdc-messages-container {
    transition: opacity 0.18s ease;
  }

  .chat-card-container :deep(.chat-md-bubble-assistant),
  .chat-card-container :deep(.chat-md-bubble-user) {
    border-radius: 18px;
  }

  .chat-card-container :deep(pre),
  .chat-card-container :deep(code) {
    max-width: 100%;
  }
}
</style>
