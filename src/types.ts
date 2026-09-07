export interface ModelConfig {
  id: string // unique profile id (uuid)
  label: string // user given name
  baseUrl: string // e.g. https://api.openai.com/v1  or OpenRouter/Groq/Ollama
  apiKey: string
  modelId: string // provider's model id
  vision: boolean // model accepts images
  createdAt: number
}

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  images?: string[] // base64 data urls
  linkContext?: string[] // fetched link summaries
}

export interface Question {
  id: string
  type: 'mcq' | 'short' | 'long' | 'fill' | 'truefalse' | 'oneword' | 'match'
  label?: string // e.g. "(i)" or "Q. 6"
  group?: string // section-group header, e.g. "Q. 1. Choose the correct option (6 × 1 = 6)"
  q: string
  options?: string[] // for mcq
  marks: number
  answer?: string // model answer / correct option
  choiceOf?: string // internal choice (OR) alternative question
  wordLimit?: number
  userAnswer?: string
  score?: number // marks awarded
  feedback?: string // AI evaluation feedback
}

export interface ExamPaper {
  id: string
  title: string
  subjectId: string
  chapterIds: string[]
  totalTimeMin: number
  totalMarks: number
  createdAt: number
  questions: Question[]
  submitted?: boolean
  evaluated?: boolean
}

export interface PendingImage {
  dataUrl: string
  name: string
}
