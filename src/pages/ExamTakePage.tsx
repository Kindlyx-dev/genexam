import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Loader2, Send, Printer, AlertTriangle } from 'lucide-react'
import { findSubject } from '../data/syllabus'
import { useExams } from '../store/exams'
import { useModels } from '../store/models'
import { streamJSON } from '../lib/ai'
import ReasoningPanel from '../components/ReasoningPanel'
import { EVAL_SYSTEM, evalUserPrompt, applyEval } from '../lib/prompts'
import { useGam, XP_RULES } from '../store/gamification'
import { useMistakes } from '../store/study'
import { normalizeQuestions } from '../lib/questions'
import type { ExamPaper } from '../types'
import PrintablePaper from '../components/PrintablePaper'

interface EvalResponse {
  results: Array<{ id: string; score: number; feedback: string }>
  totalScore: number
  totalMarks: number
  percentage: number
  grade: string
  weakChapters?: string[]
  overallFeedback: string
}

/** Group consecutive questions that share a group header (blueprint sub-parts). */
function groupsOf(paper: ExamPaper): Array<{ group?: string; questions: ExamPaper['questions'] }> {
  const blocks: Array<{ group?: string; questions: ExamPaper['questions'] }> = []
  for (const q of paper.questions) {
    const last = blocks[blocks.length - 1]
    if (q.group && last?.group === q.group) last.questions.push(q)
    else blocks.push({ group: q.group || undefined, questions: [q] })
  }
  return blocks
}

/** OR-choice toggle for questions with an internal choice. */
function OrChoice({ choiceOf, useOr, onChange }: { choiceOf: string; useOr: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-2.5 grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-surface2/40 p-1.5">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition ${!useOr ? 'bg-indigo-600 text-white' : 'text-muted hover:text-fg'}`}
      >
        Question
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition ${useOr ? 'bg-indigo-600 text-white' : 'text-muted hover:text-fg'}`}
        title={choiceOf}
      >
        OR — other choice
      </button>
      {useOr && <p className="col-span-2 rounded-lg bg-indigo-500/5 px-3 py-2 text-[11px] leading-relaxed text-muted">{choiceOf}</p>}
    </div>
  )
}

export default function ExamTakePage() {
  const { paperId = '' } = useParams()
  const nav = useNavigate()
  const { getPaper, updatePaper } = useExams()
  const { models, activeModelId } = useModels()
  const model = models.find((m) => m.id === activeModelId) ?? null
  const { addXp, bump } = useGam()
  const mistakes = useMistakes()

  const paper = getPaper(paperId)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const saved: Record<string, string> = {}
    paper?.questions.forEach((q) => (saved[q.id] = q.userAnswer || ''))
    return saved
  })
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [orPrefs, setOrPrefs] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [evalText, setEvalText] = useState('')
  const [evalReasoning, setEvalReasoning] = useState('')
  const [error, setError] = useState('')

  const subj = useMemo(() => (paper ? findSubject(paper.subjectId) : null), [paper])
  // normalized view of questions (extract inline options, infer types)
  const paperN = useMemo(() => (paper ? { ...paper, questions: normalizeQuestions(paper.questions) } : paper), [paper])

  useEffect(() => {
    if (paper && secondsLeft === null) setSecondsLeft(paper.totalTimeMin * 60)
  }, [paper])

  useEffect(() => {
    if (secondsLeft === null || submitting || (secondsLeft ?? 0) <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, submitting])

  if (!paper) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        Paper not found. Create one in the <Link to="/exams" className="text-indigo-500">Exam Studio</Link>.
      </div>
    )
  }

  if (!paperN) return null

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length
  const progressPct = Math.round((answeredCount / paperN.questions.length) * 100)

  function setAnswer(id: string, v: string) {
    setAnswers((p) => ({ ...p, [id]: v }))
  }

  async function submit() {
    if (!paper || !paperN) return
    if (!model) {
      setError('Add an AI model in Settings first — the AI does the checking.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (!paper) return
      const p: ExamPaper = {
        ...paperN,
        questions: paperN.questions.map((q) => ({
          ...q,
          userAnswer: orPrefs[q.id] && q.choiceOf ? `(Answered the OR choice) ${answers[q.id] || ''}` : answers[q.id] || '',
        })),
      }
      const result = await streamJSON<EvalResponse>({
        model,
        msgs: [{ role: 'user', content: evalUserPrompt(p) }],
        system: EVAL_SYSTEM,
        temperature: 0.3,
        reasoningEffort: 'low',
        onText: (acc) => setEvalText(acc),
        onReasoning: (acc) => setEvalReasoning((r) => (r ? r : acc.slice(-2000))),
      })
      applyEval(p, result.results || [])
      updatePaper(p)

      // Gamification + mistake notebook
      const scored = p.questions.reduce((n, q) => n + (q.score ?? 0), 0)
      addXp(XP_RULES.examSubmit + scored * XP_RULES.examPerMark)
      bump('exams')
      for (const q of p.questions) {
        if ((q.score ?? 0) === 0 && (q.userAnswer || '').trim()) {
          mistakes.add({
            subjectId: p.subjectId,
            question: q.q,
            yourAnswer: q.userAnswer || '(blank)',
            correct: q.answer || '—',
            note: q.feedback,
          })
        }
      }
      nav(`/result/${p.id}`)
    } catch (e: any) {
      setError(e?.message || String(e))
      setSubmitting(false)
    }
  }

  const mm = Math.floor((secondsLeft ?? 0) / 60)
  const ss = (secondsLeft ?? 0) % 60
  const low = (secondsLeft ?? 999) < 300

  return (
    <>
      <div className="anim-in mx-auto max-w-3xl screen-only">
      {/* Sticky exam header */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl no-print">
        <div className="flex items-center gap-3">
          <button className="btn-ghost !p-2.5" onClick={() => nav('/exams')} aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">{paper.title}</h1>
            <p className="text-[11px] text-faint">{paper.totalMarks} marks · {paperN.questions.length} questions · {subj?.name}</p>
          </div>
          <button className="btn-ghost !p-2.5 hidden sm:inline-flex" onClick={() => window.print()} title="Print paper"><Printer size={15} /></button>
          <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-sm font-bold tabular-nums ${low ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-line bg-surface text-fg'}`}>
            <Clock size={14} />
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        {/* answered progress */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-faint">{answeredCount}/{paperN.questions.length} answered</span>
        </div>
      </div>

      <div className="space-y-4">
        {groupsOf(paper).map((block, bi) => (
          <div key={bi} className="card p-4 sm:p-5">
            {block.group && (
              <div className="mb-3 border-b border-line pb-2.5">
                <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{block.group}</p>
              </div>
            )}
            <div className={block.group ? 'space-y-4' : ''}>
              {block.questions.map((q) => {
                const i = paperN.questions.indexOf(q)
                return (
                  <div key={q.id}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed">
                        {q.label && <span className="mr-1.5 font-extrabold text-indigo-500">{q.label}</span>}
                        {!block.group && !q.label?.startsWith('Q') && <span className="mr-1.5 font-extrabold text-indigo-500">Q{i + 1}.</span>}
                        {q.q}
                        {q.wordLimit ? <span className="ml-1.5 text-[10px] text-faint">(~{q.wordLimit} words)</span> : null}
                      </p>
                      <span className="chip shrink-0 font-bold">{q.marks}M</span>
                    </div>

                    {/* internal choice (OR) */}
                    {q.choiceOf && (
                      <OrChoice
                        choiceOf={q.choiceOf}
                        useOr={orPrefs[q.id] || false}
                        onChange={(v) => setOrPrefs((p) => ({ ...p, [q.id]: v }))}
                      />
                    )}

                    {q.type === 'mcq' && q.options ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt, oi) => (
                          <label
                            key={oi}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs transition ${
                              answers[q.id] === opt
                                ? 'border-indigo-500 bg-indigo-500/10 font-semibold text-indigo-600 dark:text-indigo-300'
                                : 'border-line hover:border-indigo-500/40 hover:bg-surface2/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="accent-indigo-500"
                              checked={answers[q.id] === opt}
                              onChange={() => setAnswer(q.id, opt)}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : q.type === 'fill' || q.type === 'truefalse' || q.type === 'oneword' || q.type === 'match' ? (
                      q.type === 'truefalse' && !q.options ? (
                        <div className="flex gap-2">
                          {['True', 'False'].map((v) => (
                            <button
                              key={v}
                              onClick={() => setAnswer(q.id, v)}
                              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                                answers[q.id] === v ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          placeholder="Your answer…"
                          className="input"
                        />
                      )
                    ) : (
                      <textarea
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        rows={q.type === 'long' ? 6 : 3}
                        placeholder={q.choiceOf && orPrefs[q.id] ? 'Answer the OR question here…' : 'Write your answer here… (English or Hindi)'}
                        className="input resize-y"
                      />
                    )}
                    {q.feedback && <p className="mt-1.5 text-[11px] text-muted">{q.feedback}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {submitting && (
          <ReasoningPanel title="The AI examiner is checking your answers" text={evalText} reasoning={evalReasoning} progress={evalText ? `${(evalText.match(/"id"/g) || []).length} checked` : undefined} />
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">
            <AlertTriangle size={13} className="mr-1 inline" /> {error}
          </div>
        )}

        <button className="btn-primary w-full !py-3.5 text-base" onClick={submit} disabled={submitting}>
          {submitting ? (
            <><Loader2 size={18} className="animate-spin" /> AI is checking your answers…</>
          ) : (
            <><Send size={17} /> Submit for AI Checking</>
          )}
        </button>
        <p className="pb-4 text-center text-[11px] text-faint">
          You can submit partially filled too — the AI will check whatever is written. ({answeredCount}/{paperN.questions.length} answered)
        </p>
      </div>

      </div>

      {/* Clean printable paper (Save as PDF / Print) — includes every OR choice */}
      <PrintablePaper paper={paperN} />
    </>
  )
}
