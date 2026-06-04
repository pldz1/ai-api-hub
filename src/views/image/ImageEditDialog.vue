<template>
  <dialog ref="dialogRef" class="image-edit-dialog" @click="onDialogClick" @cancel.prevent="close">
    <div class="ied-shell" @click.stop>
      <header class="ied-toolbar">
        <button class="ied-icon-button" type="button" :aria-label="t('common.close')" @click="close">
          <SvgIcon :src="closeIcon" />
        </button>
        <div class="ied-toolbar-actions">
          <!-- Download -->
          <button class="ied-secondary-button" type="button" @click="downloadImage">{{ t("image.download") }}</button>
          <!-- Reset -->
          <button class="ied-secondary-button" :class="{ active: editMode }" type="button" @click="clearMask">
            {{ t("image.editResetAction") }}
          </button>
          <!-- Brush size -->
          <label class="ied-brush-control" :class="{ disabled: !editMode }">
            <span>{{ t("image.brushSize") }}</span>
            <input v-model.number="brushSize" type="range" min="8" max="96" step="1" :disabled="!editMode" />
          </label>
          <!-- Start editing -->
          <button class="ied-secondary-button" :class="{ active: editMode }" type="button" @click="editMode = !editMode">
            {{ t("image.editImageAction") }}
          </button>
          <!-- Save modification -->
          <button class="ied-save-button" type="button" @click="save">{{ t("common.save") }}</button>
        </div>
      </header>

      <main ref="stageRef" class="ied-stage" @wheel.prevent="onWheel">
        <div class="ied-canvas-frame" :style="canvasFrameStyle">
          <canvas ref="imageCanvasRef" class="ied-canvas ied-image-layer"></canvas>
          <canvas
            ref="maskCanvasRef"
            class="ied-canvas ied-mask-layer"
            :class="{ editing: editMode, panning: isPanning }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onPointerUp"
          ></canvas>
        </div>
      </main>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { dsAlert } from "@/utils";
import SvgIcon from "@/components/SvgIcon.vue";
import closeIcon from "@/assets/svg/delete32.svg";
import type { ImageInputAttachment } from "@/types";

const emit = defineEmits<{
  apply: [payload: { image: ImageInputAttachment; mask: ImageInputAttachment }];
  close: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const { t } = useI18n();
const stageRef = ref<HTMLElement | null>(null);
const imageCanvasRef = ref<HTMLCanvasElement | null>(null);
const maskCanvasRef = ref<HTMLCanvasElement | null>(null);
const sourceImage = ref<ImageInputAttachment | null>(null);
const brushSize = ref(36);
const editMode = ref(false);
const isPainting = ref(false);
const isPanning = ref(false);
const canvasAspectRatio = ref("1 / 1");
const naturalSize = ref({ width: 1, height: 1 });
const stageSize = ref({ width: 1, height: 1 });
const zoomScale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const lastPointer = ref({ x: 0, y: 0 });
const canvasFrameStyle = computed(() => {
  const naturalWidth = Math.max(1, naturalSize.value.width);
  const naturalHeight = Math.max(1, naturalSize.value.height);
  const availableWidth = Math.max(1, stageSize.value.width);
  const availableHeight = Math.max(1, stageSize.value.height);
  const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);

  return {
    width: `${Math.round(naturalWidth * scale)}px`,
    height: `${Math.round(naturalHeight * scale)}px`,
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${zoomScale.value})`,
  };
});

function imageParamToDataUrl(image: ImageInputAttachment | null) {
  if (!image?.data) return "";
  if (String(image.data).startsWith("data:")) return image.data;
  return `data:${image.content_type || "image/png"};base64,${image.data}`;
}

function getPoint(event: PointerEvent) {
  const canvas = maskCanvasRef.value;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const xRatio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const yRatio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;

  return {
    x: Math.min(Math.max(xRatio, 0), 1) * canvas.width,
    y: Math.min(Math.max(yRatio, 0), 1) * canvas.height,
  };
}

function drawBrush(event: PointerEvent) {
  const canvas = maskCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const point = getPoint(event);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(point.x, point.y, brushSize.value / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function startPaint(event: PointerEvent) {
  if (!editMode.value) return;

  isPainting.value = true;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  drawBrush(event);
}

function paint(event: PointerEvent) {
  if (!editMode.value || !isPainting.value) return;
  drawBrush(event);
}

function stopPaint(event: PointerEvent) {
  isPainting.value = false;
  (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
}

function resetView() {
  zoomScale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
  isPanning.value = false;
  isPainting.value = false;
}

function clampZoom(value: number) {
  return Math.min(6, Math.max(1, value));
}

function zoomAt(clientX: number, clientY: number, nextScale: number) {
  const stage = stageRef.value;
  if (!stage) return;

  const previousScale = zoomScale.value;
  const clampedScale = clampZoom(nextScale);

  if (clampedScale === 1) {
    resetView();
    return;
  }

  const rect = stage.getBoundingClientRect();
  const relativeX = clientX - rect.left - rect.width / 2;
  const relativeY = clientY - rect.top - rect.height / 2;
  const ratio = clampedScale / previousScale;

  translateX.value = relativeX - (relativeX - translateX.value) * ratio;
  translateY.value = relativeY - (relativeY - translateY.value) * ratio;
  zoomScale.value = clampedScale;
}

function onWheel(event: WheelEvent) {
  const nextScale = zoomScale.value * (1 - event.deltaY * 0.0018);
  zoomAt(event.clientX, event.clientY, nextScale);
}

function startPan(event: PointerEvent) {
  isPanning.value = true;
  lastPointer.value = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
}

function pan(event: PointerEvent) {
  if (!isPanning.value) return;

  translateX.value += event.clientX - lastPointer.value.x;
  translateY.value += event.clientY - lastPointer.value.y;
  lastPointer.value = { x: event.clientX, y: event.clientY };
}

function stopPan(event: PointerEvent) {
  isPanning.value = false;
  (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
}

function onPointerDown(event: PointerEvent) {
  if (editMode.value) {
    startPaint(event);
    return;
  }

  startPan(event);
}

function onPointerMove(event: PointerEvent) {
  if (editMode.value) {
    paint(event);
    return;
  }

  pan(event);
}

function onPointerUp(event: PointerEvent) {
  if (editMode.value) {
    stopPaint(event);
    return;
  }

  stopPan(event);
}

function clearMask() {
  const canvas = maskCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function canvasToAttachment(canvas: HTMLCanvasElement, filename: string): ImageInputAttachment {
  const dataUrl = canvas.toDataURL("image/png");
  return {
    id: filename,
    filename,
    content_type: "image/png",
    data: dataUrl.split(",")[1] || "",
    previewUrl: dataUrl,
  };
}

function downloadImage() {
  const canvas = imageCanvasRef.value;
  if (!canvas) return;

  canvas.toBlob((blob) => {
    if (!blob) {
      console.error("Failed to create image blob for download");
      dsAlert({ type: "error", message: t("image.downloadFailed") });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sourceImage.value?.filename || "edit-input.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

function save() {
  const imageCanvas = imageCanvasRef.value;
  const maskCanvas = maskCanvasRef.value;
  if (!imageCanvas || !maskCanvas) return;

  emit("apply", {
    image: canvasToAttachment(imageCanvas, "edit-input.png"),
    mask: canvasToAttachment(maskCanvas, "edit-mask.png"),
  });
  close();
}

async function loadImage() {
  const dataUrl = imageParamToDataUrl(sourceImage.value);
  if (!dataUrl) return;
  await nextTick();
  updateStageSize();

  const image = new Image();
  image.onload = () => {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const imageCanvas = imageCanvasRef.value;
    const maskCanvas = maskCanvasRef.value;
    if (!imageCanvas || !maskCanvas) return;

    imageCanvas.width = width;
    imageCanvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;
    naturalSize.value = { width, height };
    canvasAspectRatio.value = `${width} / ${height}`;

    const imageCtx = imageCanvas.getContext("2d");
    imageCtx?.clearRect(0, 0, width, height);
    imageCtx?.drawImage(image, 0, 0, width, height);
    clearMask();
  };
  image.onerror = () => {
    console.error("Failed to load image:", dataUrl);
    dsAlert({ type: "error", message: t("image.loadFailed") });
  };
  image.src = dataUrl;
}

function updateStageSize() {
  const viewportWidth = window.innerWidth || 1;
  const viewportHeight = window.innerHeight || 1;
  stageSize.value = {
    width: Math.max(1, Math.min(viewportWidth - 88, 1280)),
    height: Math.max(1, viewportHeight - 130),
  };
}

async function open(image: ImageInputAttachment) {
  sourceImage.value = image;
  editMode.value = false;
  resetView();
  updateStageSize();
  dialogRef.value?.showModal();
  await loadImage();
}

function close() {
  if (dialogRef.value?.open) dialogRef.value.close();
  resetView();
  emit("close");
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) close();
}

window.addEventListener("resize", updateStageSize);

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateStageSize);
});

defineExpose({ open, close });
</script>

<style lang="scss" scoped>
.image-edit-dialog {
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;

  &::backdrop {
    background: rgba(18, 18, 18, 0.92);
  }
}

.ied-shell {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr);
  color: #fff;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.08), transparent 42%), #242424;
}

.ied-toolbar {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
}

.ied-toolbar-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.ied-icon-button {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
  font-size: 25px;
  line-height: 1;
}

.ied-brush-control {
  min-width: 148px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;

  input {
    width: 104px;
    accent-color: #fff;
  }

  &.disabled {
    opacity: 0.45;
  }
}

.ied-secondary-button,
.ied-save-button {
  height: 50px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}

.ied-secondary-button {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;

  &.active {
    background: #fff;
    color: #111827;
  }
}

.ied-save-button {
  background: #fff;
  color: #111827;
}

.ied-stage {
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 24px 44px 38px;
  overflow: hidden;
}

.ied-canvas-frame {
  position: relative;
  flex: 0 0 auto;
  background: #fff;
  box-shadow: 0 22px 80px rgba(0, 0, 0, 0.32);
  overflow: hidden;
  transform-origin: center center;
  will-change: transform;
}

.ied-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ied-mask-layer {
  cursor: grab;
  opacity: 0.48;
  touch-action: none;

  &.editing {
    cursor: crosshair;
  }

  &.panning {
    cursor: grabbing;
  }
}

@media (max-width: 720px) {
  .ied-toolbar {
    padding: 0 12px;
  }

  .ied-brush-control {
    min-width: 116px;

    input {
      width: 76px;
    }
  }

  .ied-stage {
    padding: 14px;
  }

  .ied-canvas-frame {
    max-width: calc(100vw - 28px);
  }
}
</style>
