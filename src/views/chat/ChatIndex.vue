<template>
  <!-- This view renders the chat message area and input composer. -->
  <section class="chat-card-container">
    <!-- Show starter templates before a conversation has been created. -->
    <ChatInsTemplate v-show="isShowTemplate" @on-update="onDrawTemplateIns" />

    <!-- Render the live message list and its floating scroll shortcuts. -->
    <div class="ccdc-messages-container" :class="{ active: !isShowTemplate }">
      <div id="chat-messages-container" ref="innerRef" class="cccd-scroll-window" @scroll="updateScrollActions"></div>
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
      <div class="cccd-input-area">
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
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import { dsLoading } from "@/utils";
import { ChatDrawer, addChat, getAllMessage, getChatSettings, getChatSessionRunner, resetCurrentChatDraft, stopChatSession } from "@/services";
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
const canScrollTop = ref(false);
const canScrollBottom = ref(false);

const drawer = new ChatDrawer();
const curChatId = computed<string>(() => store.state.curChatId || "");
const curConversation = computed(() => (curChatId.value ? store.state.chatConversationsById?.[curChatId.value] || null : null));
const activeMessages = computed<ChatPromptMessage[]>(() => (curChatId.value ? store.state.chatMessagesById?.[curChatId.value] || [] : []));
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const routeChatId = computed(() => (typeof route.params.cid === "string" ? route.params.cid : ""));
const isChatting = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status)));
const isModelSelectionReadonly = computed(() => Boolean(curConversation.value?.modelSnapshot && (curChatId.value || activeMessages.value.length > 0)));
const isShowTemplate = computed(() => !curChatId.value && activeMessages.value.length === 0);

const updateScrollActions = () => {
  const el = innerRef.value;
  if (!el) return;
  canScrollTop.value = el.scrollTop > 4;
  canScrollBottom.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
};

const scrollMessagesToTop = () => {
  innerRef.value?.scrollTo({ top: 0, behavior: "smooth" });
};

const scrollMessagesToBottom = () => {
  const el = innerRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
};

const renderCurrentConversation = async ({ stickToBottom = false, reset = false }: { stickToBottom?: boolean; reset?: boolean } = {}) => {
  drawer.renderConversation(activeMessages.value, { reset });
  drawer.syncDraftAssistant(activeRuntime.value || {});
  await nextTick();
  updateScrollActions();
  if (stickToBottom) scrollMessagesToBottom();
};

watch(
  () => routeChatId.value,
  async (nextRouteChatId) => {
    if (!nextRouteChatId) {
      await resetCurrentChatDraft();
      await renderCurrentConversation({ reset: true });
      return;
    }

    if (nextRouteChatId !== curChatId.value) {
      await store.dispatch("setCurChatId", nextRouteChatId);
    }
  },
  { immediate: true },
);

watch(
  () => curChatId.value,
  async (newVal) => {
    dsLoading(true);

    if (newVal) {
      const isLoaded = Boolean(store.state.chatLoadedById?.[newVal]);
      const hasConversation = Boolean(store.state.chatConversationsById?.[newVal]);
      let hasValidConversation = hasConversation;

      if (!hasConversation) {
        hasValidConversation = await getChatSettings(newVal);
      }

      if (!hasValidConversation) {
        dsLoading(false);
        await router.replace({ name: "chat" });
        return;
      }

      if (!isLoaded) await getAllMessage(newVal);
    }

    await renderCurrentConversation({ reset: true });
    dsLoading(false);
  },
  { immediate: true },
);

watch(
  () => activeMessages.value.map((item) => item.mid || "").join("|"),
  async () => {
    await renderCurrentConversation({ stickToBottom: true });
  },
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

  runner.onDraftUpdate = (content) => {
    if (!innerRef.value) return;
    drawer.updateDraftContent(content, runner.assistantStream.messageId, activeRuntime.value?.status === "error");
  };

  runner.onDraftRemove = () => {
    drawer.removeTempAssistantElem();
  };

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
  drawer.init("chat-messages-container");
  drawer.onAfterRender = updateScrollActions;
  renderCurrentConversation({ reset: true });
  updateScrollActions();
});
</script>

<style lang="scss" scoped>
.chat-card-container {
  --chat-page-max-width: 1080px;
  --chat-side-gap: max(180px, calc((100% - var(--chat-page-max-width)) / 2));
  --chat-top-gap: 28px;
  --chat-bottom-gap: 230px;
  --chat-input-bottom: 18px;
  --chat-input-shell-gap: 18px;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, oklch(var(--in) / 0.12), oklch(var(--b1) / 0) 48%),
    linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.42) 100%);
}

.chat-card-container::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 210px;
  z-index: 4;
  pointer-events: none;
}

.chat-card-container :deep(.chat-template-display-card) {
  inset: 0;
  width: 100%;
  height: 100%;
  padding: var(--chat-top-gap) var(--chat-side-gap) var(--chat-bottom-gap);
  background: transparent;
  box-sizing: border-box;
}

.ccdc-messages-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  opacity: 0;
  pointer-events: none;
  z-index: 1;
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
  padding: var(--chat-top-gap) var(--chat-side-gap) var(--chat-bottom-gap);
  scroll-padding-bottom: calc(var(--chat-bottom-gap) - 24px);
  box-sizing: border-box;

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

.cccd-input-area {
  width: 100%;
  display: flex;
  justify-content: center;
  max-width: calc(var(--chat-page-max-width) + var(--chat-input-shell-gap) * 2);
  pointer-events: auto;

  &::before {
    content: "";
    position: absolute;
    left: -24px;
    right: -24px;
    bottom: -20px;
    height: 268px;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(180deg, oklch(var(--b1) / 0) 0%, oklch(var(--b1) / 0.78) 42%, oklch(var(--b1)) 78%, oklch(var(--b1)) 100%);
    box-shadow: inset 0 -56px 72px oklch(var(--b1) / 0.32);
  }
}

@media (max-width: 1100px) {
  .chat-card-container {
    --chat-side-gap: 20px;
  }
}

@media (max-width: 900px) {
  .chat-card-container {
    --chat-side-gap: 16px;
    --chat-top-gap: 22px;
    --chat-bottom-gap: 236px;
    --chat-input-bottom: 14px;
    --chat-input-shell-gap: 14px;
  }

  .cccd-scroll-window {
    scroll-padding-bottom: calc(var(--chat-bottom-gap) - 20px);
  }

  .chat-card-container :deep(.chat-template-display-card) {
    inset: 0;
  }

  .chat-card-container :deep(.chat-md-bubble-assistant),
  .chat-card-container :deep(.chat-md-bubble-user) {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .chat-card-container {
    --chat-side-gap: 28px;
    --chat-top-gap: 56px;
    --chat-bottom-gap: 224px;
    --chat-input-bottom: max(12px, env(safe-area-inset-bottom));
    --chat-input-shell-gap: 18px;
  }

  .chat-card-container::after {
    height: 240px;
  }

  .cccd-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .chat-card-container :deep(.chat-template-display-card) {
    justify-content: flex-start;
    padding: calc(var(--chat-top-gap) + 8px) var(--chat-side-gap) var(--chat-bottom-gap);
  }
}

@media (max-width: 640px) {
  .chat-card-container {
    --chat-side-gap: 26px;
    --chat-top-gap: 48px;
    --chat-bottom-gap: 232px;
    --chat-input-shell-gap: 18px;
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
