import type { ModelConfig } from '../types'

// Vision helpers: image + text -> text (OpenAI-compatible chat completions, non-streaming)

export async function chatVisionText(opts: {
  model: ModelConfig
  image: string // data url
  prompt: string
  system?: string
}): Promise<string> {
  const { model } = opts
  if (!model.vision) {
    throw new Error(
      `Model "${model.label}" par vision (👁) tag nahi hai. Settings mein ek vision model add karo (jaise gpt-4o, gemini-2.0-flash, qwen-vl).`,
    )
  }
  const [meta, b64] = opts.image.split(',')
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const baseUrl = model.baseUrl.replace(/\/+$/, '')
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model.modelId,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            { type: 'text', text: opts.prompt },
          ],
        },
      ],
      temperature: 0.4,
      stream: false,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Vision API ${res.status}: ${t.slice(0, 200)}`)
  }
  const j = await res.json()
  return j.choices?.[0]?.message?.content ?? ''
}
