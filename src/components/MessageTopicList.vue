<template>
  <div ref="topicRef" v-if="topics.length" class="message-topic-list" :class="{ 'is-open': isOpen }">
    <aside v-if="isOpen" class="mtl-panel" :aria-label="label">
      <div class="mtl-title">{{ label }}</div>
      <nav class="mtl-list">
        <button
          v-for="topic in topics"
          :key="topic.id"
          type="button"
          class="mtl-item"
          :class="[`level-${topic.level || 1}`, { active: topic.id === activeTopicId }]"
          @click="selectTopic(topic.id)"
        >
          <span class="mtl-item-title">{{ topic.title }}</span>
          <span v-if="topic.detail" class="mtl-item-detail">{{ topic.detail }}</span>
        </button>
      </nav>
    </aside>
    <button type="button" class="mtl-trigger" :class="{ active: isOpen }" :aria-label="label" :aria-expanded="isOpen" @click="toggleOpen">
      <span class="mtl-trigger-marks" aria-hidden="true">
        <span
          v-for="mark in triggerMarks"
          :key="mark.index"
          class="mtl-trigger-mark"
          :class="{ active: mark.active }"
          :style="{ '--mark-width': `${mark.width}px` }"
        ></span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface MessageTopicItem {
  id: string;
  title: string;
  detail?: string;
  level?: number;
}

const props = withDefaults(
  defineProps<{
    topics: MessageTopicItem[];
    activeTopicId: string;
    label?: string;
  }>(),
  {
    label: "Topics",
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
}>();

const topicRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const triggerMarks = computed(() => {
  const count = Math.min(Math.max(props.topics.length, 4), 8);
  const activeIndex = Math.max(
    0,
    props.topics.findIndex((topic) => topic.id === props.activeTopicId),
  );
  const activeMarkIndex = props.topics.length > 1 ? Math.round((activeIndex / (props.topics.length - 1)) * (count - 1)) : 0;
  const widths = [12, 18, 25, 16, 28, 21, 14, 24];

  return Array.from({ length: count }, (_, index) => ({
    index,
    width: widths[index] || 18,
    active: index === activeMarkIndex,
  }));
});

function closeList() {
  isOpen.value = false;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function toggleOpen() {
  isOpen.value = !isOpen.value;
}

function selectTopic(id: string) {
  emit("select", id);
  closeList();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return;
  const target = event.target;
  if (target instanceof Node && topicRef.value?.contains(target)) return;
  closeList();
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
});

watch(
  () => props.topics.length,
  (length) => {
    if (!length) closeList();
  },
);
</script>

<style scoped lang="scss">
.message-topic-list {
  position: fixed;
  top: calc(44px + (100vh - 44px - var(--topic-bottom-gap, 220px)) / 2);
  right: 22px;
  z-index: 30;
  width: 38px;
  height: 0;
  pointer-events: auto;
}

.mtl-trigger {
  position: absolute;
  top: 0;
  right: 0;
  width: 38px;
  min-height: 68px;
  padding: 9px 6px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: oklch(var(--bc) / 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform: translateY(-50%);

  &:hover,
  &.active {
    color: oklch(var(--bc) / 0.9);
  }
}

.mtl-trigger-marks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
}

.mtl-trigger-mark {
  width: var(--mark-width);
  height: 3px;
  border-radius: 999px;
  background: oklch(var(--bc) / 0.32);

  &.active {
    width: 30px;
    height: 4px;
    background: oklch(var(--p) / 0.88);
  }
}

.mtl-panel {
  position: absolute;
  top: 0;
  right: 50px;
  display: flex;
  flex-direction: column;
  width: 304px;
  max-height: min(420px, calc(100vh - var(--topic-bottom-gap, 220px) - 112px));
  overflow: hidden;
  padding: 12px 12px 12px 14px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 10px;
  background: oklch(var(--b1) / 0.96);
  color: oklch(var(--bc) / 0.72);
  box-shadow: 0 18px 42px oklch(var(--bc) / 0.14);
  backdrop-filter: blur(14px);
  transform: translateY(-50%);
}

.mtl-title {
  min-width: 0;
  padding: 0 2px 8px;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 650;
  color: oklch(var(--bc) / 0.46);
}

.mtl-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 2px 2px 9px;
  border-left: 1px solid oklch(var(--bc) / 0.11);
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.2) transparent;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: oklch(var(--bc) / 0.18);
  }
}

.mtl-item {
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  line-height: 1.35;

  &:hover {
    background: oklch(var(--bc) / 0.055);
    color: oklch(var(--bc) / 0.88);
  }

  &.active {
    background: oklch(var(--p) / 0.12);
    color: oklch(var(--p));
    font-weight: 650;
  }
}

.mtl-item.level-1 {
  padding-left: 8px;
}

.mtl-item.level-2 {
  padding-left: 14px;
}

.mtl-item.level-3,
.mtl-item.level-4 {
  padding-left: 22px;
  font-size: 11px;
}

.mtl-item-title,
.mtl-item-detail {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.mtl-item-title {
  -webkit-line-clamp: 2;
}

.mtl-item-detail {
  margin-top: 3px;
  color: oklch(var(--bc) / 0.45);
  font-size: 11px;
  -webkit-line-clamp: 1;
}

@media (max-width: 900px) {
  .message-topic-list {
    right: 14px;
  }

  .mtl-panel {
    width: min(292px, calc(100vw - 82px));
    max-height: calc(100vh - var(--topic-bottom-gap, 220px) - 92px);
  }
}

@media (max-width: 520px) {
  .message-topic-list {
    right: 10px;
  }

  .mtl-panel {
    width: calc(100vw - 64px);
    right: 46px;
  }
}
</style>
