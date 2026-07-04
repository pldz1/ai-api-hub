# storage

Last reviewed: `2026-07-04`

Client-side persistence layer. All external code imports from the barrel (`@/services/app/storage`).

## Files

| File               | Responsibility                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `index.ts`         | Re-exports the public API from both modules                                                       |
| `indexeddb.ts`     | IndexedDB operations for image, video, and chat attachment binary data; `urlToDataUrl` utility    |
| `local-storage.ts` | JSON state in `localStorage` — models, chats, image/video metadata, conversations; route dispatch |

## How it works

`localStorage` holds lightweight metadata (IDs, prompts, conversation lists). Binary blobs for images, videos, and chat attachments live in separate IndexedDB databases (`ai-api-hub-images`, `ai-api-hub-videos`, `ai-api-hub-chat-files`) keyed by resource ID.

`requestStorage(endpoint, body)` acts as a local route dispatcher, mapping `/_api/*` paths to handler functions that read and write `localStorage` state, delegating blob I/O to the IndexedDB helpers in `indexeddb.ts`.
