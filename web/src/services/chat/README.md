# Chat Services

Chat services are split by responsibility:

- `providers/`: provider clients and provider factory for OpenAI-compatible chat calls.
- `conversation/`: persisted chat list, messages, and per-conversation model settings.
- `rendering/`: DOM rendering for chat messages and streaming output.
- `chat-proxy.ts`: runtime bridge from UI messages to the active provider executor.
- `message.ts`: packing helpers that convert UI messages into provider message formats.

Views should normally import from `@/services`. Internal chat files should import
from these folders directly when they need a narrower boundary.
