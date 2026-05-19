# Model Config Flow

This folder is the translation layer between:

- settings UI and imported/exported JSON
- normalized user-owned model config kept in store
- conversation snapshots that lock one chat to one model config
- runtime provider params used only while executing requests

## Mental Model

There are 3 different "shapes" in the app:

1. User config payload

- Examples: `ChatProviderPayload`, `ImageProviderPayload`
- Defined in `src/types/chat/provider.ts` and `src/types/image/provider.ts`
- These are the fields the user edits and the app persists/exports
- Think: "what the user configured"

2. Conversation snapshot

- Example: `ConversationModelSnapshot`
- Defined in `src/types/chat/model.ts`
- Stores which user model a conversation is bound to
- Think: "which saved model this conversation is locked to"

3. Runtime config

- Example: `ChatProviderRuntimeConfig`
- Built in `src/services/chat/providers/index.ts`
- Exists only to instantiate provider clients and send requests
- Think: "what the provider executor needs right now"

The important rule is:

- user config and exported JSON should match
- runtime config should be derived late and kept isolated

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

- `common.ts`: compatibility helpers for loose/legacy model data
- `chat.ts`: chat model normalization, capability resolution, chat param defs, snapshot helpers
- `image.ts`: image model normalization and image param helpers
- `settings.ts`: read/write bridge between normalized store config and persisted JSON

## Practical Rule Of Thumb

If you are deciding where new code should go:

- if it edits/saves/imports user model fields, use payload types
- if it locks a conversation to a chosen model, use snapshot types
- if it is about executing a provider request, use runtime config

If a value can be recomputed from user config, prefer recomputing it over
persisting it in snapshots.
