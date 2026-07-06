<template>
  <dialog ref="dialogRef" class="modal image-model-settings">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost dialog-close-button" type="button" @click="handleClose">
          <SvgIcon :src="closeIcon" style="width: 24px; height: 24px" />
        </button>
      </form>
      <h3 class="settings-dialog-title">{{ t("image.settingsTitle") }}</h3>
      <div class="ims-container">
        <!-- Image size (always available; options depend on the selected model). -->
        <div class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ t("image.size") }}</span>
            <AppTooltip :text="t('image.sizeTip')" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <AppSelect v-model="selectedSize" class="ims-select" :options="sizeOptions" />
          </div>
        </div>

        <!-- Number of images to generate per request (always available). -->
        <div class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ t("image.count") }}</span>
            <AppTooltip :text="t('image.countTip')" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <input v-model.number="localSettings.n" type="range" min="1" max="4" step="1" class="range range-xs" />
            <input v-model.number="localSettings.n" type="number" min="1" max="4" class="input input-bordered" />
          </div>
        </div>

        <!-- Render provider-specific parameter fields from the active model definition. -->
        <div v-for="item in activeParamDefs" :key="item.key" class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ item.label || item.key }}</span>
            <AppTooltip v-if="getParamDescription(item)" :text="getParamDescription(item)" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <!-- Boolean toggle -->
            <template v-if="item.type === 'boolean'">
              <input v-model="localSettings[item.key]" type="checkbox" class="toggle toggle-primary" />
            </template>

            <!-- Everything else as text input -->
            <template v-else>
              <input v-model="localSettings[item.key]" type="text" class="input input-bordered ims-input-full" :placeholder="item.placeholder || item.key" />
            </template>
          </div>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import infoIcon from "@/assets/svg/info24.svg";
import closeIcon from "@/assets/svg/error24.svg";
import AppSelect from "@/components/AppSelect.vue";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import { getImageModelSizes, resolveImageParamDefs } from "@/models";
import type { ImageModelConfig, ImageModelParamDef } from "@/types";

export interface ImageSettingsData {
  size: string;
  n: number;
  [key: string]: unknown;
}

const props = defineProps<{
  model: ImageModelConfig | null;
  settings: ImageSettingsData;
}>();

const emit = defineEmits<{
  close: [settings: ImageSettingsData];
}>();

const { t } = useI18n();
const dialogRef = ref<HTMLDialogElement | null>(null);

const activeParamDefs = computed<ImageModelParamDef[]>(() => resolveImageParamDefs(props.model || undefined));

const availableSizes = computed<string[]>(() => getImageModelSizes(props.model || undefined));
const sizeOptions = computed(() => availableSizes.value.map((item) => ({ label: item, value: item })));
const selectedSize = computed({
  get: () => String(localSettings.size || availableSizes.value[0] || "1024x1024"),
  set: (value: string | number | null) => {
    localSettings.size = String(value || availableSizes.value[0] || "1024x1024");
  },
});

const localSettings = reactive<Record<string, unknown>>({ size: "1024x1024", n: 1 });

const getParamDescription = (item: ImageModelParamDef) => {
  if (item.descriptionKey) return t(item.descriptionKey);
  return item.description || "";
};

watch(
  () => [props.model, props.settings],
  () => {
    const defaults: Record<string, unknown> = {
      size: props.settings.size || availableSizes.value[0] || "1024x1024",
      n: props.settings.n ?? 1,
    };
    activeParamDefs.value.forEach((item) => {
      defaults[item.key] = props.settings[item.key] ?? item.defaultValue ?? "";
    });
    // Keep the currently selected size if it is still valid for this model.
    if (!availableSizes.value.includes(String(defaults.size))) {
      defaults.size = availableSizes.value[0] || "1024x1024";
    }
    Object.keys(localSettings).forEach((key) => delete localSettings[key]);
    Object.assign(localSettings, defaults);
  },
  { immediate: true, deep: true },
);

const handleClose = () => {
  const nextSettings: ImageSettingsData = {
    size: String(localSettings.size || availableSizes.value[0] || "1024x1024"),
    n: Number(localSettings.n) || 1,
  };
  activeParamDefs.value.forEach((item) => {
    nextSettings[item.key] = localSettings[item.key];
  });
  emit("close", nextSettings);
  dialogRef.value?.close();
};

const openDialog = () => {
  dialogRef.value?.showModal();
};

defineExpose({ openDialog });
</script>

<style lang="scss" scoped>
.image-model-settings {
  overflow: hidden;

  .modal-box {
    position: relative;
    width: min(664px, calc(100vw - 24px));
    max-width: none;
    max-height: min(88dvh, 760px);
    padding: 18px 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .dialog-close-button {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .settings-dialog-title {
    font-size: 1.125rem;
    line-height: 1.5;
    font-weight: 700;
    color: oklch(var(--bc));
  }

  .ims-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-height: min(64dvh, 450px);
    padding: 8px;
    overflow-y: auto;
  }

  .ims-setting-item {
    display: flex;
    flex-direction: row;
    width: min(596px, 100%);
    max-width: 100%;
    align-items: center;
    gap: 16px;
  }

  .ims-setting-label {
    width: 198px;
    font-size: 16px;
    text-align: right;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .ims-info-icon {
    width: 24px;
    height: 24px;
  }

  .ims-setting-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    width: 348px;
    gap: 8px;

    .input {
      width: 92px;
      max-width: 92px;
    }

    .ims-input-full {
      width: 100%;
      max-width: none;
    }
  }

  .ims-select {
    width: 100%;
    max-width: 220px;

    :deep(.app-select-control) {
      min-height: 32px;
      height: 32px;
      font-size: 14px;
    }
  }
}

@media (max-width: 720px) {
  .image-model-settings {
    .modal-box {
      width: min(100vw - 16px, 664px);
      max-height: calc(100dvh - 16px);
      padding: 14px 14px 12px;
      border-radius: 12px;
    }

    h3 {
      font-size: 1rem;
      line-height: 1.35;
    }

    .ims-container {
      max-height: calc(100dvh - 132px);
      padding: 6px 2px 2px;
      align-items: stretch;
    }

    .ims-setting-item {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid oklch(var(--bc) / 0.06);
    }

    .ims-setting-label {
      width: 100%;
      text-align: left;
      justify-content: space-between;
      font-size: 14px;
      gap: 6px;
    }

    .ims-info-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .ims-setting-content {
      width: 100%;
      flex-wrap: wrap;
      gap: 8px;

      .input {
        width: 100%;
        max-width: none;
        flex: 1 1 100%;
      }

      .range {
        width: 100%;
        flex: 1 1 100%;
      }
    }
  }
}
</style>
