# 🚀 AI API HUB

> One interface, every model. Your API keys, your data, your rules.

**AI API HUB** is a unified chat & image generation frontend for multiple AI providers, running entirely in your browser—no backend, no telemetry, just you and the models having a conversation.

---

## 🤖 What Models Are We Talking About?

This is why you're here, right? Here's the current lineup:

### 💬 Chat Models

| Model | Providers | Multimodal | Web Search | Vibe Check |
|---|---|---|---|---|
| **GPT-5.5** 🧠 | OpenAI · Azure | ✅ Vision | ✅ | The latest and greatest. Expensive, but worth every token |
| **GPT-5.4** ⚡ | OpenAI · Azure | ✅ Vision | ✅ | The sweet spot between brains and speed |
| **GPT-4.1** 🎯 | OpenAI · Azure | ✅ Vision | ✅ | Battle-tested veteran, still shipping |
| **GPT-4o** 🏃 | OpenAI · Azure | ✅ Vision | ✅ | Lightweight & fast—your daily driver |
| **DeepSeek V4 Pro** 🔮 | DeepSeek · DashScope | ❌ Text only | ✅ (DashScope) | 1M token context window. Absolute unit for Chinese |
| **DeepSeek V4 Flash** ⚡ | DeepSeek · DashScope | ❌ Text only | ✅ (DashScope) | Pro's speedy sibling—cheap and cheerful |
| **Qwen 3.7 Max** 🐉 | DashScope | ✅ Vision | ✅ | Alibaba's flagship. Chinese comprehension on another level |

### 🎨 Image Generation

| Model | Provider | Capabilities |
|---|---|---|
| **GPT-Image-2** 🖼️ | OpenAI | Text-to-image + image-to-image + inpainting |

> 💡 **But wait, there's more** — you can add any custom model that speaks OpenAI / DeepSeek / DashScope compatible APIs. Running Ollama locally? Go for it. Third-party proxy? You do you.

---

## ✨ Features

- 🔌 **Multi-Provider Aggregation** — One UI for OpenAI, Azure, DeepSeek, and DashScope. Close those 12 browser tabs
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

| Category | Stack |
|---|---|
| Framework | Vue 3 (Composition API + SFC) |
| Language | TypeScript |
| Build | Vite 6 |
| State | Vuex 4 |
| Routing | Vue Router 4 (Hash mode) |
| i18n | vue-i18n 9 |
| UI | DaisyUI 4 + Tailwind CSS 3 |
| Markdown | markdown-it 14 + highlight.js 11 |
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
├── ai-capability/        # AI provider abstraction layer
│   ├── chat/providers/   # Chat clients (OpenAI, Azure, DeepSeek, DashScope)
│   ├── image/providers/  # Image clients (OpenAI)
│   └── common/           # Shared types, SSE client, token normalization
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

## 📄 License

[MIT](LICENSE)

---

<p align="center">Made with ❤️ and probably too much ☕</p>
