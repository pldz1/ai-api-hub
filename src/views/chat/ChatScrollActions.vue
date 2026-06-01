<template>
  <!-- This view renders quick actions for scrolling the chat list. -->
  <div class="cccd-scroll-actions">
    <!-- Jump to the first visible message when the list is scrolled down. -->
    <AppTooltip text="To top" placement="left">
      <button class="cccd-scroll-action" :class="{ disabled: !canScrollTop }" type="button" aria-label="To top" @click="$emit('scroll-top')">
        <SvgIcon class="cccd-scroll-action-icon" :src="arrowUpIcon" />
      </button>
    </AppTooltip>
    <!-- Jump back to the latest message near the bottom of the list. -->
    <AppTooltip text="To bottom" placement="left">
      <button class="cccd-scroll-action" :class="{ disabled: !canScrollBottom }" type="button" aria-label="To bottom" @click="$emit('scroll-bottom')">
        <SvgIcon class="cccd-scroll-action-icon is-bottom" :src="arrowUpIcon" />
      </button>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";

withDefaults(
  defineProps<{
    canScrollTop?: boolean;
    canScrollBottom?: boolean;
  }>(),
  {
    canScrollTop: false,
    canScrollBottom: false,
  },
);

defineEmits<{
  "scroll-top": [];
  "scroll-bottom": [];
}>();
</script>

<style lang="scss" scoped>
.cccd-scroll-actions {
  position: absolute;
  right: 20px;
  bottom: 40%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cccd-scroll-action {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: oklch(var(--b1) / 0.95);
  color: oklch(var(--bc) / 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cccd-scroll-action.disabled {
  opacity: 0.35;
  pointer-events: none;
}

.cccd-scroll-action-icon {
  width: 18px;
  height: 18px;
}

.cccd-scroll-action-icon.is-bottom {
  transform: rotate(180deg);
}
</style>
