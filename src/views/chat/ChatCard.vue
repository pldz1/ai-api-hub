<template>
  <section class="chat-card-container">
    <ChatInsTemplate v-show="isShowTemplate" @on-update="onDrawTemplateIns" />

    <div class="ccdc-messages-container" :class="{ active: !isShowTemplate }">
      <div id="chat-messages-container" class="cccd-scroll-window" ref="innerRef" @scroll="updateScrollActions"></div>
      <div class="cccd-scroll-actions" v-show="!isShowTemplate">
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

    <div class="cccd-bottom">
      <div class="cccd-input-area">
        <ChatInputArea
          :is-chatting="isChatting"
          :model-selection-readonly="isModelSelectionReadonly"
          :is-home="isShowTemplate"
          @on-start="onStartChat"
          @on-stop="onStopChat"
        ></ChatInputArea>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useStore } from "vuex";
import { dsLoading } from "@/utils";
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { ChatDrawer, addChat, getAllMessage, getChatSettings, getChatSessionRunner, stopChatSession } from "@/services";

import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import ChatInputArea from "@/views/chat/ChatInputArea.vue";
import ChatInsTemplate from "@/views/chat/ChatInsTemplate.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";

const store = useStore();
const innerRef = ref(null);
const canScrollTop = ref(false);
const canScrollBottom = ref(false);

const drawer = new ChatDrawer(true);
const curChatId = computed(() => store.state.curChatId);
const curConversation = computed(() => (curChatId.value ? store.state.chatConversationsById?.[curChatId.value] || null : null));
const activeMessages = computed(() => (curChatId.value ? store.state.chatMessagesById?.[curChatId.value] || [] : []));
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const isChatting = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status)));
const isModelSelectionReadonly = computed(() => Boolean(curConversation.value?.modelSnapshot && (curChatId.value || activeMessages.value.length > 0)));
const isShowTemplate = computed(() => {
  const a = !curChatId.value && activeMessages.value.length === 0;
  console.error(a);
  return a;
});

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

const renderCurrentConversation = async ({ stickToBottom = false } = {}) => {
  drawer.renderConversation(activeMessages.value);
  drawer.syncDraftAssistant(activeRuntime.value || {});
  await nextTick();
  updateScrollActions();
  if (stickToBottom) scrollMessagesToBottom();
};

watch(
  () => curChatId.value,
  async (newVal) => {
    dsLoading(true);

    if (newVal) {
      const isLoaded = Boolean(store.state.chatLoadedById?.[newVal]);
      const hasConversation = Boolean(store.state.chatConversationsById?.[newVal]);

      if (!hasConversation) await getChatSettings(newVal);
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

const onStartChat = async (payload) => {
  const message = payload?.message || payload;
  const selectedModel = payload?.model || null;

  if (!curChatId.value) {
    await addChat(null, selectedModel);
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

const onDrawTemplateIns = (messages) => {
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
  transition: opacity 0.18s ease;
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

.cccd-scroll-actions {
  position: absolute;
  right: 20px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cccd-scroll-action {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(27, 39, 51, 0.12);
  color: rgba(17, 24, 39, 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cccd-scroll-action.disabled {
  opacity: 0.35;
  pointer-events: none;
}

.cccd-scroll-action-icon {
  width: 18px;
  height: 18px;
}

.cccd-scroll-action-icon.is-bottom {
  transform: rotate(180deg);
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

.cccd-footer-note {
  margin: 12px 0 0;
  text-align: center;
  color: #4b5563;
  font-size: 15px;
}

@media (max-width: 900px) {
  .chat-card-container {
    padding-inline: 14px;
  }

  .cccd-scroll-window {
    padding-inline: 18px;
  }

  .cccd-footer-note {
    font-size: 13px;
  }
}
</style>
