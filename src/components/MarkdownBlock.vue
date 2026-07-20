<template>
  <div ref="elementRef" class="markdown-content"></div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { renderBlock } from "@/services/markdown/md-render";

const props = withDefaults(defineProps<{ content?: string }>(), { content: "" });
const elementRef = ref<HTMLDivElement | null>(null);

function render() {
  if (elementRef.value) renderBlock("markdown-content", elementRef.value, props.content || "");
}

onMounted(render);
watch(() => props.content, () => nextTick(render));
</script>
