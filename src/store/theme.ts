import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
}

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        apply(next)
        set({ theme: next })
      },
      set: (t) => {
        apply(t)
        set({ theme: t })
      },
    }),
    {
      name: 'genexam-theme',
      onRehydrateStorage: () => (state) => {
        apply(state?.theme ?? 'dark')
      },
    },
  ),
)

// boot-time apply (in case persist rehydrate is async)
if (typeof document !== 'undefined') {
  const saved = localStorage.getItem('genexam-theme')
  const theme: Theme = saved ? (JSON.parse(saved).state?.theme ?? 'dark') : 'dark'
  apply(theme)
}
