<template>
  <ImageStudio mode="generation" @switch-to-edit="emit('switch-to-edit', $event)" />
</template>

<script setup>
import ImageStudio from "@/views/image/ImageStudio.vue";

const emit = defineEmits(["switch-to-edit"]);
</script>
