<template>
  <dialog ref="dialogRef" class="modal video-model-settings">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" type="button" @click="handleClose">
          <SvgIcon :src="closeIcon" style="width: 24px; height: 24px" />
        </button>
      </form>
      <h3 class="text-lg font-bold">{{ t("video.settingsTitle") }}</h3>
      <div class="ims-container">
        <div class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ t("video.resolution") }}</span>
            <AppTooltip :text="t('video.resolutionTip')" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <select v-model="localSettings.resolution" class="ims-select">
              <option v-for="item in availableResolutions" :key="item" :value="item">{{ item }}</option>
            </select>
          </div>
        </div>

        <div class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ t("video.duration") }}</span>
            <AppTooltip :text="t('video.durationTip')" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <input v-model.number="localSettings.duration" type="range" min="5" max="10" step="5" class="range range-xs" />
            <span style="margin-left: 12px">{{ localSettings.duration }}s</span>
          </div>
        </div>

        <div v-for="item in activeParamDefs" :key="item.key" class="ims-setting-item">
          <div class="ims-setting-label">
            <span>{{ item.label || item.key }}</span>
            <AppTooltip v-if="getParamDescription(item)" :text="getParamDescription(item)" placement="bottom">
              <SvgIcon class="ims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="ims-setting-content">
            <template v-if="item.type === 'boolean'">
              <input v-model="localSettings[item.key]" type="checkbox" class="toggle toggle-primary" />
            </template>
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

const availableResolutions = computed(() =>
  getVideoModelResolutions(props.model as unknown as Record<string, unknown> | null),
);

const activeParamDefs = computed(() =>
  resolveVideoParamDefs(props.model as unknown as Record<string, unknown> | null).filter(
    (item) => item.key !== "first_frame" && item.key !== "resolution" && item.key !== "duration",
  ),
);

function getParamDescription(item: VideoModelParamDef): string {
  return item.descriptionKey ? t(item.descriptionKey as string) : item.description || "";
}

function openDialog() {
  localSettings.resolution = props.settings?.resolution || "720P";
  localSettings.duration = props.settings?.duration || 5;
  dialogRef.value?.showModal();
}

function handleClose() {
  dialogRef.value?.close();
  emit("close", { ...localSettings });
}

defineExpose({ openDialog });
</script>
