<template>
  <!-- This component renders either a colored SVG image or a masked icon. -->
  <!-- Switch between direct image rendering and CSS mask rendering. -->
  <span class="svg-icon" :class="{ 'svg-icon-mask': !colored }" :style="colored ? null : iconStyle" aria-hidden="true">
    <img v-if="colored" class="svg-icon-img" :src="src" alt="" />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    src: string;
    colored?: boolean;
  }>(),
  {
    colored: false,
  },
);

const iconStyle = computed(() => ({
  "--svg-icon-url": `url("${props.src}")`,
}));
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  vertical-align: -0.125em;
}

.svg-icon-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.svg-icon-mask {
  background-color: currentColor;
  mask: var(--svg-icon-url) center / contain no-repeat;
  -webkit-mask: var(--svg-icon-url) center / contain no-repeat;
}
</style>
