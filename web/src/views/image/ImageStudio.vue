<template>
  <div class="image-studio" ref="dsAlertContainer">
    <div class="image-studio-main">
      <ImageSettingsPanel :mode="mode" :settings="imageModelSettings" :image-models="imageModels" @update:settings="updateImageSettings" />

      <ImagePreviewPanel
        ref="previewPanelRef"
        :selected-image="selectedImage"
        :is-generating="isGenerating"
        :status-label="generationStatusLabel"
        :size="imageModelSettings.size"
        :image-count="imageList.length"
        :prompt="imageModelSettings.prompt"
        :elapsed-seconds="elapsedSeconds"
        :show-edit-action="mode === 'generation'"
        @copy="copyToCli"
        @save="saveTo"
        @delete="deleteImg"
        @edit-image="emit('switch-to-edit', $event)"
      />

      <ImageWorkspacePanel
        :mode="mode"
        :prompt="imageModelSettings.prompt"
        :image-param-key="workspaceImageParamKey"
        :input-image="promptInputImage"
        :is-generating="isGenerating"
        :status-label="generationStatusLabel"
        :is-send-disabled="isSendDisabled"
        :selected-image-id="selectedImageId"
        :image-list="imageList"
        :usage="generationUsage"
        @update:prompt="updatePrompt"
        @update:input-image="updatePromptInputImage"
        @send="onSendImg"
        @select-image="onSelectImage"
        @request-edit-mode="emit('switch-to-edit')"
        @apply-brush-edit="applyBrushEdit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { buildDefaultImageSettings, buildImageGenerationParams, defImageModelSeting, getModelImageParamDefs, mergeImageSettingsWithModel } from "@/constants";
import { deleteImage, generateImage, getImageList, pushImage } from "@/services";
import { copyToClipboard, dsAlert, saveToLocal } from "@/utils";
import ImagePreviewPanel from "@/views/image/ImagePreviewPanel.vue";
import ImageSettingsPanel from "@/views/image/ImageSettingsPanel.vue";
import ImageWorkspacePanel from "@/views/image/ImageWorkspacePanel.vue";

const props = defineProps({
  mode: {
    type: String,
    default: "generation",
    validator: (value) => ["generation", "edit"].includes(value),
  },
  initialEditImage: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["switch-to-edit"]);
const store = useStore();
const { t } = useI18n();

const imageModels = computed(() => (isEditMode.value ? store.state.models.imageEdit : store.state.models.imageGeneration));
const imageList = computed(() => store.state.imageList);
const getImageId = (item) => String(item?.id ?? "");
const selectedImage = computed(() => imageList.value.find((item) => getImageId(item) === selectedImageId.value) || null);
const promptLength = computed(() => imageModelSettings.value.prompt.trim().length);
const isEditMode = computed(() => props.mode === "edit");
const generationStatusLabel = computed(() => {
  if (isGenerating.value) return isEditMode.value ? t("image.editing") : t("image.generating");
  return isEditMode.value ? t("image.editReady") : t("image.ready");
});
const promptImageParamDef = computed(() => {
  const imageParamDefs = getModelImageParamDefs(imageModelSettings.value.model || {}).filter((item) => item.type === "image");
  return imageParamDefs.find((item) => item.key === "image") || imageParamDefs[0] || null;
});
const promptImageParamKey = computed(() => promptImageParamDef.value?.key || "");
const maskImageParamDef = computed(() => {
  const imageParamDefs = getModelImageParamDefs(imageModelSettings.value.model || {}).filter((item) => item.type === "image");
  return imageParamDefs.find((item) => item.key === "mask") || null;
});
const maskImageParamKey = computed(() => maskImageParamDef.value?.key || "");
const workspaceImageParamKey = computed(() => (isEditMode.value ? promptImageParamKey.value : ""));
const promptInputImage = computed(() => {
  const key = workspaceImageParamKey.value;
  return key ? imageModelSettings.value[key] || null : null;
});
const isSendDisabled = computed(() => {
  if (isGenerating.value || !imageModelSettings.value.model || promptLength.value === 0) return true;
  if (!isEditMode.value) return false;
  return !workspaceImageParamKey.value || !promptInputImage.value;
});

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

const updatePromptInputImage = (inputImage) => {
  const key = workspaceImageParamKey.value;
  if (!key) return;

  imageModelSettings.value = mergeImageSettingsWithModel(imageModelSettings.value.model, {
    ...imageModelSettings.value,
    [key]: inputImage,
  });
};

const applyBrushEdit = ({ image, mask }) => {
  const imageKey = workspaceImageParamKey.value;
  const maskKey = maskImageParamKey.value;
  if (!imageKey) return;

  imageModelSettings.value = mergeImageSettingsWithModel(imageModelSettings.value.model, {
    ...imageModelSettings.value,
    [imageKey]: image,
    ...(maskKey ? { [maskKey]: mask } : {}),
  });
  dsAlert({ type: "success", message: t("image.brushMaskReady") });
};

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const convertImageBlobToPng = (blob) => {
  if (blob.type === "image/png") return Promise.resolve(blob);

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(objectUrl);
        pngBlob ? resolve(pngBlob) : reject(new Error("PNG conversion failed"));
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    image.src = objectUrl;
  });
};

const imageUrlToPngParam = async (src, filename = "edit-input.png") => {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const pngBlob = await convertImageBlobToPng(await response.blob());
  return {
    filename,
    content_type: "image/png",
    data: await blobToBase64(pngBlob),
  };
};

const loadInitialEditImage = async (image) => {
  if (!isEditMode.value || !image?.src || !workspaceImageParamKey.value) return;
  try {
    updatePromptInputImage(await imageUrlToPngParam(image.src, "generated-edit-input.png"));
  } catch (error) {
    dsAlert({ type: "error", message: t("image.editImagePrepareFailed", { error: String(error) }) });
  }
};

const onSelectImage = (id) => {
  selectedImageId.value = String(id);
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
  if (isEditMode.value && (!workspaceImageParamKey.value || !promptInputImage.value)) return;

  isGenerating.value = true;
  startGenerationTimer();

  try {
    const generationParams = buildImageGenerationParams(model, imageModelSettings.value);
    if (!isEditMode.value) {
      getModelImageParamDefs(model || {})
        .filter((item) => item.type === "image")
        .forEach((item) => {
          delete generationParams[item.key];
        });
    }
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
  await loadInitialEditImage(props.initialEditImage);
});

watch(
  () => props.initialEditImage?.id || props.initialEditImage?.src,
  () => {
    loadInitialEditImage(props.initialEditImage);
  },
);

watch(
  imageModels,
  (nextModels) => {
    if (imageModelSettings.value.model || !nextModels.length) return;
    imageModelSettings.value = {
      ...buildDefaultImageSettings(nextModels[0]),
      model: nextModels[0],
    };
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopGenerationTimer();
});
</script>

<style lang="scss" scoped>
.image-studio {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-studio-main {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 340px;
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .image-studio-main {
    grid-template-columns: 240px minmax(0, 1fr) 320px;
  }
}

@media (max-width: 980px) {
  .image-studio-main {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }
}

@media (max-width: 720px) {
  .image-studio-main {
    padding: 10px;
    gap: 10px;
  }
}
</style>
