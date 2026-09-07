import type { ModelConfig } from '../types'

/**
 * Central fetch for all OpenAI-compatible calls.
 *
 * 1) Tries the provider DIRECTLY from the browser (fastest path).
 * 2) If the browser blocks it (CORS / mixed content → "Failed to fetch"),
 *    retries through our same-origin Cloudflare Function (/api/proxy),
 *    which calls the provider server-side where CORS doesn't apply.
 *
 * Per-endpoint outcome is remembered, so after the first failure later
 * calls go straight through whichever path worked.
 */

const directOk = new Set<string>()
const viaProxy = new Set<string>()

export interface FetchAIOpts {
  model: Pick<ModelConfig, 'baseUrl' | 'apiKey'>
  body: unknown
  signal?: AbortSignal
}

export function chatCompletionsUrl(baseUrl: string): string {
  const b = baseUrl.replace(/\/+$/, '')
  return b.endsWith('/chat/completions') ? b : `${b}/chat/completions`
}

export async function fetchAI(opts: FetchAIOpts): Promise<Response> {
  const url = chatCompletionsUrl(opts.model.baseUrl)
  const key = opts.model.apiKey

  if (viaProxy.has(url)) return sendProxy(url, key, opts)

  try {
    return await send(url, key, opts)
  } catch (e) {
    if (!isBrowserBlock(e) || sameOrigin(url)) throw e
    const res = await sendProxy(url, key, opts)
    viaProxy.add(url)
    return res
  }
}

async function send(url: string, apiKey: string | undefined, opts: FetchAIOpts): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(opts.body),
    signal: opts.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`)
  }
  directOk.add(url)
  return res
}

async function sendProxy(url: string, apiKey: string | undefined, opts: FetchAIOpts): Promise<Response> {
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-proxy-api-key': apiKey } : {}),
    },
    body: JSON.stringify({ target: url, payload: opts.body }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

/** fetch() throws TypeError("Failed to fetch") for CORS/mixed-content/offline. */
function isBrowserBlock(e: unknown): boolean {
  const msg = String((e as any)?.message || e)
  return /Failed to fetch|NetworkError|Load failed/i.test(msg)
}

function sameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin
  } catch {
    return false
  }
}
