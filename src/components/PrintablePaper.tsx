import type { ExamPaper } from '../types'
import { findSubject } from '../data/syllabus'
import { normalizeQuestions } from '../lib/questions'

/**
 * Clean black-on-white question paper for printing / Save-as-PDF.
 * Renders ALL questions — including every OR internal choice — exactly like
 * a real MP Board paper, with ruled answer spaces for written questions.
 */
export default function PrintablePaper({ paper }: { paper: ExamPaper }) {
  const subj = findSubject(paper.subjectId)
  const questions = normalizeQuestions(paper.questions)

  const blocks: Array<{ group?: string; questions: ExamPaper['questions'] }> = []
  for (const q of questions) {
    const last = blocks[blocks.length - 1]
    if (q.group && last?.group === q.group) last.questions.push(q)
    else blocks.push({ group: q.group || undefined, questions: [q] })
  }

  return (
    <div className="print-only print-paper" style={{ fontFamily: "'Inter','Noto Sans Devanagari',serif", color: '#000', padding: '10mm 4mm' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '4mm', marginBottom: '4mm' }}>
        <p style={{ fontSize: '10pt', fontWeight: 600 }}>{subj?.name ?? ''} — {subj?.nameHi ?? ''}</p>
        <h1 style={{ fontSize: '15pt', fontWeight: 800, margin: '2mm 0' }}>{paper.title}</h1>
        <p style={{ fontSize: '10.5pt' }}>
          Time: {paper.totalTimeMin >= 60 ? `${Math.floor(paper.totalTimeMin / 60)}:${String(paper.totalTimeMin % 60).padStart(2, '0')} Hours` : `${paper.totalTimeMin} min`}
          &nbsp;&nbsp;|&nbsp;&nbsp; Maximum Marks: {paper.totalMarks}
        </p>
      </div>

      {/* Instructions */}
      <div style={{ fontSize: '9.5pt', marginBottom: '5mm', paddingLeft: '2mm' }}>
        <p style={{ fontWeight: 700, marginBottom: '1mm' }}>General Instructions:</p>
        <p>1. All questions are compulsory unless stated otherwise.</p>
        <p>2. Objective questions (Q. 1 to 5) carry 1 mark for each sub-question.</p>
        <p>3. Internal choices are provided in question numbers 6 to 23.</p>
        <p>4. Draw neat and labeled diagrams wherever necessary.</p>
      </div>

      {/* Questions */}
      {blocks.map((block, bi) => (
        <div key={bi} style={{ marginBottom: '4mm' }}>
          {block.group && (
            <p style={{ fontWeight: 800, fontSize: '10.5pt', margin: '3mm 0 2mm', breakAfter: 'avoid' }}>{block.group}</p>
          )}
          {block.questions.map((q, qi) => {
            const i = questions.indexOf(q)
            return (
              <div key={q.id} className="print-q" style={{ marginBottom: '3.5mm', breakInside: 'avoid' }}>
                <p style={{ fontSize: '10pt', lineHeight: 1.5 }}>
                  <b>{block.group ? q.label : q.label || `Q.${i + 1}`}.</b>{' '}
                  {q.q}
                  {!block.group && <span style={{ float: 'right' }}>[{q.marks}]</span>}
                </p>

                {q.type === 'mcq' && q.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm 6mm', margin: '1.5mm 0 0 6mm', fontSize: '9.5pt' }}>
                    {q.options.map((o, oi) => (
                      <span key={oi}>{o}</span>
                    ))}
                  </div>
                )}

                {q.choiceOf && (
                  <>
                    <p style={{ textAlign: 'center', fontWeight: 800, margin: '2.5mm 0 1mm' }}>OR</p>
                    <p style={{ fontSize: '10pt', lineHeight: 1.5, margin: '0 0 0 6mm' }}>
                      {q.choiceOf.replace(/^\s*OR\s*[-–—]?\s*/i, '')}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <p style={{ textAlign: 'center', fontSize: '9pt', marginTop: '6mm', borderTop: '1px solid #999', paddingTop: '2mm' }}>
        — All the best! (Generated with Genexam) —
      </p>
    </div>
  )
}
