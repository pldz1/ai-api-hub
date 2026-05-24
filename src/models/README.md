# Model Config Boundary

This folder is the normalization and derivation layer between:

- settings UI and imported/exported JSON I/O
- normalized user-owned model config kept in store
- conversation snapshots that lock one chat to one model config
- runtime request params derived only while executing requests

## Mental Model

There are 4 different shapes in the app. Keep them aligned, but do not merge
them into one wide object.

1. Import/export payload

- Examples: `ChatProviderPayload`, `ImageProviderPayload`
- Defined in `src/types/chat/provider.ts` and `src/types/image/provider.ts`
- These are the fields settings pages edit and JSON import/export writes
- Think: "the public I/O contract"

2. Normalized store config

- Examples: `ChatModelConfig`, `ImageModelConfig`, `ModelSettings`
- Defined in `src/types/chat/model.ts`, `src/types/image/model.ts`, and
  `src/types/settings.ts`
- These are user-owned configs after legacy fields/defaults are normalized
- Think: "the app's canonical copy of the user's config"

3. Conversation snapshot

- Example: `ConversationModelSnapshot`
- Defined in `src/types/chat/model.ts`
- Stores which user model a conversation is bound to
- Think: "which saved model this conversation is locked to"

4. Runtime config

- Example: `ChatProviderRuntimeConfig`
- Defined and consumed in `src/services/chat/providers/`
- Exists only to instantiate provider clients and send requests
- Think: "what the provider executor needs right now"

The important rule is:

- I/O payload and normalized store config should stay shape-compatible
- runtime config should be derived late and kept inside services

## Main Read Path

When settings JSON is loaded:

1. `src/services/settings.ts#getModels()`
2. `src/models/settings.ts#migratePersistedModelSettings()`
3. `src/store/user.ts#setModels()`

What happens in practice:

- raw persisted/export JSON is validated
- legacy fields are migrated
- loose data is normalized into canonical user config
- store keeps normalized `ModelSettings`

Key functions:

- `normalizeChatModelConfig()`: loose/legacy chat model -> canonical user config
- `normalizeImageModelConfig()`: loose/legacy image model -> canonical user config
- `sanitizeModelSettings()`: strips transient fields before storing/exporting

## Main Write Path

When settings are saved/exported:

1. store holds normalized `ModelSettings`
2. `src/models/settings.ts#buildPersistedModelSettingsPayload()`
3. local storage/export writes the resulting JSON

What happens in practice:

- app state is converted back into stable persisted payloads
- only user-owned config fields are written
- runtime-only values are excluded

## Chat Runtime Flow

When a chat runs:

1. selected model becomes `ChatModelConfig`
2. `src/models/chat.ts#createConversationModelSnapshot()` stores a conversation lock
3. `src/services/chat/chat-proxy.ts` resolves the active model
4. `src/services/chat/providers/index.ts#createChatProviderConfig()` builds `ChatProviderRuntimeConfig`
5. provider client executes the request

What is derived on demand:

- supported capabilities
- enabled capabilities
- request param definitions
- final provider request body params

These are intentionally computed from `modelConfig` instead of being persisted
inside the conversation snapshot.

## File Guide

- `src/types/*/provider.ts`: persisted/imported/exported provider payloads only
- `src/types/*/model.ts`: normalized user config, editor state, snapshots, and settings
- `src/types/settings.ts`: top-level settings I/O and store settings types
- `src/services/*/providers/`: runtime-only provider config and executor code
- `src/models/common.ts`: compatibility helpers for loose/legacy model data
- `src/models/chat.ts`: chat model normalization, capability resolution, chat param defs, snapshot helpers
- `src/models/image.ts`: image model normalization and image param helpers
- `src/models/settings.ts`: read/write bridge between normalized store config and persisted JSON

## Practical Rule Of Thumb

If you are deciding where new code should go:

- If it edits/saves/imports user model fields, use payload/config types.
- If it locks a conversation to a chosen model, use snapshot types.
- If it is about executing a provider request, keep it in `services/*/providers`.
- If a field can be recomputed from user config, do not persist it.
- If a type contains provider constructor args such as `deploymentName`, it is
  runtime-only and does not belong in `src/types/*/provider.ts`.

If a value can be recomputed from user config, prefer recomputing it over
persisting it in snapshots.
