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
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import type { ChatModelConfig } from "@/types/chat";
import { dsLoading } from "@/utils";
import { ChatDrawer, addChat, getAllMessage, getChatSettings, getChatSessionRunner, resetCurrentChatDraft, stopChatSession } from "@/services";
import type { ChatPromptMessage } from "@/services/types";
import ChatInputArea from "@/views/chat/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/ChatInsTemplate.vue";
import ChatScrollActions from "@/views/chat/ChatScrollActions.vue";

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

const drawer = new ChatDrawer(true);
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

const renderCurrentConversation = async ({ stickToBottom = false }: { stickToBottom?: boolean } = {}) => {
  drawer.renderConversation(activeMessages.value);
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
      await renderCurrentConversation();
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

    await renderCurrentConversation();
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

watch(
  () => [
    activeRuntime.value?.draftMessageId || "",
    activeRuntime.value?.draftAssistantContent || "",
    activeRuntime.value?.draftReasoningContent || "",
    activeRuntime.value?.pending || false,
    activeRuntime.value?.status || "",
  ],
  async () => {
    drawer.syncDraftAssistant(activeRuntime.value || {});
    await nextTick();
    updateScrollActions();
    if (isChatting.value) scrollMessagesToBottom();
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
  await runner.chat(message);
};

const onStopChat = async () => {
  if (!curChatId.value) return;
  stopChatSession(curChatId.value);
};

const onDrawTemplateIns = (messages: ChatPromptMessage[]) => {
  drawer.renderConversation(messages);
};

onMounted(() => {
  drawer.init("chat-messages-container");
  renderCurrentConversation();
  updateScrollActions();
});
</script>

<style lang="scss" scoped>
.chat-card-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 22px 18px;
  overflow: hidden;
}

.ccdc-messages-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  opacity: 0;
  pointer-events: none;
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
  padding: 8px max(56px, calc((100% - 840px) / 2)) 18px;
}

.cccd-bottom {
  position: relative;
  z-index: 2;
  padding-top: 10px;
}

.cccd-input-area {
  display: flex;
  justify-content: center;
}

@media (max-width: 900px) {
  .chat-card-container {
    padding-inline: 14px;
  }

  .cccd-scroll-window {
    padding-inline: 18px;
  }
}
</style>
