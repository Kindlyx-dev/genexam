import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen, FileEdit, MessageSquare, Settings, Hourglass, Flame, Zap,
  LayoutDashboard, Layers, Search, Command, Sun, Moon, NotebookPen,
  CalendarDays, X, ChevronRight, Target,
} from 'lucide-react'
import { useTheme } from './store/theme'
import { useGam, levelInfo } from './store/gamification'
import { SYLLABUS } from './data/syllabus'
import ModelPicker from './components/ModelPicker'

interface NavItem { to: string; label: string; icon: any }

const groups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Study',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/', label: 'Syllabus', icon: BookOpen },
      { to: '/planner', label: 'Planner', icon: CalendarDays },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/quiz', label: 'Rapid Quiz', icon: Zap },
      { to: '/cards', label: 'Flashcards', icon: Layers },
      { to: '/exams', label: 'Exam Studio', icon: FileEdit },
      { to: '/mistakes', label: 'Mistakes', icon: NotebookPen },
    ],
  },
  {
    label: 'AI',
    items: [{ to: '/chat', label: 'AI Tutor', icon: MessageSquare }],
  },
]

const allNav: NavItem[] = [...groups[0].items, ...groups[1].items, ...groups[2].items, { to: '/settings', label: 'Settings', icon: Settings }]

const mobileNav = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/quiz', label: 'Quiz', icon: Zap },
  { to: '/chat', label: 'Tutor', icon: MessageSquare },
  { to: '/exams', label: 'Exams', icon: FileEdit },
  { to: '/settings', label: 'More', icon: Settings },
]

interface CmdItem { label: string; sub?: string; to: string }

export default function App() {
  const { theme, toggle } = useTheme()
  const { streak, xp } = useGam()
  const lvl = levelInfo(xp)
  const loc = useLocation()
  const nav2 = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    setPaletteOpen(false)
    setSidebarOpen(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])

  const cmdItems: CmdItem[] = useMemo(() => {
    return [
      ...allNav.map((n) => ({ label: n.label, to: n.to })),
      ...SYLLABUS.flatMap((s) =>
        s.chapters.map((c) => ({ label: c.name, sub: `${s.name}${c.book ? ' · ' + c.book : ''}`, to: `/subject/${s.id}/chapter/${c.id}` })),
      ),
    ]
  }, [])

  const fullBleed = loc.pathname.startsWith('/chat') || loc.pathname.includes('/subject/')

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* ───── Sidebar (desktop) ───── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/70 backdrop-blur-xl lg:flex">
          <Brand />
          <LevelCard xp={xp} streak={streak} lvl={lvl} />
          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-1">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-faint">{g.label}</p>
                <div className="space-y-0.5">
                  {g.items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-2.5 rounded-xl py-2 pl-3.5 pr-3 text-sm font-medium transition ${
                          isActive ? 'bg-indigo-500/10 font-semibold text-indigo-600 dark:text-indigo-400' : 'text-muted hover:bg-surface2 hover:text-fg'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-indigo-500" />}
                          <Icon size={16} className={isActive ? '' : 'text-faint group-hover:text-fg'} />
                          {label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="space-y-0.5 border-t border-line p-3">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-xl py-2 pl-3.5 pr-3 text-sm font-medium transition ${
                  isActive ? 'bg-indigo-500/10 font-semibold text-indigo-600 dark:text-indigo-400' : 'text-muted hover:bg-surface2 hover:text-fg'
                }`
              }
            >
              <Settings size={16} className="text-faint" /> Settings
            </NavLink>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl py-2 pl-3.5 pr-3 text-xs text-faint transition hover:bg-surface2 hover:text-fg"
            >
              <Search size={14} /> Search
              <kbd className="ml-auto rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[9px]">Ctrl K</kbd>
            </button>
          </div>
        </aside>

      {/* ───── Main ───── */}
      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl no-print">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
            <button className="btn-ghost !border-transparent !bg-transparent !p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <Command size={18} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden flex-1 lg:block" />
            <div className="flex flex-1 items-center justify-end gap-1.5 lg:flex-none">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-faint transition hover:text-fg sm:flex"
              >
                <Search size={13} /> Chapter / page…
                <kbd className="rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd>
              </button>
              <div className="hidden items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-bold text-orange-500 sm:flex dark:text-orange-400" title="Day streak">
                <Flame size={13} /> {streak}
              </div>
              <div className="hidden items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-bold text-indigo-500 sm:flex dark:text-indigo-400" title={`${xp} XP · Level ${lvl.level} ${lvl.name}`}>
                <Zap size={13} /> {xp}
              </div>
              <ModelPicker />
              <button className="btn-ghost !border-transparent !bg-transparent !p-2.5" onClick={toggle} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </div>
        </header>

        <main className={fullBleed ? "mx-auto w-full max-w-6xl flex-1 px-3 pb-[60px] pt-3 sm:px-4 sm:pb-4 sm:pt-5" : "mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:pb-12"}>
          <Outlet />
        </main>
      </div>

      {/* ───── Mobile bottom nav ───── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl sm:hidden no-print">
        <div className="grid grid-cols-5">
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-faint'}`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ───── Mobile drawer ───── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4">
              <Brand compact />
              <button className="btn-ghost !p-2" onClick={() => setSidebarOpen(false)}><X size={15} /></button>
            </div>
            <LevelCard xp={xp} streak={streak} lvl={lvl} />
            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-faint">{g.label}</p>
                  <div className="space-y-0.5">
                    {g.items.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 rounded-xl py-2 pl-3.5 pr-3 text-sm font-medium transition ${
                            isActive ? 'bg-indigo-500/10 font-semibold text-indigo-600 dark:text-indigo-400' : 'text-muted hover:bg-surface2 hover:text-fg'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-indigo-500" />}
                            <Icon size={16} className={isActive ? '' : 'text-faint group-hover:text-fg'} />
                            {label}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <div className="space-y-0.5">
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-faint">More</p>
                <NavLink to="/settings" className="nav-item"><Settings size={16} className="text-faint" /> Settings</NavLink>
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* ───── Command palette ───── */}
      {paletteOpen && (
        <CommandPalette items={cmdItems} onNavigate={(to) => { setPaletteOpen(false); nav2(to) }} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  )
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-2 p-4 pb-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
        <Hourglass size={16} />
      </span>
      <span className={`font-extrabold tracking-tight ${compact ? 'text-base' : 'text-lg'}`}>
        Last<span className="text-indigo-500 dark:text-indigo-400">Time</span>
      </span>
      {!compact && (
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[9px] font-semibold text-muted">
          MP Board 10th
        </span>
      )}
    </NavLink>
  )
}

function LevelCard({ xp, streak, lvl }: { xp: number; streak: number; lvl: ReturnType<typeof levelInfo> }) {
  return (
    <div className="mx-3 my-2 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-fg">
          <Target size={13} className="text-indigo-500" /> Lv {lvl.level} · {lvl.name}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-500">
          <Flame size={10} /> {streak}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${Math.max(4, lvl.progress * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-medium text-muted">
        {lvl.toNext > 0 ? `${lvl.toNext} XP to next level` : 'Max level reached!'} · {xp} XP total
      </p>
    </div>
  )
}

function CommandPalette({ items, onNavigate, onClose }: { items: CmdItem[]; onNavigate: (to: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim()
    if (!t) return items.slice(0, 12)
    return items.filter((i) => (i.label + ' ' + (i.sub || '')).toLowerCase().includes(t)).slice(0, 12)
  }, [q, items])

  useEffect(() => setSel(0), [q])

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] no-print" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="card relative w-full max-w-lg overflow-hidden !rounded-2xl shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
              if (e.key === 'Enter' && filtered[sel]) onNavigate(filtered[sel].to)
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Search chapters, subjects or pages…"
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[9px] text-faint">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-faint">No results</p>}
          {filtered.map((it, i) => (
            <button
              key={it.to + it.label}
              onClick={() => onNavigate(it.to)}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${i === sel ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-fg'}`}
            >
              <ChevronRight size={13} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
              {it.sub && <span className="shrink-0 text-[10px] text-faint">{it.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
