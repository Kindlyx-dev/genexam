import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ExamPaper } from '../types'

interface ExamState {
  papers: ExamPaper[]
  savePaper: (p: ExamPaper) => void
  updatePaper: (p: ExamPaper) => void
  getPaper: (id: string) => ExamPaper | undefined
  deletePaper: (id: string) => void
}

export const useExams = create<ExamState>()(
  persist(
    (set, get) => ({
      papers: [],
      savePaper: (p) => set((s) => ({ papers: [p, ...s.papers] })),
      updatePaper: (p) =>
        set((s) => ({ papers: s.papers.map((x) => (x.id === p.id ? p : x)) })),
      getPaper: (id) => get().papers.find((x) => x.id === id),
      deletePaper: (id) => set((s) => ({ papers: s.papers.filter((x) => x.id !== id) })),
    }),
    { name: 'lasttime-exams' },
  ),
)
