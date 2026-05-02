<template>
  <div class="image-homepage-container" ref="dsAlertContainer">
    <div class="ihpc-header">
      <HeaderBar></HeaderBar>
    </div>

    <div class="ihpc-main">
      <aside class="settings-panel">
        <h2>{{ t("image.settingsTitle") }}</h2>

        <div class="setting-block">
          <span class="setting-label">{{ t("image.model") }}</span>
          <select class="select select-bordered" v-model="imageModelSettings.model">
            <option :value="null" disabled>{{ t("image.selectModel") }}</option>
            <option v-for="imm in imageModels" :value="imm" :key="imm.name || imm.id || imm.value">
              {{ imm.name || t("common.unnamedModel") }}
            </option>
          </select>
        </div>

        <div class="setting-grid">
          <div class="setting-block">
            <span class="setting-label">{{ t("image.count") }}</span>
            <select class="select select-bordered" v-model="imageModelSettings.n">
              <option :value="1">1</option>
              <option :value="2">2</option>
              <option :value="4">4</option>
            </select>
          </div>

          <div class="setting-block">
            <span class="setting-label">{{ t("image.size") }}</span>
            <select class="select select-bordered" v-model="imageModelSettings.size">
              <option v-for="imsz in imageModelSize" :key="imsz.value" :value="imsz.value">
                {{ imsz.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="ratio-grid">
          <button
            v-for="option in imageModelSize"
            :key="option.value"
            type="button"
            class="ratio-card"
            :class="{ active: imageModelSettings.size === option.value }"
            @click="imageModelSettings.size = option.value"
          >
            <span class="ratio-box" :class="sizeShapeClass(option.value)"></span>
            <strong>{{ sizeAlias(option.value) }}</strong>
          </button>
        </div>
      </aside>

      <section class="preview-panel">
        <div class="preview-header">
          <div>
            <h3>{{ t("image.previewTitle") }}</h3>
            <p>{{ selectedImage?.prompt || t("image.emptyHint") }}</p>
          </div>

          <div class="preview-badges">
            <span>{{ generationStatusLabel }}</span>
            <span>{{ imageModelSettings.size }}</span>
            <span>{{ imageList.length }} {{ t("image.outputs") }}</span>
          </div>
        </div>

        <div class="preview-stage">
          <div v-if="isGenerating" class="stage-state stage-loading">
            <div class="preview-skeleton"></div>
            <h4>{{ t("image.generating") }}</h4>
            <p>{{ imageModelSettings.prompt || t("image.generatingHint") }}</p>
          </div>

          <template v-else-if="selectedImage">
            <img ref="selectedImageRef" :src="selectedImage.src" :alt="selectedImage.prompt || 'Generated image'" crossOrigin="anonymous" />
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

      <aside class="workspace-side">
        <div class="prompt-card" :class="{ disabled: isGenerating }">
          <div class="card-header">
            <h3>{{ t("image.promptTitle") }}</h3>
            <span class="count-badge">{{ promptLength }}</span>
          </div>

          <div class="prompt-editor">
            <textarea
              class="textarea textarea-bordered prompt-input"
              v-model="imageModelSettings.prompt"
              :placeholder="t('image.promptPlaceholder')"
              @keydown.enter="onEnterKeydown"
            ></textarea>
          </div>

          <div class="prompt-footer">
            <div class="status-row">
              <span class="status-dot" :class="{ generating: isGenerating }"></span>
              <span>{{ generationStatusLabel }}</span>
            </div>

            <button class="btn btn-primary generate-btn" @click="onSendImg" :disabled="isSendDisabled">
              {{ t("image.generateAction") }}
            </button>
          </div>
        </div>

        <div class="action-card" :class="{ disabled: !selectedImageId }">
          <button class="action-btn" @click="copyToCli">
            <SvgIcon class="action-icon" :src="copyIcon" />
            <span>{{ t("image.copyClipboard") }}</span>
          </button>
          <button class="action-btn" @click="saveTo">
            <SvgIcon class="action-icon" :src="saveIcon" />
            <span>{{ t("image.saveLocal") }}</span>
          </button>
          <button class="action-btn danger" @click="deleteImg">
            <SvgIcon class="action-icon" :src="deleteIcon" />
            <span>{{ t("image.deleteImage") }}</span>
          </button>
        </div>

        <div class="gallery-card">
          <div class="card-header">
            <div>
              <h3>{{ t("image.galleryTitle") }}</h3>
              <p>{{ t("image.galleryDescription") }}</p>
            </div>
            <span class="count-badge">{{ imageList.length }}</span>
          </div>

          <div v-if="hasImages" class="gallery-list">
            <button
              v-for="img in imageList"
              :key="img.id"
              type="button"
              class="gallery-item"
              :class="{ active: selectedImageId === img.id }"
              @click="onSelectImage(img.id)"
            >
              <img :src="img.src" :alt="img.prompt || 'Generated image'" crossOrigin="anonymous" />
            </button>
          </div>
          <div v-else class="gallery-empty">{{ t("image.galleryEmpty") }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import editIcon from "@/assets/svg/edit24.svg";
import saveIcon from "@/assets/svg/save18.svg";
import { imageModelSize, defImageModelSeting } from "@/constants";
import { deleteImage, generateImage, getImageList, pushImage } from "@/services";
import { copyToClipboard, dsAlert, saveToLocal } from "@/utils";
import HeaderBar from "@/components/HeaderBar.vue";
import SvgIcon from "@/components/SvgIcon.vue";

const store = useStore();
const { t } = useI18n();

const imageModels = computed(() => store.state.models.image);
const imageList = computed(() => store.state.imageList);
const hasImages = computed(() => imageList.value.length > 0);
const selectedImage = computed(() => imageList.value.find((item) => item.id === selectedImageId.value) || null);
const promptLength = computed(() => imageModelSettings.value.prompt.trim().length);
const generationStatusLabel = computed(() => (isGenerating.value ? t("image.generating") : t("image.ready")));
const isSendDisabled = computed(() => isGenerating.value || !imageModelSettings.value.model || promptLength.value === 0);

const imageModelSettings = ref(structuredClone(defImageModelSeting));
const isGenerating = ref(false);
const dsAlertContainer = ref(null);
const selectedImageId = ref(null);
const selectedImageRef = ref(null);

const onSelectImage = (id) => {
  selectedImageId.value = id;
};

const sizeAlias = (value) => {
  if (value === "1024x1024") return "1:1";
  if (value === "1024x1792") return "4:7";
  if (value === "1792x1024") return "7:4";
  return value;
};

const sizeShapeClass = (value) => {
  if (value === "1024x1792") return "portrait";
  if (value === "1792x1024") return "landscape";
  return "square";
};

const onEnterKeydown = async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await onSendImg();
  }
};

const onSendImg = async () => {
  const { prompt, size, n, model } = imageModelSettings.value;
  if (!model || !prompt.trim()) return;

  isGenerating.value = true;

  try {
    const urls = await generateImage(model, {
      prompt,
      size,
      n,
      quality: imageModelSettings.value.quality,
    });
    imageModelSettings.value.prompt = "";

    for (const item of urls) {
      if (item.type === "url") {
        await pushImage(prompt, item.data);
      } else {
        imageModelSettings.value.prompt = prompt;
        dsAlert({
          type: "error",
          message: item.data,
          container: dsAlertContainer.value,
        });
      }
    }
  } catch (err) {
    dsAlert({
      type: "error",
      message: t("image.initError", { error: String(err) }),
      container: dsAlertContainer.value,
    });
  } finally {
    isGenerating.value = false;
  }
};

const copyToCli = async () => {
  if (!selectedImageRef.value) return;
  const flag = await copyToClipboard(selectedImageRef.value);

  dsAlert({
    type: flag ? "info" : "error",
    message: flag ? t("image.copied") : t("image.copyFailed"),
    container: dsAlertContainer.value,
  });
};

const deleteImg = async () => {
  if (!selectedImageId.value) return;
  const deletedId = selectedImageId.value;
  await deleteImage(deletedId);
  if (selectedImageId.value === deletedId) {
    const next = imageList.value.find((item) => item.id !== deletedId);
    selectedImageId.value = next?.id || null;
  }
};

const saveTo = async () => {
  if (!selectedImageRef.value) return;
  const flag = await saveToLocal(selectedImageRef.value);

  dsAlert({
    type: flag ? "info" : "error",
    message: flag ? t("image.savedLocal") : t("image.saveFailed"),
    container: dsAlertContainer.value,
  });
};

watch(
  imageList,
  (nextList) => {
    if (!nextList.length) {
      selectedImageId.value = null;
      return;
    }
    const exists = nextList.some((item) => item.id === selectedImageId.value);
    if (!exists) {
      selectedImageId.value = nextList[0].id;
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await getImageList();
  if (!imageModelSettings.value.model && imageModels.value.length > 0) {
    imageModelSettings.value.model = imageModels.value[0];
  }
});
</script>

<style lang="scss" scoped>
.image-homepage-container {
  --image-header-height: 48px;
  --image-footer-height: 24px;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.05), transparent 26%),
    radial-gradient(circle at bottom right, oklch(var(--a) / 0.05), transparent 28%), linear-gradient(180deg, oklch(var(--b2) / 0.96), oklch(var(--b1)));

  .ihpc-header {
    height: var(--image-header-height);
    flex: 0 0 auto;
  }

  .disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .ihpc-main {
    flex: 0 0 auto;
    height: calc(100dvh - var(--image-header-height) - var(--image-footer-height));
    min-height: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 300px;
    gap: 14px;
    padding: 14px;
  }

  .settings-panel,
  .preview-panel,
  .workspace-side > * {
    border: 1px solid oklch(var(--bc) / 0.08);
    background: linear-gradient(180deg, oklch(var(--b1) / 0.94), oklch(var(--b2) / 0.9));
    box-shadow: 0 20px 48px oklch(var(--bc) / 0.06);
    backdrop-filter: blur(18px);
  }

  .settings-panel,
  .preview-panel,
  .prompt-card,
  .action-card,
  .gallery-card {
    border-radius: 22px;
  }

  .settings-panel {
    height: 100%;
    min-height: 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: auto;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
    }
  }

  .setting-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.58);
  }

  :deep(.select) {
    width: 100%;
    max-width: none;
    min-height: 42px;
    height: 42px;
    border-radius: 14px;
    border: 1px solid oklch(var(--bc) / 0.1);
    background: oklch(var(--b1) / 0.9);
    font-size: 14px;
  }

  .ratio-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .ratio-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 6px;
    border-radius: 14px;
    border: 1px solid oklch(var(--bc) / 0.08);
    background: oklch(var(--b1) / 0.8);

    &.active {
      border-color: oklch(var(--p) / 0.3);
      box-shadow: 0 0 0 3px oklch(var(--p) / 0.12);
    }

    strong {
      font-size: 10px;
      color: oklch(var(--bc) / 0.72);
    }
  }

  .ratio-box {
    display: block;
    border: 1.5px solid oklch(var(--bc) / 0.45);
    border-radius: 4px;

    &.square {
      width: 20px;
      height: 20px;
    }

    &.portrait {
      width: 15px;
      height: 24px;
    }

    &.landscape {
      width: 24px;
      height: 15px;
    }
  }

  .preview-panel {
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preview-header,
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
    display: grid;
    place-items: center;
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(180deg, oklch(var(--b1) / 0.92), oklch(var(--b2) / 0.84));

    img {
      max-width: 100%;
      max-height: 100%;
      border-radius: 18px;
      object-fit: contain;
      box-shadow: 0 24px 60px oklch(var(--bc) / 0.16);
    }
  }

  .stage-state {
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
    background: linear-gradient(135deg, oklch(var(--b2)), oklch(var(--b1)));
    position: relative;
    overflow: hidden;
  }

  .preview-skeleton::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, oklch(var(--b1) / 0.7), transparent);
    animation: shimmer 1.5s linear infinite;
  }

  .workspace-side {
    height: 100%;
    align-self: stretch;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }

  .prompt-card,
  .action-card,
  .gallery-card {
    min-height: 0;
    padding: 16px;
    overflow: hidden;
  }

  .prompt-card,
  .gallery-card {
    display: flex;
    flex-direction: column;
  }

  .prompt-card {
    flex: 0 0 280px;
  }

  .action-card {
    flex: 0 0 auto;
  }

  .gallery-card {
    flex: 1 1 auto;
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

  .action-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 54px;
    padding: 0 16px;
    border-radius: 16px;
    border: 1px solid oklch(var(--bc) / 0.12);
    background: oklch(var(--b1) / 0.88);
    color: oklch(var(--bc) / 0.72);
    transition:
      border-color 0.18s ease,
      transform 0.18s ease,
      background 0.18s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: oklch(var(--bc) / 0.22);
      background: oklch(var(--b1));
    }

    &.danger {
      color: oklch(0.68 0.18 22);
      border-color: oklch(0.78 0.08 22 / 0.7);
    }
  }

  .action-icon {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    :deep(.svg-icon) {
      width: 18px;
      height: 18px;
      display: block;
    }
  }

  .gallery-list {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
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
      aspect-ratio: 1;
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

  @keyframes shimmer {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }

  @media (max-width: 1200px) {
    .ihpc-main {
      grid-template-columns: 240px minmax(0, 1fr) 280px;
    }

    .gallery-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 980px) {
    .ihpc-main {
      grid-template-columns: 1fr;
      height: auto;
      max-height: none;
    }

    .workspace-side {
      height: auto;
    }

    .prompt-card,
    .gallery-card {
      flex: 0 0 auto;
    }

    .preview-stage {
      min-height: 380px;
    }
  }

  @media (max-width: 720px) {
    .ihpc-main {
      padding: 10px;
      gap: 10px;
    }

    .ratio-grid,
    .gallery-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .preview-header,
    .card-header {
      flex-direction: column;
    }

    .preview-badges {
      justify-content: flex-start;
    }
  }
}
</style>
