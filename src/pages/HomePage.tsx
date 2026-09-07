import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Paperclip, X, Youtube, FileText, ImageIcon, Sparkles } from 'lucide-react'
import { useUI } from '../store/ui'
import type { PendingImage } from '../types'

/**
 * Google-style clean home: Genexam logo centered, one big chatbar below it.
 * Whatever goes in here — a YouTube lecture link, a typed syllabus, attached
 * notes/photos — is handed to the AI tutor on /chat to build everything.
 */
export default function HomePage() {
  const nav = useNavigate()
  const openAddModel = useUI((s) => s.openAddModel)
  const [text, setText] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  function go() {
    if (!text.trim() && images.length === 0) return
    nav('/chat', { state: { seed: text.trim(), images } })
  }

  async function onFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files).slice(0, 5)) {
      if (f.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.readAsDataURL(f)
        })
        setImages((p) => [...p, { dataUrl, name: f.name }])
      } else if (/\.(txt|md|csv)$/i.test(f.name) && f.size < 512 * 1024) {
        const content = await f.text()
        setText((t) => `${t}${t ? '\n\n' : ''}[Attached file — ${f.name}]\n${content}`)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-10">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>
        </span>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Gen<span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">exam</span>
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">Paste a syllabus or lecture link — AI se sab ban jaayega.</p>
        </div>
      </div>

      {/* Chatbar */}
      <div className="w-full max-w-2xl">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-14 w-14 rounded-xl border border-line object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white shadow"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="card flex items-end gap-1.5 p-2 !rounded-[28px] shadow-pop transition focus-within:border-indigo-500/60">
          <input ref={fileRef} type="file" accept="image/*,.txt,.md,.csv" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface2 hover:text-fg"
            onClick={() => fileRef.current?.click()}
            title="Attach photo or file"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                go()
              }
            }}
            rows={1}
            placeholder="Paste a YouTube link or type your syllabus…"
            className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-faint"
          />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
            onClick={go}
            disabled={!text.trim() && images.length === 0}
            title="Build my study plan"
          >
            <ArrowUp size={17} />
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <button onClick={() => setText('https://www.youtube.com/watch?v=')} className="chip transition hover:border-indigo-500/50 hover:text-fg">
            <Youtube size={12} className="text-red-500" /> YouTube lecture link
          </button>
          <button onClick={() => fileRef.current?.click()} className="chip transition hover:border-indigo-500/50 hover:text-fg">
            <ImageIcon size={12} className="text-sky-500" /> Syllabus photo
          </button>
          <button onClick={() => fileRef.current?.click()} className="chip transition hover:border-indigo-500/50 hover:text-fg">
            <FileText size={12} className="text-emerald-500" /> Notes file
          </button>
          <button onClick={() => setText('My syllabus:\n')} className="chip transition hover:border-indigo-500/50 hover:text-fg">
            <Sparkles size={12} className="text-indigo-500" /> Type syllabus
          </button>
        </div>
      </div>
    </div>
  )
}
