export type JsonObject = Record<string, unknown>;
export interface StreamJsonMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export interface JsonRequestOptions {
  headers?: Record<string, string>;
  body?: JsonObject;
}

export interface StreamJsonOptions extends JsonRequestOptions {
  onEvent: (data: JsonObject, message: StreamJsonMessage) => void | Promise<void>;
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const error = record.error as Record<string, unknown> | undefined;
    const message = error?.message || record.message;
    if (message) return String(message);
  }

  return fallback;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestJson<TData = JsonObject>(url: string, options: JsonRequestOptions = {}): Promise<TData> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: JSON.stringify(options.body || {}),
  });
  const data = await readResponsePayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `${response.status} ${response.statusText}`));
  }

  return data as TData;
}

export async function streamJsonEvents(url: string, options: StreamJsonOptions): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      ...(options.headers || {}),
    },
    body: JSON.stringify(options.body || {}),
  });

  if (!response.ok) {
    const data = await readResponsePayload(response);
    throw new Error(getErrorMessage(data, `${response.status} ${response.statusText}`));
  }

  if (!response.body) return;

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  const emitEvent = async (rawEvent: string) => {
    const lines = rawEvent.split(/\r?\n/);
    const message: StreamJsonMessage = { data: "" };
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (!line || line.startsWith(":")) return;
      const separatorIndex = line.indexOf(":");
      const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      const value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^ /, "");

      if (field === "data") dataLines.push(value);
      if (field === "event") message.event = value;
      if (field === "id") message.id = value;
      if (field === "retry") message.retry = Number(value);
    });

    message.data = dataLines.join("\n");
    if (!message.data || message.data === "[DONE]") return;

    let data: JsonObject;
    try {
      data = JSON.parse(message.data);
    } catch {
      throw new Error(message.data);
    }

    await options.onEvent(data, message);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      await emitEvent(rawEvent);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) await emitEvent(buffer);
}
