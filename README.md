# AI API HUB

AI API HUB is a local-first AI workspace for chat, image generation, and image editing.

`web/` is the main application. `server/` is an optional Python companion that adds SQLite-backed persistence, cached image serving, bundled static hosting, and the Windows `pywebview` wrapper.

For Chinese documentation, see [README.CN-zh.md](./README.CN-zh.md).

## Product Model

- single local workspace
- no account system and no multi-user isolation
- browser-first runtime
- optional Python companion
- hash-based routing for static deployment

The `/login` route is now a workspace launch screen. It only probes whether the companion is reachable, then enters the workspace.

## Features

- chat workspace with conversation history, markdown rendering, streaming output, and per-conversation model snapshot
- concurrent multi-chat execution: one chat can keep running while the user switches to another chat and continues working
- per-chat runtime status in the sidebar, including `loading`, `success`, `stopped`, and `error`
- image workspace with separate generation and edit modes
- image edit workflow with input image support, brush mask editing, and saved image gallery
- dedicated settings workspace with autosave
- prompt template management
- chat model, image generation model, and image edit model management
- app settings for companion host configuration and workspace import/export
- built-in `zh-CN` / `en-US` i18n and theme switching
- browser storage fallback when the Python companion is unavailable

## Provider Support

Chat providers currently supported in the UI:

- `OpenAI`
- `Azure OpenAI`
- `Anthropic Direct`
- `Azure AI Foundry`

OpenAI-compatible endpoints such as DeepSeek can still be used through the OpenAI-style model flow by providing a custom `baseURL` and `model`.

Image providers currently supported:

- `OpenAI`
- `Azure OpenAI`

## Runtime Architecture

### Browser-First Request Flow

The frontend owns:

- routing
- workspace bootstrap
- model configuration
- chat request orchestration and rendering
- image generation and image editing UI
- language and theme controls

Model inference requests go directly from the browser to the selected provider. The Python companion is not on the inference path.

### Chat Runtime Design

The chat workspace no longer uses one global active request state.

It is split into two layers:

- persisted conversation data: chat list, messages, and per-conversation settings
- in-memory runtime state per chat id: pending status, streaming draft output, stop/error/success state, and session token usage

Current chat behavior:

- the main panel renders only the active conversation
- background conversations may continue streaming after the user switches away
- switching chats does not cancel other running chats
- sidebar status indicators are driven by per-chat runtime state
- per-conversation model snapshots keep older chats pinned to the model they started with

At code level, the main chat pieces are:

- `web/src/store/chat.ts`
  - active chat projection plus per-chat caches and runtime maps
- `web/src/services/chat/conversation/service.ts`
  - persisted chat list, settings, and message history access
- `web/src/services/chat/session-runner.ts`
  - per-chat request lifecycle, abort control, runtime updates, and draft assistant state
- `web/src/services/chat/chat-proxy.ts`
  - resolves the explicit chat context and calls the correct provider
- `web/src/services/chat/rendering/`
  - renders the active conversation and its draft assistant output

### Storage Router

`web/src/services/transport/request.ts` calls `web/src/services/storage/`, which selects the active persistence backend.

Storage modes:

- `server`
  - FastAPI companion is reachable and persists data with SQLite
- `browser`
  - companion is unavailable, so data falls back to browser storage
- `unknown`
  - backend detection has not finished yet

In browser mode, the app persists:

- model settings
- prompt templates
- chat list
- chat messages
- per-chat settings
- saved images

Saved browser-mode images are converted to `data:` URLs so the gallery still works after reload.

### Python Companion

`server/` is a local companion, not a required backend.

It currently provides:

- FastAPI routes for workspace settings, chats, and cached images
- SQLite-backed persistence under `server/app/storage/`
- cached image download and serving via `/_api/image/get/<image_id>`
- static serving for the production frontend bundle
- Windows `pywebview` packaging entrypoint

## Routes

The frontend router lives in `web/src/router/index.ts` and uses `createWebHashHistory()`, so static hosting does not need server-side rewrite rules.

Current routes:

- `/`
  - redirects to `/login`
- `/login`
  - workspace launch screen and storage-mode probe
- `/home`
  - landing page for Chat, Image, and Settings
- `/chat`
  - chat workspace
- `/image`
  - image workspace with generation and edit tabs
- `/settings`
  - full-page settings workspace

## Repository Layout

```text
ai-api-hub/
├─ README.md
├─ README.CN-zh.md
├─ README_CN.md
├─ web/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ vite.mock.config.js
│  ├─ public/
│  └─ src/
│     ├─ assets/
│     ├─ components/
│     │  ├─ base/
│     │  └─ header/
│     ├─ constants/
│     ├─ i18n/
│     ├─ router/
│     ├─ services/
│     │  ├─ chat/
│     │  ├─ image/
│     │  ├─ markdown/
│     │  ├─ storage/
│     │  ├─ transport/
│     │  └─ user/
│     ├─ store/
│     ├─ types/
│     ├─ utils/
│     └─ views/
│        ├─ chat/
│        ├─ home/
│        ├─ image/
│        └─ setting/
└─ server/
   ├─ app/
   │  ├─ core/
   │  ├─ routes/
   │  ├─ schemas/
   │  ├─ storage/
   │  └─ utils/
   ├─ scripts/
   ├─ statics/
   ├─ config.json
   ├─ dev.py
   ├─ main.py
   ├─ requirements.txt
   └─ win_webview.py
```

Recommended starting points:

- `web/src/router/index.ts`
- `web/src/store/chat.ts`
- `web/src/services/chat/`
- `web/src/views/chat/`
- `web/src/views/setting/SettingsWorkspace.vue`
- `server/app/`

## Model Configuration

Models are user-defined. Built-in model lists are suggestions, not hard restrictions.

Current model editing supports:

- `chatParamDefs` for dynamic chat settings fields
- `imageParamDefs` for dynamic image settings fields
- separate saved lists for chat, image generation, and image edit models
- manual `model`, `baseURL`, `endpoint`, `deployment`, and `apiVersion` fields depending on provider

The settings workspace autosaves changes and also supports import/export of the current workspace configuration.

## Development

### Frontend Only

Use this when you want a browser-only build with local storage fallback.

```bash
cd web
npm install
npm run dev:mock
```

Default dev URL: `http://127.0.0.1:20090`

### Frontend + Python Companion

Use this when you want SQLite persistence and image caching.

```bash
python -m pip install -r server/requirements.txt
python server/dev.py
```

In another terminal:

```bash
cd web
npm install
npm run dev
```

Default companion API: `http://127.0.0.1:20088`

Default frontend dev URL: `http://127.0.0.1:20090`

You can override the companion host and port in `server/config.json`.

### Type Check

```bash
cd web
npm run typecheck
```

## Build And Run

### Bundled Companion Build

Build the frontend into `server/statics/` and serve it through FastAPI:

```bash
cd web
npm install
npm run build
cd ..
python server/main.py
```

### Static Frontend Build

Build a standalone frontend that relies on browser storage fallback:

```bash
cd web
npm install
npm run build:mock
cd dist
python -m http.server 20098 --bind 0.0.0.0
```

Any static host works here because the app uses hash routing and can fall back to browser storage when `/_api` is unavailable.
