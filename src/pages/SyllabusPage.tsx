import { Link } from 'react-router-dom'
import { ChevronRight, Flame } from 'lucide-react'
import { SYLLABUS } from '../data/syllabus'
import { useProgress, useMistakes, useCards, usePlanner } from '../store/study'
import { Bar } from '../components/Charts'

export default function SyllabusPage() {
  const subjectPct = useProgress((s) => s.subjectPct)
  const pendingMistakes = useMistakes((s) => s.mistakes.filter((m) => !m.resolved).length)
  const dueCards = useCards((s) => s.cards.filter((c) => c.due <= Date.now()).length)
  const { examDate } = usePlanner()
  const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate + 'T00:00:00').getTime() - Date.now()) / 86400000)) : null

  const totalChapters = SYLLABUS.reduce((n, s) => n + s.chapters.length, 0)

  return (
    <div className="anim-in space-y-5">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="relative bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-transparent p-6 sm:p-8">
          <div className="absolute right-6 top-6 hidden sm:block">
            <div className="rounded-2xl border border-line bg-surface/80 px-4 py-3 text-center backdrop-blur">
              <p className="text-2xl font-extrabold text-indigo-500">{daysLeft !== null ? daysLeft : '—'}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-faint">days left</p>
            </div>
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
            <Flame size={12} /> MP Board · त्रैमासिक परीक्षा 2026-27
          </div>
          <h1 className="max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">
            Class 10th — the full syllabus in one place. <span className="text-indigo-500">Now top it.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Open a chapter → learn with AI → make flashcards → PYQ practice → full exam with AI checking.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-muted">
            <span className="chip">📚 {SYLLABUS.length} subjects</span>
            <span className="chip">📄 {totalChapters} chapters</span>
            {dueCards > 0 && <Link to="/cards" className="chip !border-emerald-500/40 !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400">🃏 {dueCards} cards due</Link>}
            {pendingMistakes > 0 && <Link to="/mistakes" className="chip !border-rose-500/40 !bg-rose-500/10 !text-rose-600 dark:!text-rose-400">📝 {pendingMistakes} mistakes</Link>}
          </div>
        </div>
      </div>

      {/* Subject cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SYLLABUS.map((s) => {
          const pct = subjectPct(s.id)
          return (
            <div key={s.id} className="card group overflow-hidden transition hover:border-indigo-500/40">
              <div className="flex items-center gap-3 p-4 pb-2.5">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-lg shadow-card ${s.color}`}>
                  {s.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{s.name}</h2>
                  <p className="text-xs text-muted">{s.nameHi} · {s.chapters.length} chapters</p>
                </div>
                <span className={`text-sm font-extrabold ${pct >= 75 ? 'text-emerald-500' : pct >= 45 ? 'text-amber-500' : 'text-faint'}`}>{pct}%</span>
              </div>
              <div className="px-4 pb-1">
                <Bar pct={pct} />
              </div>
              <ul className="p-2.5">
                {s.chapters.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to={`/subject/${s.id}/chapter/${c.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs text-muted transition hover:bg-indigo-500/5 hover:text-fg"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-1.5 font-bold text-faint">{i + 1}.</span>
                        {c.name}
                        {c.book && <span className="ml-1.5 rounded bg-surface2 px-1 py-0.5 text-[9px] font-semibold text-faint">{c.book}</span>}
                      </span>
                      <ChevronRight size={13} className="shrink-0 text-faint transition group-hover:text-indigo-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
