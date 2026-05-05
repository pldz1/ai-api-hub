<template>
  <section class="preview-panel">
    <div class="preview-header">
      <div>
        <h3>{{ t("image.previewTitle") }}</h3>
        <p>{{ selectedImage?.prompt || t("image.emptyHint") }}</p>
      </div>

      <div class="preview-badges">
        <span>{{ statusLabel }}</span>
        <span>{{ size }}</span>
        <span>{{ imageCount }} {{ t("image.outputs") }}</span>
        <span v-if="elapsedSeconds > 0">{{ elapsedSeconds.toFixed(1) }}s</span>
      </div>
    </div>

    <div v-if="selectedImage && !isGenerating" class="preview-toolbar">
      <button type="button" class="btn btn-sm btn-outline" @click="zoomOut">-</button>
      <span>{{ zoomPercent }}%</span>
      <button type="button" class="btn btn-sm btn-outline" @click="zoomIn">+</button>
      <button type="button" class="btn btn-sm btn-outline" @click="resetZoom">{{ t("image.zoomReset") }}</button>
      <button type="button" class="btn btn-sm btn-outline preview-action" @click="emit('copy')">
        <SvgIcon class="toolbar-icon" :src="copyIcon" />
        <span>{{ t("image.copyClipboard") }}</span>
      </button>
      <button type="button" class="btn btn-sm btn-outline preview-action" @click="emit('save')">
        <SvgIcon class="toolbar-icon" :src="saveIcon" />
        <span>{{ t("image.saveLocal") }}</span>
      </button>
      <button v-if="showEditAction" type="button" class="btn btn-sm btn-outline preview-action" @click="emit('edit-image', selectedImage)">
        <SvgIcon class="toolbar-icon" :src="editIcon" />
        <span>{{ t("image.editImageAction") }}</span>
      </button>
      <button type="button" class="btn btn-sm btn-outline btn-error preview-action" @click="emit('delete')">
        <SvgIcon class="toolbar-icon" :src="deleteIcon" />
        <span>{{ t("image.deleteImage") }}</span>
      </button>
    </div>

    <div class="preview-stage">
      <div v-if="isGenerating" class="stage-state stage-loading">
        <div class="preview-skeleton"></div>
        <h4>{{ t("image.generating") }}</h4>
        <p>{{ prompt || t("image.generatingHint") }}</p>
      </div>

      <template v-else-if="selectedImage">
        <div class="image-scroll-frame" @dblclick="resetZoom">
          <img
            ref="selectedImageRef"
            class="preview-image"
            :style="imageStyle"
            :src="selectedImage.src"
            :alt="selectedImage.prompt || 'Generated image'"
            crossOrigin="anonymous"
          />
        </div>
      </template>

      <div v-else class="stage-state">
        <span class="stage-icon">
          <SvgIcon :src="editIcon" />
        </span>
        <h4>{{ t("image.emptyTitle") }}</h4>
        <p>{{ t("image.emptyHint") }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import editIcon from "@/assets/svg/edit24.svg";
import saveIcon from "@/assets/svg/save18.svg";
import SvgIcon from "@/components/SvgIcon.vue";

const props = defineProps({
  selectedImage: {
    type: Object,
    default: null,
  },
  isGenerating: {
    type: Boolean,
    default: false,
  },
  statusLabel: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: true,
  },
  imageCount: {
    type: Number,
    default: 0,
  },
  prompt: {
    type: String,
    default: "",
  },
  elapsedSeconds: {
    type: Number,
    default: 0,
  },
  showEditAction: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["copy", "save", "delete", "edit-image"]);
const selectedImageRef = ref(null);
const zoomLevel = ref(1);
const { t } = useI18n();
const zoomPercent = computed(() => Math.round(zoomLevel.value * 100));
const imageStyle = computed(() => ({
  maxWidth: `${zoomLevel.value * 100}%`,
  maxHeight: `${zoomLevel.value * 100}%`,
}));
const zoomIn = () => {
  zoomLevel.value = Math.min(3, Number((zoomLevel.value + 0.25).toFixed(2)));
};

const zoomOut = () => {
  zoomLevel.value = Math.max(0.25, Number((zoomLevel.value - 0.25).toFixed(2)));
};

const resetZoom = () => {
  zoomLevel.value = 1;
};

watch(
  () => props.selectedImage?.id,
  () => {
    resetZoom();
  },
);

defineExpose({
  selectedImageRef,
});
</script>

<style lang="scss" scoped>
.preview-panel {
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.94), oklch(var(--b2) / 0.9));
  box-shadow: 0 20px 48px oklch(var(--bc) / 0.06);
  backdrop-filter: blur(18px);
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: oklch(var(--bc));
  }

  p {
    margin: 2px 0 0;
    color: oklch(var(--bc) / 0.62);
    line-height: 1.5;
  }
}

.preview-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid oklch(var(--bc) / 0.08);
    background: oklch(var(--b1) / 0.86);
    font-size: 12px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.72);
    white-space: nowrap;
  }
}

.preview-stage {
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100dvh - 160px);
  display: grid;
  place-items: center;
  padding: 18px;
  border-radius: 18px;
  background:
    linear-gradient(45deg, oklch(var(--bc) / 0.045) 25%, transparent 25%), linear-gradient(-45deg, oklch(var(--bc) / 0.045) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(var(--bc) / 0.045) 75%), linear-gradient(-45deg, transparent 75%, oklch(var(--bc) / 0.045) 75%),
    linear-gradient(180deg, oklch(var(--b1) / 0.9), oklch(var(--b2) / 0.82));
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-size:
    16px 16px,
    16px 16px,
    16px 16px,
    16px 16px,
    auto;
  overflow: hidden;
}

.image-scroll-frame {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.28) transparent;
}

.image-scroll-frame::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.image-scroll-frame::-webkit-scrollbar-track {
  background: transparent;
}

.image-scroll-frame::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: oklch(var(--bc) / 0.28);
}

.image-scroll-frame::-webkit-scrollbar-corner {
  background: transparent;
}

.preview-image {
  display: block;
  border-radius: 18px;
  object-fit: contain;
  box-shadow: 0 24px 60px oklch(var(--bc) / 0.18);
  transition:
    max-width 0.14s ease,
    max-height 0.14s ease;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;

  .btn {
    min-height: 32px;
    height: 32px;
    border-radius: 10px;
  }

  span {
    min-width: 54px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.7);
  }
}

.toolbar-icon {
  width: 16px;
  height: 16px;

  :deep(.svg-icon) {
    width: 16px;
    height: 16px;
    display: block;
  }
}

.preview-action {
  gap: 7px;
  padding-inline: 10px;

  span {
    min-width: 0;
  }
}

.stage-state {
  max-width: min(420px, 100%);
  text-align: center;

  h4 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    color: oklch(var(--bc));
  }

  p {
    margin: 0;
    color: oklch(var(--bc) / 0.62);
    line-height: 1.5;
  }
}

.stage-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 18px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b1) / 0.9);
  color: oklch(var(--bc) / 0.46);

  :deep(.svg-icon) {
    width: 34px;
    height: 34px;
    display: block;
  }
}

.preview-skeleton {
  width: min(100%, 320px);
  aspect-ratio: 1;
  margin: 0 auto 18px;
  border-radius: 28px;
  border: 1px solid oklch(var(--p) / 0.28);
  background: linear-gradient(135deg, oklch(var(--p) / 0.2), oklch(var(--a) / 0.2)), linear-gradient(180deg, oklch(var(--b2)), oklch(var(--b1)));
  box-shadow:
    0 22px 52px oklch(var(--p) / 0.14),
    inset 0 0 0 1px oklch(var(--bc) / 0.06);
  position: relative;
  overflow: hidden;
}

.preview-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, oklch(var(--p) / 0.42), transparent);
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 980px) {
  .preview-stage {
    min-height: 380px;
    max-height: none;

    .preview-image {
      max-height: 70dvh;
    }
  }
}

@media (max-width: 720px) {
  .preview-header {
    flex-direction: column;
  }

  .preview-badges {
    justify-content: flex-start;
  }
}
</style>
