<template>
  <!-- This view renders the chat model settings dialog. -->
  <dialog ref="dialogRef" id="global_chat_model_settings" class="modal global-chat-model-settings">
    <div class="modal-box">
      <!-- Close and persist the edited settings when leaving the dialog. -->
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" type="button" @click="handleClose">
          <SvgIcon :src="closeIcon" style="width: 24px; height: 24px"></SvgIcon>
        </button>
      </form>
      <h3 class="text-lg font-bold">{{ t("chat.settingsTitle") }}</h3>
      <div class="gcms-container">
        <!-- Edit the system instruction that seeds the conversation context. -->
        <div class="gcms-setting-item">
          <div class="gcms-setting-label">
            <span>{{ t("chat.instructions") }}</span>
            <AppTooltip :text="t('chat.instructionsTip')" placement="bottom">
              <SvgIcon class="gcms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>

          <div class="gcms-setting-content">
            <textarea v-model="instrStr" class="textarea textarea-bordered"></textarea>
          </div>
        </div>

        <!-- Control how much previous conversation is included in each request. -->
        <div class="gcms-setting-item">
          <div class="gcms-setting-label">
            <span>{{ t("chat.historyCount") }}</span>
            <AppTooltip :text="t('chat.historyCountTip')" placement="bottom">
              <SvgIcon class="gcms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="gcms-setting-content">
            <input v-model.number="modelSettings.passedMsgLen" type="range" min="1" max="20" class="range range-xs" />
            <input v-model.number="modelSettings.passedMsgLen" type="text" class="input input-bordered" />
          </div>
        </div>

        <!-- Render provider-specific parameter fields from the active model definition. -->
        <div v-for="item in activeParamDefs" :key="item.key" class="gcms-setting-item">
          <div class="gcms-setting-label">
            <span>{{ item.label || item.key }}</span>
            <AppTooltip v-if="getParamDescription(item)" :text="getParamDescription(item)" placement="bottom">
              <SvgIcon class="gcms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="gcms-setting-content">
            <!-- Use matched inputs for numeric parameters with both slider and direct entry. -->
            <template v-if="item.type === 'number'">
              <input v-model.number="modelSettings[item.key]" type="range" :min="item.min" :max="item.max" :step="item.step" class="range range-xs" />
              <input v-model.number="modelSettings[item.key]" type="number" class="input input-bordered" />
            </template>

            <!-- Toggle boolean parameters directly. -->
            <template v-else-if="item.type === 'boolean'">
              <input v-model="modelSettings[item.key]" type="checkbox" class="toggle toggle-primary" />
            </template>

            <!-- Keep structured parameters editable as JSON text. -->
            <template v-else-if="item.type === 'array' || item.type === 'object'">
              <textarea
                class="textarea textarea-bordered"
                :value="jsonFieldInputs[item.key] || getJsonFallbackText(item)"
                @input="onJsonFieldInput(item.key, $event)"
              ></textarea>
            </template>

            <!-- Fall back to a plain text field for all other parameter types. -->
            <template v-else>
              <input v-model="modelSettings[item.key]" type="text" class="input input-bordered gcms-input-full" :placeholder="item.placeholder || item.key" />
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
import { useStore } from "vuex";
import infoIcon from "@/assets/svg/info24.svg";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import closeIcon from "@/assets/svg/error24.svg";
import { mergeChatSettingsWithModel, parseParamValue, resolveChatParamDefs } from "@/models";
import { setChatSettings } from "@/services";
import { dsAlert } from "@/utils";

type ParamDef = {
  key: string;
  type: "number" | "boolean" | "array" | string;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  description?: string;
  descriptionKey?: string;
  defaultValue?: unknown;
};

const store = useStore();
const { t } = useI18n();
const dialogRef = ref<HTMLDialogElement | null>(null);
const curChatModel = computed(() => store.state.curChatModel);
const curChatModelSettings = computed(() => store.state.curChatModelSettings);
const activeParamDefs = computed<ParamDef[]>(() => resolveChatParamDefs(curChatModel.value));
const modelSettings = reactive<Record<string, any>>({});
const instrStr = ref("");
const jsonFieldInputs = reactive<Record<string, string>>({});

const getParamDescription = (item: ParamDef) => {
  if (item.descriptionKey) return t(item.descriptionKey);
  return item.description || "";
};

const getJsonFallbackText = (item: ParamDef) => JSON.stringify(item.type === "array" ? [] : {});

const isJsonParam = (item: ParamDef) => item.type === "array" || item.type === "object";

const onJsonFieldInput = (key: string, event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  jsonFieldInputs[key] = target.value;
};

watch(
  () => [curChatModel.value, curChatModelSettings.value],
  ([model, newVal]) => {
    const mergedSettings = mergeChatSettingsWithModel(model, newVal);
    Object.keys(modelSettings).forEach((key) => {
      delete modelSettings[key];
    });
    Object.assign(modelSettings, mergedSettings);

    Object.keys(jsonFieldInputs).forEach((key) => {
      delete jsonFieldInputs[key];
    });
    activeParamDefs.value
      .filter((item) => isJsonParam(item))
      .forEach((item) => {
        const value = mergedSettings[item.key] ?? item.defaultValue ?? (item.type === "array" ? [] : {});
        jsonFieldInputs[item.key] = JSON.stringify(value);
      });

    instrStr.value = mergedSettings.prompts?.[0]?.content?.[0]?.text || "";
  },
  { immediate: true, deep: true },
);

const handleClose = async () => {
  const nextSettings = mergeChatSettingsWithModel(curChatModel.value, { ...modelSettings });
  nextSettings.prompts[0].content[0].text = instrStr.value;

  activeParamDefs.value.forEach((item) => {
    if (!isJsonParam(item)) return;
    const parsedValue = parseParamValue(item.type, jsonFieldInputs[item.key], null);
    if (parsedValue === null) {
      console.warn("Failed to parse JSON parameter:", item.key);
      dsAlert({ type: "warn", message: t("chat.invalidArrayParam", { name: item.label || item.key }) });
      nextSettings[item.key] = (item.defaultValue ?? (item.type === "array" ? [] : {})) as any;
      return;
    }
    nextSettings[item.key] = parsedValue as any;
  });

  await store.dispatch("setCurChatModelSettings", nextSettings);
  await setChatSettings();
  dialogRef.value?.close();
};

const openDialog = () => {
  dialogRef.value?.showModal();
};

defineExpose({
  openDialog,
});
</script>

<style lang="scss" scoped>
.global-chat-model-settings {
  overflow: hidden;

  .modal-box {
    width: min(664px, calc(100vw - 24px));
    max-width: none;
    max-height: min(88dvh, 760px);
    padding: 18px 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .gcms-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-height: min(64dvh, 450px);
    padding: 8px;
    overflow-y: auto;
  }

  .gcms-setting-item {
    display: flex;
    flex-direction: row;
    width: min(596px, 100%);
    max-width: 100%;
    align-items: center;
    gap: 16px;
  }

  .gcms-setting-label {
    width: 198px;
    font-size: 16px;
    text-align: right;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .gcms-info-icon {
    width: 24px;
    height: 24px;
  }

  .gcms-setting-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    width: 348px;
    gap: 8px;

    .textarea {
      width: 100%;
      height: 48px;
    }

    .input {
      width: 92px;
      max-width: 92px;
    }

    .gcms-input-full {
      width: 100%;
      max-width: none;
    }
  }
}

@media (max-width: 720px) {
  .global-chat-model-settings {
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

    .gcms-container {
      max-height: calc(100dvh - 132px);
      padding: 6px 2px 2px;
      align-items: stretch;
    }

    .gcms-setting-item {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid oklch(var(--bc) / 0.06);
    }

    .gcms-setting-label {
      width: 100%;
      text-align: left;
      justify-content: space-between;
      font-size: 14px;
      gap: 6px;
    }

    .gcms-info-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .gcms-setting-content {
      width: 100%;
      flex-wrap: wrap;
      gap: 8px;

      .textarea {
        min-height: 120px;
      }

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
