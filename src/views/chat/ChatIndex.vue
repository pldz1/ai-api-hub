<template>
  <section class="chat-page">
    <div class="chat-viewport">
      <div ref="scrollRef" class="chat-scroll" @scroll="updateScrollState">
        <div v-if="isShowTemplate" class="chat-empty-state">
          <ChatInsTemplate />
        </div>
        <ChatMessageList
          v-else
          :messages="activeMessages"
          :runtime="activeRuntime"
          @edit="onEditMessage"
          @regenerate="onRegenerateAnswer"
          @retry="regenerateCurrentConversation"
          @delete-from="onDeleteFromMessage"
        />
      </div>

      <ChatScrollActions v-if="canScrollBottom && !isShowTemplate" :can-scroll-bottom="true" @scroll-bottom="scrollToBottom('smooth')" />
    </div>

    <footer class="chat-composer-dock">
      <ChatInputArea
        :is-chatting="isChatting"
        :model-selection-readonly="isModelSelectionReadonly"
        :is-home="isShowTemplate"
        @on-start="onStartChat"
        @on-stop="onStopChat"
      />
    </footer>
  </section>

  <ImageModal />
  <ChatFileModal />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import { dsAlert, dsLoading } from "@/utils";
import {
  addChat,
  editChatUserMessage,
  getAllMessage,
  getChatSessionRunner,
  getChatSettings,
  resetCurrentChatDraft,
  stopChatSession,
  truncateChatFromMessage,
} from "@/services";
import ChatFileModal from "@/views/chat/ChatFileModal.vue";
import ChatInputArea from "@/views/chat/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/ChatInsTemplate.vue";
import ChatMessageList from "@/views/chat/ChatMessageList.vue";
import ChatScrollActions from "@/views/chat/ChatScrollActions.vue";
import ImageModal from "@/components/ImageModal.vue";

type ChatStartPayload = { message: ChatPromptMessage; model: ChatModelConfig | null };

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const scrollRef = ref<HTMLElement | null>(null);
const canScrollBottom = ref(false);
let activeRunnerChatId = "";
let scrollFrame = 0;

const curChatId = computed(() => store.state.curChatId || "");
const routeChatId = computed(() => (typeof route.params.cid === "string" ? route.params.cid : ""));
const activeMessages = computed<ChatPromptMessage[]>(() => (curChatId.value ? store.state.chatMessagesById?.[curChatId.value] || [] : []));
const activeRuntime = computed<Record<string, any> | null>(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const isChatting = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status)));
const isModelSelectionReadonly = computed(() => Boolean(curChatId.value));
const isShowTemplate = computed(() => activeMessages.value.length === 0 && !isChatting.value);

function isNearBottom(threshold = 96) {
  const element = scrollRef.value;
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function readScrollState() {
  const element = scrollRef.value;
  if (!element) return;
  canScrollBottom.value = element.scrollTop + element.clientHeight < element.scrollHeight - 8;
}

function updateScrollState() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    readScrollState();
  });
}

function scrollToBottom(behavior: ScrollBehavior = "auto") {
  nextTick(() => {
    const element = scrollRef.value;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    readScrollState();
  });
}

function followOutput(force = false) {
  const shouldFollow = force || isNearBottom();
  if (shouldFollow) scrollToBottom("auto");
  else nextTick(readScrollState);
}

function detachRunner() {
  if (!activeRunnerChatId) return;
  const runner = getChatSessionRunner(activeRunnerChatId);
  if (runner) {
    runner.onDraftUpdate = null;
    runner.onDraftRemove = null;
    runner.onMessagePersisted = null;
    runner.onRuntimeUpdate = null;
  }
  activeRunnerChatId = "";
}

function bindRunner(chatId: string) {
  if (activeRunnerChatId && activeRunnerChatId !== chatId) detachRunner();
  const runner = getChatSessionRunner(chatId);
  if (!runner) return null;

  runner.onRuntimeUpdate = () => {
    if (curChatId.value === chatId) followOutput();
  };
  runner.onDraftUpdate = () => {
    if (curChatId.value === chatId) followOutput();
  };
  runner.onDraftRemove = () => {
    if (curChatId.value === chatId) followOutput();
  };
  runner.onMessagePersisted = async () => {
    if (curChatId.value === chatId) followOutput();
  };
  activeRunnerChatId = chatId;
  return runner;
}

async function syncConversationFromRoute(chatId: string) {
  dsLoading(true);
  try {
    if (!chatId) {
      detachRunner();
      await resetCurrentChatDraft();
      await nextTick();
      readScrollState();
      return;
    }

    if (chatId !== curChatId.value) {
      detachRunner();
      store.commit("setCurChatId", chatId);
    }

    let validConversation = Boolean(store.state.chatConversationsById?.[chatId]);
    if (!validConversation) validConversation = await getChatSettings(chatId);
    if (!validConversation) {
      await router.replace({ name: "chat" });
      return;
    }

    if (!store.state.chatLoadedById?.[chatId]) await getAllMessage(chatId);
    await nextTick();
    scrollToBottom("auto");
  } finally {
    dsLoading(false);
  }
}

watch(routeChatId, syncConversationFromRoute, { immediate: true });

async function onStartChat({ message, model }: ChatStartPayload) {
  if (!curChatId.value) {
    const text = message.content.find((part) => part.type === "text")?.text || "";
    const created = await addChat(text.slice(0, 35), model);
    if (!created || !store.state.curChatId) return;
    await router.replace({ name: "chat", params: { cid: store.state.curChatId } });
  }

  const chatId = store.state.curChatId;
  const runner = bindRunner(chatId);
  if (!runner) return;
  followOutput(true);
  try {
    await runner.chat(message);
  } catch (error) {
    dsAlert({ type: "error", message: t("toast.modelRequestFailed", { error: error instanceof Error ? error.message : String(error) }) });
  }
}

async function regenerateCurrentConversation() {
  if (isChatting.value || !curChatId.value) return;
  const chatId = curChatId.value;
  const runner = bindRunner(chatId);
  if (!runner) return;
  followOutput(true);
  try {
    await runner.regenerate();
  } catch (error) {
    dsAlert({ type: "error", message: t("toast.modelRequestFailed", { error: error instanceof Error ? error.message : String(error) }) });
  }
}

async function onEditMessage({ mid, text }: { mid: string; text: string }) {
  if (isChatting.value || !curChatId.value) return;
  const edited = await editChatUserMessage(curChatId.value, mid, text);
  if (edited) await regenerateCurrentConversation();
}

async function onRegenerateAnswer(mid: string) {
  if (isChatting.value || !curChatId.value) return;
  if (await truncateChatFromMessage(curChatId.value, mid)) await regenerateCurrentConversation();
}

async function onDeleteFromMessage(mid: string) {
  if (isChatting.value || !curChatId.value) return;
  await truncateChatFromMessage(curChatId.value, mid);
  await nextTick();
  readScrollState();
}

function onStopChat() {
  if (curChatId.value) stopChatSession(curChatId.value);
}

onBeforeUnmount(() => {
  detachRunner();
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
});
</script>

<style scoped lang="scss">
.chat-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, oklch(var(--in) / 0.1), transparent 48%),
    linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.32) 100%);
}

.chat-viewport { position: relative; min-height: 0; flex: 1 1 auto; }
.chat-scroll {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 24px max(24px, calc((100% - 960px) / 2)) 18px;
  box-sizing: border-box;
  scrollbar-gutter: stable;
}
.chat-empty-state { min-height: 100%; display: grid; place-items: center; }
.chat-composer-dock {
  flex: 0 0 auto;
  padding: 10px max(18px, calc((100% - 1020px) / 2)) max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid oklch(var(--bc) / 0.06);
  background: oklch(var(--b1) / 0.94);
  backdrop-filter: blur(14px);
}

.chat-page :deep(.chat-md-bubble-user),
.chat-page :deep(.chat-md-bubble-assistant) { max-width: 100%; }

@media (max-width: 768px) {
  .chat-scroll { padding: 18px 18px 12px; scrollbar-gutter: auto; }
  .chat-composer-dock { padding: 8px 12px max(10px, env(safe-area-inset-bottom)); }
}

@media (max-width: 380px) {
  .chat-scroll { padding-inline: 12px; }
  .chat-composer-dock { padding-inline: 8px; }
}
</style>
