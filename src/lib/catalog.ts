import { chatCompletionsUrl } from './fetchAI'

export interface CatalogModel {
  id: string
  free: boolean
  vision: boolean
}

/** Best-effort vision detection from model id (no manual checkbox needed). */
export function isVisionModel(modelId: string): boolean {
  const m = modelId.toLowerCase()
  return /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|vision|gemini|claude-3|claude-sonnet|claude-opus|claude-haiku|qwen.*vl|vl-\d|glm-4v|glm-5|pixtral|llava|internvl|molmo|llama-3\.2-9|llama-3\.2-11|llama-3\.2-90|phi-3\.5-vision|grok-4|grok-vision|o4|deepseek-vl/.test(m)
}

/** Provider says it's free (pricing all-zero) or the id is an obvious free variant. */
export function isFreeModel(m: { id?: string; name?: string; pricing?: { prompt?: string | number; completion?: string | number } }): boolean {
  const id = String(m.id ?? m.name ?? '').toLowerCase()
  if (/:free|(^|\/)free[-_/]|[.-]free$/.test(id)) return true
  if (m.pricing) {
    const p = Number(m.pricing.prompt ?? 0)
    const c = Number(m.pricing.completion ?? 0)
    return p === 0 && c === 0
  }
  return false
}

function isBrowserBlock(e: unknown): boolean {
  const msg = String((e as any)?.message || e)
  return /Failed to fetch|NetworkError|Load failed/i.test(msg)
}

/**
 * Fetch the provider's model catalog (OpenAI-compatible GET /models).
 * Tries directly from the browser first; if the provider blocks CORS,
 * retries through our same-origin Cloudflare Function.
 */
export async function fetchCatalog(baseUrl: string, apiKey?: string): Promise<CatalogModel[]> {
  const base = baseUrl.replace(/\/+$/, '')
  const modelsUrl = base.endsWith('/models') ? base : `${base}/models`
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}

  let res: Response
  try {
    res = await fetch(modelsUrl, { headers })
  } catch (e) {
    if (!isBrowserBlock(e)) throw e
    const target = chatCompletionsUrl(baseUrl).replace(/\/chat\/completions$/, '/models')
    res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-proxy-api-key': apiKey } : {}) },
      body: JSON.stringify({ target, method: 'GET' }),
    })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  const j = await res.json()
  const list: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : []
  const seen = new Set<string>()
  const out: CatalogModel[] = []
  for (const m of list) {
    const id = String(m?.id ?? m?.name ?? '').replace(/^models\//, '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ id, free: isFreeModel(m), vision: isVisionModel(id) })
  }
  out.sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id))
  return out
}
