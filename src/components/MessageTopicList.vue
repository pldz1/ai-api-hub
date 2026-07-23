<template>
  <div v-if="topics.length" ref="rootRef" class="message-topic-list" :class="{ 'is-open': open }">
    <aside v-if="open" class="topic-panel" :aria-label="label">
      <div class="topic-title">{{ label }}</div>
      <nav class="topic-items">
        <button
          v-for="topic in topics"
          :key="topic.id"
          class="topic-item"
          :class="[`level-${topic.level || 1}`, { active: topic.id === activeTopicId }]"
          type="button"
          @click="selectTopic(topic.id)"
        >
          <span>{{ topic.title }}</span>
          <small v-if="topic.detail">{{ topic.detail }}</small>
        </button>
      </nav>
    </aside>

    <button class="topic-trigger" :class="{ active: open }" type="button" :aria-label="label" :aria-expanded="open" @click="open = !open">
      <span class="topic-marks" aria-hidden="true">
        <span v-for="mark in triggerMarks" :key="mark.index" class="topic-mark" :class="{ active: mark.active }" :style="{ width: `${mark.width}px` }"></span>
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

const props = withDefaults(defineProps<{
  topics: MessageTopicItem[];
  activeTopicId?: string;
  label?: string;
}>(), { activeTopicId: "", label: "Topics" });

const emit = defineEmits<{ select: [id: string] }>();
const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);
const triggerMarks = computed(() => {
  const count = Math.min(Math.max(props.topics.length, 4), 8);
  const activeIndex = Math.max(0, props.topics.findIndex((topic) => topic.id === props.activeTopicId));
  const activeMarkIndex = props.topics.length > 1 ? Math.round((activeIndex / (props.topics.length - 1)) * (count - 1)) : 0;
  const widths = [12, 18, 25, 16, 28, 21, 14, 24];
  return Array.from({ length: count }, (_, index) => ({ index, width: widths[index] || 18, active: index === activeMarkIndex }));
});

function selectTopic(id: string) {
  emit("select", id);
  open.value = false;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !(event.target instanceof Node) || rootRef.value?.contains(event.target)) return;
  open.value = false;
}

onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown));
watch(() => props.topics.length, (length) => { if (!length) open.value = false; });
</script>

<style scoped lang="scss">
.message-topic-list {
  position: absolute;
  top: calc(var(--topic-top-gap, 48px) + (100% - var(--topic-top-gap, 48px) - var(--topic-bottom-gap, 150px)) / 2);
  right: 18px;
  z-index: 35;
  width: 38px;
  height: 0;
  pointer-events: auto;
}
.topic-trigger {
  position: absolute;
  top: 0;
  right: 0;
  width: 38px;
  min-height: 68px;
  padding: 9px 6px;
  border: 0;
  border-radius: 999px;
  background: oklch(var(--b1) / 0.6);
  color: oklch(var(--bc) / 0.66);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(8px);
}
.topic-trigger:hover, .topic-trigger.active { color: oklch(var(--bc) / 0.92); background: oklch(var(--b1) / 0.92); }
.topic-marks { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%; }
.topic-mark { height: 3px; border-radius: 999px; background: oklch(var(--bc) / 0.28); transition: width 0.15s ease, background-color 0.15s ease; }
.topic-mark.active { width: 30px !important; height: 4px; background: oklch(var(--p) / 0.88); }
.topic-panel {
  position: absolute;
  top: 0;
  right: 50px;
  width: 304px;
  max-height: min(430px, calc(100vh - 170px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 12px;
  background: oklch(var(--b1) / 0.97);
  box-shadow: 0 18px 42px oklch(var(--bc) / 0.14);
  backdrop-filter: blur(14px);
  transform: translateY(-50%);
}
.topic-title { padding: 0 3px 9px; color: oklch(var(--bc) / 0.48); font-size: 12px; font-weight: 700; }
.topic-items { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-left: 8px; border-left: 1px solid oklch(var(--bc) / 0.1); }
.topic-item { width: 100%; min-height: 34px; padding: 6px 8px; border: 0; border-radius: 7px; background: transparent; color: oklch(var(--bc) / 0.72); text-align: left; cursor: pointer; }
.topic-item:hover { background: oklch(var(--bc) / 0.055); color: oklch(var(--bc)); }
.topic-item.active { background: oklch(var(--p) / 0.12); color: oklch(var(--p)); font-weight: 650; }
.topic-item.level-2 { padding-left: 14px; }
.topic-item.level-3, .topic-item.level-4 { padding-left: 22px; font-size: 11px; }
.topic-item span, .topic-item small { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; word-break: break-word; }
.topic-item span { -webkit-line-clamp: 2; }
.topic-item small { margin-top: 3px; color: oklch(var(--bc) / 0.46); font-size: 11px; -webkit-line-clamp: 1; }

@media (max-width: 900px) {
  .message-topic-list { right: 12px; }
  .topic-panel { width: min(292px, calc(100vw - 82px)); }
}
@media (max-width: 520px) {
  .message-topic-list { right: 8px; }
  .topic-panel { right: 44px; width: calc(100vw - 62px); }
}
</style>
