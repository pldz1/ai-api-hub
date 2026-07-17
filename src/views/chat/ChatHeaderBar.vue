<template>
  <div class="chat-header-bar">
    <div class="chb-left">
      <slot name="left" />
    </div>
    <div class="chb-right">
      <div v-if="isShowStatus" class="chb-status">
        <span class="chb-status-time">({{ t("chat.timeCost") + " : " + elapsedSeconds }}s)</span>
        <span class="chb-status-token">
          {{ t("input.tokenUsage", { total: formattedTokens.total, input: formattedTokens.input, output: formattedTokens.output }) }}
        </span>
      </div>
      <button
        class="chb-nav-btn"
        :class="{ 'is-active': panelOpen }"
        :aria-label="panelOpen ? t('chat.closeQuestionList') : t('chat.openQuestionList')"
        @click="panelOpen = !panelOpen"
      >
        <SvgIcon :src="listIcon" />
      </button>
    </div>

    <ChatQuestionPanel
      :open="panelOpen"
      :container-el="containerEl"
      :questions="questionItems"
      :title="t('chat.questionListTitle')"
      :empty-text="t('chat.noQuestions')"
      @close="panelOpen = false"
      @select="onSelectQuestion"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import type { ChatPromptMessage } from "@/types";
import SvgIcon from "@/components/SvgIcon.vue";
import ChatQuestionPanel from "@/views/chat/ChatQuestionPanel.vue";
import type { QuestionItem } from "@/views/chat/ChatQuestionPanel.vue";
import listIcon from "@/assets/svg/sidebar24.svg";

const props = defineProps<{
  scrollContainer: HTMLElement | null;
  containerEl: HTMLElement | null;
}>();

const store = useAppStore();
const { t } = useI18n();

// question list
const questionItems = computed<QuestionItem[]>(() => {
  const messages: ChatPromptMessage[] = store.state.messages || [];
  return messages
    .filter((m) => m.role === "user")
    .map((m) => {
      const text = (m.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join(" ")
        .slice(0, 80);
      return { mid: m.mid || "", text: text || t("chat.emptyQuestion") };
    });
});

// panel
const panelOpen = ref(false);

function onSelectQuestion(mid: string) {
  const container = props.scrollContainer;
  const el = document.getElementById(mid);
  if (!el || !container) return;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offset = elRect.top - containerRect.top + container.scrollTop - 12;
  container.scrollTo({ top: offset, behavior: "smooth" });
}

// timer & token display
const elapsedMs = ref(0);
let timerIntervalId: number | null = null;

const curChatId = computed<string>(() => store.state.curChatId || "");
const activeRuntime = computed(() => (curChatId.value ? store.state.chatRuntimeById?.[curChatId.value] || null : null));
const sessionTokenUsage = computed(() => store.state.sessionTokenUsage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const isChatRunning = computed(() => Boolean(activeRuntime.value?.pending || ["loading", "streaming"].includes(activeRuntime.value?.status || "")));
const isShowStatus = computed(() => isChatRunning.value || Number(sessionTokenUsage.value.total_tokens || 0) > 0);
const elapsedSeconds = computed(() => (elapsedMs.value / 1000).toFixed(1));
const formattedTokens = computed(() => ({
  input: Number(sessionTokenUsage.value.input_tokens || 0).toLocaleString(),
  output: Number(sessionTokenUsage.value.output_tokens || 0).toLocaleString(),
  total: Number(sessionTokenUsage.value.total_tokens || 0).toLocaleString(),
}));

function clearRequestIntervals() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function startRequestTimer() {
  clearRequestIntervals();
  elapsedMs.value = 0;
  const startTime = performance.now();
  timerIntervalId = window.setInterval(() => {
    elapsedMs.value = performance.now() - startTime;
  }, 100);
}

watch(
  () => isChatRunning.value,
  (pending) => {
    if (pending) startRequestTimer();
    else clearRequestIntervals();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearRequestIntervals();
});
</script>

<style lang="scss" scoped>
.chat-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px 0 16px;
  flex-shrink: 0;
}

.chb-left {
  flex: 1;
  min-width: 0;
}

.chb-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.chb-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1;
  color: oklch(var(--bc) / 0.55);
  white-space: nowrap;
}

.chb-status-token {
  color: oklch(var(--bc) / 0.42);
}

.chb-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: oklch(var(--bc) / 0.5);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  font-size: 18px;

  &:hover {
    background: oklch(var(--b2) / 0.8);
    color: oklch(var(--bc) / 0.8);
  }

  &.is-active {
    background: oklch(var(--b2) / 0.8);
    color: oklch(var(--bc) / 0.9);
  }
}

@media (max-width: 640px) {
  .chb-status {
    font-size: 10px;
    gap: 5px;
  }

  .chb-status-time,
  .chb-status-token {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
