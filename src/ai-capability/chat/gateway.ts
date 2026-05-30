import type {
  ChatCompletionParams,
  ChatModelCapabilities,
  ChatModelConfig,
  ChatProviderResponse,
  ChatResponseDelta,
  PackedChatMessage,
  ChatRequest,
  ChatExecutor,
} from "./types";
import { createChatExecutor, createChatProviderConfig } from "./providers/executor";

type ChatDeltaQueueItem = { delta?: ChatResponseDelta; done?: true };

function providerResponseToDeltas(response: ChatProviderResponse): ChatResponseDelta[] {
  if (response.flag === false) {
    return [{ kind: "error", message: String(response.content || "") }];
  }

  const deltas: ChatResponseDelta[] = [];

  if (response.content || response.reasoning_content) {
    deltas.push({ kind: "text", content: response.content, reasoning_content: response.reasoning_content });
  }

  if (response.usage) {
    deltas.push({ kind: "usage", usage: response.usage });
  }

  return deltas;
}

function createChatDeltaQueue() {
  const items: ChatDeltaQueueItem[] = [];
  const waiters: ((item: ChatDeltaQueueItem) => void)[] = [];

  function emit(item: ChatDeltaQueueItem): void {
    const waiter = waiters.shift();
    if (waiter) waiter(item);
    else items.push(item);
  }

  return {
    push(delta: ChatResponseDelta | null): void {
      if (delta) emit({ delta });
    },
    pushMany(deltas: ChatResponseDelta[]): void {
      deltas.forEach((delta) => emit({ delta }));
    },
    close(): void {
      emit({ done: true });
    },
    next(): Promise<ChatDeltaQueueItem> {
      const item = items.shift();
      if (item) return Promise.resolve(item);
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

/**
 * Runtime bridge between normalized chat messages and provider clients.
 *
 * It applies turn-level request parameters and delegates the actual network
 * call to a provider executor.
 */
export class ChatGateway {
  executor: ChatExecutor | null;
  abortController: AbortController | null;

  constructor() {
    this.executor = null;
    this.abortController = null;
  }

  init(model: ChatModelConfig | null = null): void {
    if (!model) {
      console.warn("ChatGateway init called without a model config. Executor will not be created.");
      return;
    }

    const config = createChatProviderConfig(model);
    this.executor = config ? createChatExecutor(config) : null;
  }

  abort(): void {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = null;
  }

  async *chat(messages: PackedChatMessage[], request: ChatRequest = {}): AsyncGenerator<ChatResponseDelta, boolean, void> {
    const model = request.model;
    if (!this.executor || !model?.name || !model?.apiKey) {
      yield { kind: "error", message: "Chat model is not configured." };
      return false;
    }

    let abortController: AbortController | null = null;

    try {
      this.abort();
      this.init(model);
      abortController = new AbortController();
      this.abortController = abortController;
      const queue = createChatDeltaQueue();
      let completed = false;

      void this.executor
        .chat(messages, this.resolveChatParams(request.params, request.capabilities), (response) => queue.pushMany(providerResponseToDeltas(response)), {
          signal: abortController.signal,
        })
        .then(() => {
          completed = true;
          queue.close();
        })
        .catch((err) => {
          if (!abortController?.signal.aborted) queue.push({ kind: "error", message: String(err) });
          queue.close();
        });

      while (true) {
        const item = await queue.next();
        if (item.done) break;
        if (item.delta) yield item.delta;
      }

      return completed;
    } catch (err) {
      if (abortController?.signal.aborted) return false;
      yield { kind: "error", message: String(err) };
      return false;
    } finally {
      if (this.abortController === abortController) this.abortController = null;
    }
  }

  /**
   * Resolve effective chat completion parameters for the current turn,
   * applying any turn-level overrides.
   */
  resolveChatParams(params: ChatCompletionParams = {}, turnCapabilities: Partial<ChatModelCapabilities> = {}): ChatCompletionParams {
    return {
      ...params,
      webSearch: Boolean(turnCapabilities.webSearch),
    };
  }
}
