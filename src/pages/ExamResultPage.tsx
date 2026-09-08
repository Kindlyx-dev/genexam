import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy, AlertTriangle, RotateCcw, CheckCircle2, XCircle, Printer, Zap } from 'lucide-react'
import { findSubject } from '../data/syllabus'
import { useExams } from '../store/exams'
import Markdown from '../components/Markdown'
import { Ring } from '../components/Charts'
import type { ExamPaper } from '../types'

/** Group consecutive questions that share a group header (blueprint sub-parts). */
function blocksOf(paper: ExamPaper): Array<{ group?: string; questions: ExamPaper['questions'] }> {
  const blocks: Array<{ group?: string; questions: ExamPaper['questions'] }> = []
  for (const q of paper.questions) {
    const last = blocks[blocks.length - 1]
    if (q.group && last?.group === q.group) last.questions.push(q)
    else blocks.push({ group: q.group || undefined, questions: [q] })
  }
  return blocks
}

export default function ExamResultPage() {
  const { paperId = '' } = useParams()
  const { getPaper } = useExams()
  const paper = getPaper(paperId)

  if (!paper) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        Result not found. <Link to="/exams" className="text-indigo-500">Exam Studio</Link>
      </div>
    )
  }

  const score = paper.questions.reduce((n, q) => n + (q.score ?? 0), 0)
  const pct = paper.totalMarks > 0 ? Math.round((score / paper.totalMarks) * 100) : 0
  const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : pct >= 33 ? 'D' : 'F'
  const subj = findSubject(paper.subjectId)
  const full = paper.questions.filter((q) => q.score === q.marks).length
  const zero = paper.questions.filter((q) => q.score === 0).length
  const partial = paper.questions.length - full - zero

  return (
    <div className="anim-in mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3 no-print">
        <Link to="/exams" className="btn-ghost !p-2.5"><ArrowLeft size={16} /></Link>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold sm:text-lg">{paper.title}</h1>
          <p className="text-[11px] text-faint">Result · checked by the AI examiner</p>
        </div>
        <button className="btn-ghost ml-auto !p-2.5" onClick={() => window.print()} title="Print result"><Printer size={15} /></button>
      </div>

      {/* Score card */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <Ring pct={pct} size={150} stroke={11}>
            <div className="text-center">
              <p className="text-3xl font-extrabold tracking-tight">{score}<span className="text-base text-faint">/{paper.totalMarks}</span></p>
              <p className="text-xs font-semibold text-muted">{pct}%</p>
            </div>
          </Ring>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <MiniStat label="Grade" value={grade} cls={pct >= 75 ? 'text-emerald-500' : pct >= 45 ? 'text-amber-500' : 'text-red-500'} />
            <MiniStat label="Full marks" value={`${full}`} cls="text-emerald-500" />
            <MiniStat label="Half/partial" value={`${partial}`} cls="text-amber-500" />
            <MiniStat label="Zero" value={`${zero}`} cls="text-red-500" />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
          <Zap size={13} /> +{60 + score * 2} XP earned from this exam!
        </div>
      </div>

      {/* Per-question review */}
      <div className="space-y-3">
        {blocksOf(paper).map((block, bi) => (
          <div key={bi} className="card p-4 sm:p-5">
            {block.group && (
              <div className="mb-3 border-b border-line pb-2.5">
                <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{block.group}</p>
              </div>
            )}
            <div className={block.group ? 'space-y-5' : ''}>
              {block.questions.map((q) => {
                const i = paper.questions.indexOf(q)
                const got = q.score ?? 0
                const ok = got >= q.marks
                const half = got > 0 && got < q.marks
                return (
                  <div key={q.id}>
                    <div className="mb-2.5 flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed">
                        {q.label && <span className="mr-1.5 font-extrabold text-indigo-500">{q.label}</span>}
                        {!block.group && !q.label?.startsWith('Q') && <span className="mr-1.5 font-extrabold text-indigo-500">Q{i + 1}.</span>}
                        {q.q}
                      </p>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold ${
                          ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : half ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {ok ? <CheckCircle2 size={12} /> : got === 0 ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                        {got}/{q.marks}
                      </span>
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-line bg-surface2/40 p-3.5 text-xs">
                      <div>
                        <p className="mb-0.5 font-bold text-muted">Your answer:</p>
                        <p className="whitespace-pre-wrap">{q.userAnswer || '(blank)'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 font-bold text-emerald-600 dark:text-emerald-400">✅ Model answer:</p>
                        <Markdown text={q.answer || '—'} />
                      </div>
                      {q.feedback && (
                        <div className="border-t border-line pt-2.5">
                          <p className="mb-0.5 font-bold text-indigo-600 dark:text-indigo-400">🤖 AI Examiner:</p>
                          <p>{q.feedback}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pb-6 no-print">
        <Link to="/exams" className="btn-ghost flex-1"><RotateCcw size={15} /> New paper</Link>
        <Link to="/dashboard" className="btn-primary flex-1"><Trophy size={15} /> Dashboard</Link>
      </div>
    </div>
  )
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface2/50 px-4 py-2.5 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-faint">{label}</p>
      <p className={`text-xl font-extrabold ${cls}`}>{value}</p>
    </div>
  )
}
