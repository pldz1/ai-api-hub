# 🚀 AI API HUB

> One interface, every model. Your API keys, your data, your rules.

**AI API HUB** is a unified chat & image generation frontend for multiple AI providers, running entirely in your browser—no backend, no telemetry, just you and the models having a conversation.

---

## 🤖 What Models Are We Talking About?

This is why you're here, right? Here's the current lineup:

### 💬 Chat Models

| Model                 | Providers            | Chat Endpoint       | Vision | Web Search     | Vibe Check                                                 |
| --------------------- | -------------------- | ------------------- | ------ | -------------- | ---------------------------------------------------------- |
| **GPT-5.5**           | OpenAI · Azure       | `/responses`        | ✅     | ✅             | The latest and greatest. Expensive, but worth every token  |
| **GPT-5.4**           | OpenAI · Azure       | `/responses`        | ✅     | ✅             | The sweet spot between brains and speed                    |
| **GPT-4.1**           | OpenAI · Azure       | `/responses`        | ✅     | ✅             | Battle-tested veteran, still shipping                      |
| **GPT-4o**            | OpenAI · Azure       | `/responses`        | ✅     | ✅             | Lightweight & fast—your daily driver                       |
| **DeepSeek V4 Pro**   | DeepSeek · DashScope | `/chat/completions` | ❌     | ✅ (DashScope) | 1M token context window. Absolute unit for Chinese         |
| **DeepSeek V4 Flash** | DeepSeek · DashScope | `/chat/completions` | ❌     | ✅ (DashScope) | Pro's speedy sibling—cheap and cheerful                    |
| **Qwen Plus**         | DashScope            | `/chat/completions` | ❌     | ✅             | General-purpose Qwen text chat                             |
| **Qwen 3.7 Max**      | DashScope            | `/chat/completions` | ❌     | ✅             | Alibaba's flagship. Chinese comprehension on another level |

### 🎨 Image Generation

| Model                  | Provider       | Image-to-Image | Inpainting | Output Sizes                     |
| ---------------------- | -------------- | -------------- | ---------- | -------------------------------- |
| **GPT-Image-2**        | OpenAI · Azure | ✅             | ✅         | Up to 3840×2160 (8 sizes + auto) |
| **Qwen-Image-2.0 Pro** | DashScope      | ✅             | ❌         | Up to 3840×2160 (7 sizes)        |

### 🎬 Video Generation

| Model                | Provider  | Input             | Resolution   | Description                                       |
| -------------------- | --------- | ----------------- | ------------ | ------------------------------------------------- |
| **Wan2.7 I2V**       | DashScope | Image + Audio     | 720P · 1080P | Image-to-Video: animate a still image into a clip |
| **Wan2.7 T2V**       | DashScope | Text only         | 720P · 1080P | Text-to-Video: generate video from prompt alone   |
| **Wan2.7 R2V**       | DashScope | Image/Audio/Video | 720P · 1080P | Reference-to-Video: multi-modal guided generation |
| **Wan2.7 VideoEdit** | DashScope | Image/Audio/Video | 720P · 1080P | Video Editing: modify existing video with prompts |

> 💡 **But wait, there's more** — you can add any custom model that speaks OpenAI / DashScope compatible APIs. Running locally? Go for it. Third-party proxy? You do you.

---

## ✨ Features

- 🔌 **Multi-Provider Aggregation** — One UI for OpenAI, Azure, DeepSeek, and DashScope.
- 🌊 **Streaming (SSE)** — Real-time typewriter responses with abort support. Impatient? Hit stop anytime
- 🎨 **Image Generation & Editing** — Text-to-image, image-to-image, plus a built-in brush mask editor for surgical edits
- 🌐 **Web Search** — Supported models can search the web mid-conversation. Yes, just like that other chatbot
- 📋 **Prompt Templates** — Write once, reuse forever. Stop copy-pasting system instructions like a caveman
- 💬 **Conversation Management** — Create, rename, delete, batch operations. Sidebar shows live runtime status per session
- 📊 **Token Tracking** — Input/output tokens per turn, normalized across providers. Know where your credits are going
- 🎨 **11 Themes** — Light · Dark · Cupcake · Acid · Lemonade · Night · Coffee · Winter · Dim · Nord · Sunset
- 🌍 **i18n** — English & Simplified Chinese, auto-detected from your browser. Switch anytime
- 📦 **Config Import/Export** — URL query params, file upload, or paste JSON. One-click export to back everything up
- 🔒 **100% Local** — All data lives in `localStorage` + `IndexedDB`. No server, no accounts, your keys stay yours

---

## 🏗️ Tech Stack

| Category  | Stack                                                 |
| --------- | ----------------------------------------------------- |
| Framework | Vue 3 (Composition API + SFC)                         |
| Language  | TypeScript                                            |
| Build     | Vite 6                                                |
| State     | Vuex 4                                                |
| Routing   | Vue Router 4 (Hash mode)                              |
| i18n      | vue-i18n 9                                            |
| UI        | DaisyUI 4 + Tailwind CSS 3                            |
| Markdown  | markdown-it 14 + highlight.js 11                      |
| Streaming | Native Fetch API + ReadableStream (custom SSE parser) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Start dev server → http://127.0.0.1:20090
```

### Other Commands

```bash
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm run typecheck  # TypeScript type check
```

---

## 🎮 How to Use

1. Open the app, click **"Enter Workspace"**
2. Go to **Settings → Chat Models**, plug in your API key and endpoint
3. Create a new conversation, start chatting!
4. Want images? Add an image model in **Settings → Image Models**, then switch to the **Image** tab

### 🔗 URL-Based Config Import

Encode your config as Base64 JSON or host it somewhere, then pass it as a URL param—perfect for incognito mode:

```
http://127.0.0.1:20090/#/?config=BASE64_ENCODED_JSON
http://127.0.0.1:20090/#/?config=https://example.com/my-config.json
```

---

## 📁 Project Structure

```
src/
├── ai-capability/        # AI provider abstraction layer (Template Method pattern)
│   ├── common/           # Shared: BaseChatClient, BaseImageClient, SSE transport, usage
│   ├── chat/             # Chat capability
│   │   ├── providers/    #   Clients: OpenAI, Azure, DeepSeek, DashScope
│   │   ├── executor.ts   #   Route → factory → ChatExecutor
│   │   └── gateway.ts    #   Public API (chat, streaming, abort)
│   ├── image/            # Image capability
│   │   ├── providers/    #   Clients: OpenAI, Azure, DashScope
│   │   ├── executor.ts   #   Route → factory → ImageExecutor
│   │   └── gateway.ts    #   Public API (generate, edit)
│   └── video/            # Video capability
│       ├── providers/    #   Clients: DashScope
│       ├── executor.ts   #   Route → factory → VideoExecutor
│       └── gateway.ts    #   Public API (generate video)
├── components/           # Reusable Vue components
├── constants/            # App metadata, model catalog, parameter presets
├── i18n/                 # EN & ZH dictionaries
├── models/               # Data normalization & API param builders
├── router/               # Hash-based routes
├── services/             # Business logic (settings, conversations, images, markdown)
├── store/                # Vuex state management
├── types/                # TypeScript type definitions
└── views/                # Page components (chat, image, settings, layout)
```

---

## ⚠️⚠️⚠️ Video Generation Supported by Nginx Proxy.

Add the DashScope reverse proxy inside the same `server` block and scope it under the `/io/llm/` route only. Requests to `/io/llm/ai-api-hub-dashscope-proxy/` will be forwarded to `https://dashscope.aliyuncs.com/`, while the `/io/llm/` SPA will continue to be served from `/usr/share/nginx/templates/ai-api-hub/`. Make sure the proxy `location` is placed before the static `/io/llm/` location so Nginx matches the proxy rule first. In the frontend, use `/io/llm/ai-api-hub-dashscope-proxy/...` as the API base path instead of `/ai-api-hub-dashscope-proxy/...`. This keeps the DashScope proxy limited to the LLM demo route and prevents it from affecting other site paths.

The nginx configuration shall like this:

```txt
    location ^~ /io/llm/ai-api-hub-dashscope-proxy/ {
        proxy_pass https://dashscope.aliyuncs.com/;

        proxy_http_version 1.1;
        proxy_ssl_server_name on;

        proxy_set_header Host dashscope.aliyuncs.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Proxy Authorization、X-DashScope-Async...
        proxy_pass_request_headers on;

        # If support stram output.
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
```

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">Made with ❤️ and probably too much ☕</p>
