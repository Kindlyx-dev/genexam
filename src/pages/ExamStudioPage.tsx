import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Image as ImageIcon, X, Wand2, History, Eye, ChevronRight, Sparkles } from 'lucide-react'
import { SYLLABUS, findSubject } from '../data/syllabus'
import { useModels } from '../store/models'
import { useExams } from '../store/exams'
import { streamJSON, robustParse } from '../lib/ai'
import { chatVisionText } from '../lib/vision'
import ReasoningPanel from '../components/ReasoningPanel'
import { GEN_EXAM_SYSTEM, genExamUserPrompt, genBlueprintSectionPrompt, IMAGE_FORMAT_PROMPT, type GenExamSpec } from '../lib/prompts'
import { normalizeQuestions } from '../lib/questions'
import type { ExamPaper, PendingImage } from '../types'

/**
 * Enforce the MP Board blueprint exactly: 5 objective groups × 6 sub-parts (30 marks),
 * 12 × 2-mark, 3 × 3-mark, 3 × 4-mark questions (OR baked into choiceOf) = 75 marks, 23 questions.
 * Models often over/under-generate; this trims deterministically.
 */
function conformToBlueprint(qs: any[]): any[] {
  const objGroups = new Map<string, any[]>()
  const rest: any[] = []
  for (const q of qs) {
    if (q.group && Number(q.marks) === 1) {
      const g = objGroups.get(q.group) || []
      if (g.length < 6) g.push(q)
      objGroups.set(q.group, g)
    } else {
      rest.push(q)
    }
  }
  const objective: any[] = []
  for (const g of objGroups.values()) {
    if (objective.length / 6 >= 5) break
    objective.push(...g)
  }
  // drop stray "OR …" duplicates (OR belongs in choiceOf, not a separate question)
  const mains = rest.filter((q) => !/^\s*\(?\s*OR\b/i.test(q.q || ''))
  const tiers: Array<[number, number]> = [[12, 2], [3, 3], [3, 4]]
  const picked: any[] = []
  for (const [count, marks] of tiers) {
    const tier = mains.filter((q) => Number(q.marks) === marks && !picked.includes(q))
    picked.push(...tier.slice(0, count))
  }
  return [...objective, ...picked]
}

export default function ExamStudioPage() {
  const { models, activeModelId } = useModels()
  const { papers } = useExams()
  const model = models.find((m) => m.id === activeModelId) ?? null

  const [subjectId, setSubjectId] = useState(SYLLABUS[0].id)
  const [chapterIds, setChapterIds] = useState<string[]>([])
  const [totalMarks, setTotalMarks] = useState(75)
  const [totalTimeMin, setTotalTimeMin] = useState(180)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [formatImages, setFormatImages] = useState<PendingImage[]>([])
  const [formatNote, setFormatNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [genText, setGenText] = useState('')
  const [genReasoning, setGenReasoning] = useState('')
  const [progress, setProgress] = useState<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const lastTextRef = useRef('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const subject = findSubject(subjectId)!

  function toggleChapter(id: string) {
    setChapterIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function onFiles(files: FileList | null) {
    if (!files) return
    const arr: PendingImage[] = []
    for (const f of Array.from(files).slice(0, 3)) {
      if (!f.type.startsWith('image/')) continue
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.readAsDataURL(f)
      })
      arr.push({ dataUrl, name: f.name })
    }
    setFormatImages((p) => [...p, ...arr])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function generate() {
    if (!model) {
      setError('Add an AI model in Settings first.')
      return
    }
    setLoading(true)
    setError('')
    setGenText('')
    setGenReasoning('')
    setProgress(undefined)
    lastTextRef.current = ''
    abortRef.current = new AbortController()
    try {
      let sampleImageNote = formatNote
      if (formatImages.length > 0) {
        setStatus('Reading the sample paper format…')
        const descParts: string[] = []
        for (const img of formatImages) {
          const d = await chatVisionText({ model, image: img.dataUrl, prompt: IMAGE_FORMAT_PROMPT })
          descParts.push(d)
        }
        if (formatNote) descParts.push(formatNote)
        sampleImageNote = descParts.join('\n\n')
      }

      setStatus('Generating paper from the syllabus…')
      const spec: GenExamSpec = {
        subjectId,
        chapterIds: chapterIds.length ? chapterIds : undefined,
        totalMarks,
        totalTimeMin,
        difficulty,
        sampleImageNote: sampleImageNote || undefined,
      }

      const finalize = (title: string, questions: any[], partialNote?: string) => {
        const good = conformToBlueprint(normalizeQuestions(questions.filter((q) => q && q.q && Number(q.marks) > 0)))
        const full: ExamPaper = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          subjectId,
          chapterIds,
          submitted: false,
          title: (title || `${subject.name} Practice Paper`) + (partialNote || ''),
          totalTimeMin: totalTimeMin,
          totalMarks: good.reduce((n, q) => n + (Number(q.marks) || 0), 0) || totalMarks,
          questions: good.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` })),
        }
        useExams.getState().savePaper(full)
        setStatus('')
        setLoading(false)
        window.location.hash = `#/exam/${full.id}`
      }

      if (!sampleImageNote) {
        // Blueprint mode: two parallel section-scoped calls so the full 75-mark paper
        // generates fast and never hits output-token truncation. UI updates are
        // throttled (200 ms) so the panel stays smooth instead of stuttering.
        const spec: GenExamSpec = {
          subjectId,
          chapterIds: chapterIds.length ? chapterIds : undefined,
          totalMarks,
          totalTimeMin,
          difficulty,
        }
        let accA = ''
        let accB = ''
        let reA = ''
        let reB = ''
        let lastRe = ''
        setGenText('')
        setGenReasoning('')
        const countIds = (t: string) => (t.match(/"id"\s*:/g) || []).length
        const timer = setInterval(() => {
          const nA = countIds(accA)
          const nB = countIds(accB)
          setProgress(
            nA + nB > 0
              ? `Section A: ${nA}/30 · Sections B–D: ${nB}/18`
              : undefined,
          )
          const text =
            (accA ? `SECTION A STREAM:\n${accA.slice(-1100)}` : '') +
            (accA && accB ? '\n\n———\n\n' : '') +
            (accB ? `SECTIONS B–D STREAM:\n${accB.slice(-1100)}` : '')
          setGenText(text)
          setGenReasoning(lastRe.slice(-2000))
        }, 200)

        const [resA, resB] = await Promise.allSettled([
          streamJSON<{ questions: any[] }>({
            model,
            msgs: [{ role: 'user', content: genBlueprintSectionPrompt(spec, 'A') }],
            system: GEN_EXAM_SYSTEM,
            temperature: 0.7,
            reasoningEffort: 'low',
            signal: abortRef.current.signal,
            onText: (acc) => { accA = acc },
            onReasoning: (acc) => { reA = acc; lastRe = acc },
          }),
          streamJSON<{ questions: any[] }>({
            model,
            msgs: [{ role: 'user', content: genBlueprintSectionPrompt(spec, 'BCD') }],
            system: GEN_EXAM_SYSTEM,
            temperature: 0.7,
            reasoningEffort: 'low',
            signal: abortRef.current.signal,
            onText: (acc) => { accB = acc },
            onReasoning: (acc) => { reB = acc; lastRe = acc },
          }),
        ])
        clearInterval(timer)

        const qsA = resA.status === 'fulfilled' ? resA.value.questions || [] : []
        const qsB = resB.status === 'fulfilled' ? (resB.value.questions || []) : []
        const all = [...qsA, ...qsB]
        if (all.length === 0) {
          const reason = resA.status === 'rejected' ? resA.reason : resB.status === 'rejected' ? resB.reason : new Error('No questions generated')
          throw reason
        }
        finalize(`Model Question Paper: Class 10th — ${subject.name} (Quarterly Exam)`, all, all.length < 20 ? ' (partial)' : undefined)
        return
      }

      const paper = await streamJSON<Omit<ExamPaper, 'id' | 'createdAt' | 'subjectId' | 'chapterIds' | 'submitted'>>({
        model,
        msgs: [{ role: 'user', content: genExamUserPrompt(spec) }],
        system: GEN_EXAM_SYSTEM,
        temperature: 0.7,
        reasoningEffort: 'low',
        signal: abortRef.current.signal,
        onText: (acc) => {
          lastTextRef.current = acc
          setGenText(acc)
        },
        onReasoning: (acc) => {
          if (!lastTextRef.current) setGenReasoning(acc.slice(-2000))
        },
      })
      finalize(paper.title, paper.questions || [])
    } catch (e: any) {
      // Stop or interruption — salvage whatever of the paper completed
      if (lastTextRef.current) {
        try {
          const partial = robustParse<Omit<ExamPaper, 'id' | 'createdAt' | 'subjectId' | 'chapterIds' | 'submitted'>>(lastTextRef.current)
          const good = conformToBlueprint(normalizeQuestions((partial.questions || []).filter((q) => q && q.q && Number(q.marks) > 0)))
          if (good.length >= 5) {
            const full: ExamPaper = {
              id: crypto.randomUUID(),
              createdAt: Date.now(),
              subjectId,
              chapterIds,
              submitted: false,
              title: (partial.title || `${subject.name} Practice Paper`) + ' (partial)',
              totalTimeMin: partial.totalTimeMin || totalTimeMin,
              totalMarks: good.reduce((n, q) => n + (Number(q.marks) || 0), 0) || totalMarks,
              questions: good.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` })),
            }
            useExams.getState().savePaper(full)
            setStatus('')
            setLoading(false)
            window.location.hash = `#/exam/${full.id}`
            return
          }
        } catch { /* nothing usable */ }
      }
      if (e?.name === 'AbortError') setError('Generation stopped. Press Generate to try again.')
      else setError(e?.message || String(e))
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="anim-in mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
          <Wand2 className="text-indigo-500" size={22} /> Exam Studio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Generate a full paper from the syllabus — or upload a sample paper photo and its format will be copied. Submit your attempt and the AI examiner gives step-wise marks.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        {/* Subject */}
        <div>
          <span className="label">Subject</span>
          <div className="flex flex-wrap gap-2">
            {SYLLABUS.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSubjectId(s.id); setChapterIds([]) }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  subjectId === s.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'border-line text-muted hover:bg-surface2'
                }`}
              >
                <span>{s.emoji}</span> {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chapters */}
        <div>
          <span className="label">Chapters <span className="normal-case text-faint">(empty = full syllabus)</span></span>
          <div className="flex flex-wrap gap-1.5">
            {subject.chapters.map((c, i) => {
              const on = chapterIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChapter(c.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-line text-muted hover:bg-surface2'
                  }`}
                >
                  {i + 1}. {c.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Config */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <span className="label">Total marks</span>
            <select className="input" value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))}>
              {[25, 50, 75, 100].map((n) => <option key={n} value={n}>{n === 75 ? '75 (MP Board blueprint)' : n}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Time (min)</span>
            <select className="input" value={totalTimeMin} onChange={(e) => setTotalTimeMin(Number(e.target.value))}>
              {[30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="label">Difficulty</span>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
              <option value="easy">Easy — basics</option>
              <option value="medium">Medium — exam level</option>
              <option value="hard">Hard — toppers level</option>
            </select>
          </div>
        </div>

        {/* Sample format */}
        <div>
          <span className="label">Sample paper image <span className="normal-case text-faint">(optional · needs a 👁 vision model)</span></span>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            {formatImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded-xl border border-line object-cover" />
                <button
                  onClick={() => setFormatImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white shadow"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button className="btn-soft !py-2 text-xs" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={14} /> Add image
            </button>
          </div>
          <textarea
            value={formatNote}
            onChange={(e) => setFormatNote(e.target.value)}
            rows={2}
            placeholder="Or type it: 'Section A: 20 MCQs of 1 mark, Section B: 10 short of 2 marks…'"
            className="input mt-2 resize-none"
          />
        </div>

        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-300">⚠️ {error}</div>}

        {loading ? (
          <ReasoningPanel
            title={status || 'Generating your paper'}
            text={genText}
            reasoning={genReasoning}
            progress={progress}
            onStop={() => abortRef.current?.abort()}
          />
        ) : (
          <button className="btn-primary w-full !py-3" onClick={generate}>
            <><Sparkles size={16} /> Generate Full Exam Paper</>
          </button>
        )}
        {!model && (
          <p className="text-center text-[11px] text-amber-500">
            <Link to="/settings" className="underline">Add a model in Settings</Link>
          </p>
        )}
      </div>

      {/* Past papers */}
      {papers.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <History size={14} /> Your papers
          </h2>
          <div className="space-y-2">
            {papers.map((p) => {
              const subj = findSubject(p.subjectId)
              const scored = p.questions.some((q) => q.score != null)
              const pct = scored ? Math.round((p.questions.reduce((n, q) => n + (q.score ?? 0), 0) / Math.max(1, p.totalMarks)) * 100) : null
              return (
                <Link
                  key={p.id}
                  to={p.evaluated ? `/result/${p.id}` : `/exam/${p.id}`}
                  className="card flex items-center gap-3 p-3.5 transition hover:border-indigo-500/40"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-base text-white ${subj?.color ?? ''}`}>
                    {subj?.emoji ?? '📄'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="text-[11px] text-faint">
                      {p.totalMarks} marks · {p.questions.length} Qs · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {pct !== null && (
                    <span className={`text-sm font-extrabold ${pct >= 75 ? 'text-emerald-500' : pct >= 45 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                  )}
                  {!scored && <span className="chip !border-amber-500/40 !bg-amber-500/10 !text-amber-600 dark:!text-amber-400">Attempt</span>}
                  <ChevronRight size={14} className="text-faint" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
