<template>
  <dialog id="global_chat_model_settings" class="modal global-chat-model-settings">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="handleClose">✕</button>
      </form>
      <h3 class="text-lg font-bold">{{ t("chat.settingsTitle") }}</h3>
      <div class="gcms-container">
        <div class="gcms-setting-item">
          <div class="gcms-setting-label">
            <span>{{ t("chat.instructions") }}</span>
            <AppTooltip :text="t('chat.instructionsTip')" placement="bottom">
              <SvgIcon class="gcms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>

          <div class="gcms-setting-content">
            <textarea class="textarea textarea-bordered" v-model="instrStr"></textarea>
          </div>
        </div>

        <div class="gcms-setting-item">
          <div class="gcms-setting-label">
            <span>{{ t("chat.historyCount") }}</span>
            <AppTooltip :text="t('chat.historyCountTip')" placement="bottom">
              <SvgIcon class="gcms-info-icon" :src="infoIcon" />
            </AppTooltip>
          </div>
          <div class="gcms-setting-content">
            <input type="range" min="1" max="20" class="range range-xs" v-model.number="modelSettings.passedMsgLen" />
            <input type="text" class="input input-bordered" v-model.number="modelSettings.passedMsgLen" />
          </div>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup>
import { useStore } from "vuex";
import { computed, reactive, watch, ref } from "vue";
import { useI18n } from "vue-i18n";
import infoIcon from "@/assets/svg/info24.svg";
import { mergeChatSettingsWithModel } from "@/constants";
import { setChatSettings } from "@/services";
import AppTooltip from "@/components/base/AppTooltip.vue";
import SvgIcon from "@/components/base/SvgIcon.vue";

const store = useStore();
const { t } = useI18n();
const curChatModel = computed(() => store.state.curChatModel);
const curChatModelSettings = computed(() => store.state.curChatModelSettings);
const modelSettings = reactive({});
const instrStr = ref("");

watch(
  () => [curChatModel.value, curChatModelSettings.value],
  ([model, newVal]) => {
    const mergedSettings = mergeChatSettingsWithModel(model, newVal);
    Object.keys(modelSettings).forEach((key) => {
      delete modelSettings[key];
    });
    Object.assign(modelSettings, mergedSettings);
    instrStr.value = mergedSettings.prompts?.[0]?.content?.[0]?.text || "";
  },
  { immediate: true, deep: true },
);

const handleClose = async () => {
  const nextSettings = mergeChatSettingsWithModel(curChatModel.value, { ...modelSettings });
  nextSettings.prompts[0].content[0].text = instrStr.value;

  store.dispatch("setCurChatModelSettings", nextSettings);
  await setChatSettings();
};
</script>

<style lang="scss" scoped>
.global-chat-model-settings {
  overflow: hidden;
  .modal-box {
    width: 600px;
    max-width: unset;
  }

  .gcms-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-height: 450px;
    padding: 8px;
    overflow-y: auto;
  }

  .gcms-setting-item {
    display: flex;
    flex-direction: row;
    width: 528px;
    max-width: 528px;
    align-items: center;
    gap: 16px;
  }

  .gcms-setting-label {
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

  .gcms-info-icon {
    width: 24px;
    height: 24px;
  }

  .gcms-setting-content {
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

    .gcms-input-full {
      width: 100%;
      max-width: none;
    }
  }
}
</style>
