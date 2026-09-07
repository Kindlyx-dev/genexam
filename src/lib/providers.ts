/** Known OpenAI-compatible providers. "Custom" covers anything else the user pastes. */
export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  needsKey: boolean
  keyHint?: string
  supportsAutoFetch: boolean // has a public /models listing
  freeTier?: boolean
}

export const PROVIDERS: ProviderPreset[] = [
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true, keyHint: 'sk-or-…', supportsAutoFetch: true },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', needsKey: true, keyHint: 'sk-…', supportsAutoFetch: true },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true, keyHint: 'gsk_…', supportsAutoFetch: true },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true, keyHint: 'AIza…', supportsAutoFetch: true, freeTier: true },
  { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', needsKey: true, keyHint: '…', supportsAutoFetch: true, freeTier: true },
  { id: 'cerebras', label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', needsKey: true, keyHint: 'csk-…', supportsAutoFetch: true, freeTier: true },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', needsKey: false, supportsAutoFetch: true },
  { id: 'custom', label: 'Custom', baseUrl: '', needsKey: false, supportsAutoFetch: false },
]

export function providerOf(baseUrl: string): ProviderPreset {
  const b = baseUrl.replace(/\/+$/, '').toLowerCase()
  return PROVIDERS.find((p) => p.baseUrl && b.startsWith(p.baseUrl.toLowerCase())) ?? PROVIDERS[PROVIDERS.length - 1]
}
