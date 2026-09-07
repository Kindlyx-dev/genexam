// Fetches readable context for YouTube links (transcript) and web links (page text).
// Uses public CORS proxies — best effort, works from the browser without a backend.

const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
]

async function fetchViaProxy(url: string): Promise<string> {
  let lastErr: unknown = null
  for (const p of PROXIES) {
    try {
      const res = await fetch(p(url))
      if (!res.ok) throw new Error(`proxy ${res.status}`)
      const text = await res.text()
      if (text.trim()) return text
      throw new Error('empty response')
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('all proxies failed')
}

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

function extractJsonAfter(html: string, marker: string): any | null {
  const i = html.indexOf(marker)
  if (i === -1) return null
  const start = html.indexOf('{', i)
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let j = start; j < html.length; j++) {
    const c = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export interface YtContext {
  kind: 'youtube'
  title: string
  transcript: string
}

export async function fetchYouTubeContext(watchUrl: string): Promise<YtContext> {
  const html = await fetchViaProxy(watchUrl)
  const player = extractJsonAfter(html, 'ytInitialPlayerResponse')
  const title: string = player?.videoDetails?.title ?? 'YouTube video'
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (tracks.length === 0) throw new Error('no caption tracks')
  const track =
    tracks.find((t: any) => t.languageCode === 'hi') ||
    tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
    tracks[0]
  const raw = await fetchViaProxy(`${track.baseUrl}&fmt=json3`)
  let transcript = ''
  try {
    const j = JSON.parse(raw)
    transcript = (j.events || [])
      .map((ev: any) => (ev.segs || []).map((s: any) => s.utf8 || '').join(''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    transcript = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;#39;/g, "'")
      .replace(/&amp;quot;/g, '"')
      .replace(/&amp;amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (!transcript) throw new Error('empty transcript')
  return { kind: 'youtube', title, transcript: transcript.slice(0, 15000) }
}

export interface WebContext {
  kind: 'web'
  title: string
  text: string
}

async function fetchViaJina(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`)
  if (!res.ok) throw new Error(`jina ${res.status}`)
  return res.text()
}

export async function fetchWebContext(url: string): Promise<WebContext> {
  let text = ''
  try {
    text = await fetchViaJina(url)
  } catch {
    const html = await fetchViaProxy(url)
    text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  }
  return {
    kind: 'web',
    title: url.replace(/^https?:\/\//, '').slice(0, 60),
    text: text.slice(0, 12000),
  }
}

export async function fetchLinkContext(
  url: string,
): Promise<string> {
  const yt = youtubeId(url)
  if (yt) {
    try {
      const ctx = await fetchYouTubeContext(
        `https://www.youtube.com/watch?v=${yt}`,
      )
      return `YOUTUBE VIDEO: "${ctx.title}"\nTRANSCRIPT (Hindi/auto):\n${ctx.transcript}`
    } catch {
      try {
        const md = await fetchViaJina(`https://www.youtube.com/watch?v=${yt}`)
        return `YOUTUBE VIDEO page content:\n${md.slice(0, 8000)}`
      } catch {
        return `YOUTUBE LINK (transcript unavailable): ${url}`
      }
    }
  }
  try {
    const ctx = await fetchWebContext(url)
    return `WEBPAGE: ${ctx.title}\n${ctx.text}`
  } catch {
    return `LINK (content unavailable): ${url}`
  }
}
