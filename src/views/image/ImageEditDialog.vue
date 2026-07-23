<template>
  <dialog ref="dialogRef" class="image-edit-dialog" @click="onDialogClick" @cancel.prevent="close">
    <div class="ied-shell" @click.stop>
      <header class="ied-toolbar">
        <div class="ied-toolbar-identity">
          <button class="ied-icon-button" type="button" :aria-label="t('common.close')" @click="close">
            <SvgIcon :src="closeIcon" />
          </button>
          <div class="ied-title">
            <strong>{{ t("image.editDialogTitle") }}</strong>
            <small>{{ sourceImage?.filename || t("assets.untitledAsset") }}</small>
          </div>
        </div>

        <div v-if="editMode" class="ied-edit-tools">
          <button class="ied-tool-button" type="button" @click="clearMask">
            {{ t("image.editResetAction") }}
          </button>
          <label class="ied-brush-control">
            <span>{{ t("image.brushSize") }}</span>
            <input v-model.number="brushSize" type="range" min="8" max="96" step="1" :disabled="!editMode" />
            <output>{{ brushSize }}</output>
          </label>
        </div>

        <div class="ied-toolbar-actions">
          <button class="ied-quiet-button" type="button" @click="downloadImage">{{ t("image.download") }}</button>
          <button
            class="ied-edit-button"
            :class="{ active: editMode }"
            type="button"
            :aria-pressed="editMode"
            @click="editMode = !editMode"
          >
            <SvgIcon :src="editIcon" />
            {{ editMode ? t("image.cancelEditAction") : t("image.editImageAction") }}
          </button>
          <button class="ied-save-button" type="button" @click="save">{{ t("image.applyEditAction") }}</button>
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
        <div class="ied-stage-status" :class="{ editing: editMode }">
          <span class="ied-status-dot"></span>
          {{ editMode ? t("image.editDialogPaintHint") : t("image.editDialogViewHint") }}
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
import closeIcon from "@/assets/svg/close16.svg";
import editIcon from "@/assets/svg/edit24.svg";
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
    background: rgba(7, 9, 13, 0.82);
    backdrop-filter: blur(8px);
  }
}

.ied-shell {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  color: #fff;
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.09), transparent 36%),
    linear-gradient(145deg, #1d2128 0%, #111419 68%, #0d1015 100%);
}

.ied-toolbar {
  position: relative;
  z-index: 2;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 16, 21, 0.82);
  backdrop-filter: blur(18px);
}

.ied-toolbar-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
}

.ied-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong { font-size: 14px; line-height: 1.2; }
  small {
    max-width: 210px;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.ied-toolbar-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.ied-icon-button {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  cursor: pointer;

  &:hover { background: rgba(255, 255, 255, 0.13); }
  :deep(.svg-icon) { width: 15px; height: 15px; }
}

.ied-edit-tools {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 9px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
}

.ied-brush-control {
  min-width: 190px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;

  input {
    width: 104px;
    accent-color: #78a7ff;
  }

  output {
    width: 26px;
    color: rgba(255, 255, 255, 0.48);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
}

.ied-tool-button,
.ied-quiet-button,
.ied-edit-button,
.ied-save-button {
  height: 38px;
  padding: 0 15px;
  border: none;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
}

.ied-tool-button,
.ied-quiet-button {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);

  &:hover { background: rgba(255, 255, 255, 0.09); color: #fff; }
}

.ied-edit-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;

  &:hover { background: rgba(255, 255, 255, 0.16); }
  &.active { background: rgba(120, 167, 255, 0.2); color: #b9d2ff; }
  :deep(.svg-icon) { width: 16px; height: 16px; }
}

.ied-save-button {
  background: #f4f7fb;
  color: #121820;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);

  &:hover { background: #fff; }
}

.ied-stage {
  position: relative;
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
  border-radius: 6px;
  box-shadow: 0 26px 90px rgba(0, 0, 0, 0.42);
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
  opacity: 0;
  touch-action: none;
  transition: opacity 0.18s ease;

  &.editing {
    cursor: crosshair;
    opacity: 0.48;
  }

  &.panning {
    cursor: grabbing;
  }
}

.ied-stage-status {
  position: absolute;
  bottom: 16px;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(12, 15, 20, 0.72);
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  pointer-events: none;
  transform: translateX(-50%);
  backdrop-filter: blur(12px);

  &.editing { color: #c8dbff; }
}

.ied-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
}

.ied-stage-status.editing .ied-status-dot {
  background: #78a7ff;
  box-shadow: 0 0 0 4px rgba(120, 167, 255, 0.12);
}

@media (max-width: 980px) {
  .ied-title small { max-width: 120px; }
  .ied-edit-tools { margin-left: auto; }
  .ied-brush-control { min-width: 152px; }
  .ied-brush-control input { width: 72px; }
}

@media (max-width: 760px) {
  .ied-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 10px 12px;
  }

  .ied-title { display: none; }
  .ied-edit-tools { grid-column: 1 / -1; grid-row: 2; width: 100%; justify-content: space-between; box-sizing: border-box; }
  .ied-toolbar-actions { min-width: 0; }
  .ied-quiet-button { display: none; }

  .ied-stage {
    padding: 14px 14px 48px;
  }

  .ied-canvas-frame {
    max-width: calc(100vw - 28px);
  }
}

@media (max-width: 430px) {
  .ied-edit-button,
  .ied-save-button { padding: 0 11px; }
  .ied-brush-control { min-width: 0; flex: 1; }
  .ied-brush-control input { min-width: 48px; width: 100%; }
}
</style>
