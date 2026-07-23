# Architecture

AI API Hub is a browser-side BYOK workbench. Its central job is to turn a
user-owned model configuration into a predictable request, normalize the
provider response, and keep the resulting conversation locally.

## Module map

```text
src/views/                 Vue components: interaction and presentation
src/services/              Use cases: orchestrate capability, Store and persistence
src/ai-capability/         Model resolution, protocol adapters and normalized results
src/persistence/           Browser repositories: localStorage schema and IndexedDB blobs
src/store/                 Reactive in-memory projection and transient runtime state
src/models/                Domain constructors, normalization and snapshots
src/types/                 Application-owned types
```

The allowed dependency flow is:

```text
views ──> services ──> ai-capability ──> provider clients
                    ├─> persistence
                    └─> store

views ──> store (read state and commit UI-only changes)
persistence ──> domain types
```

Provider clients never import Store, persistence, services or Vue components.
Repositories never update Store. Store never performs I/O.

## A feature request

A normal Chat, Image or Video request has four explicit phases:

1. A service reads the current reactive input and resolves the model binding.
2. The capability gateway executes a provider adapter and returns one normalized
   result.
3. The service commits the result to the in-memory Store projection.
4. The service asks a typed repository to persist the domain object.

There is no local HTTP-shaped `/_api` layer. Browser persistence is an ordinary
function boundary and reports failures by throwing errors. Services decide how
those failures are shown to the user.

## Capability architecture

There is one capability module for Chat, Image and Video under
`src/ai-capability`. Each uses three descriptions that must stay separate.

### Provider definition

Located in each capability's `types.ts`. It describes a service connection:

- provider name;
- default endpoint;
- editable connection fields;
- default protocol adapter.

It does not describe a particular model's optional inputs or parameters.

### Model binding

Located in each capability's `models.ts`. One binding is one exact
`model × provider × adapter` combination and is the single source of truth for:

- supported parameters;
- input/output capabilities;
- message format, sizes or resolutions;
- adapter options required by that combination.

The same model on two providers may have two different bindings. Lookups with a
provider are exact and never fall back to another provider's binding.

### Adapter / client

Located in each capability's `providers` directory. It owns protocol behavior:

- URL and authentication headers;
- request body translation;
- streaming or task polling;
- response and error normalization.

An adapter must not infer model families with string matching. Protocol
variation is declared in binding `adapterOptions`.

## Canonical resolution

`resolveChatModel`, `resolveImageModel`, and `resolveVideoModel` are the boundary
between user configuration and runtime behavior. Parameter panels, capability
indicators and executors all use the resolved binding. Reimplementing those
rules in a Vue component, Store or service creates a second source of truth.

Unknown custom models use the selected provider's default adapter and
conservative capabilities. Supporting a custom model does not mean guessing
that it supports files, search, masks or other optional inputs.

## Run snapshots

Chat, Image and Video responses use the same `RunSnapshot`. Chat stores it in
`message.meta.run`; Image and Video assistant messages store it in
`message.run`.

The snapshot is created at the execution boundary and owns the exact model
binding, adapter, sanitized request parameters, capabilities, status, duration,
usage, output count, provider task status and error for that response. Changing
current settings never rewrites historical Run information.

Run snapshots never store API keys or binary inputs. Sensitive parameters are
redacted, large inline content is omitted, and connection URLs are stripped of
credentials, query parameters and fragments before persistence.

## Persistence boundary

`src/persistence` is the only application persistence boundary.

- `workspaceRepository` owns model settings and prompt templates.
- `chatRepository` owns Chat conversations, settings and messages.
- `imageRepository` owns generated Image assets and Image conversations.
- `videoRepository` owns generated Video assets and Video conversations.
- `browser/blobs.ts` is the IndexedDB implementation used by repositories and
  attachment workflows.

The localStorage document stores only small workspace configuration and
conversation indexes. Chat, Image and Video message collections live in three
IndexedDB object stores under `ai-api-hub-workspace-records-v4`. Repositories
also hide media indirection: callers work with usable data URLs while persisted
messages use small `idb:` references. Serialization and blob cleanup do not
belong in a feature service.

Repositories also convert Store projections into plain cloneable records at
the persistence boundary. Vue reactive proxies must never reach IndexedDB.

The current browser schema key is `ai-api-hub.workspace.v4`. This project is in
active development, so old internal schemas are intentionally not migrated.

## Store boundary

Vuex is a reactive in-memory projection, not a backend or business layer.

- Mutations are synchronous and named after the corresponding state operation.
- There is no pass-through Action layer.
- Vue components use the typed `useAppStore()` entry point; registered mutation
  names are checked against the root state operations.
- Persisted data is loaded and saved by services through repositories.
- Request-only state such as pending flags and provider polling status remains
  transient and is never treated as historical response data.

Views may read Store state. They should call a service for workflows involving
providers or persistence, and commit directly only for local UI state.

## Conversation lifecycle

Chat conversations and creation sessions intentionally have different product
semantics:

- A Chat conversation is one causal history. Each new Run may use the model
  currently selected in the composer while still sending the configured amount
  of preceding history. The persisted conversation model snapshot records the
  latest selection for reopening; each Assistant message's `RunSnapshot` records
  the exact model that produced that response. Editing a user message replaces
  downstream history and regenerates from that point with the current selection.
- An Image or Video session is a collection of independent Runs. Each new Run
  may select another model. Reusing an old input fills the composer and creates
  a new Run while preserving the previous result.

Image and Video share collection lifecycle code for list, create, select and
delete. Their message schemas, provider execution, polling and persistence
folding remain separate. Chat keeps its own lifecycle because its causal history
and per-conversation request settings require different behavior.

## View ownership

`MainView` owns the workspace sidebar and renders feature routes through one
nested router view. Each workbench owns one scrolling result viewport and keeps
its composer in normal document flow beneath it. Floating navigation is limited
to a contextual “jump to latest” action.

`LeftView` owns sidebar workflows such as create, select, rename, export and
delete. Its children own presentation only: `SidebarPrimaryNav` renders feature
navigation, `SidebarHistorySection` renders one normalized history collection,
and `SidebarSettingsNav` renders settings navigation.

`ImageIndex` and `VideoIndex` own route/session state, composer drafts, model
selection and request submission. `ImageMessageList` and `VideoMessageList` own
historical run rendering, message folding and attachment preview. Reusing an old
input is emitted back to the parent because it changes the current composer
draft; it does not mutate the historical run.

`CreationComposer` owns only the shared composer shell. `ImageSourceDialog`
owns the shared choice between generated Image assets and the browser's local
file picker, and emits a normal `File`. Chat, Image and Video views remain
responsible for converting that file into their capability-specific attachment
shape.

All three workbenches use the same full-width shell: `WorkbenchHeaderBar` owns
the session identity, cumulative token usage and contextual navigation;
`workbench-content` constrains only the readable result column; `ComposerDock`
remains full width and owns the complete current-turn interaction. Chat, Image
and Video composers therefore keep model selection and model settings beside
the prompt, attachments, capabilities and send/stop action.

All three workbenches expose a compact right-side topic navigator. Chat topics
show the active response's Markdown outline, while Image and Video topics show
the independent prompts in the session. `ChatHeaderBar` composes the shared
header with the user-question history for navigating the full causal
conversation.

Chat messages are Vue components. Provider execution and streaming state live
in services and Store runtime projections; views do not construct message DOM
nodes or maintain a parallel rendering tree. Per-result `RunDetails` is shared
by Chat, Image and Video and stays collapsed until requested.

## Adding support

### Add a model to an existing provider

1. Add one binding in the capability's `models.ts`.
2. Declare its parameters and capabilities on that binding.
3. Add `adapterOptions` only when the existing protocol needs explicit variation.

No Store, persistence or UI branch should be necessary.

### Add a provider that uses an existing protocol

1. Add its provider definition in `types.ts`.
2. Add model bindings that reference the existing adapter.
3. Add authentication variation to the adapter only if required.

### Add a new protocol

1. Add a stable adapter ID in capability types.
2. Implement a client in `providers`.
3. Register its factory in `providers/executor.ts`.
4. Point explicit model bindings at the adapter.
