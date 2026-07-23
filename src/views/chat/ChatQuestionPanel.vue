<template>
  <Teleport to="body">
    <Transition name="question-panel">
      <div v-if="open" class="question-panel" role="dialog" :aria-label="title">
      <div class="question-panel-header">
        <strong>{{ title }}</strong>
        <button type="button" :aria-label="t('common.close')" @click="emit('close')">&times;</button>
      </div>
      <div class="question-panel-body">
        <p v-if="questions.length === 0" class="question-panel-empty">{{ emptyText }}</p>
        <button v-for="(question, index) in questions" :key="question.mid" class="question-item" type="button" @click="select(question.mid)">
          <span>{{ index + 1 }}</span>
          <p>{{ question.text }}</p>
        </button>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

export interface ChatQuestionItem { mid: string; text: string }

const props = defineProps<{ open: boolean; questions: ChatQuestionItem[]; title: string; emptyText: string }>();
const emit = defineEmits<{ close: []; select: [mid: string] }>();
const { t } = useI18n();

function select(mid: string) { emit("select", mid); emit("close"); }
function onKeydown(event: KeyboardEvent) { if (event.key === "Escape" && props.open) emit("close"); }
onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<style scoped lang="scss">
.question-panel {
  position: fixed;
  top: 54px;
  right: 12px;
  z-index: 80;
  width: min(360px, calc(100vw - 32px));
  max-height: min(65vh, 600px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 12px;
  background: oklch(var(--b1) / 0.98);
  box-shadow: 0 18px 46px oklch(var(--bc) / 0.16);
  backdrop-filter: blur(14px);
}
.question-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; color: oklch(var(--bc) / 0.66); font-size: 12px; }
.question-panel-header button { width: 26px; height: 26px; border: 0; border-radius: 7px; background: transparent; color: inherit; font-size: 18px; cursor: pointer; }
.question-panel-header button:hover { background: oklch(var(--bc) / 0.06); }
.question-panel-body { min-height: 0; overflow-y: auto; padding: 4px 8px 10px; }
.question-panel-empty { margin: 0; padding: 24px 8px; text-align: center; color: oklch(var(--bc) / 0.45); font-size: 13px; }
.question-item { width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 0; border-radius: 10px; background: transparent; color: oklch(var(--bc)); text-align: left; cursor: pointer; }
.question-item:hover { background: oklch(var(--bc) / 0.055); }
.question-item > span { flex: 0 0 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: oklch(var(--bc) / 0.06); color: oklch(var(--bc) / 0.52); font-size: 11px; font-weight: 700; }
.question-item p { min-width: 0; margin: 1px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 1.45; }
.question-panel-enter-active, .question-panel-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; transform-origin: top right; }
.question-panel-enter-from, .question-panel-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }

@media (max-width: 640px) {
  .question-panel { position: fixed; top: auto; right: 8px; bottom: 8px; left: 8px; width: auto; max-height: 58vh; }
}
</style>
