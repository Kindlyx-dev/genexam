import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Loader2, CheckCircle2, XCircle, RotateCcw, Timer } from 'lucide-react'
import { SYLLABUS, findSubject } from '../data/syllabus'
import { useModels } from '../store/models'
import { streamJSON, robustParse } from '../lib/ai'
import ReasoningPanel from '../components/ReasoningPanel'
import { useGam, XP_RULES } from '../store/gamification'
import { useProgress, useMistakes } from '../store/study'

interface QuizQ {
  q: string
  options: string[]
  answer: number
  explanation: string
}

type Phase = 'setup' | 'playing' | 'done'

const Q_TIME = 20

export default function QuizPage() {
  const { models, activeModelId } = useModels()
  const model = models.find((m) => m.id === activeModelId) ?? null
  const { addXp, bump } = useGam()
  const recordAnswer = useProgress((s) => s.recordAnswer)
  const recordQuiz = useProgress((s) => s.recordQuiz)
  const mistakes = useMistakes()

  const [subjectId, setSubjectId] = useState(SYLLABUS[0].id)
  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(0) // live count while streaming
  const [error, setError] = useState('')
  const [qs, setQs] = useState<QuizQ[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(Q_TIME)
  const [answers, setAnswers] = useState<Array<{ q: QuizQ; picked: number | null }>>([])
  const abortRef = useRef<AbortController | null>(null)
  const [genText, setGenText] = useState('')
  const [genReasoning, setGenReasoning] = useState('')
  const lastTextRef = useRef('')

  const subject = findSubject(subjectId)!

  const start = useCallback(async () => {
    if (!model) { setError('No model configured yet — add one in Settings.'); return }
    setLoading(true)
    setError('')
    setLoaded(0)
    setGenText('')
    setGenReasoning('')
    lastTextRef.current = ''
    abortRef.current = new AbortController()
    try {
      const chapters = subject.chapters.map((c) => c.name).join('; ')
      const lang = subject.id === 'hindi' || subject.id === 'sanskrit'
        ? `Write questions in ${subject.id === 'hindi' ? 'Hindi' : 'Sanskrit'}.`
        : 'Write questions in English.'
      const res = await streamJSON<{ questions: QuizQ[] }>({
        model,
        msgs: [{
          role: 'user',
          content: `Generate 8 rapid-fire MCQs for MP Board Class 10 ${subject.name} quarterly exam from ONLY these chapters: ${chapters}.
Easy-medium mix. "answer" = index (0-3) of the correct option. "explanation" = max 12 words. ${lang}
Return ONLY JSON: {"questions":[{"q":"...","options":["a)","b)","c)","d)"],"answer":0,"explanation":"..."}]}`,
        }],
        temperature: 0.8,
        reasoningEffort: 'low',
        signal: abortRef.current.signal,
        onText: (acc) => {
          lastTextRef.current = acc
          setGenText(acc)
          const n = (acc.match(/"q"\s*:/g) || []).length
          setLoaded(n)
        },
      })
      const list = (res.questions || [])
        .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({ ...q, answer: Number(q.answer) }))
        .filter((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
      if (list.length === 0) throw new Error('No questions received — try again')
      setQs(list)
      setIdx(0)
      setScore(0)
      setAnswers([])
      setPicked(null)
      setTimeLeft(Q_TIME)
      setPhase('playing')
    } catch (e: any) {
      // Stop pressed or stream interrupted — salvage whatever questions completed
      if (lastTextRef.current) {
        try {
          const partial = robustParse<{ questions: QuizQ[] }>(lastTextRef.current)
          const list = (partial.questions || [])
            .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
            .map((q) => ({ ...q, answer: Number(q.answer) }))
            .filter((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
          if (list.length >= 3) {
            setQs(list)
            setIdx(0)
            setScore(0)
            setAnswers([])
            setPicked(null)
            setTimeLeft(Q_TIME)
            setPhase('playing')
            return
          }
        } catch { /* nothing usable */ }
      }
      if (e?.name === 'AbortError') setError('Stopped. Press Start quiz to try again.')
      else setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [model, subject])

  useEffect(() => {
    if (phase !== 'playing' || picked !== null) return
    if (timeLeft <= 0) { handlePick(null); return }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft, picked])

  function handlePick(optionIdx: number | null) {
    const q = qs[idx]
    const correct = optionIdx === q.answer
    if (correct) setScore((s) => s + 1)
    setPicked(optionIdx ?? -2)
    setAnswers((a) => [...a, { q, picked: optionIdx }])
    recordAnswer(subjectId, correct)
    if (!correct && optionIdx !== null) {
      mistakes.add({
        subjectId,
        question: q.q,
        yourAnswer: q.options[optionIdx],
        correct: q.options[q.answer],
        note: q.explanation,
      })
    }
  }

  function next() {
    if (idx + 1 >= qs.length) {
      const pct = Math.round((score / qs.length) * 100)
      recordQuiz(subjectId, pct)
      bump('quizzes')
      if (score === qs.length) addXp(XP_RULES.quizPerfect)
      else addXp(XP_RULES.quizFinish + score * 3)
      setPhase('done')
      return
    }
    setIdx((i) => i + 1)
    setPicked(null)
    setTimeLeft(Q_TIME)
  }

  function restart() {
    setPhase('setup')
    setQs([])
  }

  // ---------- SETUP ----------
  if (phase === 'setup') {
    return (
      <div className="anim-in mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><Zap className="text-amber-500" size={22} /> Rapid Quiz</h1>
          <p className="mt-1 text-sm text-muted">8 MCQs · 20 seconds each · instant feedback · earn XP. Reflex + revision in one.</p>
        </div>
        <div className="card space-y-4 p-5">
          <div>
            <span className="label">Pick a subject</span>
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
          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">{error}</div>}
          {loading ? (
            <ReasoningPanel
              title="Generating your quiz"
              text={genText}
              reasoning={genReasoning}
              progress={loaded > 0 ? `${loaded}/8 questions` : undefined}
              onStop={() => abortRef.current?.abort()}
            />
          ) : (
            <button className="btn-primary w-full !py-3" onClick={start}>
              <><Zap size={16} /> Start quiz</>
            </button>
          )}
          {!model && <p className="text-center text-[11px] text-amber-500"><Link to="/settings" className="underline">Add a model</Link> to generate questions</p>}
        </div>
      </div>
    )
  }

  // ---------- DONE ----------
  if (phase === 'done') {
    const pct = Math.round((score / qs.length) * 100)
    return (
      <div className="anim-in mx-auto max-w-2xl space-y-5">
        <div className="card p-8 text-center">
          <p className="text-5xl">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</p>
          <h1 className="mt-3 text-3xl font-extrabold">{score}/{qs.length}</h1>
          <p className="mt-1 text-sm text-muted">{subject.name} rapid quiz · {pct}% accuracy</p>
          <div className="mx-auto mt-4 flex justify-center gap-1.5">
            {answers.map((a, i) => (
              <span key={i} className={`h-2 w-6 rounded-full ${a.picked === a.q.answer ? 'bg-emerald-500' : 'bg-red-500'}`} />
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">+{score === qs.length ? XP_RULES.quizPerfect : XP_RULES.quizFinish + score * 3} XP earned</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-soft" onClick={restart}><RotateCcw size={14} /> New quiz</button>
            <Link to="/mistakes" className="btn-ghost">Review mistakes</Link>
          </div>
        </div>
        <div className="space-y-2">
          {answers.filter((a) => a.picked !== a.q.answer).map((a, i) => (
            <div key={i} className="card p-4 text-sm">
              <p className="font-semibold">{a.q.q}</p>
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">✗ Yours: {a.picked != null && a.picked >= 0 ? a.q.options[a.picked] : '(time out)'}</p>
              <p className="text-xs text-emerald-500 dark:text-emerald-400">✓ Correct: {a.q.options[a.q.answer]}</p>
              <p className="mt-1 text-xs text-muted">{a.q.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------- PLAYING ----------
  const q = qs[idx]
  const tPct = (timeLeft / Q_TIME) * 100

  return (
    <div className="anim-in mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-1">
          {qs.map((_, i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full ${i < idx ? 'bg-indigo-500' : i === idx ? 'bg-indigo-500/50' : 'bg-line'}`} />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted">{idx + 1}/{qs.length}</span>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-sm font-bold tabular-nums">
          <Timer size={13} className={timeLeft <= 5 ? 'text-red-500' : 'text-muted'} />
          <span className={timeLeft <= 5 ? 'text-red-500' : ''}>{String(timeLeft).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="h-1 bg-line">
          <div className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${tPct}%` }} />
        </div>
        <div className="p-5 sm:p-6">
          <h2 className="text-base font-bold leading-relaxed sm:text-lg">{q.q}</h2>
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, oi) => {
              const isCorrect = oi === q.answer
              const isPicked = picked === oi
              const show = picked !== null
              return (
                <button
                  key={oi}
                  disabled={show}
                  onClick={() => handlePick(oi)}
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    show
                      ? isCorrect
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isPicked
                          ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'border-line text-faint'
                      : 'border-line hover:border-indigo-500/60 hover:bg-indigo-500/5'
                  }`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                  {show && isCorrect && <CheckCircle2 size={16} className="ml-auto shrink-0" />}
                  {show && isPicked && !isCorrect && <XCircle size={16} className="ml-auto shrink-0" />}
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <div className="anim-in mt-4">
              <div className={`rounded-xl border p-3 text-xs ${picked === q.answer ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'}`}>
                {picked === q.answer ? 'Correct! ' : 'Wrong. '}{q.explanation}
              </div>
              <button className="btn-primary mt-3 w-full" onClick={next}>
                {idx + 1 >= qs.length ? 'See result →' : 'Next question →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
