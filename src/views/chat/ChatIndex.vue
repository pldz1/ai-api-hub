<template>
  <section class="chat-page">
    <ChatHeaderBar
      :title="conversationTitle"
      :messages="activeMessages"
      :runtime="activeRuntime"
      :scroll-container="scrollRef"
      :token-usage="activeRuntime?.sessionTokenUsage || null"
    />

    <div class="chat-viewport">
      <div ref="scrollRef" class="chat-scroll" @scroll="updateScrollState">
        <div class="workbench-content">
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
      </div>

      <ChatScrollActions v-if="canScrollBottom && !isShowTemplate" :can-scroll-bottom="true" @scroll-bottom="scrollToBottom('smooth')" />
    </div>

    <MessageTopicList
      v-if="!isShowTemplate"
      :topics="tocTopics"
      :active-topic-id="activeTocHeadingId"
      :label="t('chat.messageOutline')"
      @select="scrollToTocHeading"
    />

    <ComposerDock>
      <ChatInputArea
        :is-chatting="isChatting"
        :is-home="isShowTemplate"
        :model-options="chatModelOptions"
        :model-index="selectedModelIndex"
        :model-disabled="isChatting"
        @update:model-index="selectedModelIndex = $event"
        @settings="openChatSettings"
        @on-start="onStartChat"
        @on-stop="onStopChat"
      />
    </ComposerDock>
  </section>

  <ImageModal />
  <ChatFileModal />
  <ChatSettings ref="chatSettingsRef" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import type { ChatModelConfig, ChatPromptMessage } from "@/types";
import { mergeChatSettingsWithModel } from "@/models";
import { dsAlert, dsLoading } from "@/utils";
import {
  addChat,
  editChatUserMessage,
  getAllMessage,
  getChatSessionRunner,
  getChatSettings,
  resetCurrentChatDraft,
  selectChatModel,
  stopChatSession,
  truncateChatFromMessage,
} from "@/services";
import ChatFileModal from "@/views/chat/ChatFileModal.vue";
import ChatHeaderBar from "@/views/chat/ChatHeaderBar.vue";
import ChatInputArea from "@/views/chat/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/ChatInsTemplate.vue";
import ChatMessageList from "@/views/chat/ChatMessageList.vue";
import ChatScrollActions from "@/views/chat/ChatScrollActions.vue";
import ChatSettings from "@/views/chat/ChatSettings.vue";
import ComposerDock from "@/components/ComposerDock.vue";
import ImageModal from "@/components/ImageModal.vue";
import MessageTopicList from "@/components/MessageTopicList.vue";
import { useChatMessageToc } from "@/services/conversation/rendering/use-chat-message-toc";

type ChatStartPayload = { message: ChatPromptMessage; model: ChatModelConfig };

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const scrollRef = ref<HTMLElement | null>(null);
const chatSettingsRef = ref<{ openDialog: () => void } | null>(null);
const canScrollBottom = ref(false);
const { headings: tocHeadings, activeHeadingId: activeTocHeadingId, scrollToHeading: scrollToTocHeading } = useChatMessageToc(scrollRef);
let activeRunnerChatId = "";
let scrollFrame = 0;

const curChatId = computed(() => store.state.curChatId || "");
const routeChatId = computed(() => (typeof route.params.cid === "string" ? route.params.cid : ""));
const activeMessages = computed<ChatPromptMessage[]>(() => (curChatId.value ? store.state.chatMessagesById?.[curChatId.value] || [] : []));
const activeRuntime = computed<Record<string, any> | null>(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const isChatting = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status)));
const isShowTemplate = computed(() => activeMessages.value.length === 0 && !isChatting.value);
const conversationTitle = computed(() => store.state.chatList.find((item) => item.cid === curChatId.value)?.cname || t("chat.newChatConversation"));
const tocTopics = computed(() => tocHeadings.value.map((heading) => ({ id: heading.id, title: heading.text, level: heading.level })));
const chatModels = computed<ChatModelConfig[]>(() => store.state.models.chat || []);
const chatModelOptions = computed(() => chatModels.value.map((model, index) => ({ label: model.name, value: index })));
const getModelIdentityKey = (model: ChatModelConfig | null) => [model?.provider, model?.name, model?.model, model?.baseURL].join("|");
const selectedModel = computed<ChatModelConfig | null>({
  get: () => store.state.curChatModel || null,
  set: (model) => {
    const previousModel = store.state.curChatModel || null;
    store.commit("setCurChatModel", model);
    if (model && getModelIdentityKey(previousModel) !== getModelIdentityKey(model)) {
      store.commit("setCurChatModelSettings", mergeChatSettingsWithModel(model, store.state.curChatModelSettings));
      store.commit("resetInputCapabilities");
    }
  },
});
const selectedModelIndex = computed<number | null>({
  get: () => {
    if (!selectedModel.value) return null;
    const selectedKey = getModelIdentityKey(selectedModel.value);
    const index = chatModels.value.findIndex((model) => getModelIdentityKey(model) === selectedKey);
    return index >= 0 ? index : null;
  },
  set: (index) => {
    selectedModel.value = typeof index === "number" ? chatModels.value[index] || null : null;
  },
});

watch(
  chatModels,
  (models) => {
    if (!models.length) {
      selectedModel.value = null;
      return;
    }
    if (!selectedModel.value) {
      selectedModel.value = models[0];
      return;
    }
    const selectedKey = getModelIdentityKey(selectedModel.value);
    const matchedModel = models.find((model) => getModelIdentityKey(model) === selectedKey);
    if (matchedModel && matchedModel !== selectedModel.value) selectedModel.value = matchedModel;
  },
  { deep: true, immediate: true },
);

function openChatSettings() {
  if (!selectedModel.value) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  chatSettingsRef.value?.openDialog();
}

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
  if (!(await selectChatModel(chatId, model))) return;
  const runner = bindRunner(chatId);
  if (!runner) return;
  followOutput(true);
  try {
    await runner.chat(message, model);
  } catch (error) {
    dsAlert({ type: "error", message: t("toast.modelRequestFailed", { error: error instanceof Error ? error.message : String(error) }) });
  }
}

async function regenerateCurrentConversation() {
  if (isChatting.value || !curChatId.value) return;
  const chatId = curChatId.value;
  const model = store.state.curChatModel as ChatModelConfig | null;
  if (!model) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  if (!(await selectChatModel(chatId, model))) return;
  const runner = bindRunner(chatId);
  if (!runner) return;
  followOutput(true);
  try {
    await runner.regenerate(model);
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
  --workspace-top-gap: 28px;
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, oklch(var(--in) / 0.1), transparent 48%), linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.32) 100%);
}

.chat-viewport {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
}
.chat-scroll {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--workspace-top-gap) 0 20px;
  box-sizing: border-box;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.24) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: oklch(var(--bc) / 0.2);
  }
}
.chat-empty-state {
  min-height: 100%;
  display: grid;
  place-items: center;
}
.chat-page :deep(.chat-md-bubble-user),
.chat-page :deep(.chat-md-bubble-assistant) {
  max-width: 100%;
}

@media (max-width: 640px) {
  .chat-page {
    --workspace-top-gap: 16px;
  }

  .chat-scroll {
    padding-right: 12px;
    padding-left: 12px;
    padding-bottom: 12px;
    scrollbar-gutter: auto;
  }
}
</style>
