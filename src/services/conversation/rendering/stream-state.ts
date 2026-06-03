import type { ChatResponseDelta, TokenUsage } from "@/types";

/**
 * Lightweight stream state-machine.
 *
 *   idle ──(startStream)──→ streaming ──(complete)──→ completed
 *                              │    │
 *                    (error delta)  (stop)
 *                              │    │
 *                              ▼    ▼
 *                            error  stopped
 */

export type StreamStatus = "idle" | "streaming" | "completed" | "error" | "stopped";

export interface StreamDraft {
  content: string;
  reasoning_content: string;
}

export function createStreamState() {
  let messageId = "";
  let content = "";
  let reasoningContent = "";
  let tokenUsage: TokenUsage | null = null;
  let status: StreamStatus = "idle";
  let error = "";

  function reset(msgId = "") {
    messageId = msgId;
    content = "";
    reasoningContent = "";
    tokenUsage = null;
    status = "idle";
    error = "";
  }

  /** Enter streaming from idle — fresh assistant turn. */
  function startStream(msgId: string) {
    messageId = msgId;
    content = "";
    reasoningContent = "";
    tokenUsage = null;
    status = "streaming";
    error = "";
  }

  function applyDelta(delta: ChatResponseDelta) {
    if (status === "stopped") return;
    if (status === "idle") status = "streaming";

    switch (delta.kind) {
      case "usage":
        tokenUsage = delta.usage;
        break;
      case "error":
        status = "error";
        error = delta.message;
        break;
      case "text":
        content += delta.content || "";
        reasoningContent += delta.reasoning_content || "";
        break;
    }
  }

  /** Replace content wholesale — used for error fallback / timeout placeholder. */
  function setContent(text: string, reasoning = "") {
    content = text;
    if (reasoning) reasoningContent = reasoning;
  }

  function complete() {
    if (status === "streaming") status = "completed";
  }
  function stop() {
    if (status === "streaming") status = "stopped";
  }

  // -- queries --
  const getDraft = (): StreamDraft => ({ content, reasoning_content: reasoningContent });
  const getMessageId = () => messageId;
  const getStatus = () => status;
  const getError = () => error;
  const getTokenUsage = () => tokenUsage;
  const hasContent = () => Boolean(content || reasoningContent);
  const isStopped = () => status === "stopped";
  const isError = () => status === "error";
  const isStreaming = () => status === "streaming";

  return {
    reset,
    startStream,
    applyDelta,
    setContent,
    complete,
    stop,
    getDraft,
    getMessageId,
    getStatus,
    getError,
    getTokenUsage,
    hasContent,
    isStopped,
    isError,
    isStreaming,
  };
}

export type StreamState = ReturnType<typeof createStreamState>;
