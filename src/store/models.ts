import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModelConfig } from '../types'

interface ModelState {
  models: ModelConfig[]
  activeModelId: string | null
  addModel: (m: Omit<ModelConfig, 'id' | 'createdAt'>) => void
  updateModel: (id: string, patch: Partial<ModelConfig>) => void
  removeModel: (id: string) => void
  setActive: (id: string) => void
  activeModel: () => ModelConfig | null
}

export const useModels = create<ModelState>()(
  persist(
    (set, get) => ({
      models: [],
      activeModelId: null,
      addModel: (m) => {
        const id = crypto.randomUUID()
        set((s) => ({
          models: [...s.models, { ...m, id, createdAt: Date.now() }],
          activeModelId: s.activeModelId ?? id,
        }))
      },
      updateModel: (id, patch) =>
        set((s) => ({
          models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeModel: (id) =>
        set((s) => {
          const models = s.models.filter((m) => m.id !== id)
          return {
            models,
            activeModelId: s.activeModelId === id ? (models[0]?.id ?? null) : s.activeModelId,
          }
        }),
      setActive: (id) => set({ activeModelId: id }),
      activeModel: () => {
        const { models, activeModelId } = get()
        return models.find((m) => m.id === activeModelId) ?? null
      },
    }),
    { name: 'genexam-models' },
  ),
)
