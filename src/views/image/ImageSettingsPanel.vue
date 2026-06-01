<template>
  <aside class="settings-panel">
    <div class="settings-header">
      <h2>{{ mode === "edit" ? t("image.editSettingsTitle") : t("image.settingsTitle") }}</h2>
    </div>

    <div class="setting-block">
      <span class="setting-label">{{ t("image.model") }}</span>
      <select class="setting-select" :value="selectedModelIndex" @change="onModelChange">
        <option :value="-1" disabled>{{ t("image.selectModel") }}</option>
        <option v-for="(imm, index) in imageModels" :value="index" :key="`${imm.name || imm.id || imm.value}-${index}`">
          {{ imm.name || t("common.unnamedModel") }}
        </option>
      </select>
    </div>

    <div class="setting-grid">
      <div class="setting-block">
        <span class="setting-label">{{ t("image.count") }}</span>
        <select class="setting-select" :value="settings.n" @change="updateSetting('n', Number($event.target.value))">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="4">4</option>
        </select>
      </div>

      <div class="setting-block">
        <span class="setting-label">{{ t("image.size") }}</span>
        <select class="setting-select" :value="settings.size" @change="updateSetting('size', $event.target.value)">
          <option v-for="imsz in imageModelSize" :key="imsz" :value="imsz">
            {{ imsz }}
          </option>
        </select>
      </div>
    </div>

    <div class="ratio-grid">
      <button
        v-for="option in imageModelSize"
        :key="option"
        type="button"
        class="ratio-card"
        :class="{ active: settings.size === option }"
        @click="updateSetting('size', option)"
      >
        <span class="ratio-box" :class="sizeShapeClass(option)"></span>
        <strong>{{ sizeAlias(option) }}</strong>
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
  mode: {
    type: String,
    default: "generation",
  },
});

const emit = defineEmits(["update:settings"]);
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
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.98), oklch(var(--b2) / 0.94));
  box-shadow: 0 12px 28px oklch(var(--bc) / 0.05);
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
}

.setting-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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

.setting-select {
  width: 100%;
  max-width: none;
  min-height: 42px;
  height: 42px;
  padding: 0 38px 0 14px;
  border-radius: 14px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background:
    linear-gradient(180deg, oklch(var(--b1) / 0.98), oklch(var(--b2) / 0.9)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%23111827' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      no-repeat right 12px center / 12px 12px;
  font-size: 14px;
  color: oklch(var(--bc) / 0.9);
  appearance: none;
  box-shadow: 0 8px 20px oklch(var(--bc) / 0.05);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    border-color: oklch(var(--bc) / 0.18);
    transform: translateY(-1px);
  }

  &:focus {
    outline: none;
    border-color: oklch(var(--p) / 0.42);
    box-shadow:
      0 0 0 3px oklch(var(--p) / 0.12),
      0 12px 26px oklch(var(--bc) / 0.08);
  }
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
