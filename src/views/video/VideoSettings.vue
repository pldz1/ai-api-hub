<template>
  <dialog ref="dialogRef" class="modal video-model-settings">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost dialog-close-button" type="button" @click="handleClose">
          <SvgIcon :src="closeIcon" style="width: 24px; height: 24px" />
        </button>
      </form>
      <h3 class="settings-dialog-title">{{ t("video.settingsTitle") }}</h3>
      <div class="vms-container">
        <!-- Resolution -->
        <div class="vms-setting-item">
          <div class="vms-setting-label">
            <span>{{ t("video.resolution") }}</span>
            <AppTooltip :text="t('video.resolutionTip')" placement="bottom">
              <SvgIcon class="vms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="vms-setting-content">
            <AppSelect v-model="localSettings.resolution" class="vms-select" :options="resolutionOptions" />
          </div>
        </div>

        <!-- Duration -->
        <div class="vms-setting-item">
          <div class="vms-setting-label">
            <span>{{ t("video.duration") }}</span>
            <AppTooltip :text="t('video.durationTip')" placement="bottom">
              <SvgIcon class="vms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="vms-setting-content">
            <input v-model.number="localSettings.duration" type="range" min="5" max="10" step="5" class="range range-xs" />
            <input v-model.number="localSettings.duration" type="number" min="5" max="10" class="input input-bordered" />
          </div>
        </div>

        <!-- Dynamic params from model definition -->
        <div v-for="item in activeParamDefs" :key="item.key" class="vms-setting-item">
          <div class="vms-setting-label">
            <span>{{ item.label || item.key }}</span>
            <AppTooltip v-if="getParamDescription(item)" :text="getParamDescription(item)" placement="bottom">
              <SvgIcon class="vms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="vms-setting-content">
            <template v-if="item.type === 'boolean'">
              <input v-model="localSettings[item.key]" type="checkbox" class="toggle toggle-primary" />
            </template>
            <template v-else>
              <input v-model="localSettings[item.key]" type="text" class="input input-bordered vms-input-full" :placeholder="item.placeholder || item.key" />
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
import { getVideoModelResolutions, resolveVideoParamDefs } from "@/models";
import type { VideoModelConfig, VideoModelParamDef } from "@/types";

export interface VideoSettingsData {
  resolution: string;
  duration: number;
  [key: string]: unknown;
}

const props = defineProps<{
  model: VideoModelConfig | null;
  settings: VideoSettingsData;
}>();

const emit = defineEmits<{
  close: [settings: VideoSettingsData];
}>();

const { t } = useI18n();
const dialogRef = ref<HTMLDialogElement | null>(null);

const localSettings = reactive<VideoSettingsData>({
  resolution: props.settings?.resolution || "720P",
  duration: props.settings?.duration || 5,
});

const availableResolutions = computed(() => getVideoModelResolutions(props.model as unknown as Record<string, unknown> | null));
const resolutionOptions = computed(() => availableResolutions.value.map((item) => ({ label: item, value: item })));

const activeParamDefs = computed(() =>
  resolveVideoParamDefs(props.model as unknown as Record<string, unknown> | null).filter(
    (item) => item.key !== "first_frame" && item.key !== "resolution" && item.key !== "duration",
  ),
);

function getParamDescription(item: VideoModelParamDef): string {
  return item.descriptionKey ? t(item.descriptionKey as string) : item.description || "";
}

watch(
  () => [props.model, props.settings],
  () => {
    localSettings.resolution = props.settings?.resolution || availableResolutions.value[0] || "720P";
    localSettings.duration = props.settings?.duration || 5;
    activeParamDefs.value.forEach((item) => {
      localSettings[item.key] = props.settings[item.key] ?? item.defaultValue ?? "";
    });
  },
  { deep: true },
);

function openDialog() {
  localSettings.resolution = props.settings?.resolution || availableResolutions.value[0] || "720P";
  localSettings.duration = props.settings?.duration || 5;
  activeParamDefs.value.forEach((item) => {
    localSettings[item.key] = props.settings[item.key] ?? item.defaultValue ?? "";
  });
  dialogRef.value?.showModal();
}

function handleClose() {
  dialogRef.value?.close();
  emit("close", { ...localSettings });
}

defineExpose({ openDialog });
</script>

<style lang="scss" scoped>
.video-model-settings {
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

  .vms-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-height: min(64dvh, 450px);
    padding: 8px;
    overflow-y: auto;
  }

  .vms-setting-item {
    display: flex;
    flex-direction: row;
    width: min(596px, 100%);
    max-width: 100%;
    align-items: center;
    gap: 16px;
  }

  .vms-setting-label {
    width: 198px;
    font-size: 16px;
    text-align: right;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .vms-info-icon {
    width: 24px;
    height: 24px;
  }

  .vms-setting-content {
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

    .vms-input-full {
      width: 100%;
      max-width: none;
    }
  }

  .vms-select {
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
  .video-model-settings {
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

    .vms-container {
      max-height: calc(100dvh - 132px);
      padding: 6px 2px 2px;
      align-items: stretch;
    }

    .vms-setting-item {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid oklch(var(--bc) / 0.06);
    }

    .vms-setting-label {
      width: 100%;
      text-align: left;
      justify-content: space-between;
      font-size: 14px;
      gap: 6px;
    }

    .vms-info-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .vms-setting-content {
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
