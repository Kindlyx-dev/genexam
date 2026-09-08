import { useState } from 'react'
import { NotebookPen, Trash2, CheckCircle2, Circle, Eraser } from 'lucide-react'
import { useMistakes } from '../store/study'
import { findSubject } from '../data/syllabus'
import Markdown from '../components/Markdown'

export default function MistakesPage() {
  const { mistakes, toggleResolved, remove, clearResolved, bumpReview } = useMistakes()
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')

  const list = mistakes.filter((m) => (filter === 'all' ? true : filter === 'open' ? !m.resolved : m.resolved))
  const pending = mistakes.filter((m) => !m.resolved).length

  return (
    <div className="anim-in mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><NotebookPen className="text-rose-500" size={22} /> Mistake Notebook</h1>
          <p className="mt-1 text-sm text-muted">Every mistake lands here. Before the exam, revise just this page — you will never repeat them.</p>
        </div>
        {pending > 0 && <span className="chip !border-rose-500/40 !bg-rose-500/10 !text-rose-500">{pending} pending</span>}
      </div>

      <div className="flex gap-1.5">
        {(['open', 'done', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
            }`}
          >
            {f}
          </button>
        ))}
        {mistakes.some((m) => m.resolved) && (
          <button className="ml-auto text-xs text-faint transition hover:text-red-500" onClick={clearResolved}>
            <Eraser size={12} className="mr-1 inline" /> clear resolved
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {list.map((m) => {
          const subj = findSubject(m.subjectId)
          return (
            <div key={m.id} className={`card p-4 ${m.resolved ? 'opacity-60' : ''}`}>
              <div className="mb-2 flex items-start gap-3">
                <button onClick={() => toggleResolved(m.id)} title={m.resolved ? 'Reopen' : 'Mark as understood'}>
                  {m.resolved ? <CheckCircle2 size={19} className="text-emerald-500" /> : <Circle size={19} className="text-faint hover:text-indigo-500" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-relaxed ${m.resolved ? 'line-through' : ''}`}>{m.question}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p className="text-red-500 dark:text-red-400">❌ Yours: <span className="text-muted">{m.yourAnswer}</span></p>
                    <p className="text-emerald-500 dark:text-emerald-400">✅ Correct: <span className="text-muted">{m.correct}</span></p>
                    {m.note && <div className="mt-1.5 rounded-lg border border-line bg-surface2/50 p-2.5"><Markdown text={m.note} /></div>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  {subj && <span className="text-base" title={subj.name}>{subj.emoji}</span>}
                  <button className="text-faint transition hover:text-red-500" onClick={() => remove(m.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              {!m.resolved && (
                <button
                  className="ml-8 rounded-lg border border-line px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:border-indigo-500/50 hover:text-indigo-500"
                  onClick={() => { bumpReview(m.id); toggleResolved(m.id) }}
                >
                  Mark revised ✓
                </button>
              )}
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-4xl">📝</p>
            <p className="mt-2 text-sm font-semibold">{filter === 'open' ? 'No pending mistakes — great! 🎉' : 'Nothing here yet'}</p>
            <p className="mt-1 text-xs text-faint">Wrong answers from Rapid Quiz and Exams land here automatically.</p>
          </div>
        )}
      </div>
    </div>
  )
}
