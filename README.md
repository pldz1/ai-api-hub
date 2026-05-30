# AI API HUB

A unified chat & image generation interface for multiple AI providers, running entirely in the browser.

## Features

- **Multi-provider chat** — Supports OpenAI, Azure OpenAI, and DeepSeek through a unified chat interface with streaming (SSE) responses.
- **Image generation & editing** — Text-to-image and image-to-image generation via OpenAI / Azure OpenAI. Includes an in-app brush-based mask editor for precise edit regions.
- **Model management** — Configure custom models, endpoints, API keys, and deployment settings per provider. Model catalog includes GPT-5.5, GPT-4.1, GPT-4o, and DeepSeek V4 variants.
- **Prompt templates** — Create, edit, and reuse system instruction templates across conversations.
- **Conversation management** — Create, rename, delete, and batch-delete chat and image conversations. Sidebar shows real-time runtime status per session.
- **Token usage tracking** — Per-session input/output token accounting.
- **Theme & language** — 5 DaisyUI themes (Light, Dark, Cupcake, Acid, Lemonade). UI in English and Simplified Chinese.
- **Settings import/export** — Import config via URL query parameters, file upload, or inline JSON. Export as a portable JSON package.
- **Fully local** — Runs entirely in the browser with localStorage persistence. No account, no backend server required.

## Supported Providers

| Provider | Chat | Image |
|---|---|---|
| OpenAI | Streaming & sync via `/chat/completions`, web search via `/responses` | Generation & edit via `/images/generations` and `/images/edits` |
| Azure OpenAI | Streaming & sync via Azure deployment endpoint | Generation & edit via Azure deployment |
| DeepSeek | Streaming & sync via `/chat/completions` (text-only) | — |

## Tech Stack

- **Vue 3** (Composition API, SFC)
- **TypeScript** (strict mode off)
- **Vite 6** (dev server, bundler)
- **Vuex 4** (state management, 4 modules)
- **Vue Router 4** (hash-based routing)
- **vue-i18n 9** (internationalization)
- **DaisyUI 4 + Tailwind CSS 3** (UI components & theming)
- **markdown-it + highlight.js** (message rendering with syntax highlighting)
- **axios** (HTTP client)

## Project Structure

```
src/
├── ai-capability/       # AI provider abstraction layer
│   ├── chat/            # Chat providers (OpenAI, Azure, DeepSeek)
│   │   └── providers/   # Per-provider client implementations
│   ├── image/           # Image providers (OpenAI, Azure)
│   │   └── providers/
│   └── common/          # Shared types, SSE client, usage normalization
├── assets/              # SCSS stylesheets, SVG icons
├── components/          # Reusable Vue components
├── constants/           # App metadata, model catalog, parameter presets
├── i18n/                # Locale dictionaries (zh-CN, en-US)
├── models/              # Data normalization & API parameter builders
├── router/              # Hash-based route definitions
├── services/            # Business logic
│   ├── app/             # Settings CRUD, config import, storage
│   ├── conversation/    # Chat conversation CRUD, runtime, rendering
│   ├── creation/        # Image generation & gallery management
│   └── markdown/        # Markdown parsing & code highlighting
├── store/               # Vuex store (user, chat, image, modal modules)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── views/               # Page components
    ├── chat/            # Chat UI (input, settings, templates)
    ├── image/           # Image studio (workspace, preview, brush editor)
    ├── layout/          # Sidebar & main view layout
    └── setting/         # Settings pages (models, templates, app)
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
npm install
```

### Development

```bash
npm run dev
```

Dev server starts at `http://127.0.0.1:20090`.

### Build

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server.

### Type Check

```bash
npm run typecheck
```

### Preview Build

```bash
npm run preview
```

## Usage

1. Open the app, click **"Enter Workspace"** on the home screen.
2. Go to **Settings** → **Chat Models** and add a model with your provider's API key and endpoint.
3. Create a new chat conversation and start sending messages.
4. For image generation, add an image model in **Settings** → **Image Models**, then switch to the **Image** tab.

### URL-based Config Import

Pass config via the `config` query parameter in the URL hash:

```
http://127.0.0.1:20090/#/?config=BASE64_ENCODED_JSON
http://127.0.0.1:20090/#/?config=https://example.com/my-config.json
```

This is useful for sharing configuration without manually importing files, especially in private or incognito browsing modes.

## License

[MIT](LICENSE)
