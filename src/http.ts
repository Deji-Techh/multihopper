import { newIdempotencyKey } from "./idempotency.js";
import type { RuntimeConfig } from "./config.js";

export class MultiHopperApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "MultiHopperApiError";
    this.status = status;
    this.body = body;
  }
}

export class MultiHopperClient {
  constructor(private readonly config: RuntimeConfig) {}

  async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    options: { idempotencyKey?: string | false } = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.config.apiKey) headers["x-api-key"] = this.config.apiKey;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method === "POST" && options.idempotencyKey !== false) {
      headers["Idempotency-Key"] = options.idempotencyKey ?? newIdempotencyKey();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = text.length ? safeJsonParse(text) : null;

      if (!response.ok) {
        throw new MultiHopperApiError(response.status, parsed, `MultiHopper API returned ${response.status} for ${method} ${path}`);
      }

      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
