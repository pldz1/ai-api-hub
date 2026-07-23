<template>
  <WorkbenchHeaderBar
    :title="title"
    :count="questionItems.length"
    :token-usage="tokenUsage"
    :running="Boolean(runtime?.pending)"
  >
    <template #actions>
      <button
        class="chat-history-button"
        :class="{ active: panelOpen }"
        type="button"
        :aria-label="t('chat.questionListTitle')"
        :aria-expanded="panelOpen"
        @click="panelOpen = !panelOpen"
      >
        <SvgIcon :src="listIcon" />
      </button>
    </template>
  </WorkbenchHeaderBar>

  <ChatQuestionPanel
    :open="panelOpen"
    :questions="questionItems"
    :title="t('chat.questionListTitle')"
    :empty-text="t('chat.noQuestions')"
    @close="panelOpen = false"
    @select="selectQuestion"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChatPromptMessage, TokenUsage } from "@/types";
import SvgIcon from "@/components/SvgIcon.vue";
import WorkbenchHeaderBar from "@/components/WorkbenchHeaderBar.vue";
import listIcon from "@/assets/svg/sidebar24.svg";
import ChatQuestionPanel, { type ChatQuestionItem } from "@/views/chat/ChatQuestionPanel.vue";

const props = defineProps<{
  title: string;
  messages: ChatPromptMessage[];
  runtime?: Record<string, any> | null;
  scrollContainer: HTMLElement | null;
  tokenUsage?: TokenUsage | null;
}>();

const { t } = useI18n();
const panelOpen = ref(false);
const questionItems = computed<ChatQuestionItem[]>(() => props.messages
  .filter((message) => message.role === "user")
  .map((message) => ({
    mid: message.mid || "",
    text: message.content.filter((part) => part.type === "text").map((part) => part.text || "").join(" ").trim() || t("chat.emptyQuestion"),
  }))
  .filter((item) => item.mid));

function selectQuestion(mid: string) {
  const container = props.scrollContainer;
  const message = container?.querySelector(`#${CSS.escape(mid)}`) as HTMLElement | null;
  if (!container || !message) return;
  const top = message.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12;
  container.scrollTo({ top, behavior: "smooth" });
}

watch(() => props.messages, () => { if (!questionItems.value.length) panelOpen.value = false; });
</script>

<style scoped lang="scss">
.chat-history-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: oklch(var(--bc) / 0.55);
  cursor: pointer;

  &:hover, &.active { background: oklch(var(--bc) / 0.06); color: oklch(var(--bc)); }
  :deep(.svg-icon) { width: 18px; height: 18px; }
}
</style>
