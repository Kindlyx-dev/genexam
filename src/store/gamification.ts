import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const LEVELS = [
  { min: 0, name: 'Getting Started' },
  { min: 150, name: 'Learner' },
  { min: 400, name: 'Hard Worker' },
  { min: 800, name: 'Exam Fighter' },
  { min: 1500, name: 'Rank Challenger' },
  { min: 2500, name: 'Topper Mode' },
  { min: 4000, name: 'Legend' },
]

function todayStr() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

export const XP_RULES = {
  examSubmit: 60,
  examPerMark: 2,
  quizPerfect: 80,
  quizFinish: 30,
  flashcardReview: 2,
  flashcardSession: 20,
  pomodoro: 40,
  planDone: 15,
  chapterDone: 25,
}

interface GamState {
  xp: number
  streak: number
  bestStreak: number
  lastActive: string // YYYY-MM-DD
  counters: { exams: number; quizzes: number; cardsReviewed: number; pomodoros: number; questionsSeen: number }
  addXp: (n: number) => void
  touch: () => void // daily streak touch
  bump: (key: keyof GamState['counters'], n?: number) => void
  reset: () => void
}

export const useGam = create<GamState>()(
  persist(
    (set, get) => ({
      xp: 0,
      streak: 0,
      bestStreak: 0,
      lastActive: '',
      counters: { exams: 0, quizzes: 0, cardsReviewed: 0, pomodoros: 0, questionsSeen: 0 },
      addXp: (n) => {
        get().touch()
        set((s) => ({ xp: s.xp + Math.max(0, Math.round(n)) }))
      },
      touch: () =>
        set((s) => {
          const today = todayStr()
          if (s.lastActive === today) return s
          const streak = s.lastActive === yesterdayStr() ? s.streak + 1 : 1
          return { streak, bestStreak: Math.max(streak, s.bestStreak), lastActive: today }
        }),
      bump: (key, n = 1) => set((s) => ({ counters: { ...s.counters, [key]: s.counters[key] + n } })),
      reset: () => set({ xp: 0, streak: 0, bestStreak: 0, lastActive: '', counters: { exams: 0, quizzes: 0, cardsReviewed: 0, pomodoros: 0, questionsSeen: 0 } }),
    }),
    { name: 'lasttime-gam' },
  ),
)

export function levelInfo(xp: number) {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i
  const cur = LEVELS[idx]
  const next = LEVELS[idx + 1]
  const base = cur.min
  const span = next ? next.min - cur.min : 1
  const into = xp - base
  return {
    level: idx + 1,
    name: cur.name,
    progress: next ? Math.min(1, into / span) : 1,
    nextAt: next?.min ?? null,
    toNext: next ? next.min - xp : 0,
  }
}
