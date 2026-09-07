import { create } from 'zustand'

interface UIState {
  addModelOpen: boolean
  openAddModel: () => void
  closeAddModel: () => void
}

export const useUI = create<UIState>()((set) => ({
  addModelOpen: false,
  openAddModel: () => set({ addModelOpen: true }),
  closeAddModel: () => set({ addModelOpen: false }),
}))
