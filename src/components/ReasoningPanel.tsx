import { useEffect, useRef, useState } from 'react'
import { Square, Brain, ChevronDown } from 'lucide-react'

/**
 * Live status card shown while the AI creates papers/quizzes/flashcards/evaluations.
 * Mirrors the chat "Thinking" pill: live reasoning (open while working) + a
 * collapsible raw-output view for transparency.
 */
export default function ReasoningPanel({
  title, text, reasoning, progress, onStop,
}: {
  title: string
  text: string
  reasoning?: string
  progress?: string
  onStop?: () => void
}) {
  const thinkRef = useRef<HTMLPreElement>(null)
  const outRef = useRef<HTMLPreElement>(null)
  const [showOutput, setShowOutput] = useState(false)

  useEffect(() => {
    if (thinkRef.current) thinkRef.current.scrollTop = thinkRef.current.scrollHeight
  }, [reasoning])
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight
  }, [text])

  const thinking = !!reasoning && !text

  return (
    <div className="card overflow-hidden !rounded-2xl border-indigo-500/30 anim-in">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-line bg-surface2/60 px-4 py-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
        </span>
        <p className="text-xs font-bold text-fg">{title}</p>
        {progress && (
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-300">{progress}</span>
        )}
        {onStop && (
          <button
            onClick={onStop}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:border-red-500/40 hover:text-red-500"
          >
            <Square size={9} className="fill-current" /> Stop
          </button>
        )}
      </div>

      {/* live reasoning — chat-style */}
      {reasoning ? (
        <div className="px-4 py-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300"
            onClick={() => thinkRef.current?.scrollTo({ top: thinkRef.current.scrollHeight })}
          >
            <Brain size={12} className="animate-pulse" /> Thinking…
          </button>
          <pre
            ref={thinkRef}
            className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface2/40 px-3.5 py-2.5 text-[11px] italic leading-relaxed text-muted"
          >
            {reasoning.slice(-2500)}
          </pre>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-4 py-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
          ))}
        </div>
      )}

      {/* raw output — collapsed by default */}
      {text && (
        <div className="border-t border-line px-4 py-2">
          <button
            onClick={() => setShowOutput((o) => !o)}
            className="flex items-center gap-1 text-[10px] font-semibold text-faint transition hover:text-fg"
          >
            Live output
            <ChevronDown size={11} className={`transition-transform ${showOutput ? 'rotate-180' : ''}`} />
          </button>
          {showOutput && (
            <pre
              ref={outRef}
              className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface2/40 px-3 py-2 font-mono text-[10px] leading-relaxed text-faint"
            >
              {text.slice(-2500)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
