import { getSettings } from './settings';
import { isNativeApp } from './platform';

/**
 * Builds the URL used to fetch a remote resource.
 *
 * - `direct`  : the URL is used as-is.
 * - `custom`  : the URL is appended to the configured proxy. The proxy template
 *               may contain the placeholder `{url}`, otherwise the target is
 *               appended as a query parameter (`?url=` / `&url=`).
 *
 * Any CORS proxy can be used (AllOrigins, corsproxy.io, r.jina.ai, a
 * self-hosted worker, ...).
 */
export function buildProxyUrl(target: string): string {
  const settings = getSettings();
  if (settings.proxyMode === 'direct' || !settings.proxyUrl) {
    return target;
  }

  const proxy = settings.proxyUrl.trim();
  if (proxy.includes('{url}')) {
    return proxy.replace('{url}', encodeURIComponent(target));
  }

  const separator = proxy.includes('?') ? '&' : '?';
  return `${proxy}${separator}url=${encodeURIComponent(target)}`;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  /** Timeout override in ms. */
  timeoutMs?: number;
  /** Number of extra attempts after the first failure. */
  retries?: number;
  /** Use the configured CORS proxy. */
  useProxy?: boolean;
}

export interface ProxyFetchResult {
  ok: boolean;
  status: number;
  text: string;
  headers: Headers;
  url: string;
}

export class ProxyFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ProxyFetchError';
  }
}

/**
 * Fetches a URL, optionally through the configured CORS proxy.
 * Retries are attempted with a small exponential backoff.
 */
export async function proxyFetch(
  target: string,
  options: FetchOptions = {},
): Promise<ProxyFetchResult> {
  const settings = getSettings();
  const useProxy = options.useProxy !== false;
  // Native Rust HTTP bypasses WebView CORS; browser builds keep the configured proxy path.
  const url = isNativeApp() ? target : useProxy ? buildProxyUrl(target) : target;

  const headers: Record<string, string> = {
    Accept: '*/*',
    ...(options.headers ?? {}),
  };

  if (settings.userAgentOverride) {
    headers['User-Agent'] = settings.userAgentOverride;
  }
  if (useProxy && settings.proxyMode === 'custom') {
    for (const [key, value] of Object.entries(settings.proxyHeaders)) {
      headers[key] = value;
    }
  }

  const timeoutMs = options.timeoutMs ?? settings.proxyTimeoutMs;
  const retries = options.retries ?? settings.proxyRetries;
  const attempts = Math.max(0, retries) + 1;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    try {
      if (import.meta.env.DEV && !isNativeApp()) {
        const body = options.body;
        const bodyText =
          typeof body === 'string'
            ? body
            : body instanceof URLSearchParams
              ? body.toString()
              : body instanceof Blob
                ? await body.text()
                : null;
        const relayResponse = await fetch('/__feedgram/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            method: options.method ?? 'GET',
            headers,
            body: bodyText,
          }),
          signal: controller.signal,
          credentials: 'same-origin',
        });
        const relay = (await relayResponse.json()) as {
          ok?: boolean;
          status?: number;
          text?: string;
          headers?: Record<string, string>;
          url?: string;
          error?: string;
        };
        if (!relayResponse.ok) {
          throw new Error(relay.error ?? `Proxy failed (${relayResponse.status})`);
        }
        return {
          ok: relay.ok ?? false,
          status: relay.status ?? 502,
          text: relay.text ?? '',
          headers: new Headers(relay.headers),
          url: relay.url ?? url,
        };
      }
      const init: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        body: options.body ?? null,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'follow',
      };
      const response = isNativeApp()
        ? await (await import('@tauri-apps/plugin-http')).fetch(url, init)
        : await fetch(url, init);

      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text,
        headers: response.headers,
        url,
      };
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) break;
      if (attempt < attempts - 1) {
        await delay(500 * Math.pow(2, attempt));
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Request failed';
  throw new ProxyFetchError(message, 0, url);
}

export async function fetchJson<T>(
  target: string,
  options: FetchOptions = {},
): Promise<T> {
  const result = await proxyFetch(target, options);
  if (!result.ok) {
    throw new ProxyFetchError(
      `Request failed with status ${result.status}`,
      result.status,
      result.url,
    );
  }
  try {
    return JSON.parse(result.text) as T;
  } catch {
    throw new ProxyFetchError('Response was not valid JSON', result.status, result.url);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
