import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mic, MicOff, X, ArrowDown, Plus, RotateCcw } from 'lucide-react'
import { useModels } from '../store/models'
import { useUI } from '../store/ui'
import { streamChat, extractUrls } from '../lib/ai'
import { useStreamChat } from '../components/useStreamChat'
import { AssistantBubble, StopSendButton } from '../components/ChatUI'
import { fetchLinkContext } from '../lib/links'
import type { ChatMsg, PendingImage } from '../types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ChatState {
  msgs: ChatMsg[]
  set: (m: ChatMsg[]) => void
  clear: () => void
}

const useChat = create<ChatState>()(
  persist(
    (set) => ({
      msgs: [],
      set: (msgs) => set({ msgs }),
      clear: () => set({ msgs: [] }),
    }),
    { name: 'genexam-chat' },
  ),
)

interface LocState {
  seed?: string
  images?: PendingImage[]
}

/**
 * Google-style results page: the chatbar sits at the top (like Google's search
 * box on the results screen) and every answer streams below it as results.
 */
export default function ChatPage() {
  const { models, activeModelId } = useModels()
  const model = models.find((m) => m.id === activeModelId) ?? null
  const { msgs, set, clear } = useChat()
  const loc = useLocation()
  const seededRef = useRef(false)

  const [input, setInput] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const [preparing, setPreparing] = useState('')
  const stream = useStreamChat()
  const reasoningRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const [listening, setListening] = useState(false)
  const recogRef = useRef<any>(null)

  const lastAssistantIdx = (() => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') return i
    return -1
  })()

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, stream.text, stream.isStreaming, atBottom])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 160)
  }

  async function run(list: ChatMsg[]) {
    if (!model) return
    stream.start()
    stream.abortController.current = new AbortController()
    await streamChat({
      model,
      msgs: list,
      maxTokens: 3000,
      signal: stream.abortController.current.signal,
      onDelta: stream.pushDelta,
      onReasoning: (acc) => {
        reasoningRef.current = acc
        stream.pushReasoning(acc)
      },
      onDone: (full) => {
        stream.finish(full)
        set([...list, { role: 'assistant', content: full, reasoning: reasoningRef.current || undefined }])
      },
      onError: (e) => stream.fail(e),
    })
  }

  /** Read links (YouTube transcript / page text) before sending so the AI has real context. */
  async function prepare(list: ChatMsg[]): Promise<ChatMsg[]> {
    const last = list[list.length - 1]
    if (!last || last.role !== 'user') return list
    const links = extractUrls(last.content)
    if (links.length === 0) return list
    try {
      setPreparing('Reading your link…')
      const contexts = await Promise.all(links.slice(0, 2).map((u) => fetchLinkContext(u)))
      const ctx = contexts.filter(Boolean).join('\n\n---\n\n')
      if (ctx) {
        return [...list.slice(0, -1), { ...last, content: `${last.content}\n\n[Link context:\n${ctx}\n]` }]
      }
    } catch { /* best effort */ }
    return list
  }

  async function sendGeneric(text: string, imgs: PendingImage[]) {
    reasoningRef.current = ''
    if ((!text && imgs.length === 0) || stream.isStreaming) return
    if (!model) {
      stream.fail('No model yet — click "Add model" in the top bar.')
      return
    }
    const userMsg: ChatMsg = {
      role: 'user',
      content: text || 'Look at this and help me study it.',
      images: imgs.length ? imgs.map((i) => i.dataUrl) : undefined,
    }
    const next = [...msgs, userMsg]
    set(next)
    setAtBottom(true)
    const enriched = await prepare(next)
    setPreparing('')
    await run(enriched)
  }

  async function send() {
    const text = input.trim()
    const imgs = images
    setInput('')
    setImages([])
    await sendGeneric(text, imgs)
  }

  // Seed from the home chatbar (YouTube link / typed syllabus / attachments)
  useEffect(() => {
    if (seededRef.current) return
    const st = (loc.state || {}) as LocState
    if (st.seed || (st.images && st.images.length)) {
      seededRef.current = true
      window.history.replaceState({}, '')
      sendGeneric(st.seed || 'Help me study this.', st.images || [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function regenerate(idx: number) {
    if (stream.isStreaming) return
    reasoningRef.current = ''
    const upto = msgs.slice(0, idx)
    set(upto)
    run(upto)
  }

  async function onFiles(files: FileList | null) {
    if (!files) return
    const arr: PendingImage[] = []
    for (const f of Array.from(files).slice(0, 4)) {
      if (f.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.readAsDataURL(f)
        })
        arr.push({ dataUrl, name: f.name })
      } else if (/\.(txt|md|csv)$/i.test(f.name) && f.size < 512 * 1024) {
        const content = await f.text()
        setInput((t) => `${t}${t ? '\n\n' : ''}[Attached file — ${f.name}]\n${content}`)
      }
    }
    setImages((p) => [...p, ...arr])
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleMic() {
    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      stream.fail('Voice input is not supported in this browser. Try Chrome.')
      return
    }
    const r = new SR()
    r.lang = 'en-IN'
    r.interimResults = true
    r.continuous = false
    let final = ''
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setInput(final + interim)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recogRef.current = r
    r.start()
    setListening(true)
  }

  const empty = msgs.length === 0 && !stream.isStreaming

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Sticky search bar (Google results style) ── */}
      <div className="sticky top-14 z-30 border-b border-line bg-bg/90 backdrop-blur-xl no-print">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow" title="New search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>
          </Link>

          <div className="card flex flex-1 items-end gap-1 !rounded-full p-1 pr-1.5 transition focus-within:border-indigo-500/60">
            <input ref={fileRef} type="file" accept="image/*,.txt,.md,.csv" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface2 hover:text-fg"
              onClick={() => fileRef.current?.click()}
              title="Attach photo or file"
            >
              <Plus size={17} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder={hasYT(input) ? 'YouTube link detected — press Enter' : 'Search again — syllabus, link, or question…'}
              className="max-h-32 flex-1 resize-none bg-transparent px-0.5 py-2 text-sm outline-none placeholder:text-faint"
            />
            {stream.isStreaming ? (
              <StopSendButton onClick={stream.stop} />
            ) : (
              <>
                <button
                  onClick={toggleMic}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${listening ? 'mic-live bg-red-500 text-white' : 'text-faint hover:bg-surface2 hover:text-fg'}`}
                  title="Speak"
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
                  onClick={send}
                  disabled={!input.trim() && images.length === 0}
                  title="Search"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {msgs.length > 0 && (
            <button className="btn-ghost !p-2 text-faint" onClick={clear} title="New search">
              <RotateCcw size={15} />
            </button>
          )}
        </div>
        {images.length > 0 && (
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-4 pb-2.5">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-12 w-12 rounded-lg border border-line object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white shadow"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex flex-col items-center gap-5 px-4 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>
            </span>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">What are we studying today?</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted">
                Search above with a YouTube link, your syllabus, or a photo — the AI tutor builds notes, plans, quizzes and papers from it.
              </p>
            </div>
            <div className="grid w-full max-w-xl gap-1.5 sm:grid-cols-2">
              {[
                'Make me a 7-day study plan from my syllabus: [paste it]',
                'Take notes from this lecture: [YouTube link]',
                'Give me the 20 most important questions from: [chapter]',
                'Create a 25-mark practice paper from: [topic]',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-2xl border border-line bg-surface p-3 text-left text-xs text-muted transition hover:border-indigo-500/40 hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
            {!model && (
              <p className="text-xs text-amber-500">
                <button className="underline" onClick={() => useUI.getState().openAddModel()}>Add a model</button> to get results.
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6">
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="mb-4 border-b border-line pb-4">
                  {m.images && m.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.images.map((img, j) => (
                        <img key={j} src={img} alt="" className="h-20 rounded-xl border border-line object-cover" />
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-faint">You searched</p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-fg">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="mb-8">
                  <AssistantBubble
                    content={m.content}
                    reasoning={m.reasoning}
                    onRegenerate={i === lastAssistantIdx && !stream.isStreaming ? () => regenerate(i) : undefined}
                  />
                </div>
              ),
            )}
            {stream.isStreaming && (
              <div className="mb-8">
                <AssistantBubble content={stream.text} streaming reasoning={stream.reasoning} />
              </div>
            )}
            {preparing && (
              <div className="mb-6 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 text-xs text-indigo-600 dark:text-indigo-300">
                {preparing}
              </div>
            )}
            {stream.error && (
              <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">
                {stream.error}
              </div>
            )}
            <div ref={bottomRef} className="h-2" />
            <p className="pb-8 text-center text-[10px] text-faint">AI can make mistakes — verify important facts.</p>
          </div>
        )}

        {!atBottom && !empty && (
          <button
            onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true) }}
            className="sticky bottom-4 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-fg shadow-pop"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function hasYT(text: string): boolean {
  return extractUrls(text).some((u) => /youtu\.?be|youtube\.com/.test(u))
}
