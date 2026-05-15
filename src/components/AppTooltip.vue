<template>
  <span class="app-tooltip-host">
    <span
      ref="triggerRef"
      class="app-tooltip-trigger"
      v-bind="attrs"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
      @focusin="showTooltip"
      @focusout="hideTooltip"
    >
      <slot />
    </span>
    <Teleport :to="teleportTarget">
      <div v-if="visible" ref="tooltipRef" class="app-tooltip-bubble" :class="`is-${resolvedPlacement}`" :style="tooltipStyle">
        {{ text }}
      </div>
    </Teleport>
  </span>
</template>

<script setup>
defineOptions({ inheritAttrs: false });

import { computed, nextTick, onBeforeUnmount, ref, useAttrs } from "vue";

const props = defineProps({
  text: {
    type: String,
    default: "",
  },
  placement: {
    type: String,
    default: "top",
  },
});

const attrs = useAttrs();
const triggerRef = ref(null);
const tooltipRef = ref(null);
const visible = ref(false);
const position = ref({ top: 0, left: 0 });
const resolvedPlacement = ref(props.placement);
const teleportTarget = ref("body");

const GAP = 10;
const VIEWPORT_PADDING = 12;

const tooltipStyle = computed(() => ({
  top: `${position.value.top}px`,
  left: `${position.value.left}px`,
}));

function getTooltipSize() {
  const tooltipEl = tooltipRef.value;
  if (!tooltipEl) return { width: 0, height: 0 };
  const rect = tooltipEl.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computePlacementPosition(placement, rect, tooltipSize) {
  const { width, height } = tooltipSize;

  switch (placement) {
    case "bottom":
      return {
        top: rect.bottom + GAP,
        left: rect.left + rect.width / 2 - width / 2,
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 - height / 2,
        left: rect.left - width - GAP,
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 - height / 2,
        left: rect.right + GAP,
      };
    default:
      return {
        top: rect.top - height - GAP,
        left: rect.left + rect.width / 2 - width / 2,
      };
  }
}

function fitsViewport(nextPosition, tooltipSize) {
  const viewportLeft = VIEWPORT_PADDING;
  const viewportTop = VIEWPORT_PADDING;
  const viewportRight = window.innerWidth - VIEWPORT_PADDING;
  const viewportBottom = window.innerHeight - VIEWPORT_PADDING;

  return (
    nextPosition.left >= viewportLeft &&
    nextPosition.top >= viewportTop &&
    nextPosition.left + tooltipSize.width <= viewportRight &&
    nextPosition.top + tooltipSize.height <= viewportBottom
  );
}

function clampToViewport(nextPosition, tooltipSize) {
  const minLeft = VIEWPORT_PADDING;
  const minTop = VIEWPORT_PADDING;
  const maxLeft = window.innerWidth - tooltipSize.width - VIEWPORT_PADDING;
  const maxTop = window.innerHeight - tooltipSize.height - VIEWPORT_PADDING;

  return {
    left: clamp(nextPosition.left, minLeft, Math.max(minLeft, maxLeft)),
    top: clamp(nextPosition.top, minTop, Math.max(minTop, maxTop)),
  };
}

const updatePosition = () => {
  const triggerEl = triggerRef.value;
  const tooltipEl = tooltipRef.value;
  if (!triggerEl || !tooltipEl) return;
  const rect = triggerEl.getBoundingClientRect();
  const tooltipSize = getTooltipSize();
  const placements = [props.placement, "top", "bottom", "right", "left"].filter((item, index, list) => item && list.indexOf(item) === index);

  let nextPlacement = props.placement;
  let nextPosition = computePlacementPosition(nextPlacement, rect, tooltipSize);

  for (const placement of placements) {
    const candidate = computePlacementPosition(placement, rect, tooltipSize);
    if (fitsViewport(candidate, tooltipSize)) {
      nextPlacement = placement;
      nextPosition = candidate;
      break;
    }
  }

  resolvedPlacement.value = nextPlacement;
  position.value = clampToViewport(nextPosition, tooltipSize);
};

const bindViewportEvents = () => {
  window.addEventListener("scroll", updatePosition, true);
  window.addEventListener("resize", updatePosition);
};

const unbindViewportEvents = () => {
  window.removeEventListener("scroll", updatePosition, true);
  window.removeEventListener("resize", updatePosition);
};

const showTooltip = async () => {
  if (!props.text) return;
  teleportTarget.value = triggerRef.value?.closest?.("dialog[open]") || "body";
  visible.value = true;
  await nextTick();
  updatePosition();
  bindViewportEvents();
};

const hideTooltip = () => {
  visible.value = false;
  unbindViewportEvents();
};

onBeforeUnmount(() => {
  unbindViewportEvents();
});
</script>

<style scoped>
.app-tooltip-host {
  display: inline-flex;
}

.app-tooltip-trigger {
  display: inline-flex;
}

.app-tooltip-bubble {
  position: fixed;
  z-index: 5000;
  max-width: min(280px, calc(100vw - 24px));
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid oklch(var(--bc) / 0.12);
  background: oklch(var(--n) / 0.96);
  color: oklch(var(--nc));
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-line;
  box-shadow: 0 12px 28px oklch(var(--bc) / 0.16);
  pointer-events: none;
  word-break: break-word;
}
</style>
