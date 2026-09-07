import type { ChatMsg, ModelConfig } from '../types'
import { fetchAI } from './fetchAI'
import { fetchLinkContext } from './links'

export interface StreamOpts {
  model: ModelConfig
  msgs: ChatMsg[]
  system?: string
  temperature?: number
  maxTokens?: number
  onDelta: (text: string) => void
  onReasoning?: (text: string) => void
  onDone?: (full: string) => void
  onError?: (err: string) => void
  signal?: AbortSignal
}

const SYLLABUS_SHORT = `MP Board Class 10 quarterly syllabus:
- English: Prose: A Letter to God; Nelson Mandela; His First Flight; Black Aeroplane; Anne Frank; Glimpses of India. Poems: Dust of Snow; Fire and Ice; Tiger in the Zoo; How to Tell Wild Animals; The Ball Poem; Amanda! Supplementary (Footprints without Feet): A Triumph of Surgery; The Thief's Story; The Midnight Visitor; A Question of Trust.
- Hindi (answer in Hindi for this subject): सूरदास के पद; राम-लक्ष्मण-परशुराम संवाद; नेताजी का चश्मा; बलगोविन भगत; माता का आँचल; व्याकरण (मुहावरे, लोकोक्तियाँ, रस/अलंकार, संधि).
- Maths: Real Numbers; Polynomials; Linear Equations; Quadratic Equations; Arithmetic Progressions; Triangles; Coordinate Geometry.
- Science: Chemical Reactions; Life Processes; Control and Coordination; Human Eye; Our Environment.
- Social Science: Power Sharing; Federalism; Development; Sectors of Indian Economy; Rise of Nationalism in Europe; Nationalism in India; Resources and Development; Forest & Wildlife; Water Resources; Minerals & Energy.
- Sanskrit (answer in Sanskrit/Hindi for this subject): शिशुलालनम्; जननी तुल्यवत्सला; सुभाषितानि; पाठ 4-6.`

const BASE_SYSTEM = `You are "Genexam AI", an expert teacher for MP Board Class 10 students preparing for the quarterly (Trimashik) exam.
- Reply in the language the user writes in. Keep Hindi/Sanskrit subject content in its original language.
- Be exam-oriented, concise, and correct. Use markdown; LaTeX for math ($...$ inline).
- Only set questions from the syllabus below, in MP Board previous-year style.
${SYLLABUS_SHORT}`

export function systemPrompt(extra?: string) {
  return extra ? `${BASE_SYSTEM}\n\n${extra}` : BASE_SYSTEM
}

export function buildMessages(msgs: ChatMsg[], system: string) {
  const out: Array<{ role: string; content: any }> = [{ role: 'system', content: system }]
  for (const m of msgs) {
    if (m.role === 'user' && m.images && m.images.length > 0) {
      const parts: any[] = []
      for (const img of m.images) {
        const [meta, b64] = img.split(',')
        const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg'
        parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
      }
      parts.push({ type: 'text', text: m.content })
      out.push({ role: 'user', content: parts })
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

/** Reads an SSE chat-completions stream; separates reasoning tokens from content tokens. */
async function readSSE(
  res: Response,
  handlers: { onContent: (d: string) => void; onReasoning: (d: string) => void },
): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
  let thinkOpen = false // for models that wrap thinking in <think> tags inside content
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const j = JSON.parse(payload)
        const delta = j.choices?.[0]?.delta ?? {}
        const reasoning: string = delta.reasoning_content ?? delta.reasoning ?? ''
        if (reasoning) {
          handlers.onReasoning(reasoning)
          continue
        }
        let rest: string = delta.content ?? j.choices?.[0]?.text ?? ''
        if (!rest) continue
        if (thinkOpen || rest.includes('<think>')) {
          while (rest) {
            if (thinkOpen) {
              const end = rest.indexOf('</think>')
              if (end === -1) {
                handlers.onReasoning(rest)
                rest = ''
              } else {
                handlers.onReasoning(rest.slice(0, end))
                rest = rest.slice(end + 8)
                thinkOpen = false
              }
            } else {
              const start = rest.indexOf('<think>')
              if (start === -1) {
                full += rest
                handlers.onContent(rest)
                rest = ''
              } else {
                const before = rest.slice(0, start)
                if (before) {
                  full += before
                  handlers.onContent(before)
                }
                rest = rest.slice(start + 7)
                thinkOpen = true
              }
            }
          }
        } else {
          full += rest
          handlers.onContent(rest)
        }
      } catch { /* partial chunk */ }
    }
  }
  return full
}

export async function streamChat(opts: StreamOpts): Promise<void> {
  const { model, msgs, onDelta, onError, signal } = opts
  if (!model) {
    onError?.('No AI model configured. Open Settings and add a model first.')
    return
  }

  // Auto-fetch context for links in the latest user message
  let enriched = msgs
  let full = ''
  let reasoning = ''
  try {
    const last = msgs[msgs.length - 1]
    if (last && last.role === 'user') {
      const links = extractUrls(last.content)
      if (links.length > 0) {
        const contexts = await Promise.all(links.slice(0, 2).map((u) => fetchLinkContext(u)))
        const ctxText = contexts.filter(Boolean).join('\n\n---\n\n')
        if (ctxText) {
          enriched = [...msgs.slice(0, -1), { ...last, content: `${last.content}\n\n[Link context:\n${ctxText}\n]` }]
        }
      }
    }
  } catch { /* non-fatal */ }

  try {
    const res = await fetchAI({
      model,
      body: {
        model: model.modelId,
        messages: buildMessages(enriched, systemPrompt(opts.system)),
        temperature: opts.temperature ?? 0.7,
        stream: true,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      },
      signal,
    })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${text.slice(0, 300)}`)
    }
    full = await readSSE(res, {
      onContent: onDelta,
      onReasoning: (d) => {
        reasoning += d
        opts.onReasoning?.(reasoning)
      },
    })
    opts.onDone?.(full)
  } catch (e: any) {
    // stop pressed mid-stream: keep whatever was generated so far
    if (e?.name === 'AbortError') {
      opts.onDone?.(full)
      return
    }
    onError?.(friendlyError(e))
  }
}

export function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)>\]]+/g) || []
}

/** Map low-level failures to friendly, actionable messages. */
export function friendlyError(e: unknown): string {
  const msg = String((e as any)?.message || e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return 'Could not reach your AI provider (direct and via proxy). Check your internet connection and the Base URL in Settings. Note: `http://` base URLs are blocked on the live site — use `https://`.'
  if (/API 401|API 403/.test(msg))
    return 'Your API key was rejected. Check the key in Settings.'
  if (/API 404/.test(msg))
    return 'Model or endpoint not found. Check the Model ID and Base URL in Settings.'
  if (/API 429/.test(msg))
    return 'Rate limit reached — wait a few seconds and try again.'
  if (/API 5\d\d/.test(msg))
    return 'The AI provider had a temporary problem. Please try again.'
  return msg
}

function cleanJSON(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

/**
 * Never throws a raw "Unexpected end of JSON input" at the user.
 * 1) strip fences, find the JSON start
 * 2) try a direct parse
 * 3) if truncated, auto-repair: keep all completed items and close open brackets
 */
export function robustParse<T>(raw: string): T {
  let s = cleanJSON(raw.trim())
  const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0)
  if (starts.length && starts[0] > 0) s = s.slice(Math.min(...starts))

  // tolerate trailing commas
  const tolerant = s.replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(tolerant) as T
  } catch { /* fall through to repair */ }

  const repaired = repairJSON(tolerant)
  try {
    return JSON.parse(repaired) as T
  } catch { /* give up with a friendly error */ }

  throw new Error('The AI response was interrupted. Please try again.')
}

function scanState(s: string) {
  let inStr = false
  let esc = false
  const stack: string[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') stack.pop()
  }
  return { inStr, stack }
}

function repairJSON(s: string): string {
  // cut at the last fully-completed depth-1 child (e.g. a finished question object)
  let inStr = false
  let esc = false
  const stack: string[] = []
  let lastSafe = -1
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') {
      stack.pop()
      if (stack.length === 1) lastSafe = i + 1
      if (stack.length === 0) return s.slice(0, i + 1) // already complete top-level
    }
  }
  if (lastSafe > 0) s = s.slice(0, lastSafe)
  s = s.replace(/,\s*$/, '')
  const { inStr: strOpen, stack: open } = scanState(s)
  let out = s
  if (strOpen) out += '"'
  while (open.length) out += open.pop() === '{' ? '}' : ']'
  return out
}

/** Non-streaming JSON request. Set stream=true to also get live text (unused by callers now). */
export async function chatJSON<T>(opts: {
  model: ModelConfig
  msgs: ChatMsg[]
  system?: string
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}): Promise<T> {
  const attempt = async (effort: boolean): Promise<T> => {
    const { model } = opts
    if (!model) throw new Error('No AI model configured')
    const res = await fetchAI({
      model,
      body: {
        model: model.modelId,
        messages: buildMessages(opts.msgs, systemPrompt(opts.system)),
        temperature: opts.temperature ?? 0.6,
        stream: false,
        // NOTE: no max_tokens cap — reasoning models spend tokens thinking first
        ...(effort && opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${text.slice(0, 300)}`)
    }
    const j = await res.json()
    let content: string = j.choices?.[0]?.message?.content ?? ''
    // strip reasoning-model <think> blocks from non-streaming replies
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^<think>[\s\S]*/, '')
    return robustParse<T>(content)
  }
  try {
    return await attempt(true)
  } catch (e: any) {
    const msg = String(e?.message || e)
    // provider rejected reasoning_effort → retry without it
    if (opts.reasoningEffort && /API 400/i.test(msg)) {
      try {
        return await attempt(false)
      } catch (e2: any) {
        return retryOrThrow(e2, () => attempt(false))
      }
    }
    return retryOrThrow(e, () => attempt(opts.reasoningEffort ? false : true))
  }
}

async function retryOrThrow<T>(e: any, fn: () => Promise<T>): Promise<T> {
  const msg = String(e?.message || e)
  const retryable = /JSON|interrupted|Failed to fetch|NetworkError|API 5\d\d|API 429/i.test(msg)
  if (!retryable) throw e
  await new Promise((r) => setTimeout(r, 800))
  return fn()
}

/** Streams a JSON response and calls onText with the accumulated raw text as it arrives (for live progress). */
export async function streamJSON<T>(opts: {
  model: ModelConfig
  msgs: ChatMsg[]
  system?: string
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  onText?: (accumulated: string) => void
  onReasoning?: (accumulated: string) => void
  signal?: AbortSignal
}): Promise<T> {
  const attempt = async (effort: boolean): Promise<T> => {
    const { model } = opts
    if (!model) throw new Error('No AI model configured')
    const res = await fetchAI({
      model,
      body: {
        model: model.modelId,
        messages: buildMessages(opts.msgs, systemPrompt(opts.system)),
        temperature: opts.temperature ?? 0.6,
        stream: true,
        // NOTE: no max_tokens cap — reasoning models spend tokens thinking first
        ...(effort && opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      },
      signal: opts.signal,
    })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${text.slice(0, 300)}`)
    }
    let full = ''
    let reasoning = ''
    full = await readSSE(res, {
      onContent: (d) => {
        full += d
        opts.onText?.(full)
      },
      onReasoning: (d) => {
        reasoning += d
        opts.onReasoning?.(reasoning)
      },
    })
    return robustParse<T>(full)
  }
  try {
    return await attempt(true)
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (opts.reasoningEffort && /API 400/i.test(msg)) {
      try {
        return await attempt(false)
      } catch (e2: any) {
        return retryOrThrow(e2, () => attempt(false))
      }
    }
    return retryOrThrow(e, () => attempt(opts.reasoningEffort ? false : true))
  }
}

/** Count complete-looking question objects in a streaming JSON string (live progress). */
export function countStreamedItems(text: string, key = '"q"'): number {
  return (text.match(new RegExp(key.replace(/"/g, '\\\\"'), 'g')) || []).length
}
