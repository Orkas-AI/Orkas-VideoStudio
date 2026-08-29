/**
 * fetch with an explicit timeout. Every outbound provider call sets one — no
 * relying on platform defaults. Ordinary JSON/control and TTS calls use ~60s;
 * generation polls use a short per-request timeout (20–30s) while the overall
 * task timeout is enforced by the polling loop.
 */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 60_000, signal: external, ...rest } = init;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  const signal = external ? AbortSignal.any([ctl.signal, external]) : ctl.signal;
  try {
    return await fetch(url, { ...rest, signal });
  } catch (error) {
    if (ctl.signal.aborted) throw ctl.signal.reason;
    if (external?.aborted) throw external.reason;
    // Fetch errors can contain a configured endpoint or signed URL. Keep
    // provider-facing failures actionable without echoing those values.
    throw new Error('network request failed', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['message', 'error', 'detail', 'details', 'code']) {
    const message = errorMessage(record[key]);
    if (message) return message;
  }
  return undefined;
}

/** Keep provider failures actionable without echoing headers, URLs, or secrets. */
function providerErrorDetail(body: string): string | undefined {
  let detail: string | undefined;
  try {
    detail = errorMessage(JSON.parse(body));
  } catch {
    detail = body.replace(/\s+/g, ' ').trim() || undefined;
  }
  return detail?.slice(0, 500);
}

/** POST JSON and parse a JSON response, throwing a legible error on non-2xx. */
export async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 60_000): Promise<unknown> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    timeoutMs,
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = providerErrorDetail(text);
    throw new Error(`provider request failed with HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('provider returned a non-JSON response');
  }
}

/** GET and parse a JSON response, throwing a legible error on non-2xx. */
export async function getJson(url: string, headers: Record<string, string>, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetchWithTimeout(url, { method: 'GET', headers, timeoutMs });
  const text = await res.text();
  if (!res.ok) {
    const detail = providerErrorDetail(text);
    throw new Error(`provider request failed with HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('provider returned a non-JSON response');
  }
}
