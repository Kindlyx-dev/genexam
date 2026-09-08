import type { ExamPaper, Question } from '../types'
import { SYLLABUS } from '../data/syllabus'

export function chaptersPrompt(subjectId: string, chapterIds?: string[]) {
  const subj = SYLLABUS.find((s) => s.id === subjectId)
  if (!subj) return ''
  const chapters = chapterIds?.length
    ? subj.chapters.filter((c) => chapterIds.includes(c.id))
    : subj.chapters
  return chapters.map((c) => `${c.name}${c.nameHi ? ` (${c.nameHi})` : ''}`).join('; ')
}

export interface GenExamSpec {
  subjectId: string
  chapterIds?: string[]
  totalMarks: number
  totalTimeMin: number
  difficulty: 'easy' | 'medium' | 'hard'
  sampleImageNote?: string // description of a sample paper format the user uploaded
}

export const GEN_EXAM_SYSTEM = `You are an MP Board Class 10 question-paper setter. Create question papers strictly from the listed syllabus chapters, in MP Board previous-year style.
Every question MUST come from the listed chapters only. Include a brief answer key for every question. Marks must sum EXACTLY to the total.
Keep answers short (1-2 sentences for short questions, max 5 lines for long ones) so the paper generates fast.
Return ONLY valid JSON — no markdown fences, no commentary.`

export function genExamUserPrompt(spec: GenExamSpec): string {
  const subj = SYLLABUS.find((s) => s.id === spec.subjectId)
  const langLine =
    subj?.id === 'english'
      ? 'Write questions in English.'
      : subj?.id === 'hindi' || subj?.id === 'sanskrit'
        ? 'Write questions in the subject language (Hindi for Hindi, Sanskrit for Sanskrit).'
        : 'Write questions in English.'
  const chapters = chaptersPrompt(spec.subjectId, spec.chapterIds)
  return `Create ONE complete practice question paper.

Subject: ${subj?.name}
Chapters allowed (ONLY from these): ${chapters}
Time: ${spec.totalTimeMin} minutes
Difficulty: ${spec.difficulty} (mix of easy/medium/hard)
${spec.sampleImageNote ? `Follow this sample-paper format INSTEAD of the blueprint below:\n"""\n${spec.sampleImageNote}\n"""` : `Use the EXACT MP Board quarterly blueprint below.`}
${langLine}
${subj?.id === 'maths' || subj?.id === 'science' ? 'For numericals you may use LaTeX like $x^2+3x$.' : ''}

BLUEPRINT (75 marks, 23 questions — standard MP Board quarterly pattern):
- Section A — Objective, 30 marks: 5 main questions, each with 6 sub-parts (1 mark per sub-part):
  Q.1: 6 MCQs | Q.2: 6 Fill in the blanks | Q.3: 6 True/False | Q.4: 6 Match the columns | Q.5: 6 One-word/one-sentence answers
- Section B — Very Short Answer, 24 marks: Q.6 to Q.17 = 12 questions × 2 marks (~30 words each). EVERY question must have an internal choice (OR)
- Section C — Short Answer, 9 marks: Q.18 to Q.20 = 3 questions × 3 marks (~75 words each). Each with an internal choice (OR)
- Section D — Long Answer/Analytical, 12 marks: Q.21 to Q.23 = 3 questions × 4 marks (~120 words each). Each with an internal choice (OR)
(Internal assessment / practical marks are not part of this written paper.)

Return JSON exactly in this schema — one flat questions array; use group/label for sub-parts and choiceOf for OR:
{
  "title": "Model Question Paper: Class 10th — <Subject> (Quarterly Exam)",
  "totalTimeMin": ${spec.totalTimeMin},
  "totalMarks": 75,
  "questions": [
    { "id": "q1-1", "type": "mcq", "group": "Q. 1. Choose the correct option (6 × 1 = 6)", "label": "(i)", "q": "question text", "options": ["(a) ...","(b) ...","(c) ...","(d) ..."], "marks": 1, "answer": "(b) ..." },
    { "id": "q2-1", "type": "fill", "group": "Q. 2. Fill in the blanks (6 × 1 = 6)", "label": "(i)", "q": "sentence with ..........", "marks": 1, "answer": "word" },
    { "id": "q3-1", "type": "truefalse", "group": "Q. 3. True or False (6 × 1 = 6)", "label": "(i)", "q": "statement", "marks": 1, "answer": "True" },
    { "id": "q4-1", "type": "match", "group": "Q. 4. Match the columns (6 × 1 = 6)", "label": "(1)", "q": "Column A item → match with Column B", "marks": 1, "answer": "(B)" },
    { "id": "q5-1", "type": "oneword", "group": "Q. 5. Answer in one word/sentence (6 × 1 = 6)", "label": "(i)", "q": "question", "marks": 1, "answer": "brief" },
    { "id": "q6", "type": "short", "label": "Q. 6", "q": "main question (2 marks)", "choiceOf": "OR — the alternative question", "marks": 2, "answer": "brief model answer for the main question", "wordLimit": 30 }
  ]
}
Rules:
- Objective sub-parts (Q.1–Q.5) have NO choiceOf.
- EVERY question from Q.6 to Q.23 MUST include choiceOf (OR alternative).
- Marks of ALL questions must sum EXACTLY to 75. Keep answers brief for speed.`
}

/**
 * Parallel-friendly section-scoped prompt: generates ONLY its own section so the
 * full 75-mark paper can be built from two fast, conflict-free AI calls.
 */
export function genBlueprintSectionPrompt(spec: GenExamSpec, part: 'A' | 'BCD'): string {
  const subj = SYLLABUS.find((s) => s.id === spec.subjectId)
  const chapters = chaptersPrompt(spec.subjectId, spec.chapterIds)
  const langLine =
    subj?.id === 'english'
      ? 'Write questions in English.'
      : subj?.id === 'hindi' || subj?.id === 'sanskrit'
        ? 'Write questions in the subject language (Hindi for Hindi, Sanskrit for Sanskrit).'
        : 'Write questions in English.'
  const latex = subj?.id === 'maths' || subj?.id === 'science' ? 'For numericals you may use LaTeX like $x^2+3x$.' : ''

  const scope =
    part === 'A'
      ? `YOUR TASK — generate Section A ONLY (objective type, 30 marks total):
- Q.1: 6 MCQs → type "mcq", 4 options each, "answer" = correct option
- Q.2: 6 Fill in the blanks → type "fill", sentence with ..........
- Q.3: 6 True/False → type "truefalse", "answer" = "True" or "False"
- Q.4: 6 Match the columns → type "match", q = "Column A item → match with Column B", "answer" = "(B)" style
- Q.5: 6 One-word/one-sentence answers → type "oneword"
Each sub-part object: { "id": "qN-k", "group": "Q. N. <instruction> (6 × 1 = 6)", "label": "(k)", "q": "...", "marks": 1, "answer": "..." }
Do NOT add choiceOf. Do NOT generate Sections B, C or D. Exactly 30 sub-parts, 30 marks.`
      : `YOUR TASK — generate Sections B, C and D ONLY (45 marks total):
- Section B: Q.6 to Q.17 = 12 questions × 2 marks (~30 words), type "short", wordLimit 30
- Section C: Q.18 to Q.20 = 3 questions × 3 marks (~75 words), type "short", wordLimit 75
- Section D: Q.21 to Q.23 = 3 questions × 4 marks (~120 words), type "long", wordLimit 120
Each object: { "id": "q6", "type": "short", "label": "Q. 6", "q": "main question", "choiceOf": "OR — alternative question", "marks": 2, "answer": "brief model answer", "wordLimit": 30 }
EVERY question MUST include choiceOf (OR). Do NOT generate Section A / objective questions. Exactly 18 questions, 45 marks.`

  return `You are generating ONE PART of an MP Board Class 10 quarterly paper. Another generator is producing the other part — stay strictly inside your scope.

Subject: ${subj?.name}
Chapters allowed (ONLY from these): ${chapters}
Difficulty: ${spec.difficulty}
${langLine}
${latex}

${scope}

Return ONLY valid JSON — no fences, no commentary:
{ "questions": [ ... ] }`
}

export const EVAL_SYSTEM = `You are a strict but fair MP Board Class 10 examiner. Evaluate the student's answers against the answer key.
Rules:
- Award marks step-wise (Maths: give step marks). Blank or completely wrong answers get 0.
- Accept answers in Hindi or English.
- feedback: ONE short sentence in English pointing out what was right/wrong.
Return ONLY valid JSON.`

export function evalUserPrompt(paper: ExamPaper): string {
  const qs = paper.questions.map((q, i) => ({
    id: q.id,
    n: i + 1,
    label: q.label || `Q${i + 1}`,
    group: q.group || '',
    question: q.q,
    orAlternative: q.choiceOf || '',
    type: q.type,
    maxMarks: q.marks,
    answerKey: q.answer || '',
    studentAnswer: q.userAnswer || '(blank)',
  }))
  return `Evaluate this submitted answer sheet.

PAPER: ${paper.title} (total ${paper.totalMarks} marks)

QUESTIONS & ANSWERS:
${JSON.stringify(qs, null, 1)}

Return JSON exactly in this schema:
{
  "results": [
    { "id": "q1", "score": number, "feedback": "one short English sentence" }
  ],
  "totalScore": number,
  "totalMarks": ${paper.totalMarks},
  "percentage": number,
  "grade": "A+/A/B/C/D/F based on percentage",
  "weakChapters": ["chapter/topic names where student lost marks"],
  "overallFeedback": "2-3 sentences in English: strengths, weaknesses, what to study next"
}
Every question id must appear exactly once in results. score must be between 0 and maxMarks.`
}

export const IMAGE_FORMAT_PROMPT = `Look at this sample question paper image carefully. Describe its FORMAT in detail so an exact replica can be generated from a different syllabus:
- How many sections (A, B, C...)? What does each section say (instructions)?
- What types of questions (MCQ / very short / short / long / fill in the blanks / true false / match)?
- How many questions per section? Marks per question type? Any "attempt any N" choices?
- Total marks of the paper, if visible.
Reply in plain text, concise bullet points. This description will be used as a template.`

export function questionsJSONPrompt(opts: {
  subjectId: string
  chapterIds?: string[]
  type: 'mcq' | 'short' | 'long' | 'mixed'
  count: number
  marksEach?: number
}): string {
  const subj = SYLLABUS.find((s) => s.id === opts.subjectId)
  const chapters = chaptersPrompt(opts.subjectId, opts.chapterIds)
  const langLine =
    subj?.id === 'english'
      ? 'Write in English.'
      : subj?.id === 'hindi' || subj?.id === 'sanskrit'
        ? 'Write in the subject language (Hindi for Hindi, Sanskrit for Sanskrit).'
        : 'Write in English.'
  return `Generate ${opts.count} exam-style practice questions (MP Board PYQ pattern, frequently-asked important questions) from ONLY these chapters: ${chapters}

Question type: ${opts.type === 'mixed' ? 'mix of mcq, short (2-3 marks), long (4-5 marks)' : opts.type}${opts.marksEach ? `, each worth ${opts.marksEach} marks` : ''}
${langLine}
${subj?.id === 'maths' || subj?.id === 'science' ? 'Use LaTeX for math like $x^2$.' : ''}

Return ONLY valid JSON:
{"questions":[{"id":"q1","type":"mcq|short|long","q":"...","options":["a) ...","b) ...","c) ...","d) ..."],"marks":number,"answer":"model answer / correct option"}]}`
}

export function applyEval(paper: ExamPaper, results: Array<{ id: string; score: number; feedback: string }>) {
  for (const r of results) {
    const q = paper.questions.find((x) => x.id === r.id)
    if (q) {
      q.score = Math.max(0, Math.min(q.marks, Math.round(r.score)))
      q.feedback = r.feedback
    }
  }
  paper.evaluated = true
  paper.submitted = true
}
