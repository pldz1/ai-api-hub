<template>
  <main class="qa-page">
    <section class="qa-hero">
      <p class="qa-kicker">README.md quick guide</p>
      <h1>AI API HUB QA</h1>
      <p>支持哪些模型、每类 Provider 应该填什么接口，以及 DashScope / DeepSeek 的几个参数注意点。</p>
      <div class="qa-actions">
        <RouterLink to="/settings/chat-models">配置 Chat Models</RouterLink>
        <RouterLink to="/settings/image-models">配置 Image Models</RouterLink>
        <RouterLink to="/settings/video-models">配置 Video Models</RouterLink>
      </div>
    </section>

    <section class="qa-section">
      <div class="qa-grid">
        <article class="qa-card">
          <h3>What Models Are We Talking About?</h3>
          <p>先看模型表。它说明 Chat、Image、Video 三类能力分别支持哪些 Provider，以及是否支持视觉输入、联网搜索、图生图、视频输入。</p>
        </article>
        <article class="qa-card">
          <h3>How to Use</h3>
          <p>再看使用流程。核心路径是 Settings -> Chat Models / Image Models / Video Models，填 API Key、Base URL 和模型 ID。</p>
        </article>
        <article class="qa-card">
          <h3>Video Generation Proxy</h3>
          <p>如果使用 DashScope 视频模型，需要注意浏览器跨域。README.md 里有 Nginx 代理示例，开发环境也有对应代理路径。</p>
        </article>
      </div>
    </section>

    <section class="qa-section">
      <h2>当前支持的模型</h2>
      <div class="qa-table-wrap">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>模型</th>
              <th>Provider</th>
              <th>能力</th>
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
      <h2>Chat 接口怎么填</h2>
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
      <h2>几个容易配错的点</h2>
      <div class="qa-notes">
        <p>
          <strong>OpenAI / Azure OpenAI:</strong>
          本项目的 Chat 路由走 Responses API，所以 Base URL 应该是 /responses，不是 /chat/completions。
        </p>
        <p>
          <strong>DashScope / DeepSeek:</strong>
          Chat 路由走 Chat Completions API，所以 Base URL 应该是 /chat/completions。
        </p>
        <p>
          <strong>DashScope 视觉:</strong>
          图片输入要选 qwen-vl-plus 这类 VL 模型。qwen-plus、qwen3.7-max-2026-05-17 这类文本模型不要传 image_url。
        </p>
        <p>
          <strong>DashScope DeepSeek-V4:</strong>
          reasoning_effort 只适用于 deepseek-v4-pro / deepseek-v4-flash。low、medium、high 会映射为 high；xhigh、max 会映射为 max。
        </p>
        <p>
          <strong>联网搜索:</strong>
          DashScope 兼容接口使用 enable_search: true。DeepSeek 直连和 OpenAI Responses 的搜索能力由各自 Provider 适配处理。
        </p>
      </div>
    </section>

    <section class="qa-section">
      <h2>参考地址</h2>
      <div class="reference-list">
        <p>README.md</p>
        <p>OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses</p>
        <p>Azure OpenAI Responses API: https://learn.microsoft.com/azure/ai-foundry/openai/how-to/responses</p>
        <p>DashScope OpenAI 兼容 Chat: https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions</p>
        <p>DeepSeek Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

const modelRows = [
  { type: "Chat", model: "gpt-5.5 / gpt-5.4 / gpt-4.1 / gpt-4o", provider: "OpenAI / Azure OpenAI", capability: "视觉输入、联网搜索" },
  { type: "Chat", model: "deepseek-v4-pro / deepseek-v4-flash", provider: "DeepSeek / DashScope", capability: "文本对话；DashScope 路由支持联网搜索" },
  { type: "Chat", model: "qwen-plus", provider: "DashScope", capability: "文本对话、联网搜索" },
  { type: "Chat", model: "qwen-vl-plus", provider: "DashScope", capability: "视觉输入" },
  { type: "Chat", model: "qwen3.7-max-2026-05-17", provider: "DashScope", capability: "文本对话、联网搜索" },
  { type: "Image", model: "gpt-image-2", provider: "OpenAI / Azure OpenAI", capability: "文生图、图生图、局部编辑" },
  { type: "Image", model: "qwen-image-2.0", provider: "DashScope", capability: "文生图、图生图" },
  { type: "Video", model: "wan2.7-i2v / t2v / r2v / videoedit", provider: "DashScope", capability: "文生视频、图生视频、参考视频、视频编辑" },
];

const endpointRows = [
  {
    provider: "OpenAI",
    note: "Chat 使用 Responses API。",
    url: "https://api.openai.com/v1/responses",
  },
  {
    provider: "Azure OpenAI",
    note: "Chat 使用 Azure OpenAI Responses API。",
    url: "https://<YOUR-AZURE-PROJECT>.openai.azure.com/openai/v1/responses",
  },
  {
    provider: "DashScope",
    note: "Chat 使用 OpenAI 兼容 Chat Completions API。",
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  },
  {
    provider: "DeepSeek",
    note: "Chat 使用 Chat Completions API。",
    url: "https://api.deepseek.com/chat/completions",
  },
];
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
