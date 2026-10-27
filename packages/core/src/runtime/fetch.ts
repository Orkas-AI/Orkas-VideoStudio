/**
 * fetch with an explicit timeout. Every outbound provider call sets one — no
 * relying on platform defaults. Ordinary JSON/control and TTS calls use ~60s;
 * generation polls use a short per-request timeout (20–30s) while the overall
 * task timeout is enforced by the polling loop.
 */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  return fetchAndReadWithTimeout(url, init, async response => response);
}

export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) { super(`request timed out after ${timeoutMs}ms`); }
}

export class ProviderHttpError extends Error {
  constructor(readonly status: number, detail?: string) {
    super(`provider request failed with HTTP ${status}${detail ? `: ${detail}` : ''}`);
  }
}

/** Keep the deadline and caller cancellation active through body consumption. */
export async function fetchAndReadWithTimeout<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number },
  read: (response: Response, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const { timeoutMs = 60_000, signal: external, ...rest } = init;
  external?.throwIfAborted();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new RequestTimeoutError(timeoutMs)), timeoutMs);
  const signal = external ? AbortSignal.any([ctl.signal, external]) : ctl.signal;
  try {
    let response: Response;
    try { response = await fetch(url, { ...rest, signal }); }
    catch {
      // A configured endpoint or signed URL may appear in fetch diagnostics.
      throw new Error('network request failed');
    }
    signal.throwIfAborted();
    return await read(response, signal);
  } catch (error) {
    if (ctl.signal.aborted) throw ctl.signal.reason;
    if (external?.aborted) throw external.reason;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class ResponseTooLargeError extends Error {
  constructor() { super('response was too large and was not saved'); }
}

/** Incremental cap and cancellation also work with custom fetch/stream adapters. */
export async function readResponseBytes(response: Response, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  signal.throwIfAborted();
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ResponseTooLargeError();
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) return Buffer.concat(chunks, bytes);
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ResponseTooLargeError();
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ResponseTooLargeError) throw error;
    throw new Error('network response could not be read');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/**
 * Best-effort human-readable message from a provider error payload: a string,
 * an object carrying message / msg / error / detail(s) / code (searched
 * recursively, first hit wins), or an array of those — FastAPI-style
 * validation bodies are `{detail: [{loc, msg, type}]}`, where the field name
 * is prefixed so "Input should be 5 or 10" says which input. Never echoes the
 * whole body, so a payload that reflects headers or keys stays private.
 */
export function providerErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = providerErrorMessage(item);
      if (message) return message;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.msg === 'string' && Array.isArray(record.loc)) {
    const field = record.loc.filter((part): part is string => typeof part === 'string' && part !== 'body').join('.');
    return field ? `${field}: ${record.msg}` : record.msg;
  }
  for (const key of ['message', 'msg', 'error', 'detail', 'details', 'code']) {
    const message = providerErrorMessage(record[key]);
    if (message) return message;
  }
  return undefined;
}

/** Keep provider failures actionable without echoing headers, URLs, or secrets. */
function providerErrorDetail(body: string): string | undefined {
  let detail: string | undefined;
  try {
    detail = providerErrorMessage(JSON.parse(body));
  } catch {
    detail = body.replace(/\s+/g, ' ').trim() || undefined;
  }
  return detail?.slice(0, 500);
}

export interface JsonResponsePolicy {
  maxBytes?: number;
  includeProviderDetails?: boolean;
}

/** POST JSON and parse a JSON response, throwing a legible error on non-2xx. */
export async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 60_000, policy: JsonResponsePolicy = {}): Promise<unknown> {
  return fetchAndReadWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    timeoutMs,
  }, (res, signal) => readJsonResponse(res, signal, policy));
}

async function readJsonResponse(res: Response, signal: AbortSignal, policy: JsonResponsePolicy): Promise<unknown> {
  if (!res.ok && policy.includeProviderDetails === false) {
    await res.body?.cancel().catch(() => {});
    throw new ProviderHttpError(res.status);
  }
  // Image JSON can embed full-resolution base64 data. Only control callers
  // opt into a small body cap; retain the existing image response contract.
  const text = policy.maxBytes === undefined ? await res.text()
    : (await readResponseBytes(res, policy.maxBytes, signal)).toString('utf8');
  if (!res.ok) {
    const detail = policy.includeProviderDetails === false ? undefined : providerErrorDetail(text);
    throw new ProviderHttpError(res.status, detail);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('provider returned a non-JSON response');
  }
}

/** GET and parse a JSON response, throwing a legible error on non-2xx. */
export async function getJson(url: string, headers: Record<string, string>, timeoutMs = 30_000, policy: JsonResponsePolicy = {}): Promise<unknown> {
  return fetchAndReadWithTimeout(url, { method: 'GET', headers, timeoutMs }, (res, signal) => readJsonResponse(res, signal, policy));
}
