import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus, Check, Eye, Settings2 } from 'lucide-react'
import { useModels } from '../store/models'
import { useUI } from '../store/ui'

/** Navbar model selector — dropdown with FREE badges + "Add model" popup trigger. */
export default function ModelPicker() {
  const { models, activeModelId, setActive } = useModels()
  const openAddModel = useUI((s) => s.openAddModel)
  const [open, setOpen] = useState(false)
  const active = models.find((m) => m.id === activeModelId) ?? null

  return (
    <div className="relative">
      {models.length === 0 ? (
        <button
          onClick={openAddModel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-300"
        >
          <Plus size={13} /> Add model
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex max-w-[150px] items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg transition hover:bg-surface2 sm:max-w-[220px]"
        >
          {active?.vision && <Eye size={12} className="shrink-0 text-amber-500" />}
          <span className="truncate">{active?.label}</span>
          {active?.free && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>}
          <ChevronDown size={12} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" />
          <div
            className="card absolute right-0 top-11 w-72 overflow-hidden !rounded-2xl shadow-pop anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-line px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-faint">Models</p>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setActive(m.id); setOpen(false) }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition ${
                    m.id === activeModelId ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-fg hover:bg-surface2'
                  }`}
                >
                  {m.vision && <Eye size={12} className="shrink-0 text-amber-500" />}
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.label}</span>
                  {m.free && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>}
                  {m.id === activeModelId && <Check size={13} className="shrink-0" />}
                </button>
              ))}
            </div>
            <div className="border-t border-line p-1.5">
              <button
                onClick={() => { setOpen(false); openAddModel() }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                <Plus size={13} /> Add model
              </button>
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-muted transition hover:bg-surface2 hover:text-fg"
              >
                <Settings2 size={13} /> Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
