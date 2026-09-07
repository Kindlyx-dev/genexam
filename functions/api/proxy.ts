// Cloudflare Pages Function: /api/proxy
// Forwards OpenAI-compatible requests (chat completions + model catalog) to
// the user's provider. Needed because many providers don't send CORS headers,
// so the browser blocks direct calls ("Failed to fetch"). Retried here
// server-side, where CORS doesn't apply. Streaming (SSE) passes through.
export async function onRequestPost({ request }: { request: Request }): Promise<Response> {
  let upstream: Response
  try {
    const { target, payload, method } = await request.json<{
      target?: string
      payload?: unknown
      method?: 'GET' | 'POST'
    }>()
    if (!target || !/^https:\/\//i.test(target)) {
      return json({ error: 'Invalid target URL' }, 400)
    }
    if (method !== 'GET' && !target.includes('/chat/completions') && !target.includes('/models')) {
      return json({ error: 'Invalid target URL' }, 400)
    }
    // rebuild a clean upstream request — never forward cookies/CF headers
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const apiKey = request.headers.get('x-proxy-api-key')
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    upstream = await fetch(target, {
      method: method === 'GET' ? 'GET' : 'POST',
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
    })
  } catch {
    return json({ error: 'Proxy could not reach the provider' }, 502)
  }
  const res = new Response(upstream.body, upstream)
  res.headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('X-Accel-Buffering', 'no')
  return res
}

export async function onRequestOptions(): Promise<Response> {
  const res = new Response(null, { status: 204 })
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-proxy-api-key')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  return res
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
