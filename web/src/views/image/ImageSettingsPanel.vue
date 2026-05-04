<template>
  <aside class="settings-panel">
    <div class="settings-header">
      <h2>{{ t("image.settingsTitle") }}</h2>
      <button type="button" class="btn btn-sm btn-outline" :disabled="!settings.model" @click="emit('open-settings')">
        {{ t("image.modelSettings") }}
      </button>
    </div>

    <div class="setting-block">
      <span class="setting-label">{{ t("image.model") }}</span>
      <select class="select select-bordered" :value="selectedModelIndex" @change="onModelChange">
        <option :value="-1" disabled>{{ t("image.selectModel") }}</option>
        <option v-for="(imm, index) in imageModels" :value="index" :key="`${imm.name || imm.id || imm.value}-${index}`">
          {{ imm.name || t("common.unnamedModel") }}
        </option>
      </select>
    </div>

    <div class="setting-grid">
      <div class="setting-block">
        <span class="setting-label">{{ t("image.count") }}</span>
        <select class="select select-bordered" :value="settings.n" @change="updateSetting('n', Number($event.target.value))">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="4">4</option>
        </select>
      </div>

      <div class="setting-block">
        <span class="setting-label">{{ t("image.size") }}</span>
        <select class="select select-bordered" :value="settings.size" @change="updateSetting('size', $event.target.value)">
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
        :class="{ active: settings.size === option.value }"
        @click="updateSetting('size', option.value)"
      >
        <span class="ratio-box" :class="sizeShapeClass(option.value)"></span>
        <strong>{{ sizeAlias(option.value) }}</strong>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { imageModelSize } from "@/constants";

const props = defineProps({
  settings: {
    type: Object,
    required: true,
  },
  imageModels: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:settings", "open-settings"]);
const { t } = useI18n();

const selectedModelIndex = computed(() => props.imageModels.indexOf(props.settings.model));

const updateSetting = (key, value) => {
  emit("update:settings", { ...props.settings, [key]: value });
};

const onModelChange = (event) => {
  const model = props.imageModels[Number(event.target.value)] || null;
  updateSetting("model", model);
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
</script>

<style lang="scss" scoped>
.settings-panel {
  height: 100%;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.94), oklch(var(--b2) / 0.9));
  box-shadow: 0 20px 48px oklch(var(--bc) / 0.06);
  backdrop-filter: blur(18px);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
  }

  .btn {
    min-height: 34px;
    border-radius: 12px;
    white-space: nowrap;
  }
}

.setting-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
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

@media (max-width: 720px) {
  .ratio-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
