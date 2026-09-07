import { useMemo, useState } from 'react'
import { CalendarDays, Wand2, Loader2, CheckCircle2, Circle, Trash2, Clock, Plus } from 'lucide-react'
import { SYLLABUS, findSubject } from '../data/syllabus'
import { usePlanner } from '../store/study'
import { useProgress } from '../store/study'
import { useGam, XP_RULES } from '../store/gamification'
import { Bar } from '../components/Charts'

interface PlannedTask { date: string; subjectId: string; chapterIds: string[]; title: string; minutes: number }

function todayStr() { return new Date().toLocaleDateString('en-CA') }
function addDays(d: string, n: number) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toLocaleDateString('en-CA')
}

// Local smart planner: weak subjects first, spread chapters across available days
export function generatePlan(examDate: string, minutesPerDay: number): PlannedTask[] {
  const start = todayStr() <= examDate ? todayStr() : examDate
  const days = Math.max(1, Math.round((new Date(examDate + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000))
  const prog = useProgress.getState()
  const subjects = SYLLABUS.map((s) => ({
    s,
    pct: prog.subjectPct(s.id),
  })).sort((a, b) => a.pct - b.pct) // weakest first

  // Build flat queue: subject weight = remaining weakness
  const queue: Array<{ subjectId: string; chapterId: string; title: string; weight: number }> = []
  subjects.forEach(({ s, pct }) => {
    const chapters = s.chapters
    chapters.forEach((c, i) => {
      const cpct = prog.chapterPct(c.id)
      queue.push({
        subjectId: s.id,
        chapterId: c.id,
        title: `${s.emoji} ${s.name}: ${c.name}${c.nameHi ? ` (${c.nameHi})` : ''} — revise + 10 questions`,
        weight: (100 - pct) + (100 - cpct),
        order: i,
      } as any)
    })
  })
  queue.sort((a, b) => (b as any).weight - (a as any).weight)

  const perDay = Math.max(1, Math.ceil(queue.length / days))
  const tasks: PlannedTask[] = []
  let qi = 0
  for (let d = 0; d < days && qi < queue.length; d++) {
    const date = addDays(start, d)
    for (let k = 0; k < perDay && qi < queue.length; k++, qi++) {
      tasks.push({ date, subjectId: queue[qi].subjectId, chapterIds: [queue[qi].chapterId], title: queue[qi].title, minutes: Math.round(minutesPerDay / perDay) })
    }
  }
  return tasks
}

export default function PlannerPage() {
  const { examDate, setExamDate, tasks, addTask, toggleTask, removeTask } = usePlanner()
  const { addXp } = useGam()
  const [minutes, setMinutes] = useState(120)
  const [generating, setGenerating] = useState(false)
  const [customTitle, setCustomTitle] = useState('')

  const grouped = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const t of tasks) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tasks])

  const doneCount = tasks.filter((t) => t.done).length
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
  const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate + 'T00:00:00').getTime() - Date.now()) / 86400000)) : null

  function gen() {
    if (!examDate) return
    setGenerating(true)
    setTimeout(() => {
      const plan = generatePlan(examDate, minutes)
      plan.forEach((p) => addTask({ date: p.date, subjectId: p.subjectId, title: p.title, minutes: p.minutes }))
      setGenerating(false)
    }, 400)
  }

  function addCustom() {
    if (!customTitle.trim()) return
    addTask({ date: todayStr(), title: customTitle.trim(), minutes: 30 })
    setCustomTitle('')
  }

  return (
    <div className="anim-in mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><CalendarDays className="text-violet-500" size={22} /> Study Planner</h1>
        <p className="mt-1 text-sm text-muted">Set your exam date → weak subjects come first, smart day-wise plan. Follow it daily = guaranteed improvement.</p>
      </div>

      {/* Setup card */}
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <span className="label">Exam start date</span>
            <input type="date" className="input" value={examDate ?? ''} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div>
            <span className="label">Daily time (min)</span>
            <select className="input !w-32" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[60, 90, 120, 180, 240, 300].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={gen} disabled={!examDate || generating}>
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {tasks.length ? 'Recreate plan' : 'Make a plan'}
          </button>
        </div>
        {examDate && (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="text-sm font-bold">{daysLeft} days left hain</p>
              <p className="text-[11px] text-muted">Exam: {new Date(examDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
        )}
        {/* custom task */}
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Or add a custom task — e.g. 'Memorise trigonometry formulas'"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          />
          <button className="btn-soft !px-3" onClick={addCustom}><Plus size={15} /></button>
        </div>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span>{doneCount}/{tasks.length} tasks done</span>
            <span className="text-indigo-500">{pct}%</span>
          </div>
          <Bar pct={pct} />
        </div>
      )}

      {/* Task list */}
      <div className="space-y-4">
        {grouped.map(([date, list]) => {
          const isToday = date === todayStr()
          const isPast = date < todayStr()
          return (
            <div key={date} className="card overflow-hidden">
              <div className={`flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-bold ${isToday ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'bg-surface2 text-muted'}`}>
                {isToday ? '📌 TODAY' : new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                <span className="text-faint">· {list.filter((t) => t.done).length}/{list.length}</span>
                {isPast && <span className="ml-auto text-[10px] text-faint">past</span>}
              </div>
              <div className="divide-y divide-line">
                {list.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => { toggleTask(t.id); if (!t.done) addXp(XP_RULES.planDone) }}>
                      {t.done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-faint hover:text-indigo-500" />}
                    </button>
                    <p className={`min-w-0 flex-1 text-sm ${t.done ? 'text-faint line-through' : ''}`}>{t.title}</p>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-faint"><Clock size={10} />{t.minutes}m</span>
                    <button className="text-faint transition hover:text-red-500" onClick={() => removeTask(t.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {tasks.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">
            No tasks yet. Set your exam date above and press <b>Make a plan</b> — or add a custom task.
          </div>
        )}
      </div>
    </div>
  )
}
