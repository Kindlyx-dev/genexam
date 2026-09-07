export interface ModelConfig {
  id: string // unique profile id (uuid)
  label: string // user given name
  baseUrl: string // e.g. https://api.openai.com/v1 or OpenRouter/Groq/Ollama
  apiKey: string
  modelId: string // provider's model id
  vision: boolean // model accepts images
  free?: boolean // detected via auto-fetch (pricing: 0)
  createdAt: number
}

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  images?: string[] // base64 data urls
}

export interface Question {
  id: string
  type: 'mcq' | 'short' | 'long' | 'fill' | 'truefalse' | 'oneword' | 'match'
  label?: string
  group?: string
  q: string
  options?: string[]
  marks: number
  answer?: string
  choiceOf?: string
  wordLimit?: number
  userAnswer?: string
  score?: number
  feedback?: string
}

export interface ExamPaper {
  id: string
  title: string
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
