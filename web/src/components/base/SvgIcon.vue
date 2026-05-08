<template>
  <span class="svg-icon" :class="{ 'svg-icon-mask': !colored }" :style="colored ? null : iconStyle" aria-hidden="true">
    <img v-if="colored" class="svg-icon-img" :src="src" alt="" />
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  colored: {
    type: Boolean,
    default: false,
  },
});

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
