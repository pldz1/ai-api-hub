<template>
  <aside class="workspace-side">
    <div class="prompt-card" :class="{ disabled: isGenerating }">
      <div class="card-header">
        <h3>{{ mode === "edit" ? t("image.editPromptTitle") : t("image.promptTitle") }}</h3>
        <span class="count-badge">{{ promptLength }}</span>
      </div>

      <div class="prompt-editor" :class="{ 'has-image': inputImagePreview }">
        <textarea
          class="textarea textarea-bordered prompt-input"
          :value="prompt"
          :placeholder="mode === 'edit' ? t('image.editPromptPlaceholder') : t('image.promptPlaceholder')"
          @input="emit('update:prompt', $event.target.value)"
          @paste="onPromptPaste"
          @keydown.enter="onEnterKeydown"
        ></textarea>

        <div v-if="inputImagePreview" class="prompt-image-preview">
          <div class="prompt-image-thumb">
            <img :src="inputImagePreview" :alt="inputImageLabel" />
          </div>
          <div class="prompt-image-meta">
            <span>{{ imageParamKey }}</span>
            <strong>{{ inputImageLabel }}</strong>
          </div>
          <button type="button" class="btn btn-sm btn-ghost prompt-image-clear" @click="emit('update:input-image', null)">
            {{ t("image.clearParamImage") }}
          </button>
        </div>
      </div>

      <ImageBrushEditor v-if="mode === 'edit' && inputImage" :source-image="inputImage" @apply="emit('apply-brush-edit', $event)" />

      <div class="usage-grid">
        <span>{{ t("image.inputTokens") }} {{ usage.input_tokens || 0 }}</span>
        <span>{{ t("image.outputTokens") }} {{ usage.output_tokens || 0 }}</span>
        <span>{{ t("image.totalTokens") }} {{ usage.total_tokens || 0 }}</span>
      </div>

      <div class="prompt-footer">
        <div class="status-row">
          <span class="status-dot" :class="{ generating: isGenerating }"></span>
          <span>{{ statusLabel }}</span>
        </div>

        <button class="btn btn-primary generate-btn" @click="emit('send')" :disabled="isSendDisabled">
          {{ mode === "edit" ? t("image.editAction") : t("image.generateAction") }}
        </button>
      </div>
    </div>

    <div class="gallery-card">
      <div class="card-header">
        <div>
          <h3>{{ t("image.galleryTitle") }}</h3>
          <p>{{ mode === "edit" ? t("image.editGalleryDescription") : t("image.galleryDescription") }}</p>
        </div>
        <span class="count-badge">{{ imageList.length }}</span>
      </div>

      <div v-if="imageList.length > 0" class="gallery-list">
        <button
          v-for="img in imageList"
          :key="String(img.id)"
          type="button"
          class="gallery-item"
          :class="{ active: selectedImageId === String(img.id) }"
          @click="emit('select-image', String(img.id))"
        >
          <img :src="img.src" :alt="img.prompt || t('image.generatedAlt')" crossOrigin="anonymous" />
        </button>
      </div>
      <div v-else class="gallery-empty">{{ t("image.galleryEmpty") }}</div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { dsAlert } from "@/utils";
import ImageBrushEditor from "@/views/image/ImageBrushEditor.vue";

const props = defineProps({
  prompt: {
    type: String,
    default: "",
  },
  imageParamKey: {
    type: String,
    default: "",
  },
  inputImage: {
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
  isSendDisabled: {
    type: Boolean,
    default: false,
  },
  selectedImageId: {
    type: String,
    default: null,
  },
  imageList: {
    type: Array,
    default: () => [],
  },
  usage: {
    type: Object,
    default: () => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }),
  },
  mode: {
    type: String,
    default: "generation",
  },
});

const emit = defineEmits(["update:prompt", "update:input-image", "send", "select-image", "request-edit-mode", "apply-brush-edit"]);
const { t } = useI18n();
const promptLength = computed(() => props.prompt.trim().length);
const inputImageLabel = computed(() => props.inputImage?.filename || t("image.noParamImage"));
const inputImagePreview = computed(() => {
  if (!props.inputImage?.data) return "";
  return `data:${props.inputImage.content_type || "image/png"};base64,${props.inputImage.data}`;
});

const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const getPastedImageFile = (event) => {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
  return imageItem?.getAsFile() || null;
};

const buildPastedImageName = (file) => {
  if (file.name) return file.name;
  const extension = (file.type || "image/png").split("/")[1] || "png";
  return `pasted-image.${extension}`;
};

const onPromptPaste = async (event) => {
  const file = getPastedImageFile(event);
  if (!file) return;

  event.preventDefault();

  if (!props.imageParamKey) {
    if (props.mode === "generation") {
      dsAlert({ type: "info", message: t("image.pasteImageUseEdit") });
      emit("request-edit-mode");
    }
    return;
  }

  try {
    emit("update:input-image", {
      filename: buildPastedImageName(file),
      content_type: file.type || "image/png",
      data: await readFileAsBase64(file),
    });
  } catch (error) {
    dsAlert({ type: "error", message: t("image.paramImageReadFailed", { error: String(error) }) });
  }
};

const onEnterKeydown = async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    emit("send");
  }
};
</script>

<style lang="scss" scoped>
.workspace-side {
  height: 100%;
  align-self: stretch;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.workspace-side > * {
  border: 1px solid oklch(var(--bc) / 0.08);
  background: linear-gradient(180deg, oklch(var(--b1) / 0.94), oklch(var(--b2) / 0.9));
  box-shadow: 0 20px 48px oklch(var(--bc) / 0.06);
  backdrop-filter: blur(18px);
}

.prompt-card,
.gallery-card {
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  border-radius: 22px;
}

.prompt-card,
.gallery-card {
  display: flex;
  flex-direction: column;
}

.prompt-card {
  flex: 0 0 390px;
  overflow-y: auto;
}

.gallery-card {
  flex: 1 1 auto;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.card-header {
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

.count-badge {
  min-width: 34px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b1) / 0.86);
  font-size: 12px;
  font-weight: 700;
  color: oklch(var(--bc) / 0.7);
  text-align: center;
}

.prompt-editor {
  flex: 1 1 auto;
  min-height: 176px;
  margin-top: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 20px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background: oklch(var(--b1) / 0.74);
  box-shadow:
    inset 0 1px 0 oklch(var(--b1) / 0.9),
    0 12px 28px oklch(var(--bc) / 0.035);

  &.has-image {
    min-height: 204px;
  }
}

.prompt-input {
  width: 100%;
  max-width: 100%;
  flex: 1 1 auto;
  display: block;
  min-height: 104px !important;
  height: 100%;
  resize: none;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 14px;
  background: oklch(var(--b1) / 0.9);
  padding: 10px 12px;
  line-height: 1.6;
  box-shadow: none;
  box-sizing: border-box;
  overflow: auto;

  &:focus {
    outline: 2px solid oklch(var(--p) / 0.18);
    outline-offset: 0;
    border-color: oklch(var(--p) / 0.28);
  }
}

.prompt-image-preview {
  flex: 0 0 auto;
  min-height: 70px;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 8px;
  border-radius: 16px;
  border: 1px solid oklch(var(--bc) / 0.09);
  background: linear-gradient(180deg, oklch(var(--b1) / 0.94), oklch(var(--b2) / 0.72));
  box-shadow: inset 0 1px 0 oklch(var(--b1) / 0.9);

  img {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 12px;
    object-fit: cover;
    background: oklch(var(--b2));
  }
}

.prompt-image-thumb {
  width: 64px;
  height: 54px;
  padding: 3px;
  border-radius: 14px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background:
    linear-gradient(45deg, oklch(var(--bc) / 0.04) 25%, transparent 25%), linear-gradient(-45deg, oklch(var(--bc) / 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(var(--bc) / 0.04) 75%), linear-gradient(-45deg, transparent 75%, oklch(var(--bc) / 0.04) 75%);
  background-color: oklch(var(--b1));
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0;
  background-size: 12px 12px;
}

.prompt-image-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  span {
    width: fit-content;
    max-width: 100%;
    padding: 3px 7px;
    border-radius: 999px;
    background: oklch(var(--bc) / 0.06);
    font-size: 10px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.62);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 1.35;
    color: oklch(var(--bc) / 0.82);
  }
}

.prompt-image-clear {
  min-height: 34px;
  height: 34px;
  padding-inline: 10px;
  border-radius: 10px;
  color: oklch(var(--bc) / 0.72);
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;

  span {
    min-width: 0;
    border-radius: 14px;
    padding: 8px 10px;
    border: 1px solid oklch(var(--bc) / 0.06);
    background: oklch(var(--b1) / 0.64);
    color: oklch(var(--bc) / 0.66);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
  }
}

.prompt-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding-top: 14px;
  border-top: 1px solid oklch(var(--bc) / 0.08);
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-size: 13px;
  color: oklch(var(--bc) / 0.68);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;

  &.generating {
    background: #3b82f6;
  }
}

.generate-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, oklch(0.55 0.26 286), oklch(0.66 0.24 245));
  border: 0;
  box-shadow: 0 18px 34px oklch(0.56 0.18 255 / 0.24);
}

.gallery-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 128px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
  overflow: auto;
  padding-right: 2px;
}

.gallery-item {
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b1) / 0.84);

  img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  &.active {
    border-color: oklch(var(--p) / 0.32);
    box-shadow: 0 0 0 3px oklch(var(--p) / 0.12);
  }
}

.gallery-empty {
  margin-top: 12px;
  color: oklch(var(--bc) / 0.56);
}

@media (max-width: 1200px) {
  .gallery-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .workspace-side {
    height: auto;
  }

  .prompt-card,
  .gallery-card {
    flex: 0 0 auto;
  }
}

@media (max-width: 720px) {
  .gallery-list {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
  }

  .prompt-image-preview {
    grid-template-columns: 56px minmax(0, 1fr);

    .prompt-image-clear {
      grid-column: 1 / -1;
      width: 100%;
    }
  }

  .prompt-image-thumb {
    width: 56px;
    height: 50px;
  }
}
</style>
