<template>
  <!-- Only surface navigation when the latest response is outside the viewport. -->
  <div class="cccd-scroll-actions">
    <AppTooltip :text="t('chat.jumpLatest')" placement="left">
      <button class="cccd-scroll-action" :class="{ disabled: !canScrollBottom }" type="button" :aria-label="t('chat.jumpLatest')" @click="$emit('scroll-bottom')">
        <SvgIcon class="cccd-scroll-action-icon is-bottom" :src="arrowUpIcon" />
      </button>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import { useI18n } from "vue-i18n";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";

const { t } = useI18n();

withDefaults(
  defineProps<{
    canScrollBottom?: boolean;
  }>(),
  {
    canScrollBottom: false,
  },
);

defineEmits<{
  "scroll-bottom": [];
}>();
</script>

<style lang="scss" scoped>
.cccd-scroll-actions {
  position: absolute;
  right: 20px;
  bottom: 18px;
  display: flex;
  z-index: 5;
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
