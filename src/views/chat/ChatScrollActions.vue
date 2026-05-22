<template>
  <div class="cccd-scroll-actions">
    <AppTooltip text="To top" placement="left">
      <button class="cccd-scroll-action" :class="{ disabled: !canScrollTop }" type="button" aria-label="To top" @click="$emit('scroll-top')">
        <SvgIcon class="cccd-scroll-action-icon" :src="arrowUpIcon" />
      </button>
    </AppTooltip>
    <AppTooltip text="To bottom" placement="left">
      <button class="cccd-scroll-action" :class="{ disabled: !canScrollBottom }" type="button" aria-label="To bottom" @click="$emit('scroll-bottom')">
        <SvgIcon class="cccd-scroll-action-icon is-bottom" :src="arrowUpIcon" />
      </button>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";

defineProps({
  canScrollTop: {
    type: Boolean,
    default: false,
  },
  canScrollBottom: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["scroll-top", "scroll-bottom"]);
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
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(27, 39, 51, 0.12);
  color: rgba(17, 24, 39, 0.78);
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
