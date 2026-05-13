<template>
  <div class="brush-editor">
    <div class="brush-toolbar">
      <div>
        <h4>{{ t("image.brushEditorTitle") }}</h4>
        <p>{{ t("image.brushEditorDescription") }}</p>
      </div>
      <div class="brush-controls">
        <label>
          <span>{{ t("image.brushSize") }}</span>
          <input type="range" min="8" max="96" step="1" v-model.number="brushSize" class="range range-xs" />
        </label>
        <button type="button" class="btn btn-sm btn-outline" @click="clearMask">{{ t("image.clearBrush") }}</button>
        <button type="button" class="btn btn-sm btn-primary" @click="applyMask">{{ t("image.useBrushMask") }}</button>
      </div>
    </div>

    <div class="brush-canvas-wrap" :style="{ aspectRatio: canvasAspectRatio }">
      <canvas ref="imageCanvasRef" class="brush-canvas image-layer"></canvas>
      <canvas
        ref="maskCanvasRef"
        class="brush-canvas mask-layer"
        @pointerdown="startPaint"
        @pointermove="paint"
        @pointerup="stopPaint"
        @pointerleave="stopPaint"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { dsAlert } from "@/utils";

const props = defineProps({
  sourceImage: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["apply"]);
const { t } = useI18n();
const imageCanvasRef = ref(null);
const maskCanvasRef = ref(null);
const brushSize = ref(32);
const isPainting = ref(false);
const canvasAspectRatio = ref("1 / 1");
let imageDataUrl = "";

function imageParamToDataUrl(image) {
  if (!image?.data) return "";
  if (String(image.data).startsWith("data:")) return image.data;
  return `data:${image.content_type || "image/png"};base64,${image.data}`;
}

function getPoint(event) {
  const canvas = maskCanvasRef.value;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function drawBrush(event) {
  const canvas = maskCanvasRef.value;
  const ctx = canvas.getContext("2d");
  const point = getPoint(event);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(point.x, point.y, brushSize.value / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function startPaint(event) {
  isPainting.value = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  drawBrush(event);
}

function paint(event) {
  if (!isPainting.value) return;
  drawBrush(event);
}

function stopPaint(event) {
  isPainting.value = false;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

function clearMask() {
  const canvas = maskCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function canvasToImageParam(canvas, filename) {
  const dataUrl = canvas.toDataURL("image/png");
  return {
    filename,
    content_type: "image/png",
    data: dataUrl.split(",")[1] || "",
  };
}

function applyMask() {
  const imageCanvas = imageCanvasRef.value;
  const maskCanvas = maskCanvasRef.value;
  if (!imageCanvas || !maskCanvas) return;

  emit("apply", {
    image: canvasToImageParam(imageCanvas, "edit-input.png"),
    mask: canvasToImageParam(maskCanvas, "edit-mask.png"),
  });
}

async function loadImage() {
  const dataUrl = imageParamToDataUrl(props.sourceImage);
  if (!dataUrl || dataUrl === imageDataUrl) return;
  imageDataUrl = dataUrl;
  await nextTick();

  const image = new Image();
  image.onload = () => {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const imageCanvas = imageCanvasRef.value;
    const maskCanvas = maskCanvasRef.value;
    imageCanvas.width = width;
    imageCanvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;
    canvasAspectRatio.value = `${width} / ${height}`;

    const imageCtx = imageCanvas.getContext("2d");
    imageCtx.clearRect(0, 0, width, height);
    imageCtx.drawImage(image, 0, 0, width, height);
    clearMask();
  };
  image.onerror = () => {
    dsAlert({ type: "error", message: t("image.brushImageLoadFailed") });
  };
  image.src = dataUrl;
}

watch(
  () => props.sourceImage,
  () => {
    loadImage();
  },
  { immediate: true, deep: true },
);
</script>

<style lang="scss" scoped>
.brush-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  padding: 10px;
  background: oklch(var(--b1) / 0.74);
}

.brush-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;

  h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
  }

  p {
    margin: 3px 0 0;
    color: oklch(var(--bc) / 0.58);
    font-size: 11px;
    line-height: 1.35;
  }
}

.brush-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;

  label {
    width: 128px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.58);
  }
}

.brush-canvas-wrap {
  position: relative;
  width: 100%;
  max-height: 280px;
  border-radius: 8px;
  overflow: hidden;
  background:
    linear-gradient(45deg, oklch(var(--bc) / 0.08) 25%, transparent 25%), linear-gradient(-45deg, oklch(var(--bc) / 0.08) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(var(--bc) / 0.08) 75%), linear-gradient(-45deg, transparent 75%, oklch(var(--bc) / 0.08) 75%);
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-size: 16px 16px;
}

.brush-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mask-layer {
  cursor: crosshair;
  opacity: 0.46;
  touch-action: none;
}
</style>
