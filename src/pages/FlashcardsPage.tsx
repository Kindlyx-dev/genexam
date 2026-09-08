import { useRef, useState } from 'react'
import { Layers, Loader2, Sparkles, RotateCcw, CheckCircle2, XCircle, Flame } from 'lucide-react'
import { SYLLABUS, findSubject } from '../data/syllabus'
import { useModels } from '../store/models'
import { streamJSON, robustParse } from '../lib/ai'
import ReasoningPanel from '../components/ReasoningPanel'
import { useCards } from '../store/study'
import { useGam, XP_RULES } from '../store/gamification'

type Phase = 'setup' | 'review' | 'done'

export default function FlashcardsPage() {
  const { models, activeModelId } = useModels()
  const model = models.find((m) => m.id === activeModelId) ?? null
  const { cards, addMany, review } = useCards()
  const { addXp, bump } = useGam()

  const [subjectId, setSubjectId] = useState(SYLLABUS[0].id)
  const [loading, setLoading] = useState(false)
  const [genText, setGenText] = useState('')
  const [genReasoning, setGenReasoning] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const lastTextRef = useRef('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('setup')
  const [queue, setQueue] = useState<string[]>([]) // card ids
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState({ again: 0, good: 0 })

  const subject = findSubject(subjectId)!
  const allSubjectCards = cards.filter((c) => c.subjectId === subjectId)
  const dueCards = cards
    .filter((c) => c.subjectId === subjectId && c.due <= Date.now() + 60000)
    .sort((a, b) => a.due - b.due)

  async function generate() {
    if (!model) { setError('Add an AI model in Settings first.'); return }
    setLoading(true)
    setError('')
    setGenText('')
    setGenReasoning('')
    lastTextRef.current = ''
    abortRef.current = new AbortController()
    try {
      const chapters = subject.chapters.map((c, i) => `${i + 1}. ${c.name}${c.nameHi ? ` (${c.nameHi})` : ''}`).join('; ')
      const lang = subject.id === 'english' ? 'English' : subject.id === 'hindi' || subject.id === 'sanskrit' ? 'Hindi (Devanagari)' : 'bilingual (English + Hindi)'
      const res = await streamJSON<{ cards: Array<{ front: string; back: string }> }>({
        model,
        msgs: [{
          role: 'user',
          content: `Create 15 revision flashcards for MP Board Class 10th ${subject.name}, from ONLY these chapters: ${chapters}.
Front = question/term (short). Back = crisp answer (1-2 lines). Focus on exam-frequently-asked facts, formulas, definitions, dates.
Write in ${lang}.
Return ONLY valid JSON: {"cards":[{"front":"...","back":"..."}]}`,
        }],
        temperature: 0.7,
        reasoningEffort: 'low',
        signal: abortRef.current.signal,
        onText: (acc) => {
          lastTextRef.current = acc
          setGenText(acc)
        },
        onReasoning: (acc) => {
          if (!lastTextRef.current) setGenReasoning(acc.slice(-2000))
        },
      })
      const n = addMany((res.cards || []).map((c) => ({ chapterId: '', subjectId, front: c.front, back: c.back })))
      setError(n === 0 ? 'All cards already exist — start reviewing!' : `${n} new cards created!`)
    } catch (e: any) {
      // Stop or interruption — salvage completed cards
      if (lastTextRef.current) {
        try {
          const partial = robustParse<{ cards: Array<{ front: string; back: string }> }>(lastTextRef.current)
          const n = addMany((partial.cards || []).filter((c) => c.front && c.back).map((c) => ({ chapterId: '', subjectId, front: c.front, back: c.back })))
          setError(n > 0 ? `${n} cards saved (generation was stopped early).` : 'Stopped — no complete cards to save.')
          if (n > 0) return
        } catch { /* nothing usable */ }
      }
      if (e?.name === 'AbortError') setError('Stopped. Press Generate to try again.')
      else setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  function startReview() {
    setQueue(dueCards.map((c) => c.id))
    setStats({ again: 0, good: 0 })
    setFlipped(false)
    setPhase('review')
  }

  function grade(q: 'again' | 'hard' | 'good' | 'easy') {
    const id = queue[0]
    review(id, q)
    addXp(XP_RULES.flashcardReview)
    bump('cardsReviewed')
    setStats((s) => ({ again: s.again + (q === 'again' ? 1 : 0), good: s.good + (q !== 'again' ? 1 : 0) }))
    setFlipped(false)
    if (queue.length === 1) {
      addXp(XP_RULES.flashcardSession)
      setPhase('done')
    } else {
      setQueue((u) => u.slice(1))
    }
  }

  const current = queue.length ? cards.find((c) => c.id === queue[0]) : null

  // ---------- SETUP ----------
  if (phase === 'setup') {
    return (
      <div className="anim-in mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><Layers className="text-emerald-500" size={22} /> Flashcards</h1>
          <p className="mt-1 text-sm text-muted">Spaced repetition — the science-backed way to remember. Cards you forget come back sooner; ones you know move further away.</p>
        </div>
        <div className="card space-y-4 p-5">
          <div>
            <span className="label">Subject</span>
            <div className="flex flex-wrap gap-2">
              {SYLLABUS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSubjectId(s.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    subjectId === s.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                  }`}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-line bg-surface2/50 p-3">
              <p className="text-2xl font-extrabold text-emerald-500">{dueCards.length}</p>
              <p className="text-[11px] text-muted">to revise today</p>
            </div>
            <div className="rounded-xl border border-line bg-surface2/50 p-3">
              <p className="text-2xl font-extrabold">{allSubjectCards.length}</p>
              <p className="text-[11px] text-muted">{subject.name} total cards</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 text-xs text-indigo-600 dark:text-indigo-300">✨ {error}</div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={generate} disabled={loading}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating cards…</> : <><Sparkles size={16} /> Generate cards with AI</>}
            </button>
            {dueCards.length > 0 && (
              <button className="btn-soft flex-1" onClick={startReview}><Flame size={16} /> Start review ({dueCards.length})</button>
            )}
          </div>
          {!model && <p className="text-center text-[11px] text-amber-500">for AI cards <a className="underline" href="#/settings">add a model</a></p>}
        </div>

        {allSubjectCards.length > 0 && (
          <div className="card divide-y divide-line overflow-hidden">
            {allSubjectCards.slice(0, 20).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{c.front}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${c.due <= Date.now() ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                  {c.due <= Date.now() ? 'DUE' : new Date(c.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
            {allSubjectCards.length > 20 && <p className="px-4 py-2 text-[10px] text-faint">+{allSubjectCards.length - 20} more…</p>}
          </div>
        )}
      </div>
    )
  }

  // ---------- DONE ----------
  if (phase === 'done') {
    return (
      <div className="anim-in mx-auto max-w-2xl">
        <div className="card p-8 text-center">
          <p className="text-5xl">🧠</p>
          <h1 className="mt-3 text-2xl font-extrabold">Review complete!</h1>
          <p className="mt-1 text-sm text-muted">{stats.good} remembered · {stats.again} to repeat (they return tomorrow)</p>
          <p className="mt-3 text-xs text-faint">+{stats.good * XP_RULES.flashcardReview + XP_RULES.flashcardSession} XP</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-primary" onClick={() => setPhase('setup')}><RotateCcw size={14} /> More cards</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- REVIEW ----------
  if (!current) return null
  return (
    <div className="anim-in mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted">
        <span>{queue.length} left</span>
        <span>✅ {stats.good} · 🔁 {stats.again}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((dueCards.length - queue.length) / Math.max(1, dueCards.length)) * 100}%` }} />
      </div>

      <div className="flip-scene" onClick={() => setFlipped((f) => !f)}>
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="flip-face card grid min-h-[260px] cursor-pointer place-items-center p-8 text-center">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-faint">Question</p>
              <p className="text-lg font-bold leading-relaxed">{current.front}</p>
              <p className="mt-4 text-[10px] text-faint">tap to flip 👆</p>
            </div>
          </div>
          {/* Back */}
          <div className="flip-face flip-back card absolute inset-0 grid min-h-[260px] cursor-pointer place-items-center border-indigo-500/40 bg-indigo-500/5 p-8 text-center">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-500">Answer</p>
              <p className="text-base font-semibold leading-relaxed">{current.back}</p>
            </div>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {([
            ['again', 'Again', 'bg-red-500 hover:bg-red-400'],
            ['hard', 'Hard', 'bg-amber-500 hover:bg-amber-400'],
            ['good', 'Good', 'bg-indigo-500 hover:bg-indigo-400'],
            ['easy', 'Easy', 'bg-emerald-500 hover:bg-emerald-400'],
          ] as const).map(([q, label, cls]) => (
            <button key={q} onClick={() => grade(q)} className={`rounded-xl py-3 text-sm font-bold text-white transition active:scale-95 ${cls}`}>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <button className="btn-soft mt-4 w-full !py-3" onClick={() => setFlipped(true)}>Reveal answer</button>
      )}
      <div className="h-64" />
    </div>
  )
}
