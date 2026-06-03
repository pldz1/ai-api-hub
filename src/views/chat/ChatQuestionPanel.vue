<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="open" class="cqp-backdrop" @click="$emit('close')">
        <div ref="panelRef" class="cqp-panel" :style="panelStyle" @click.stop>
          <div class="cqp-panel-header">
            <span class="cqp-panel-title">{{ title }}</span>
            <button class="cqp-panel-close" @click="$emit('close')">&times;</button>
          </div>
          <div class="cqp-panel-body">
            <div v-if="questions.length === 0" class="cqp-empty">
              {{ emptyText }}
            </div>
            <button v-for="(q, i) in questions" :key="q.mid" class="cqp-question-item" @click="onSelect(q.mid)">
              <span class="cqp-question-index">{{ i + 1 }}</span>
              <span class="cqp-question-text">{{ q.text }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface QuestionItem {
  mid: string;
  text: string;
}

const props = defineProps<{
  open: boolean;
  containerEl: HTMLElement | null;
  questions: QuestionItem[];
  title?: string;
  emptyText?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", mid: string): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const panelTop = ref(0);
const panelRight = ref(0);

const panelStyle = computed(() => ({
  top: `${panelTop.value}px`,
  right: `${panelRight.value}px`,
}));

function findHeaderEl(): HTMLElement | null {
  return props.containerEl?.querySelector(".chat-header-bar") as HTMLElement | null;
}

function updatePosition() {
  if (!props.containerEl) return;
  const containerRect = props.containerEl.getBoundingClientRect();
  panelRight.value = window.innerWidth - containerRect.right;

  const headerEl = findHeaderEl();
  if (headerEl) {
    panelTop.value = headerEl.getBoundingClientRect().bottom + 6;
  } else {
    panelTop.value = containerRect.top + 48;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) {
    emit("close");
  }
}

function onSelect(mid: string) {
  emit("select", mid);
  emit("close");
}

let scrollEl: HTMLElement | null = null;

watch(
  () => props.open,
  (val) => {
    if (val) {
      updatePosition();
      document.addEventListener("keydown", onKeydown);
      scrollEl = props.containerEl?.querySelector(".cccd-scroll-window") || null;
      scrollEl?.addEventListener("scroll", updatePosition, { passive: true });
    } else {
      document.removeEventListener("keydown", onKeydown);
      scrollEl?.removeEventListener("scroll", updatePosition);
      scrollEl = null;
    }
  },
);

onMounted(() => {
  window.addEventListener("resize", updatePosition);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", updatePosition);
  scrollEl?.removeEventListener("scroll", updatePosition);
});
</script>

<style lang="scss" scoped>
.cqp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: oklch(var(--bc) / 0.08);
}

.cqp-panel {
  position: fixed;
  z-index: 5001;
  width: 340px;
  max-height: min(70vh, 600px);
  display: flex;
  flex-direction: column;
  background: oklch(var(--b1));
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 12px;
  box-shadow:
    0 4px 24px oklch(var(--bc) / 0.12),
    0 0 0 1px oklch(var(--bc) / 0.04);
  overflow: hidden;
}

.cqp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.cqp-panel-title {
  font-size: 13px;
  font-weight: 700;
  color: oklch(var(--bc) / 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cqp-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: oklch(var(--bc) / 0.4);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: oklch(var(--b2) / 0.8);
    color: oklch(var(--bc) / 0.8);
  }
}

.cqp-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 10px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: oklch(var(--bc) / 0.12);
  }
}

.cqp-empty {
  padding: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: oklch(var(--bc) / 0.4);
}

.cqp-question-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: oklch(var(--bc));
  font-size: 13px;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: oklch(var(--b2) / 0.7);
  }

  &:active {
    background: oklch(var(--b2) / 0.9);
  }
}

.cqp-question-index {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: oklch(var(--b2) / 0.8);
  font-size: 11px;
  font-weight: 700;
  color: oklch(var(--bc) / 0.5);
  line-height: 1;
}

.cqp-question-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* transition */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.18s ease;

  .cqp-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;

  .cqp-panel {
    transform: translateY(-8px) scale(0.97);
    opacity: 0;
  }
}

/* mobile */
@media (max-width: 768px) {
  .cqp-backdrop {
    background: oklch(var(--bc) / 0.18);
  }

  .cqp-panel {
    position: fixed;
    top: auto !important;
    right: 0 !important;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 60vh;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px oklch(var(--bc) / 0.16);
  }

  .panel-fade-enter-from .cqp-panel,
  .panel-fade-leave-to .cqp-panel {
    transform: translateY(100%);
  }
}
</style>
