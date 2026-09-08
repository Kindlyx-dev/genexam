import type { Question } from '../types'

/**
 * Normalizes AI-generated questions so rendering never breaks:
 * - extracts options that the model wrote inline in the question text
 * - infers missing types from the group/answer/marks
 * - fills True/False options
 */
export function normalizeQuestions(list: Question[]): Question[] {
  return list.map((raw) => {
    const q: Question = { ...raw }

    // 1) extract inline options like "(a) ... (b) ... (c) ... (d) ..."
    if ((!q.options || q.options.length === 0) && q.q) {
      const extracted = extractInlineOptions(q.q)
      if (extracted) {
        q.q = extracted.stem
        q.options = extracted.options
      }
    }

    // 2) infer missing type
    if (!q.type) {
      const g = (q.group || '').toLowerCase()
      const a = (q.answer || '').trim().toLowerCase()
      if (q.options && q.options.length >= 2) q.type = 'mcq'
      else if (a === 'true' || a === 'false') q.type = 'truefalse'
      else if (g.includes('match')) q.type = 'match'
      else if (g.includes('fill')) q.type = 'fill'
      else if (g.includes('one word') || g.includes('one-word') || g.includes('sentence')) q.type = 'oneword'
      else if ((q.marks || 1) <= 1) q.type = 'oneword'
      else if ((q.marks || 0) >= 4) q.type = 'long'
      else q.type = 'short'
    }

    // 3) True/False always gets its options
    if (q.type === 'truefalse' && (!q.options || q.options.length === 0)) {
      q.options = ['True', 'False']
    }

    return q
  })
}

/** Finds "(a) … (b) … (c) … (d) …" written inline and splits it out of the stem. */
function extractInlineOptions(text: string): { stem: string; options: string[] } | null {
  const re = /\(\s*([a-dA-D])\s*\)|(?<![a-zA-Z0-9])([a-dA-D])\s*[\.\)]\s*/g
  const marks: Array<{ ch: string; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const ch = (m[1] || m[2] || '').toLowerCase()
    if (ch) marks.push({ ch, start: m.index, end: re.lastIndex })
  }
  const find = (ch: string, after: number) => marks.find((p) => p.ch === ch && p.start > after)
  const a = marks.find((p) => p.ch === 'a')
  if (!a) return null
  const b = find('b', a.end)
  if (!b) return null
  const c = find('c', b.end)
  if (!c) return null
  const d = find('d', c.end)
  if (!d) return null

  const stem = text.slice(0, a.start).replace(/[\s\-–—:]+\$/, '').trim()
  const options = [
    text.slice(a.start, b.start).trim(),
    text.slice(b.start, c.start).trim(),
    text.slice(c.start, d.start).trim(),
    text.slice(d.start).trim(),
  ]
  if (options.some((o) => o.length < 1)) return null
  return { stem, options }
}
