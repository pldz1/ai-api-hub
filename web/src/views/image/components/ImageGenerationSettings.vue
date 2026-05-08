<template>
  <dialog id="global_image_model_settings" class="modal global-image-model-settings">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="handleClose">x</button>
      </form>
      <h3 class="text-lg font-bold">{{ t("image.modelSettings") }}</h3>

      <div class="gims-container">
        <div v-for="item in activeParamDefs" :key="item.key" class="gims-setting-item">
          <div class="gims-setting-label">
            <span>{{ item.label || item.key }}</span>
            <AppTooltip v-if="getParamDescription(item)" :text="getParamDescription(item)" placement="bottom">
              <SvgIcon class="gims-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="gims-setting-content">
            <template v-if="item.type === 'number'">
              <input type="range" :min="item.min" :max="item.max" :step="item.step" v-model.number="modelSettings[item.key]" class="range range-xs" />
              <input type="text" class="input input-bordered" v-model.number="modelSettings[item.key]" />
            </template>

            <template v-else-if="item.type === 'boolean'">
              <input type="checkbox" class="toggle toggle-primary" v-model="modelSettings[item.key]" />
            </template>

            <template v-else-if="item.type === 'array'">
              <textarea
                class="textarea textarea-bordered"
                :value="jsonFieldInputs[item.key] || '[]'"
                @input="jsonFieldInputs[item.key] = $event.target.value"
              ></textarea>
            </template>

            <template v-else-if="item.type === 'object'">
              <textarea
                class="textarea textarea-bordered"
                :value="jsonFieldInputs[item.key] || '{}'"
                :placeholder="item.placeholder || '{ }'"
                @input="jsonFieldInputs[item.key] = $event.target.value"
              ></textarea>
            </template>

            <template v-else-if="item.type === 'image'">
              <div class="gims-image-param">
                <input
                  :id="`image-param-${item.key}`"
                  type="file"
                  accept="image/*"
                  class="gims-file-input"
                  @change="onImageParamFileChange(item, $event)"
                />
                <label class="btn btn-sm btn-outline" :for="`image-param-${item.key}`">
                  {{ t("image.uploadParamImage") }}
                </label>
                <button v-if="modelSettings[item.key]" type="button" class="btn btn-sm btn-ghost" @click="clearImageParam(item.key)">
                  {{ t("image.clearParamImage") }}
                </button>
                <span>{{ getImageParamLabel(modelSettings[item.key]) }}</span>
              </div>
            </template>

            <template v-else>
              <input type="text" class="input input-bordered gims-input-full" v-model="modelSettings[item.key]" :placeholder="item.placeholder || item.key" />
            </template>
          </div>
        </div>

        <div v-if="activeParamDefs.length === 0" class="gims-empty">
          {{ t("image.noModelParams") }}
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup>
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import infoIcon from "@/assets/svg/info24.svg";
import { dsAlert } from "@/utils";
import { getModelImageParamDefs, mergeImageSettingsWithModel, parseChatParamValue } from "@/constants";
import AppTooltip from "@/components/base/AppTooltip.vue";
import SvgIcon from "@/components/base/SvgIcon.vue";

const props = defineProps({
  mode: {
    type: String,
    default: "generation",
  },
  model: {
    type: Object,
    default: null,
  },
  settings: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:settings"]);
const { t } = useI18n();
const activeParamDefs = computed(() => {
  const defs = getModelImageParamDefs(props.model || {});
  if (props.mode === "edit") return defs;
  return defs.filter((item) => item.type !== "image");
});
const modelSettings = reactive({});
const jsonFieldInputs = reactive({});

const getParamDescription = (item) => {
  if (item.descriptionKey) return t(item.descriptionKey);
  return item.description || "";
};

watch(
  () => [props.model, props.settings],
  ([model, newVal]) => {
    const mergedSettings = mergeImageSettingsWithModel(model, newVal);
    Object.keys(modelSettings).forEach((key) => {
      delete modelSettings[key];
    });
    Object.assign(modelSettings, mergedSettings);

    Object.keys(jsonFieldInputs).forEach((key) => {
      delete jsonFieldInputs[key];
    });
    activeParamDefs.value
      .filter((item) => item.type === "array" || item.type === "object")
      .forEach((item) => {
        const fallbackValue = item.type === "object" ? {} : [];
        const value = mergedSettings[item.key] ?? item.defaultValue ?? fallbackValue;
        jsonFieldInputs[item.key] = JSON.stringify(value, null, item.type === "object" ? 2 : 0);
      });
  },
  { immediate: true, deep: true },
);

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

const onImageParamFileChange = async (item, event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    modelSettings[item.key] = {
      filename: file.name || "image.png",
      content_type: file.type || "image/png",
      data: await readFileAsBase64(file),
    };
  } catch (error) {
    dsAlert({ type: "error", message: t("image.paramImageReadFailed", { error: String(error) }) });
  }
};

const clearImageParam = (key) => {
  modelSettings[key] = null;
};

const getImageParamLabel = (value) => {
  if (!value?.filename) return t("image.noParamImage");
  return `${value.filename} (${value.content_type || "image/*"})`;
};

const handleClose = () => {
  const nextSettings = mergeImageSettingsWithModel(props.model, { ...modelSettings });

  activeParamDefs.value.forEach((item) => {
    if (item.type !== "array" && item.type !== "object") return;
    const fallbackValue = item.type === "object" ? {} : [];
    const parsedValue = parseChatParamValue(item.type, jsonFieldInputs[item.key], null);
    if (parsedValue === null) {
      dsAlert({ type: "warn", message: t("image.invalidJsonParam", { name: item.label || item.key }) });
      nextSettings[item.key] = item.defaultValue ?? fallbackValue;
      return;
    }
    nextSettings[item.key] = parsedValue;
  });

  emit("update:settings", nextSettings);
};
</script>

<style lang="scss" scoped>
.global-image-model-settings {
  overflow: hidden;

  .modal-box {
    width: 600px;
    max-width: unset;
  }
}

.gims-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-height: 450px;
  padding: 8px;
  overflow-y: auto;
}

.gims-setting-item {
  display: flex;
  flex-direction: row;
  width: 528px;
  max-width: 528px;
  align-items: center;
  gap: 16px;
}

.gims-setting-label {
  width: 180px;
  max-width: 180px;
  font-size: 16px;
  text-align: right;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.gims-info-icon {
  width: 24px;
  height: 24px;
}

.gims-setting-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 348px;
  gap: 8px;

  .textarea {
    width: 100%;
  }

  .input {
    width: 80px;
    max-width: 80px;
  }

  .gims-input-full {
    width: 100%;
    max-width: none;
  }
}

.gims-image-param {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  span {
    min-width: 0;
    color: oklch(var(--bc) / 0.65);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.gims-file-input {
  display: none;
}

.gims-empty {
  width: 528px;
  border: 1px dashed oklch(var(--b3));
  border-radius: 16px;
  padding: 18px;
  color: oklch(var(--bc) / 0.62);
  text-align: center;
}
</style>
