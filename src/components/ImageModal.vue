<template>
  <!-- This component shows the shared image preview modal. -->
  <dialog ref="dialogRef" id="global_image_preview_modal" class="modal global-image-preview-modal" @click="onDialogClick" @close="resetTransform">
    <div
      ref="viewerRef"
      class="modal-box image-viewer"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @touchstart="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- Provide a simple close control for the fullscreen image preview. -->
      <button class="btn btn-sm btn-circle btn-ghost image-viewer-close" type="button" @click="close">&times;</button>

      <!-- Scale the selected image to fit within the viewport. -->
      <img class="img-container" :src="imgSrc" :style="imageStyle" draggable="false" />
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAppStore } from "@/store";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const WHEEL_ZOOM_SPEED = 0.0018;

const store = useAppStore();
const dialogRef = ref<HTMLDialogElement | null>(null);
const viewerRef = ref<HTMLDivElement | null>(null);
const imgSrc = computed(() => store.state.modalImgSrc);

const scale = ref(MIN_SCALE);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const lastPointer = ref({ x: 0, y: 0 });
const lastTouchDistance = ref(0);

const imageStyle = computed(() => ({
  transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
  cursor: scale.value > MIN_SCALE ? (isDragging.value ? "grabbing" : "grab") : "default",
}));

watch(imgSrc, resetTransform);

function close() {
  dialogRef.value?.close();
}

function resetTransform() {
  scale.value = MIN_SCALE;
  translateX.value = 0;
  translateY.value = 0;
  isDragging.value = false;
  lastTouchDistance.value = 0;
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function zoomAt(clientX: number, clientY: number, nextScale: number) {
  const viewer = viewerRef.value;
  if (!viewer) return;

  const previousScale = scale.value;
  const clampedScale = clampScale(nextScale);

  if (clampedScale === MIN_SCALE) {
    resetTransform();
    return;
  }

  const rect = viewer.getBoundingClientRect();
  const relativeX = clientX - rect.left - rect.width / 2;
  const relativeY = clientY - rect.top - rect.height / 2;
  const ratio = clampedScale / previousScale;

  translateX.value = relativeX - (relativeX - translateX.value) * ratio;
  translateY.value = relativeY - (relativeY - translateY.value) * ratio;
  scale.value = clampedScale;
}

function onWheel(event: WheelEvent) {
  const nextScale = scale.value * (1 - event.deltaY * WHEEL_ZOOM_SPEED);
  zoomAt(event.clientX, event.clientY, nextScale);
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0 || scale.value <= MIN_SCALE) return;

  isDragging.value = true;
  lastPointer.value = { x: event.clientX, y: event.clientY };
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp, { once: true });
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging.value) return;

  translateX.value += event.clientX - lastPointer.value.x;
  translateY.value += event.clientY - lastPointer.value.y;
  lastPointer.value = { x: event.clientX, y: event.clientY };
}

function onMouseUp() {
  isDragging.value = false;
  window.removeEventListener("mousemove", onMouseMove);
}

function getTouchDistance(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function getTouchCenter(touches: TouchList) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length === 2) {
    lastTouchDistance.value = getTouchDistance(event.touches);
    isDragging.value = false;
    return;
  }

  if (event.touches.length === 1 && scale.value > MIN_SCALE) {
    isDragging.value = true;
    lastPointer.value = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length === 2) {
    const distance = getTouchDistance(event.touches);
    const center = getTouchCenter(event.touches);

    if (lastTouchDistance.value > 0) {
      zoomAt(center.x, center.y, scale.value * (distance / lastTouchDistance.value));
    }

    lastTouchDistance.value = distance;
    return;
  }

  if (event.touches.length === 1 && isDragging.value && scale.value > MIN_SCALE) {
    const touch = event.touches[0];
    translateX.value += touch.clientX - lastPointer.value.x;
    translateY.value += touch.clientY - lastPointer.value.y;
    lastPointer.value = { x: touch.clientX, y: touch.clientY };
  }
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) {
    lastTouchDistance.value = 0;
  }

  if (event.touches.length === 1 && scale.value > MIN_SCALE) {
    isDragging.value = true;
    lastPointer.value = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
    return;
  }

  isDragging.value = false;
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) close();
}
</script>

<style lang="scss" scoped>
.global-image-preview-modal {
  .modal-box {
    max-width: 100vw;
    max-height: 100vh;
    height: 100vh;
    width: 100vw;
    background-color: oklch(0% 0 0 / 0.32);
    box-shadow: initial;
    overflow: hidden;
  }

  .image-viewer {
    touch-action: none;
    user-select: none;
  }

  .image-viewer-close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    background-color: transparent;
    color: oklch(var(--nc));
    font-size: 36px;
  }

  .img-container {
    height: 100%;
    width: 100%;
    object-fit: contain;
    transform-origin: center center;
    will-change: transform;
  }
}
</style>
