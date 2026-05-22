<template>
  <div class="chat-template-display-card">
    <div class="ctdc-copy">
      <h1 class="ctdc-title">Over to you{{ userSuffix }}</h1>
      <p class="ctdc-subtitle">Start a new conversation or reuse one of your prompt templates.</p>
    </div>
    <div class="ctdc-templates">
      <div class="ctdc-templates-container">
        <button v-for="inst in insTemplateList" :key="inst.id" class="ctdc-template-chip" @click="onSelectInst(inst.id)">
          {{ inst.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useStore } from "vuex";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getBuiltinChatInsTemplateList } from "@/models";
import { addChat } from "@/services";
import { dsAlert, append4Random } from "@/utils";

const emit = defineEmits(["on-update"]);

const store = useStore();
const { t, locale } = useI18n();
const curChatModelSettings = computed(() => store.state.curChatModelSettings);
const userSuffix = computed(() => (store.state.username && store.state.username !== "__workspace__" ? `, ${store.state.username}` : ""));
const insTemplateList = computed(() => {
  locale.value;
  return [...getBuiltinChatInsTemplateList(), ...store.state.chatInsTemplateList];
});

const onSelectInst = async (id) => {
  const instObj = insTemplateList?.value?.find((inst) => inst.id === id);
  if (!instObj) {
    dsAlert({ type: "error", message: t("chat.invalidTemplate") });
    return;
  }

  const newVal = { ...curChatModelSettings.value };
  newVal.prompts[0].content[0].text = instObj.value;
  await store.dispatch("setCurChatModelSettings", newVal);

  const name = append4Random(instObj.name);
  await addChat(name);

  emit("on-update", [
    { role: "user", content: [{ type: "text", text: t("chat.repeatInstruction") }] },
    { role: "assistant", content: [{ type: "text", text: instObj.value }] },
  ]);
};
</script>

<style lang="scss" scoped>
.chat-template-display-card {
  position: absolute;
  inset: 72px 0 156px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 0 24px;
}

.ctdc-copy {
  text-align: center;
}

.ctdc-title {
  margin: 0;
  font-size: clamp(42px, 5vw, 60px);
  font-weight: 400;
  letter-spacing: -0.04em;
  color: #202124;
}

.ctdc-subtitle {
  margin: 10px 0 0;
  color: #5f6368;
  font-size: 16px;
}

.ctdc-templates {
  width: min(920px, 100%);
}

.ctdc-templates-container {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ctdc-template-chip {
  height: 40px;
  padding: 0 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: #202124;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.05);
}

@media (max-width: 900px) {
  .chat-template-display-card {
    inset: 92px 0 168px;
  }

  .ctdc-title {
    font-size: 38px;
  }

  .ctdc-subtitle {
    font-size: 14px;
  }
}
</style>
