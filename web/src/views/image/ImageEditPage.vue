<template>
  <ImageStudio mode="edit" :initial-edit-image="initialEditImage" />
</template>

<script setup>
import ImageStudio from "@/views/image/ImageStudio.vue";

defineProps({
  initialEditImage: {
    type: Object,
    default: null,
  },
});
</script>
