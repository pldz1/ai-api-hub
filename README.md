# AI API HUB

AI API HUB is a local-first AI workspace for chat and image generation.

The current architecture is browser-first:

- the frontend is the primary product
- model requests go directly from the browser to OpenAI, Azure OpenAI, or DeepSeek
- persistence is handled through a storage provider layer
- `server/` is now an optional Python companion service, not a required backend

If you only keep one mental model, keep this one:

> `web/` is the app. `server/` is optional local infrastructure.

For the Chinese version, see [README_CN.md](./README_CN.md).

## What Changed

This project no longer behaves like a multi-user web app with a mandatory login flow.

The current product model is:

- single local workspace
- no account system
- no meaningful multi-user separation
- optional Python companion for SQLite, image caching, and desktop packaging

The project no longer requires a real account login, but it still keeps a dedicated `/login` entry page as the workspace launch screen.

## Features

- multi-model chat
- multi-model image generation
- prompt template management
- dedicated `/settings` workspace
- autosaved settings
- theme switching
- i18n-based UI
- browser-only fallback mode
- optional Python companion service

Supported providers:

- OpenAI
- Azure OpenAI
- DeepSeek

## Architecture

### Browser-first runtime

The frontend is responsible for:

- routing
- model configuration
- chat rendering
- image generation flow
- theme and language controls
- choosing the active storage provider

Model traffic does not depend on the Python service.

### Storage provider layer

Storage is routed through `web/src/services/storage/`.

Current modes:

- `server`
  - the Python companion is reachable
  - data is persisted through FastAPI + SQLite
- `browser`
  - the companion is unavailable
  - data is persisted in browser storage
- `unknown`
  - the app has not confirmed a mode yet

This means the app can run:

- with the companion service
- without the companion service
- as a static frontend

### Single workspace model

The frontend now boots into a fixed local workspace instead of asking the user to log in.

That workspace owns:

- model definitions
- prompt templates
- chats and messages
- per-chat settings
- saved images

The Python companion mirrors this same assumption: one local workspace, not a real user system.

## What `server/` Still Does

`server/` is now best understood as a companion service.

Use it when you want:

- SQLite persistence
- image download and caching
- a local HTTP API
- Windows `pywebview` packaging

Do not think of it as the primary app backend anymore.

## Repository Layout

```text
ai-api-hub/
├─ README.md
├─ README_CN.md
├─ dev.py
├─ web/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ vite.mock.config.js
│  └─ src/
│     ├─ components/
│     ├─ constants/
│     ├─ i18n/
│     ├─ router/
│     ├─ services/
│     │  ├─ aigc/
│     │  ├─ api/
│     │  ├─ chat/
│     │  ├─ markdown/
│     │  └─ storage/
│     ├─ store/
│     ├─ utils/
│     └─ views/
└─ server/
   ├─ app/
   │  ├─ core/
   │  ├─ routes/
   │  ├─ schemas/
   │  ├─ storage/
   │  └─ utils/
   ├─ main.py
   ├─ dev.py
   ├─ config.json
   ├─ requirements.txt
   ├─ statics/
   ├─ win_webview.py
   └─ scripts/
```

Important directories:

- `web/src/views/`
  - page-level UI
- `web/src/components/`
  - shared UI primitives
- `web/src/services/storage/`
  - storage provider routing
- `server/`
  - optional Python companion
- `server/app/`
  - the real companion service package
- `server/scripts/`
  - legacy compatibility exports that now forward to `server/app/`

## Routes

Frontend routes live in `web/src/router/index.js`.

Current routes:

- `/`
  - redirects to `/login`
- `/login`
  - workspace launch page
- `/home`
- `/chat`
- `/image`
- `/settings`

### `/login`

The login page is now a launch screen for the local workspace.

It:

- probes companion availability
- shows whether the app is in companion mode or browser-storage mode
- enters the workspace without a real account system

### `/home`

The entry page exposes three primary actions:

- Chat
- Image
- Settings

### `/chat`

- collapsible sidebar
- chat list management
- streaming responses
- markdown rendering
- per-chat dynamic parameter settings

### `/image`

- image model selection
- generation settings
- image history
- local save and clipboard actions

### `/settings`

Settings is a full page, not a modal.

Sections:

- Prompt Templates
- Chat Models
- Image Models
- App Settings

Behavior:

- list + detail editing
- autosave
- import/export
- companion service URL management

## Chat and Image Model Configuration

Core files:

- `web/src/constants/model.js`
- `web/src/components/ModelEditCard.vue`
- `web/src/views/chat/ChatSettings.vue`

### Model ID

Model IDs are entered manually.

The built-in list is only a suggestion list, not a hard restriction.

### Dynamic chat parameters

Chat models can now define their own editable parameters through `chatParamDefs`.

That definition drives the chat settings UI:

- `number`
  - slider + numeric input
- `string`
  - text input
- `boolean`
  - toggle
- `array`
  - JSON text input

This replaces the older hard-coded parameter logic that depended on a fixed set of model names.

## Browser Storage Mode

Browser storage is no longer a throwaway mock. It is now a first-class storage provider.

It covers:

- workspace bootstrap
- model settings
- prompt templates
- chat list CRUD
- message CRUD
- per-chat settings
- image list CRUD

In browser mode:

- image URLs are converted to `data:` URLs
- refreshes keep using the same local workspace
- Python-backed features are unavailable

Limitations:

- storage is still browser-bound
- large image histories can hit storage limits
- no SQLite

## Python Companion Mode

In companion mode the frontend uses the same UI, but data goes through FastAPI and SQLite.

This mode is useful for:

- larger local persistence
- image caching
- desktop packaging

The companion is now single-workspace oriented and no longer needs a real login flow.

## Development

### Full local setup

Run the frontend and companion together:

```bash
python dev.py
```

### Frontend-only development

Use the mock Vite config so the dev proxy does not interfere with browser-storage fallback:

```bash
cd web
npm run dev:mock
```

### Production build

Normal build:

```bash
cd web
npm run build
```

Mock-focused build:

```bash
cd web
npm run build:mock
```

### Static deployment without Python

```bash
cd web
npm run build:mock
cd dist
python -m http.server 20098 --bind 0.0.0.0
```

If `/_api/...` resolves to a plain static server response such as `404`, `405`, or `501`, the frontend falls back to browser storage automatically.

## Theme and i18n

Theme and language controls are shared across:

- home
- chat
- image
- settings

The app now uses a common header, a common tooltip/dropdown layer, and i18n-backed UI copy across major views.

## Python Companion Design Notes

The current `server/` folder has already been simplified toward a single-workspace model, but it is still intentionally optional.

That means future refactors should prefer:

- shrinking the companion
- keeping the browser provider healthy
- avoiding fake multi-user complexity

If you are extending the project, prefer these assumptions:

- local-first
- single workspace
- browser-first
- companion optional

## Recommended Reading Order

If you are new to the codebase, read in this order:

1. `web/src/router/index.js`
2. `web/src/App.vue`
3. `web/src/views/home/HomePage.vue`
4. `web/src/views/chat/HomePage.vue`
5. `web/src/views/image/HomePage.vue`
6. `web/src/views/user/UserSettings.vue`
7. `web/src/services/storage/`
8. `web/src/services/api/`
9. `web/src/services/aigc/`
10. `server/app/routes/`

This order reflects the current truth of the project: UI and storage flow first, optional companion second.
