import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// dev-only stand-in for functions/api/proxy.ts (the Cloudflare Pages Function):
// same /api/proxy contract, so `npm run dev` can reach CORS-blocked providers
// exactly like production does — no wrangler needed
function aiProxyDev(): Plugin {
  return {
    name: 'genexam-ai-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/proxy', (req, res) => {
        void (async () => {
          try {
            const chunks: Buffer[] = []
            for await (const c of req) chunks.push(c as Buffer)
            const { target, payload, method } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
            if (!target || !/^https:\/\//i.test(target)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid target URL' }))
              return
            }
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            const key = String(req.headers['x-proxy-api-key'] || '')
            if (key) headers['Authorization'] = `Bearer ${key}`
            const upstream = await fetch(target, {
              method: method === 'GET' ? 'GET' : 'POST',
              headers,
              body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
            })
            res.statusCode = upstream.status
            const ct = upstream.headers.get('content-type')
            if (ct) res.setHeader('Content-Type', ct)
            const { Readable } = await import('node:stream')
            Readable.fromWeb(upstream.body as any).pipe(res)
          } catch (e) {
            res.statusCode = 502
            res.end(String((e as any)?.message || e))
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), aiProxyDev()],
})
