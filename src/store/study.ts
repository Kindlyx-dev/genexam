import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SYLLABUS } from '../data/syllabus'

// ---------- Progress (chapter understanding) ----------
export interface ChapterProg {
  explained: boolean
  questions: number
  correct: number
  quizScores: number[] // percentage history
  lastSeen: number
}

interface ProgState {
  prog: Record<string, ChapterProg> // key: chapterId
  markExplained: (cid: string) => void
  recordAnswer: (cid: string, correct: boolean) => void
  recordQuiz: (cid: string, pct: number) => void
  chapterPct: (cid: string) => number
  subjectPct: (subjectId: string) => number
  overallPct: () => number
}

export const useProgress = create<ProgState>()(
  persist(
    (set, get) => ({
      prog: {},
      markExplained: (cid) =>
        set((s) => ({
          prog: { ...s.prog, [cid]: { ...(s.prog[cid] || { explained: false, questions: 0, correct: 0, quizScores: [], lastSeen: 0 }), explained: true, lastSeen: Date.now() } },
        })),
      recordAnswer: (cid, correct) =>
        set((s) => {
          const p: ChapterProg = s.prog[cid] || { explained: false, questions: 0, correct: 0, quizScores: [], lastSeen: 0 }
          return { prog: { ...s.prog, [cid]: { ...p, questions: p.questions + 1, correct: p.correct + (correct ? 1 : 0), lastSeen: Date.now() } } }
        }),
      recordQuiz: (cid, pct) =>
        set((s) => {
          const p: ChapterProg = s.prog[cid] || { explained: false, questions: 0, correct: 0, quizScores: [], lastSeen: 0 }
          return { prog: { ...s.prog, [cid]: { ...p, quizScores: [...p.quizScores, pct].slice(-10), lastSeen: Date.now() } } }
        }),
      chapterPct: (cid) => {
        const p = get().prog[cid]
        if (!p) return 0
        const acc = p.questions > 0 ? p.correct / p.questions : 0
        const quiz = p.quizScores.length > 0 ? p.quizScores[p.quizScores.length - 1] / 100 : 0
        return Math.round(((p.explained ? 0.3 : 0) + acc * 0.3 + quiz * 0.4) * 100)
      },
      subjectPct: (subjectId) => {
        const subj = SYLLABUS.find((s) => s.id === subjectId)
        if (!subj) return 0
        const vals = subj.chapters.map((c) => get().chapterPct(c.id))
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      },
      overallPct: () => {
        const vals = SYLLABUS.map((s) => get().subjectPct(s.id))
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      },
    }),
    { name: 'genexam-progress' },
  ),
)

// ---------- Flashcards with SM-2 lite SRS ----------
export interface Flashcard {
  id: string
  chapterId: string
  subjectId: string
  front: string
  back: string
  ease: number
  intervalDays: number
  due: number // timestamp
  createdAt: number
  reps: number
}

interface CardState {
  cards: Flashcard[]
  add: (c: Omit<Flashcard, 'id' | 'ease' | 'intervalDays' | 'due' | 'createdAt' | 'reps'>) => void
  addMany: (cards: Array<{ chapterId: string; subjectId: string; front: string; back: string }>) => number
  remove: (id: string) => void
  review: (id: string, quality: 'again' | 'hard' | 'good' | 'easy') => void
  dueCards: (subjectId?: string, chapterId?: string) => Flashcard[]
  clearSubject: (subjectId: string) => void
}

const DAY = 86400000

export const useCards = create<CardState>()(
  persist(
    (set, get) => ({
      cards: [],
      add: (c) =>
        set((s) => ({
          cards: [
            { ...c, id: crypto.randomUUID(), ease: 2.5, intervalDays: 0, due: Date.now(), createdAt: Date.now(), reps: 0 },
            ...s.cards,
          ],
        })),
      addMany: (list) => {
        const existing = new Set(get().cards.map((c) => c.front.toLowerCase().trim()))
        const fresh = list
          .filter((c) => c.front.trim() && c.back.trim() && !existing.has(c.front.toLowerCase().trim()))
          .map((c) => ({
            ...c,
            id: crypto.randomUUID(),
            ease: 2.5,
            intervalDays: 0,
            due: Date.now(),
            createdAt: Date.now(),
            reps: 0,
          }))
        set((s) => ({ cards: [...fresh, ...s.cards] }))
        return fresh.length
      },
      remove: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      clearSubject: (subjectId) => set((s) => ({ cards: s.cards.filter((c) => c.subjectId !== subjectId) })),
      review: (id, quality) =>
        set((s) => ({
          cards: s.cards.map((c) => {
            if (c.id !== id) return c
            let { ease, intervalDays } = c
            if (quality === 'again') {
              ease = Math.max(1.3, ease - 0.2)
              intervalDays = 0
            } else {
              if (quality === 'hard') ease = Math.max(1.3, ease - 0.15)
              if (quality === 'easy') ease = Math.min(3.2, ease + 0.15)
              intervalDays = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(intervalDays * ease)
            }
            return { ...c, ease, intervalDays, reps: c.reps + 1, due: Date.now() + Math.max(0.02, intervalDays) * DAY }
          }),
        })),
      dueCards: (subjectId, chapterId) => {
        const now = Date.now()
        return get()
          .cards.filter((c) => c.due <= now + 60000)
          .filter((c) => (subjectId ? c.subjectId === subjectId : true))
          .filter((c) => (chapterId ? c.chapterId === chapterId : true))
          .sort((a, b) => a.due - b.due)
      },
    }),
    { name: 'genexam-cards' },
  ),
)

// ---------- Mistake notebook ----------
export interface Mistake {
  id: string
  subjectId: string
  chapterId?: string
  question: string
  yourAnswer: string
  correct: string
  note?: string
  resolved: boolean
  createdAt: number
  reviewCount: number
}

interface MistState {
  mistakes: Mistake[]
  add: (m: Omit<Mistake, 'id' | 'resolved' | 'createdAt' | 'reviewCount'>) => void
  remove: (id: string) => void
  toggleResolved: (id: string) => void
  bumpReview: (id: string) => void
  clearResolved: () => void
}

export const useMistakes = create<MistState>()(
  persist(
    (set) => ({
      mistakes: [],
      add: (m) =>
        set((s) => ({
          mistakes: [
            { ...m, id: crypto.randomUUID(), resolved: false, createdAt: Date.now(), reviewCount: 0 },
            ...s.mistakes,
          ],
        })),
      remove: (id) => set((s) => ({ mistakes: s.mistakes.filter((m) => m.id !== id) })),
      toggleResolved: (id) =>
        set((s) => ({ mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, resolved: !m.resolved } : m)) })),
      bumpReview: (id) =>
        set((s) => ({ mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, reviewCount: m.reviewCount + 1 } : m)) })),
      clearResolved: () => set((s) => ({ mistakes: s.mistakes.filter((m) => !m.resolved) })),
    }),
    { name: 'genexam-mistakes' },
  ),
)

// ---------- Study planner (exam countdown) ----------
export interface PlanTask {
  id: string
  title: string
  subjectId?: string
  date: string // YYYY-MM-DD
  minutes: number
  done: boolean
}

interface PlanState {
  examDate: string | null
  tasks: PlanTask[]
  setExamDate: (d: string) => void
  addTask: (t: Omit<PlanTask, 'id' | 'done'>) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
}

export const usePlanner = create<PlanState>()(
  persist(
    (set) => ({
      examDate: null,
      tasks: [],
      setExamDate: (d) => set({ examDate: d }),
      addTask: (t) => set((s) => ({ tasks: [...s.tasks, { ...t, id: crypto.randomUUID(), done: false }] })),
      toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    }),
    { name: 'genexam-planner' },
  ),
)
