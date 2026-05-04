<template>
  <aside class="workspace-side">
    <div class="prompt-card" :class="{ disabled: isGenerating }">
      <div class="card-header">
        <h3>{{ t("image.promptTitle") }}</h3>
        <span class="count-badge">{{ promptLength }}</span>
      </div>

      <div class="prompt-editor">
        <textarea
          class="textarea textarea-bordered prompt-input"
          :value="prompt"
          :placeholder="t('image.promptPlaceholder')"
          @input="emit('update:prompt', $event.target.value)"
          @keydown.enter="onEnterKeydown"
        ></textarea>
      </div>

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
          {{ t("image.generateAction") }}
        </button>
      </div>
    </div>

    <div class="gallery-card">
      <div class="card-header">
        <div>
          <h3>{{ t("image.galleryTitle") }}</h3>
          <p>{{ t("image.galleryDescription") }}</p>
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
          <img :src="img.src" :alt="img.prompt || 'Generated image'" crossOrigin="anonymous" />
        </button>
      </div>
      <div v-else class="gallery-empty">{{ t("image.galleryEmpty") }}</div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  prompt: {
    type: String,
    default: "",
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
});

const emit = defineEmits(["update:prompt", "send", "select-image"]);
const { t } = useI18n();
const promptLength = computed(() => props.prompt.trim().length);

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
  flex: 0 0 320px;
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
  min-height: 0;
  margin-top: 12px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: linear-gradient(180deg, oklch(var(--b1) / 0.96), oklch(var(--b2) / 0.88));
  box-shadow: inset 0 1px 0 oklch(var(--b1));
}

.prompt-input {
  width: 100%;
  max-width: 100%;
  display: block;
  min-height: 0 !important;
  height: 100%;
  resize: none;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  line-height: 1.7;
  box-shadow: none;
  box-sizing: border-box;
  overflow: auto;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;

  span {
    min-width: 0;
    border-radius: 12px;
    padding: 7px 8px;
    background: oklch(var(--b1) / 0.75);
    color: oklch(var(--bc) / 0.66);
    font-size: 11px;
    text-align: center;
    white-space: nowrap;
  }
}

.prompt-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
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
}
</style>
