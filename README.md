# AI API HUB

AI API HUB is a local-first AI workspace for chat, image generation, and image editing.

`web/` is the main product. `server/` is an optional Python companion that adds SQLite-backed persistence, image caching, bundled static serving, and the Windows `pywebview` wrapper.

For Chinese docs, see [README.CN-zh.md](./README.CN-zh.md).

## Current Product Model

- single local workspace
- no real account system or multi-user separation
- browser-first runtime
- optional Python companion
- hash-based routing for static deployment

The `/login` route is now a workspace launch screen. It only checks whether the companion service is reachable and then enters the workspace.

## Features

- chat workspace with conversation list, streaming output, and markdown rendering
- per-conversation model snapshot so existing chats stay on the model configuration they started with
- image workspace with separate generation and edit modes
- image edit flow with input image support and brush-mask tooling
- dedicated settings workspace with autosave
- prompt template management
- chat model, image generation model, and image edit model management
- app settings for companion host configuration plus settings import/export
- theme switching and built-in `zh-CN` / `en-US` i18n
- browser storage fallback when the Python companion is unavailable

### Provider Support

Chat models configured in the UI currently support:

- `OpenAI`
- `Azure OpenAI`
- `Anthropic Direct`
- `Azure AI Foundry`

OpenAI-compatible endpoints such as DeepSeek can still be used by configuring a custom `baseURL` and `model` under the OpenAI-style chat model flow.

Image models currently support:

- `OpenAI`
- `Azure OpenAI`

## Runtime Architecture

### Browser-First Request Model

The frontend owns:

- routing
- workspace bootstrap
- model configuration
- chat rendering and streaming
- image generation and image editing UI
- theme and language controls

Model requests go directly from the browser to the selected provider. The Python companion is not on the critical path for model inference.

### Storage Router

`web/src/services/transport/request.ts` calls `web/src/services/storage/`, which chooses the active persistence backend.

Storage modes:

- `server`: FastAPI companion is reachable and persists data with SQLite
- `browser`: companion is unavailable, so data falls back to browser storage
- `unknown`: backend detection has not finished yet

In browser mode, the app persists:

- model settings
- prompt templates
- chat list
- chat messages
- per-chat settings
- saved images

Saved browser-mode images are converted to `data:` URLs so the gallery still works after reload.

### Companion Service

`server/` is a local companion, not a required application backend.

It currently provides:

- FastAPI routes for workspace settings, chats, and cached images
- SQLite-backed persistence under `server/app/storage/`
- cached image download and streaming via `/_api/image/get/<image_id>`
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

Useful starting points:

- `web/src/router/index.ts`
- `web/src/constants/model.ts`
- `web/src/services/`
- `web/src/views/setting/SettingsWorkspace.vue`
- `server/app/server.py`

## Model Configuration Notes

Models are user-defined. The built-in model lists are suggestion lists, not hard restrictions.

Current model editing supports:

- `chatParamDefs` for dynamic chat settings fields
- `imageParamDefs` for dynamic image settings fields
- separate saved lists for chat, image generation, and image edit models
- manual `model`, `baseURL`, `endpoint`, `deployment`, and `apiVersion` fields depending on provider

The settings workspace autosaves changes and also supports import/export of the current workspace configuration.

## Development

### Frontend Only

Use this when you want a pure browser build with local storage fallback.

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
