# Services

`services` is split by responsibility:

- `storage/`: localStorage persistence and the shared request adapter used by feature services.
- `settings.ts`: app bootstrap, model settings, and chat instruction templates.
- `chat/`: conversation persistence, provider clients, message packing, and chat DOM rendering.
- `image/`: image generation/editing entrypoints, provider adapters, and persisted image gallery.
- `markdown/`: markdown rendering helpers used by chat message rendering.

Feature views should import public functions from `@/services` when possible.
Direct submodule imports are reserved for integration points that need a narrower
boundary, such as `@/services/settings` for settings and bootstrap helpers.
