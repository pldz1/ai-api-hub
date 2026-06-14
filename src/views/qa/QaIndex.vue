<template>
  <main class="qa-page">
    <section class="qa-hero">
      <p class="qa-kicker">{{ t("qa.kicker") }}</p>
      <h1>AI API HUB QA</h1>
      <p>{{ t("qa.heroDescription") }}</p>
      <div class="qa-actions">
        <RouterLink to="/settings/chat-models">{{ t("qa.actions.chatModels") }}</RouterLink>
        <RouterLink to="/settings/image-models">{{ t("qa.actions.imageModels") }}</RouterLink>
        <RouterLink to="/settings/video-models">{{ t("qa.actions.videoModels") }}</RouterLink>
      </div>
    </section>

    <section class="qa-section">
      <div class="qa-grid">
        <article class="qa-card">
          <h3>{{ t("qa.cards.modelsTitle") }}</h3>
          <p>{{ t("qa.cards.modelsDescription") }}</p>
        </article>
        <article class="qa-card">
          <h3>{{ t("qa.cards.useTitle") }}</h3>
          <p>{{ t("qa.cards.useDescription") }}</p>
        </article>
        <article class="qa-card">
          <h3>{{ t("qa.cards.proxyTitle") }}</h3>
          <p>{{ t("qa.cards.proxyDescription") }}</p>
        </article>
      </div>
    </section>

    <section class="qa-section">
      <h2>{{ t("qa.supportedModelsTitle") }}</h2>
      <div class="qa-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t("qa.table.type") }}</th>
              <th>{{ t("qa.table.model") }}</th>
              <th>Provider</th>
              <th>{{ t("qa.table.capability") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in modelRows" :key="`${item.type}-${item.model}`">
              <td>{{ item.type }}</td>
              <td>{{ item.model }}</td>
              <td>{{ item.provider }}</td>
              <td>{{ item.capability }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="qa-section">
      <h2>{{ t("qa.chatEndpointTitle") }}</h2>
      <div class="endpoint-list">
        <article v-for="item in endpointRows" :key="item.provider" class="endpoint-item">
          <div>
            <h3>{{ item.provider }}</h3>
            <p>{{ item.note }}</p>
          </div>
          <code>{{ item.url }}</code>
        </article>
      </div>
    </section>

    <section class="qa-section">
      <h2>{{ t("qa.notesTitle") }}</h2>
      <div class="qa-notes">
        <p>
          <strong>OpenAI / Azure OpenAI:</strong>
          {{ t("qa.notes.openai") }}
        </p>
        <p>
          <strong>DashScope / DeepSeek:</strong>
          {{ t("qa.notes.compatible") }}
        </p>
        <p>
          <strong>{{ t("qa.notes.dashscopeVisionLabel") }}</strong>
          {{ t("qa.notes.dashscopeVision") }}
        </p>
        <p>
          <strong>DashScope DeepSeek-V4:</strong>
          {{ t("qa.notes.deepseekV4") }}
        </p>
        <p>
          <strong>{{ t("qa.notes.webSearchLabel") }}</strong>
          {{ t("qa.notes.webSearch") }}
        </p>
      </div>
    </section>

    <section class="qa-section">
      <h2>{{ t("qa.referencesTitle") }}</h2>
      <div class="reference-list">
        <p>README.md</p>
        <p>OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses</p>
        <p>Azure OpenAI Responses API: https://learn.microsoft.com/azure/ai-foundry/openai/how-to/responses</p>
        <p>{{ t("qa.references.dashscopeCompatibleChat") }}: https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions</p>
        <p>DeepSeek Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

const { t } = useI18n();

const modelRows = computed(() => [
  { type: "Chat", model: "gpt-5.5 / gpt-5.4 / gpt-4.1 / gpt-4o", provider: "OpenAI / Azure OpenAI", capability: t("qa.capabilities.visionSearch") },
  { type: "Chat", model: "deepseek-v4-pro / deepseek-v4-flash", provider: "DeepSeek / DashScope", capability: t("qa.capabilities.textDashscopeSearch") },
  { type: "Chat", model: "qwen-plus", provider: "DashScope", capability: t("qa.capabilities.textSearch") },
  { type: "Chat", model: "qwen-vl-plus", provider: "DashScope", capability: t("qa.capabilities.vision") },
  { type: "Chat", model: "qwen3.7-max-2026-05-17", provider: "DashScope", capability: t("qa.capabilities.textSearch") },
  { type: "Image", model: "gpt-image-2", provider: "OpenAI / Azure OpenAI", capability: t("qa.capabilities.imageEdit") },
  { type: "Image", model: "qwen-image-2.0", provider: "DashScope", capability: t("qa.capabilities.image") },
  { type: "Video", model: "wan2.7-i2v / t2v / r2v / videoedit", provider: "DashScope", capability: t("qa.capabilities.video") },
]);

const endpointRows = computed(() => [
  {
    provider: "OpenAI",
    note: t("qa.endpoints.openai"),
    url: "https://api.openai.com/v1/responses",
  },
  {
    provider: "Azure OpenAI",
    note: t("qa.endpoints.azure"),
    url: "https://<YOUR-AZURE-PROJECT>.openai.azure.com/openai/v1/responses",
  },
  {
    provider: "DashScope",
    note: t("qa.endpoints.dashscope"),
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  },
  {
    provider: "DeepSeek",
    note: t("qa.endpoints.deepseek"),
    url: "https://api.deepseek.com/chat/completions",
  },
]);
</script>

<style lang="scss" scoped>
.qa-page {
  height: 100%;
  overflow-y: auto;
  padding: 34px;
  color: oklch(var(--bc));
  background: oklch(var(--b1));
}

.qa-hero,
.qa-section {
  width: min(100%, 1064px);
  margin-inline: auto;
}

.qa-hero {
  padding-bottom: 26px;
  border-bottom: 1px solid oklch(var(--bc) / 0.08);

  h1 {
    margin: 6px 0 10px;
    font-size: 34px;
    line-height: 1.15;
    font-weight: 800;
  }

  p {
    max-width: 780px;
    color: oklch(var(--bc) / 0.72);
    line-height: 1.7;
  }
}

.qa-kicker {
  margin: 0;
  color: oklch(var(--p));
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.qa-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;

  a {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    border-radius: 8px;
    padding: 0 12px;
    border: 1px solid oklch(var(--p) / 0.18);
    background: oklch(var(--p) / 0.1);
    color: oklch(var(--p));
    font-size: 12px;
    font-weight: 800;
  }
}

.qa-section {
  padding: 26px 0;

  h2 {
    margin: 0 0 14px;
    font-size: 18px;
    font-weight: 800;
  }
}

.qa-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.qa-card,
.endpoint-item,
.qa-notes,
.reference-list,
.qa-table-wrap {
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  background: oklch(var(--b1));
}

.qa-card {
  padding: 14px;

  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: oklch(var(--bc) / 0.68);
    font-size: 12px;
    line-height: 1.65;
  }
}

.qa-table-wrap {
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th,
  td {
    padding: 12px 14px;
    border-bottom: 1px solid oklch(var(--bc) / 0.07);
    text-align: left;
    font-size: 12px;
    vertical-align: top;
  }

  th {
    color: oklch(var(--bc) / 0.62);
    font-weight: 800;
    background: oklch(var(--b2) / 0.42);
  }

  tr:last-child td {
    border-bottom: 0;
  }
}

.endpoint-list {
  display: grid;
  gap: 10px;
}

.endpoint-item {
  display: grid;
  grid-template-columns: minmax(180px, 0.5fr) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px;

  h3 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: oklch(var(--bc) / 0.64);
    font-size: 12px;
  }

  code {
    min-width: 0;
    overflow-wrap: anywhere;
    border-radius: 6px;
    padding: 8px 10px;
    background: oklch(var(--b2) / 0.72);
    font-size: 12px;
  }
}

.qa-notes,
.reference-list {
  padding: 14px;

  p {
    margin: 0;
    color: oklch(var(--bc) / 0.72);
    font-size: 12px;
    line-height: 1.7;
    overflow-wrap: anywhere;

    & + p {
      margin-top: 8px;
    }
  }
}

@media (max-width: 820px) {
  .qa-page {
    padding: 24px 16px;
  }

  .qa-grid,
  .endpoint-item {
    grid-template-columns: 1fr;
  }

  .qa-hero h1 {
    font-size: 28px;
  }
}
</style>
