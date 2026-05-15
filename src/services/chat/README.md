# Chat Services

Chat services are split by responsibility:

- `providers/`: provider clients and provider factory for OpenAI-compatible chat calls.
- `conversation/`: persisted chat list, messages, and per-conversation model settings.
- `session-runner.ts`: per-chat runtime executor that owns request lifecycle, abort control, draft assistant content, and runtime status updates.
- `rendering/`: DOM rendering for the active conversation and its draft assistant stream.
- `chat-proxy.ts`: runtime bridge from an explicit chat context to the selected provider executor.
- `message.ts`: packing helpers that convert UI messages into provider message formats.

## Current Chat Design

Chat is no longer modeled as one global active request.

- persistent chat data remains per conversation
- runtime state is isolated per `cid`
- the active view renders one conversation at a time
- background conversations may continue running after the user switches away
- sidebar status indicators are driven by per-chat runtime state, not persisted storage

In store terms, the chat module now keeps:

- active conversation projection for the currently selected chat
- per-chat cached messages and settings
- per-chat runtime state such as `loading`, `streaming`, `success`, `stopped`, and `error`

The main execution flow is:

1. `conversation/service.ts` loads persisted chat metadata and message history.
2. `session-runner.ts` starts or stops model requests for a specific chat id.
3. `chat-proxy.ts` resolves the chat's model snapshot and settings, then calls the provider.
4. `rendering/` paints the currently active conversation and its draft assistant output.

Views should normally import from `@/services`. Internal chat files should import
from these folders directly when they need a narrower boundary.
