<template>
  <div class="image-homepage-container" ref="dsAlertContainer">
    <div class="ihpc-header">
      <HeaderBar></HeaderBar>
    </div>

    <div class="ihpc-main">
      <ImageSettingsPanel
        :settings="imageModelSettings"
        :image-models="imageModels"
        @update:settings="updateImageSettings"
        @open-settings="openImageModelSettings"
      />

      <ImagePreviewPanel
        ref="previewPanelRef"
        :selected-image="selectedImage"
        :is-generating="isGenerating"
        :status-label="generationStatusLabel"
        :size="imageModelSettings.size"
        :image-count="imageList.length"
        :prompt="imageModelSettings.prompt"
        :elapsed-seconds="elapsedSeconds"
        @copy="copyToCli"
        @save="saveTo"
        @delete="deleteImg"
      />

      <ImageWorkspacePanel
        :prompt="imageModelSettings.prompt"
        :is-generating="isGenerating"
        :status-label="generationStatusLabel"
        :is-send-disabled="isSendDisabled"
        :selected-image-id="selectedImageId"
        :image-list="imageList"
        :usage="generationUsage"
        @update:prompt="updatePrompt"
        @send="onSendImg"
        @select-image="onSelectImage"
      />
    </div>
  </div>

  <ImageGenerationSettings :model="imageModelSettings.model" :settings="imageModelSettings" @update:settings="updateImageSettings" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { buildDefaultImageSettings, buildImageGenerationParams, defImageModelSeting, mergeImageSettingsWithModel } from "@/constants";
import { deleteImage, generateImage, getImageList, pushImage } from "@/services";
import { copyToClipboard, dsAlert, saveToLocal } from "@/utils";
import HeaderBar from "@/components/HeaderBar.vue";
import ImageGenerationSettings from "@/views/image/ImageGenerationSettings.vue";
import ImagePreviewPanel from "@/views/image/ImagePreviewPanel.vue";
import ImageSettingsPanel from "@/views/image/ImageSettingsPanel.vue";
import ImageWorkspacePanel from "@/views/image/ImageWorkspacePanel.vue";

const store = useStore();
const { t } = useI18n();

const imageModels = computed(() => store.state.models.image);
const imageList = computed(() => store.state.imageList);
const getImageId = (item) => String(item?.id ?? "");
const selectedImage = computed(() => imageList.value.find((item) => getImageId(item) === selectedImageId.value) || null);
const promptLength = computed(() => imageModelSettings.value.prompt.trim().length);
const generationStatusLabel = computed(() => (isGenerating.value ? t("image.generating") : t("image.ready")));
const isSendDisabled = computed(() => isGenerating.value || !imageModelSettings.value.model || promptLength.value === 0);

const imageModelSettings = ref(structuredClone(defImageModelSeting));
const generationUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
const elapsedSeconds = ref(0);
const isGenerating = ref(false);
const dsAlertContainer = ref(null);
const selectedImageId = ref(null);
const previewPanelRef = ref(null);
let generationTimer = null;

const selectedImageElement = computed(() => {
  const exposedImageRef = previewPanelRef.value?.selectedImageRef;
  return exposedImageRef?.value || exposedImageRef || null;
});

const updateImageSettings = (nextSettings) => {
  imageModelSettings.value = mergeImageSettingsWithModel(nextSettings.model || imageModelSettings.value.model, nextSettings);
};

const updatePrompt = (prompt) => {
  imageModelSettings.value = {
    ...imageModelSettings.value,
    prompt,
  };
};

const onSelectImage = (id) => {
  selectedImageId.value = String(id);
};

const openImageModelSettings = () => {
  if (!imageModelSettings.value.model) {
    dsAlert({ type: "warn", message: t("image.chooseModelFirst"), container: dsAlertContainer.value });
    return;
  }
  document.getElementById("global_image_model_settings")?.showModal();
};

const startGenerationTimer = () => {
  elapsedSeconds.value = 0;
  const startedAt = performance.now();
  generationTimer = window.setInterval(() => {
    elapsedSeconds.value = (performance.now() - startedAt) / 1000;
  }, 100);
};

const stopGenerationTimer = () => {
  if (generationTimer) {
    window.clearInterval(generationTimer);
    generationTimer = null;
  }
};

const onSendImg = async () => {
  const { prompt, size, n, model } = imageModelSettings.value;
  if (!model || !prompt.trim() || isGenerating.value) return;

  isGenerating.value = true;
  startGenerationTimer();

  try {
    const generationParams = buildImageGenerationParams(model, imageModelSettings.value);
    const result = await generateImage(model, {
      ...generationParams,
      prompt,
      size,
      n,
      outputFormat: generationParams.output_format,
    });
    generationUsage.value = result.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    imageModelSettings.value.prompt = "";

    for (const item of result.images || []) {
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
    stopGenerationTimer();
  }
};

const copyToCli = async () => {
  if (!selectedImageElement.value) return;
  const flag = await copyToClipboard(selectedImageElement.value);

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
    const next = imageList.value.find((item) => getImageId(item) !== deletedId);
    selectedImageId.value = next ? getImageId(next) : null;
  }
};

const saveTo = async () => {
  if (!selectedImageElement.value) return;
  const flag = await saveToLocal(selectedImageElement.value);

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
    const exists = nextList.some((item) => getImageId(item) === selectedImageId.value);
    if (!exists) {
      selectedImageId.value = getImageId(nextList[0]);
    }
  },
  { immediate: true },
);

watch(
  () => imageModelSettings.value.model,
  (model, oldModel) => {
    if (!model || model === oldModel) return;
    const prompt = imageModelSettings.value.prompt || "";
    imageModelSettings.value = {
      ...buildDefaultImageSettings(model),
      model,
      prompt,
    };
  },
);

onMounted(async () => {
  await getImageList();
  if (!imageModelSettings.value.model && imageModels.value.length > 0) {
    imageModelSettings.value = {
      ...buildDefaultImageSettings(imageModels.value[0]),
      model: imageModels.value[0],
    };
  }
});

onBeforeUnmount(() => {
  stopGenerationTimer();
});
</script>

<style lang="scss" scoped>
.image-homepage-container {
  --image-header-height: 48px;
  --image-footer-height: 0px;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.05), transparent 26%),
    radial-gradient(circle at bottom right, oklch(var(--a) / 0.05), transparent 28%), linear-gradient(180deg, oklch(var(--b2) / 0.96), oklch(var(--b1)));
}

.ihpc-header {
  height: var(--image-header-height);
  flex: 0 0 auto;
}

.ihpc-main {
  flex: 1 1 auto;
  height: calc(100dvh - var(--image-header-height) - var(--image-footer-height));
  min-height: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 340px;
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .ihpc-main {
    grid-template-columns: 240px minmax(0, 1fr) 320px;
  }
}

@media (max-width: 980px) {
  .ihpc-main {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }
}

@media (max-width: 720px) {
  .ihpc-main {
    padding: 10px;
    gap: 10px;
  }
}
</style>
