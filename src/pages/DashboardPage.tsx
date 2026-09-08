import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Zap, Trophy, CalendarDays, NotebookPen, Target, TrendingUp, Timer, Play, Layers, FileEdit } from 'lucide-react'
import { SYLLABUS } from '../data/syllabus'
import { useGam, levelInfo, XP_RULES } from '../store/gamification'
import { useProgress, useMistakes, useCards, usePlanner } from '../store/study'
import { useExams } from '../store/exams'
import { LineChart, Bar, Ring } from '../components/Charts'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { xp, streak, bestStreak, counters } = useGam()
  const lvl = levelInfo(xp)
  const subjectPct = useProgress((s) => s.subjectPct)
  const overallPct = useProgress((s) => s.overallPct)
  const { papers } = useExams()
  const { tasks, examDate } = usePlanner()
  const allCards = useCards((s) => s.cards)
  const pendingMistakes = useMistakes((s) => s.mistakes.filter((m) => !m.resolved).length)
  const dueCount = useMemo(() => allCards.filter((c) => c.due <= Date.now()).length, [allCards])

  const evaluated = useMemo(
    () => papers.filter((p) => p.evaluated && p.questions.some((q) => q.score != null)),
    [papers],
  )

  const pctOf = (p: typeof papers[number]) =>
    Math.round((p.questions.reduce((n, q) => n + (q.score ?? 0), 0) / Math.max(1, p.totalMarks)) * 100)

  const trend = useMemo(() => {
    return [...evaluated]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-12)
      .map((p) => ({
        label: new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value: pctOf(p),
      }))
  }, [evaluated])

  const avgPct = evaluated.length ? Math.round(evaluated.reduce((n, p) => n + pctOf(p), 0) / evaluated.length) : 0
  const bestPct = evaluated.length ? Math.max(...evaluated.map(pctOf)) : 0

  const today = new Date().toLocaleDateString('en-CA')
  const todayTasks = tasks.filter((t) => t.date === today)
  const doneToday = todayTasks.filter((t) => t.done).length

  const daysLeft = examDate
    ? Math.max(0, Math.ceil((new Date(examDate + 'T00:00:00').getTime() - Date.now()) / 86400000))
    : null

  const subjectStats = useMemo(
    () => SYLLABUS.map((s) => ({ s, pct: subjectPct(s.id) })).sort((a, b) => a.pct - b.pct),
    [subjectPct],
  )

  return (
    <div className="anim-in space-y-5">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}, Topper! <span className="inline-block">🎯</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {daysLeft !== null ? (
              <>Only <b className="text-fg">{daysLeft} days</b> left — {daysLeft <= 7 ? 'full speed now! 🔥' : 'consistent raho.'}</>
            ) : (
              <>Set your exam date in the Planner — the countdown and plan appear here.</>
            )}
          </p>
        </div>
        <Link to="/quiz" className="btn-primary"><Zap size={15} /> Play Rapid Quiz</Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Flame size={16} className="text-orange-500" />} label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={`Best: ${bestStreak}`} />
        <StatCard icon={<Zap size={16} className="text-indigo-500" />} label={`Lv ${lvl.level} · ${lvl.name}`} value={`${xp} XP`} sub={lvl.toNext > 0 ? `${lvl.toNext} XP to go` : 'MAX!'} />
        <StatCard icon={<Trophy size={16} className="text-amber-500" />} label="Avg score" value={evaluated.length ? `${avgPct}%` : '—'} sub={evaluated.length ? `Best: ${bestPct}%` : 'No papers yet'} />
        <StatCard icon={<Layers size={16} className="text-emerald-500" />} label="Cards due" value={`${dueCount}`} sub={`${allCards.length} total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Score trend */}
        <div className="card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold"><TrendingUp size={15} className="text-indigo-500" /> Score trend</h2>
            <span className="text-[11px] text-faint">{evaluated.length} papers checked</span>
          </div>
          {trend.length >= 2 ? (
            <LineChart data={trend} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted">Submit at least 2 papers to see your trend.</p>
              <Link to="/exams" className="btn-soft text-xs"><FileEdit size={13} /> Open Exam Studio</Link>
            </div>
          )}
        </div>

        {/* Overall mastery ring */}
        <div className="card flex flex-col items-center justify-center gap-3 p-5 lg:col-span-2">
          <Ring pct={overallPct()} size={130}>
            <div className="text-center">
              <p className="text-2xl font-extrabold">{overallPct()}%</p>
              <p className="text-[10px] font-semibold uppercase text-faint">Syllabus</p>
            </div>
          </Ring>
          <p className="text-xs text-muted">Overall preparation level</p>
          <div className="w-full space-y-1.5">
            {subjectStats.slice(0, 3).map(({ s, pct }) => (
              <div key={s.id}>
                <div className="mb-0.5 flex justify-between text-[10px] font-medium text-muted">
                  <span>{s.emoji} {s.name}</span><span>{pct}%</span>
                </div>
                <Bar pct={pct} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionCard to="/planner" icon={<CalendarDays size={18} />} title="Today's plan" sub={todayTasks.length ? `${doneToday}/${todayTasks.length} done` : 'Make a plan'} color="from-violet-500 to-purple-500" />
        <ActionCard to="/quiz" icon={<Zap size={18} />} title="Rapid Quiz" sub="8 Q · 20s each" color="from-amber-500 to-orange-500" />
        <ActionCard to="/mistakes" icon={<NotebookPen size={18} />} title="Mistakes" sub={`${pendingMistakes} pending`} color="from-rose-500 to-red-500" />
        <ActionCard to="/cards" icon={<Layers size={18} />} title="Flashcards" sub={`${dueCount} due today`} color="from-emerald-500 to-teal-500" />
      </div>

      {/* Subject mastery */}
      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Target size={15} className="text-indigo-500" /> Subject mastery</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {subjectStats.map(({ s, pct }) => (
            <Link key={s.id} to={`/subject/${s.id}/chapter/${s.chapters[0].id}`} className="rounded-xl border border-line p-3 transition hover:border-indigo-500/40">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5">{s.emoji} {s.name}</span>
                <span className={pct >= 75 ? 'text-emerald-500' : pct >= 45 ? 'text-amber-500' : 'text-muted'}>{pct}%</span>
              </div>
              <Bar pct={pct} />
            </Link>
          ))}
        </div>
      </div>

      {/* Pomodoro */}
      <PomodoroWidget />
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">{icon} {label}</div>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-faint">{sub}</p>}
    </div>
  )
}

function ActionCard({ to, icon, title, sub, color }: { to: string; icon: React.ReactNode; title: string; sub: string; color: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 transition hover:border-indigo-500/40">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-[11px] text-faint">{sub}</p>
      </div>
    </Link>
  )
}

function PomodoroWidget() {
  const [secs, setSecs] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [sessions, setSessions] = useState(0)
  const { addXp, bump } = useGam()

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          if (mode === 'focus') {
            addXp(XP_RULES.pomodoro)
            bump('pomodoros')
            setSessions((n) => n + 1)
            setMode('break')
            return 5 * 60
          }
          setMode('focus')
          return 25 * 60
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, mode])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const total = mode === 'focus' ? 25 * 60 : 5 * 60
  const pct = ((total - secs) / total) * 100

  return (
    <div className="card flex flex-wrap items-center gap-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 text-white"><Timer size={20} /></span>
        <div>
          <h2 className="text-sm font-bold">Focus timer (Pomodoro)</h2>
          <p className="text-[11px] text-faint">{mode === 'focus' ? '25 min deep focus' : '5 min break'} · {sessions} sessions done</p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="font-mono text-3xl font-extrabold tabular-nums">{mm}:{ss}</p>
          <Bar pct={pct} className="mt-1 w-24" />
        </div>
        <div className="flex gap-1.5">
          <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => setRunning((r) => !r)}>
            <Play size={13} /> {running ? 'Pause' : 'Start'}
          </button>
          <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => { setRunning(false); setSecs(mode === 'focus' ? 25 * 60 : 5 * 60) }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
