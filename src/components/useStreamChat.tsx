import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * ChatGPT-style streaming state manager.
 * - Holds the streaming text in a ref + state, batched via rAF for smoothness.
 * - Also captures model reasoning (thinking tokens) separately.
 */
export function useStreamChat() {
  const [text, setText] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const bufRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const flushRef = useRef<(() => void) | null>(null)

  const flush = useCallback(() => {
    rafRef.current = null
    setText(bufRef.current)
  }, [])

  flushRef.current = flush

  const pushDelta = useCallback((d: string) => {
    bufRef.current += d
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => flushRef.current?.())
    }
  }, [])

  const pushReasoning = useCallback((acc: string) => {
    setReasoning(acc)
  }, [])

  const start = useCallback(() => {
    bufRef.current = ''
    setText('')
    setReasoning('')
    setError('')
    setIsStreaming(true)
  }, [])

  const finish = useCallback((final?: string) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const t = final ?? bufRef.current
    setText(t)
    setIsStreaming(false)
  }, [])

  const fail = useCallback((msg: string) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setError(msg)
    setIsStreaming(false)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  return {
    text, reasoning, isStreaming, error,
    pushDelta, pushReasoning, start, finish, fail, stop,
    abortController: abortRef,
  }
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-2 w-2 rounded-full bg-muted" />
      ))}
    </span>
  )
}
