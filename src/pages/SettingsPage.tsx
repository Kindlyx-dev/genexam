import { useState } from 'react'
import { Trash2, Eye, EyeOff, CheckCircle2, Download, Upload, AlertTriangle, Sun, Moon } from 'lucide-react'
import { useModels } from '../store/models'
import { useTheme } from '../store/theme'
import { useUI } from '../store/ui'
import type { ModelConfig } from '../types'

/** Minimal settings: theme, saved models (manage), data backup. Adding models happens in the navbar popup. */
export default function SettingsPage() {
  const { models, removeModel, setActive, activeModelId } = useModels()
  const { theme, set: setTheme } = useTheme()
  const openAddModel = useUI((s) => s.openAddModel)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  function exportData() {
    const data: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('genexam')) data[k] = JSON.parse(localStorage.getItem(k) || '{}')
    }
    delete data['genexam-models'] // don't export API keys
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `genexam-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        for (const [k, v] of Object.entries(data)) {
          if (k !== 'genexam-models') localStorage.setItem(k, JSON.stringify(v))
        }
        location.reload()
      } catch {
        alert('Invalid file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="anim-in mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">⚙️ Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Everything stays <b>in your browser only</b>. Add or switch models from the top bar.
        </p>
      </div>

      {/* Theme */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-muted">🎨 Theme</h2>
        <div className="card flex gap-2 p-2">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                theme === t ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
              }`}
            >
              {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      {/* Models */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-muted">🤖 Your models</h2>
        <div className="space-y-2">
          {models.map((m: ModelConfig) => (
            <div key={m.id} className={`card flex items-center gap-3 p-3.5 ${m.id === activeModelId ? 'border-indigo-500/70' : ''}`}>
              <button
                onClick={() => setActive(m.id)}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                  m.id === activeModelId ? 'bg-indigo-600 text-white' : 'bg-surface2 text-muted'
                }`}
                title={m.id === activeModelId ? 'Active' : 'Set active'}
              >
                {m.id === activeModelId ? '✓' : m.label.slice(0, 2).toUpperCase()}
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {m.vision && <span title="Vision model"><Eye size={13} className="text-amber-500" /></span>}
                  {m.label}
                  {m.free && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>}
                  {m.id === activeModelId && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-500 dark:text-indigo-300">active</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-faint">{m.modelId} · {m.baseUrl.replace(/^https?:\/\//, '')}</p>
              </div>
              <button
                className="btn-ghost !p-2 text-muted"
                onClick={() => setShowKey((s) => ({ ...s, [m.id]: !s[m.id] }))}
                title={showKey[m.id] ? 'Hide key' : 'Show key'}
              >
                {showKey[m.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className="btn-ghost !p-2 text-red-500 hover:!border-red-500/50" onClick={() => removeModel(m.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {models.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-3xl">🤖</p>
              <p className="mt-2 text-sm font-semibold">No models yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
                OpenAI, Gemini, Groq, OpenRouter or local Ollama — all work.
              </p>
            </div>
          )}
        </div>
        <button className="btn-primary mt-2 w-full" onClick={openAddModel}>+ Add another model</button>
      </section>

      {/* Data */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-muted">💾 Data</h2>
        <div className="card flex flex-wrap gap-2 p-4">
          <button className="btn-soft text-xs" onClick={exportData}><Download size={13} /> Backup export</button>
          <label className="btn-soft cursor-pointer text-xs">
            <Upload size={13} /> Import backup
            <input type="file" accept="application/json" hidden onChange={importData} />
          </label>
          <button
            className="btn-soft ml-auto text-xs !text-red-500 hover:!border-red-500/40"
            onClick={() => {
              if (confirm('All data (chats, models, API keys) will be deleted. Are you sure?')) {
                Object.keys(localStorage).filter((k) => k.startsWith('genexam')).forEach((k) => localStorage.removeItem(k))
                location.reload()
              }
            }}
          >
            <Trash2 size={13} /> Reset everything
          </button>
        </div>
      </section>

      <p className="flex items-start gap-1.5 pb-6 text-[11px] leading-relaxed text-faint">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        API keys are never exported in backups and never leave your browser except to call your chosen provider directly (or via our proxy when the provider blocks browser calls).
      </p>
    </div>
  )
}
