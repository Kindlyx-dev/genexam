import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const AI_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', hint: 'gpt-4o-mini / gpt-4o (vision)' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', hint: 'free + paid models sab' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', hint: 'llama-3.3-70b (fast & free tier)' },
  { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', hint: 'gemini-2.0-flash (vision, free tier)' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', hint: 'local models, no key' },
]
