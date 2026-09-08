import { useEffect, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Mic, MicOff, X, Trash2, MessageSquare, ArrowDown, Plus } from 'lucide-react'
import { useModels } from '../store/models'
import { useUI } from '../store/ui'
import { streamChat, extractUrls } from '../lib/ai'
import { useStreamChat } from '../components/useStreamChat'
import { UserBubble, AssistantBubble, StopSendButton } from '../components/ChatUI'
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
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
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
      navReplace()
      sendGeneric(st.seed || 'Help me study this.', st.images || [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navReplace() {
    window.history.replaceState({}, '')
  }

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

  const hasYT = extractUrls(input).some((u) => /youtu\.?be|youtube\.com/.test(u))

  return (
    <div className="flex h-[calc(100dvh-3.5rem-72px)] flex-col sm:h-[calc(100dvh-3.5rem-28px)]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-line px-1 pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <MessageSquare className="text-indigo-500 dark:text-indigo-400" size={17} /> AI Tutor
          </h1>
          <p className="text-[11px] text-muted">Syllabus, YouTube links, photos, doubts — sab yahan.</p>
        </div>
        {msgs.length > 0 && (
          <button className="btn-ghost !py-2 text-xs" onClick={clear}>
            <Trash2 size={13} /> <span className="hidden sm:inline">New chat</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto pt-5">
          <div className="mx-auto max-w-3xl space-y-6 px-1">
            {msgs.length === 0 && !stream.isStreaming && (
              <Welcome onPick={(t) => setInput(t)} hasModel={!!model} />
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <UserBubble key={i} msg={m} />
              ) : (
                <AssistantBubble
                  key={i}
                  content={m.content}
                  reasoning={m.reasoning}
                  onRegenerate={i === lastAssistantIdx && !stream.isStreaming ? () => regenerate(i) : undefined}
                />
              ),
            )}
            {stream.isStreaming && <AssistantBubble content={stream.text} streaming reasoning={stream.reasoning} />}
            {preparing && (
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 text-xs text-indigo-600 dark:text-indigo-300">
                {preparing}
              </div>
            )}
            {stream.error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">
                {stream.error}
              </div>
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {!atBottom && (
          <button
            onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true) }}
            className="absolute bottom-4 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-fg shadow-pop"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-3xl pb-3 pt-2">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded-xl border border-line object-cover" />
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
        <div className="card flex items-end gap-1.5 p-2 !rounded-3xl shadow-pop">
          <input ref={fileRef} type="file" accept="image/*,.txt,.md,.csv" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface2 hover:text-fg"
            onClick={() => fileRef.current?.click()}
            title="Attach photo or file"
          >
            <Plus size={19} />
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
            placeholder={hasYT ? 'YouTube link detected — just send it!' : 'Paste a syllabus, lecture link, or ask anything…'}
            className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-faint"
          />
          {stream.isStreaming ? (
            <StopSendButton onClick={stream.stop} />
          ) : (
            <>
              <button
                onClick={toggleMic}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${listening ? 'mic-live bg-red-500 text-white' : 'text-faint hover:bg-surface2 hover:text-fg'}`}
                title="Speak"
              >
                {listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
                onClick={send}
                disabled={!input.trim() && images.length === 0}
                title="Send"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-faint">
          AI can make mistakes — verify important facts. · {!model && <button className="text-amber-500 underline" onClick={() => useUI.getState().openAddModel()}>Add a model to start</button>}
        </p>
      </div>
    </div>
  )
}

function Welcome({ onPick, hasModel }: { onPick: (t: string) => void; hasModel: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>
      </span>
      <div>
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Kya seekhna hai aaj?</h2>
        <p className="mt-1.5 text-sm text-muted">
          YouTube link do toh transcript padh ke guide karega. Syllabus type karo toh plan, notes, quiz — sab banega.
        </p>
      </div>
      <div className="grid w-full max-w-xl gap-1.5 sm:grid-cols-2">
        {[
          'Meri syllabus copy karo: [yahan paste karo] — phir 7-day study plan banao',
          'Is YouTube lecture se notes banao: [link paste karo]',
          'Mere syllabus ke most important 20 questions do',
          'Mujhe ek 25-mark practice paper do meri syllabus se',
        ].map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-line bg-surface p-3 text-left text-xs text-muted transition hover:border-indigo-500/40 hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
      {!hasModel && (
        <p className="text-xs text-amber-500">
          <button className="underline" onClick={() => useUI.getState().openAddModel()}>Add a model</button> to get started.
        </p>
      )}
    </div>
  )
}
