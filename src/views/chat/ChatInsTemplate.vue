<template>
  <!-- This view shows starter prompt templates for a new chat. -->
  <div class="chat-template-display-card">
    <!-- Introduce the empty state with a lightweight headline and subtitle. -->
    <div class="ctdc-copy">
      <h1 class="ctdc-title">Over to you</h1>
      <p class="ctdc-subtitle">Start a new conversation or reuse one of your prompt templates.</p>
    </div>
    <!-- Offer built-in and saved prompt shortcuts as reusable chips. -->
    <div class="ctdc-templates">
      <div class="ctdc-templates-container">
        <button v-for="inst in insTemplateList" :key="inst.id" class="ctdc-template-chip" @click="onSelectInst(inst.id)">
          {{ inst.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/store";
import { addChat } from "@/services";
import { append4Random, dsAlert } from "@/utils";
import { chatInsTemplateList } from "@/constants";

type ChatInstructionTemplate = {
  id: string;
  name: string;
  value: string;
};

const store = useAppStore();
const router = useRouter();
const { t, locale } = useI18n();
const curChatModelSettings = computed(() => store.state.curChatModelSettings);
const insTemplateList = computed<ChatInstructionTemplate[]>(() => {
  locale.value;
  return [...chatInsTemplateList, ...store.state.chatInsTemplateList];
});

const onSelectInst = async (id: string) => {
  const instObj = insTemplateList.value.find((inst) => inst.id === id);
  if (!instObj) {
    dsAlert({ type: "error", message: t("chat.invalidTemplate") });
    return;
  }

  const newVal = { ...curChatModelSettings.value };
  newVal.prompts[0].content[0].text = instObj.value;
  store.commit("setCurChatModelSettings", newVal);

  const model = store.state.curChatModel;
  if (!model) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  const name = append4Random(instObj.name);
  await addChat(name, model);
  if (store.state.curChatId) {
    await router.replace({ name: "chat", params: { cid: store.state.curChatId } });
  }

};
</script>

<style lang="scss" scoped>
.chat-template-display-card {
  width: min(100%, 920px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 24px 0;
  box-sizing: border-box;
}

.ctdc-copy {
  position: relative;
  isolation: isolate;
  text-align: center;

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: -1;
    pointer-events: none;
    border-radius: 999px;
    transform: translate(-50%, -50%);
  }

  &::before {
    width: min(560px, 88vw);
    aspect-ratio: 1;
    background: radial-gradient(circle, oklch(var(--p) / 0.18) 0%, oklch(var(--p) / 0.08) 34%, oklch(var(--p) / 0) 68%);
    filter: blur(8px);
  }

  &::after {
    width: min(340px, 64vw);
    aspect-ratio: 1;
    background: radial-gradient(circle, oklch(var(--p) / 0.14) 0%, oklch(var(--p) / 0.05) 42%, oklch(var(--p) / 0) 72%);
  }
}

.ctdc-title {
  margin: 0;
  font-size: clamp(36px, 4vw, 48px);
  font-weight: 400;
  letter-spacing: -0.04em;
  color: oklch(var(--bc));
}

.ctdc-subtitle {
  margin: 10px 0 0;
  color: oklch(var(--bc) / 0.68);
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
  border: 1px solid oklch(var(--bc) / 0.06);
  border-radius: 999px;
  background: oklch(var(--b1) / 0.84);
  color: oklch(var(--bc));
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 8px 24px oklch(var(--bc) / 0.05);
}

@media (max-width: 900px) {
  .chat-template-display-card {
    width: min(100%, 560px);
    gap: 18px;
    padding: 18px 0;
  }

}

@media (max-width: 640px) {
  .chat-template-display-card {
    gap: 16px;
    padding: 12px 0;
  }

  .ctdc-subtitle {
    margin-top: 8px;
    line-height: 1.45;
  }

  .ctdc-templates-container {
    gap: 8px;
  }

  .ctdc-template-chip {
    height: 34px;
    padding: 0 14px;
    font-size: 13px;
  }
}
</style>
