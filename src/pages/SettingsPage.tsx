import { useState } from 'react'
import {
  Plus, Trash2, Eye, EyeOff, CheckCircle2, Pencil, KeyRound, Globe, Cpu,
  Loader2, X, Sun, Moon, Download, Upload, AlertTriangle,
} from 'lucide-react'
import { useModels } from '../store/models'
import { useTheme } from '../store/theme'
import type { ModelConfig } from '../types'
import { AI_PRESETS } from '../store/presets'

interface Draft {
  id?: string
  label: string
  baseUrl: string
  apiKey: string
  modelId: string
  vision: boolean
}

const emptyDraft = (): Draft => ({ label: '', baseUrl: 'https://api.openai.com/v1', apiKey: '', modelId: '', vision: false })

/** Auto-detect vision capability from the model id — no manual checkbox needed. */
export function isVisionModel(modelId: string): boolean {
  const m = modelId.toLowerCase()
  return /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|vision|gemini|claude-3|claude-sonnet|claude-opus|claude-haiku|qwen.*vl|vl-\d|glm-4v|glm-5|pixtral|llava|internvl|molmo|llama-3\.2-9|llama-3\.2-11|llama-3\.2-90|phi-3\.5-vision|grok-4|grok-vision|o4|deepseek-vl/.test(m)
}

export default function SettingsPage() {
  const { models, addModel, updateModel, removeModel, setActive, activeModelId } = useModels()
  const { theme, set: setTheme } = useTheme()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function save() {
    if (!draft || !draft.label.trim() || !draft.baseUrl.trim() || !draft.modelId.trim()) return
    const withAutoVision = { ...draft, vision: isVisionModel(draft.modelId) }
    if (draft.id) {
      updateModel(draft.id, withAutoVision)
      setActive(draft.id)
    } else {
      addModel(withAutoVision)
    }
    setDraft(null)
    setTestResult(null)
  }

  async function test() {
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    try {
      const baseUrl = draft.baseUrl.replace(/\/+$/, '')
      const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(draft.apiKey ? { Authorization: `Bearer ${draft.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: draft.modelId,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 5,
        }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`${res.status}: ${t.slice(0, 200)}`)
      }
      const j = await res.json()
      const reply = j.choices?.[0]?.message?.content || '(empty reply)'
      setTestResult({ ok: true, msg: `Model replied: "${reply.trim().slice(0, 50)}" — all good! ✅` })
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || String(e) })
    } finally {
      setTesting(false)
    }
  }

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
    <div className="anim-in mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">⚙️ Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Your API key, your provider — everything stays <b>in your browser only</b>. Add as many models as you want and switch from the header.
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
        <h2 className="mb-2 text-sm font-bold text-muted">🤖 AI Models</h2>
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
                  {m.vision && (
                    <span title="Vision model"><Eye size={13} className="text-amber-500" /></span>
                  )}
                  {m.label}
                  {m.id === activeModelId && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-500 dark:text-indigo-300">active</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-faint">{m.modelId} · {m.baseUrl.replace(/^https?:\/\//, '')}</p>
              </div>
              <button className="btn-ghost !p-2 text-muted" onClick={() => { setDraft({ ...m }); setTestResult(null) }}><Pencil size={14} /></button>
              <button className="btn-ghost !p-2 text-red-500 hover:!border-red-500/50" onClick={() => removeModel(m.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {models.length === 0 && !draft && (
            <div className="card p-6 text-center">
              <p className="text-3xl">🤖</p>
              <p className="mt-2 text-sm font-semibold">No models yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
                OpenAI, Gemini, Groq, OpenRouter or local Ollama — all work (OpenAI-compatible).
              </p>
            </div>
          )}
        </div>

        {!draft ? (
          <button className="btn-primary mt-2 w-full" onClick={() => { setDraft(emptyDraft()); setTestResult(null) }}>
            <Plus size={16} /> Add Model
          </button>
        ) : (
          <div className="card mt-2 space-y-3.5 border-indigo-500/40 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-300">{draft.id ? 'Edit model' : 'New model'}</h3>
              <button className="btn-ghost !p-2" onClick={() => setDraft(null)}><X size={14} /></button>
            </div>

            {!draft.id && (
              <div>
                <span className="label">Provider preset <span className="normal-case text-faint">(optional — fills the Base URL)</span></span>
                <div className="flex flex-wrap gap-1.5">
                  {AI_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setDraft({ ...draft, baseUrl: p.baseUrl, label: draft.label || p.label })}
                      title={p.hint}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                        draft.baseUrl === p.baseUrl ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="label"><KeyRound size={11} className="mr-1 inline" /> Name</span>
              <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Gemini Flash / GPT-4o" />
            </div>
            <div>
              <span className="label"><Globe size={11} className="mr-1 inline" /> Base URL</span>
              <input className="input font-mono text-xs" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
              <p className="mt-1 text-[10px] text-faint">OpenAI-compatible endpoint (…/v1) — /chat/completions is added automatically.</p>
            </div>
            <div>
              <span className="label">API Key</span>
              <div className="relative">
                <input
                  className="input pr-10 font-mono text-xs"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="sk-… (empty for Ollama)"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg" onClick={() => setShowKey((s) => !s)} type="button">
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <span className="label"><Cpu size={11} className="mr-1 inline" /> Model ID</span>
              <input className="input font-mono text-xs" value={draft.modelId} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} placeholder="gpt-4o-mini / gemini-2.0-flash" />
              <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                {isVisionModel(draft.modelId) ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                    <Eye size={10} /> Vision auto-detected
                  </span>
                ) : (
                  <span className="text-faint">Text model — images disabled (vision is detected automatically)</span>
                )}
              </div>
            </div>

            {testResult && (
              <div className={`rounded-xl border p-3 text-xs ${testResult.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-300'}`}>
                {testResult.ok ? <CheckCircle2 size={13} className="mr-1 inline" /> : <AlertTriangle size={13} className="mr-1 inline" />}
                {testResult.msg}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={test} disabled={testing || !draft.baseUrl || !draft.modelId}>
                {testing ? <Loader2 size={15} className="animate-spin" /> : '🔌'} Test connection
              </button>
              <button className="btn-primary flex-1" onClick={save} disabled={!draft.label.trim() || !draft.baseUrl.trim() || !draft.modelId.trim()}>
                Save model
              </button>
            </div>
          </div>
        )}
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
              if (confirm('All data (papers, progress, chats) will be deleted, including models/API keys. Are you sure?')) {
                Object.keys(localStorage).filter((k) => k.startsWith('genexam')).forEach((k) => localStorage.removeItem(k))
                location.reload()
              }
            }}
          >
            <Trash2 size={13} /> Reset everything
          </button>
        </div>
      </section>

      <p className="pb-6 text-[11px] leading-relaxed text-faint">
        🔒 API keys are never exported in backups. Requests go directly to your provider (OpenAI/Gemini/…) — Genexam has no server. Public CORS proxies are used to read YouTube/web links.
      </p>
    </div>
  )
}
