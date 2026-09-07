// Shared chat UI pieces used by ChatPage and ChapterPage

import { useState } from 'react'
import { Copy, Check, RefreshCcw, Volume2, Square, Brain, ChevronDown } from 'lucide-react'
import Markdown from './Markdown'
import type { ChatMsg } from '../types'

export function Avatar({ role }: { role: 'user' | 'assistant' }) {
  return role === 'user' ? (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">T</span>
  ) : (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>
    </span>
  )
}

export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/[#*`$\\]/g, '').slice(0, 4000))
    u.lang = 'hi-IN'
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  } catch { /* no tts */ }
}

export function AssistantActions({ text, onRegenerate }: { text: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  return (
    <div className="mt-2 flex items-center gap-0.5 opacity-0 transition group-hover/msg:opacity-100">
      <button
        className="grid h-7 w-7 place-items-center rounded-lg text-faint transition hover:bg-surface2 hover:text-fg"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
        title="Copy"
      >
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      </button>
      <button
        className="grid h-7 w-7 place-items-center rounded-lg text-faint transition hover:bg-surface2 hover:text-fg"
        onClick={() => {
          if (speaking) { speechSynthesis.cancel(); setSpeaking(false) } else { speak(text); setSpeaking(true) }
        }}
        title="Listen"
      >
        <Volume2 size={13} className={speaking ? 'text-indigo-500' : ''} />
      </button>
      {onRegenerate && (
        <button
          className="grid h-7 w-7 place-items-center rounded-lg text-faint transition hover:bg-surface2 hover:text-fg"
          onClick={onRegenerate}
          title="Regenerate"
        >
          <RefreshCcw size={13} />
        </button>
      )}
    </div>
  )
}

/**
 * Collapsible "Thinking" pill for reasoning models.
 * While reasoning streams and no answer text has arrived yet: animated "Thinking…" (expanded by default).
 * Once the answer starts: collapses to a clickable "Thought process" pill.
 */
export function ThinkingBlock({
  reasoning, streaming, contentStarted,
}: { reasoning: string; streaming?: boolean; contentStarted: boolean }) {
  const [open, setOpen] = useState(!contentStarted)
  const active = !!streaming && !contentStarted

  // auto-open while thinking, auto-collapse when the answer starts
  const [wasActive, setWasActive] = useState(false)
  if (active && !wasActive) { setOpen(true); setWasActive(true) }
  if (!active && wasActive) { setOpen(false); setWasActive(false) }

  if (!reasoning) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
          active
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
            : 'border-line text-muted hover:bg-surface2'
        }`}
      >
        <Brain size={12} className={active ? 'animate-pulse' : ''} />
        {active ? 'Thinking…' : 'Thought process'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface2/50 px-3.5 py-3 text-[11px] leading-relaxed text-muted">
          {reasoning.slice(-4000)}
        </pre>
      )}
    </div>
  )
}

export function UserBubble({ msg }: { msg: ChatMsg }) {  return (
    <div className="group/msg flex flex-row-reverse gap-3">
      <Avatar role="user" />
      <div className="min-w-0 max-w-[85%]">
        {msg.images && msg.images.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-1.5">
            {msg.images.map((img, i) => (
              <img key={i} src={img} alt="" className="h-24 rounded-xl border border-line object-cover" />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap rounded-3xl rounded-tr-lg bg-indigo-600 px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {msg.content}
        </div>
      </div>
    </div>
  )
}

export function AssistantBubble({
  content, streaming, reasoning, onRegenerate,
}: { content: string; streaming?: boolean; reasoning?: string; onRegenerate?: () => void }) {
  if (streaming && !content && !reasoning) {
    return (
      <div className="group/msg flex gap-3">
        <Avatar role="assistant" />
        <span className="mt-2 inline-flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
          ))}
        </span>
      </div>
    )
  }

  return (
    <div className="group/msg flex gap-3">
      <Avatar role="assistant" />
      <div className="min-w-0 max-w-[92%] flex-1">
        {reasoning && <ThinkingBlock reasoning={reasoning} streaming={streaming} contentStarted={!!content} />}
        <Markdown text={content} />
        {!streaming && content && <AssistantActions text={content} onRegenerate={onRegenerate} />}
      </div>
    </div>
  )
}

export function StopSendButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg transition hover:opacity-85"
      title="Stop generating"
    >
      <Square size={14} className="fill-current" />
    </button>
  )
}
