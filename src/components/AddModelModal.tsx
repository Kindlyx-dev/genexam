import { useMemo, useRef, useState } from 'react'
import { X, Loader2, Search, Check, Sparkles, Keyboard, Globe } from 'lucide-react'
import { useModels } from '../store/models'
import { useUI } from '../store/ui'
import { PROVIDERS, providerOf } from '../lib/providers'
import { fetchCatalog, type CatalogModel } from '../lib/catalog'
import { chatCompletionsUrl } from '../lib/fetchAI'

type Mode = 'auto' | 'manual'
type Filter = 'free' | 'paid' | 'all'

/**
 * Small popup window for adding a model — Base URL + API key, then either
 * "Auto fetch" the provider's model list (free/paid/all filter, FREE badges)
 * or type the Model ID manually. Sits in the navbar; never opens full Settings.
 */
export default function AddModelModal() {
  const { addModelOpen, closeAddModel } = useUI()
  const { addModel } = useModels()

  const [mode, setMode] = useState<Mode>('auto')
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [manualId, setManualId] = useState('')

  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null)
  const [filter, setFilter] = useState<Filter>('free')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<CatalogModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const keyShownRef = useRef(false)

  if (!addModelOpen) return null

  function pickProvider(id: string) {
    const p = PROVIDERS.find((x) => x.id === id)!
    setProvider(p)
    setBaseUrl(p.baseUrl)
    setCatalog(null)
    setPicked(null)
    setError('')
    keyShownRef.current = false
  }

  async function autoFetch() {
    setLoading(true)
    setError('')
    setCatalog(null)
    setPicked(null)
    try {
      const list = await fetchCatalog(baseUrl, apiKey.trim() || undefined)
      if (list.length === 0) throw new Error('Provider returned an empty model list')
      setCatalog(list)
      setFilter('all')
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  function save() {
    const modelId = mode === 'auto' ? picked?.id : manualId.trim()
    if (!modelId || !baseUrl.trim()) return
    const vis = mode === 'auto' ? picked!.vision : /vision|gemini|gpt-4o|gpt-5|claude|glm-5|grok-4/i.test(modelId)
    addModel({
      label: label.trim() || modelId.split('/').pop()!.slice(0, 24),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId,
      vision: vis,
      free: mode === 'auto' ? picked!.free : /:free|free[-_/]/i.test(modelId),
    })
    setSaved(true)
    setTimeout(closeAddModel, 700)
  }

  const canSave = !!baseUrl.trim() && (mode === 'auto' ? !!picked : !!manualId.trim())

  const shown = useMemo(() => {
    if (!catalog) return []
    let list = filter === 'free' ? catalog.filter((m) => m.free) : filter === 'paid' ? catalog.filter((m) => !m.free) : catalog
    const q = query.toLowerCase().trim()
    if (q) list = list.filter((m) => m.id.toLowerCase().includes(q))
    return list.slice(0, 80)
  }, [catalog, filter, query])

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[10vh] no-print" onClick={closeAddModel}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="card relative w-full max-w-md overflow-hidden !rounded-2xl shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {saved ? (
          <div className="grid place-items-center gap-2 p-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Check size={22} /></span>
            <p className="text-sm font-bold">Model saved — you're ready!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={14} className="text-indigo-500" /> Add a model</h3>
              <button className="btn-ghost !p-1.5" onClick={closeAddModel}><X size={14} /></button>
            </div>

            <div className="max-h-[65vh] space-y-3.5 overflow-y-auto p-4">
              {/* Provider */}
              <div>
                <span className="label">Provider</span>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickProvider(p.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        provider.id === p.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="label"><Globe size={11} className="mr-1 inline" /> Base URL</span>
                <input className="input font-mono text-xs" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setCatalog(null); setPicked(null) }} placeholder="https://api.provider.com/v1" />
              </div>
              {provider.needsKey && (
                <div>
                  <span className="label">API Key</span>
                  <input
                    className="input font-mono text-xs"
                    type={keyShownRef.current ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider.keyHint || 'sk-…'}
                  />
                  <p className="mt-1 text-[10px] text-faint">Sirf tere browser mein save hota hai — kahin upload nahi hota.</p>
                </div>
              )}

              {/* Mode switch */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-surface2/40 p-1.5">
                <button
                  onClick={() => setMode('auto')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === 'auto' ? 'bg-indigo-600 text-white' : 'text-muted hover:text-fg'}`}
                >
                  <Sparkles size={12} /> Auto fetch
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === 'manual' ? 'bg-indigo-600 text-white' : 'text-muted hover:text-fg'}`}
                >
                  <Keyboard size={12} /> Model ID
                </button>
              </div>

              {mode === 'auto' ? (
                catalog === null ? (
                  <div className="space-y-2">
                    {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-[11px] text-red-500 dark:text-red-300">{error}</div>}
                    <button className="btn-primary w-full !py-2.5 text-xs" onClick={autoFetch} disabled={loading || !baseUrl.trim()}>
                      {loading ? <><Loader2 size={14} className="animate-spin" /> Fetching models…</> : <><Sparkles size={14} /> Fetch models</>}
                    </button>
                    <p className="text-center text-[10px] text-faint">Provider ki model list utha lega — free models pe FREE badge.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['free', 'paid', 'all'] as Filter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold uppercase transition ${
                            filter === f ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
                      <Search size={13} className="text-faint" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models…" className="w-full bg-transparent py-2 text-xs outline-none placeholder:text-faint" />
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-line">
                      {shown.length === 0 && <p className="p-3 text-center text-[11px] text-faint">No models match.</p>}
                      {shown.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setPicked(m)}
                          className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-[11px] transition last:border-0 ${
                            picked?.id === m.id ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'hover:bg-surface2'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate font-mono">{m.id}</span>
                          {m.free && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>}
                          {m.vision && <span className="text-[9px] text-amber-500" title="Vision">👁</span>}
                          {picked?.id === m.id && <Check size={12} className="shrink-0" />}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-faint">{catalog.length} models · showing {shown.length}</p>
                  </div>
                )
              ) : (
                <div>
                  <span className="label">Model ID</span>
                  <input className="input font-mono text-xs" value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="e.g. gpt-4o-mini / gemini-2.0-flash" />
                </div>
              )}

              <div>
                <span className="label">Name <span className="normal-case text-faint">(optional)</span></span>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={mode === 'auto' && picked ? picked.id.split('/').pop() : 'My model'} />
              </div>

              {mode === 'manual' && error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-[11px] text-red-500 dark:text-red-300">{error}</div>}
            </div>

            <div className="flex gap-2 border-t border-line p-3">
              <button className="btn-ghost flex-1 !py-2.5 text-xs" onClick={closeAddModel}>Cancel</button>
              <button className="btn-primary flex-1 !py-2.5 text-xs" onClick={save} disabled={!canSave}>
                <Check size={14} /> Save model
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
