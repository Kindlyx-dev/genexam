import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, GraduationCap, Brain, Sparkles,
  Mic, MicOff, X, ArrowDown, Plus,
} from 'lucide-react'
import { findChapter } from '../data/syllabus'
import { streamChat, extractUrls } from '../lib/ai'
import { chatVisionText } from '../lib/vision'
import { useModels } from '../store/models'
import { useGam } from '../store/gamification'
import { useStreamChat } from '../components/useStreamChat'
import { UserBubble, AssistantBubble, StopSendButton } from '../components/ChatUI'
import { useProgress } from '../store/study'
import Markdown from '../components/Markdown'
import type { ChatMsg, PendingImage } from '../types'

type Mode = 'explain' | 'practice'

function lsGet<T>(key: string, fb: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fb
  } catch { return fb }
}

export default function ChapterPage() {
  const { subjectId = '', chapterId = '' } = useParams()
  const nav = useNavigate()
  const { subject, chapter } = findChapter(subjectId, chapterId)

  // scope chat per chapter
  const key = `lasttime-chat-${subjectId}-${chapterId}`
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => lsGet<ChatMsg[]>(key, []))
  useEffect(() => {
    setMsgs(lsGet(key, []))
  }, [key])

  const [mode, setMode] = useState<'explain' | 'practice'>('explain')
  const [input, setInput] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const stream = useStreamChat()
  const reasoningRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const [listening, setListening] = useState(false)
  const recogRef = useRef<any>(null)
  const { models, activeModelId } = useModels()
  const model = models.find((m) => m.id === activeModelId) ?? null
  const { addXp } = useGam()
  const progress = useProgress()

  const lastAssistantIdx = (() => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') return i
    return -1
  })()

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, stream.text, stream.isStreaming, atBottom])

  if (!subject || !chapter) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        Chapter not found. <Link className="text-indigo-500" to="/">Syllabus par jao</Link>
      </div>
    )
  }

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }

  async function run(list: ChatMsg[], m: Mode) {
    if (!model) return
    if (!subject || !chapter) return
    stream.start()
    stream.abortController.current = new AbortController()
    const sys =
      m === 'explain'
        ? `The student is studying chapter "${chapter.name}"${chapter.nameHi ? ` (${chapter.nameHi})` : ''} of ${subject.name} (${subject.nameHi}), MP Board Class 10th Trimashik syllabus. Teach this chapter in depth: concepts, summary, important points, exam tips. Respond in the language the student uses. If the student asks something else, still help but connect back to exam prep.`
        : `The student is practicing chapter "${chapter.name}" of ${subject.name}, MP Board Class 10th. When asked for questions, give MP Board PYQ-style questions with marks. When the user writes their own answer, evaluate strictly like an examiner and show the model answer.`
    await streamChat({
      model,
      msgs: list,
      maxTokens: 3000,
      system: sys,
      signal: stream.abortController.current.signal,
      onDelta: stream.pushDelta,
      onReasoning: (acc) => {
        reasoningRef.current = acc
        stream.pushReasoning(acc)
      },
      onDone: (full) => {
        stream.finish(full)
        const final = [...list, { role: 'assistant' as const, content: full, reasoning: reasoningRef.current || undefined }]
        setMsgs(final)
        localStorage.setItem(key, JSON.stringify(final.slice(-40)))
        progress.markExplained(chapter.id)
        addXp(5)
      },
      onError: (e) => stream.fail(e),
    })
  }

  async function send() {
    reasoningRef.current = ''
    const text = input.trim()
    if ((!text && images.length === 0) || stream.isStreaming) return
    if (!model) {
      stream.fail('Add an AI model in Settings first.')
      return
    }
    const imgs = images.map((i) => i.dataUrl)
    const userMsg: ChatMsg = {
      role: 'user',
      content: text || 'Is image ko dekh kar batao.',
      images: imgs.length ? imgs : undefined,
    }
    const next = [...msgs, userMsg]
    setMsgs(next)
    setInput('')
    setImages([])
    setAtBottom(true)
    await run(next, mode)
  }

  function regenerate(idx: number) {
    if (stream.isStreaming) return
    reasoningRef.current = ''
    const upto = msgs.slice(0, idx)
    setMsgs(upto)
    run(upto, mode)
  }

  async function onFiles(files: FileList | null) {
    if (!files) return
    const arr: PendingImage[] = []
    for (const f of Array.from(files).slice(0, 4)) {
      if (!f.type.startsWith('image/')) continue
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.readAsDataURL(f)
      })
      arr.push({ dataUrl, name: f.name })
    }
    setImages((p) => [...p, ...arr])
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleMic() {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { stream.fail('Voice input is not supported in this browser. Try Chrome.'); return }
    const r = new SR()
    r.lang = 'hi-IN'
    r.interimResults = true
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

  const chapterName = chapter.nameHi && chapter.nameHi !== chapter.name ? `${chapter.name} (${chapter.nameHi})` : chapter.name
  const hasYT = extractUrls(input).some((u) => /youtu\.?be|youtube\.com/.test(u))

  return (
    <div className="anim-in flex h-[calc(100dvh-3.5rem-72px)] flex-col sm:h-[calc(100dvh-3.5rem-28px)]">
      {/* Chapter header */}
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <button className="btn-ghost !border-transparent !bg-transparent !p-2.5" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`hidden h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-sm text-white sm:grid ${subject.color}`}>
              {subject.emoji}
            </span>
            <h1 className="truncate text-base font-bold sm:text-lg">{chapterName}</h1>
          </div>
          <p className="truncate text-[11px] text-muted">{subject.name} · {chapter.book ?? subject.nameHi}</p>
        </div>
        <div className="flex rounded-xl border border-line bg-surface p-0.5">
          <button
            onClick={() => setMode('explain')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${mode === 'explain' ? 'bg-indigo-600 text-white' : 'text-muted'}`}
          >
            <GraduationCap size={12} /> Samjho
          </button>
          <button
            onClick={() => setMode('practice')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${mode === 'practice' ? 'bg-indigo-600 text-white' : 'text-muted'}`}
          >
            <Brain size={12} /> Practice
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto pt-4">
          <div className="mx-auto max-w-3xl space-y-6 px-1">
            {msgs.length === 0 && !stream.isStreaming && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
                  <Sparkles size={24} />
                </span>
                <div>
                  <p className="font-bold">{mode === 'explain' ? 'Learn this chapter with AI' : 'Practice time — PYQ style'}</p>
                  <p className="mt-1 text-xs text-muted">Text, photo (sample paper/question), YouTube link — anything works.</p>
                </div>
                <div className="grid w-full max-w-xl gap-1.5 sm:grid-cols-2">
                  {(mode === 'explain'
                    ? [
                        `${chapter.name} explain fully — summary + key points for the exam`,
                        `${chapter.name} — the most important exam topics`,
                        `${chapter.name} — quick revision notes`,
                        `${chapter.name} — most common mistakes students make`,
                      ]
                    : [
                        `${chapter.name} — top 10 important questions in PYQ style`,
                        `${chapter.name} — 5 MCQs + 3 short + 2 long questions with answers`,
                        `${chapter.name} — give me a 20-mark mini test, I will write the answers`,
                        `${chapter.name} — practice numericals step by step`,
                      ]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-2xl border border-line bg-surface p-3 text-left text-xs text-muted transition hover:border-indigo-500/40 hover:text-fg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
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
            {stream.isStreaming && (
              <>
                <AssistantBubble content={stream.text} streaming reasoning={stream.reasoning} />
              </>
            )}
            {stream.error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">⚠️ {stream.error}</div>
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
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface2 hover:text-fg"
            onClick={() => fileRef.current?.click()}
            title="Attach image"
          >
            <Plus size={19} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            rows={1}
            placeholder={hasYT ? 'YouTube link detected — just send it!' : `${mode === 'explain' ? 'Ask about this chapter' : 'Ask for questions or write your answer'}…`}
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
          {subject.emoji} {subject.name} · {chapterName} · {!model && <Link to="/settings" className="text-amber-500 underline">Add a model</Link>}
        </p>
      </div>
    </div>
  )
}
