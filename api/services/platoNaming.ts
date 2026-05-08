import type {
  NamingRequestItem,
  NamingResponse,
  NamingResultItem,
} from '../../shared/types.js'

type PlatoAuthMode = 'x-api-key' | 'authorization' | 'both'

function getBaseUrl() {
  const raw = process.env.PLATO_BASE_URL
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

function getAuthHeaders() {
  const apiKey = process.env.PLATO_API_KEY
  if (!apiKey) return null
  const mode = (process.env.PLATO_AUTH_MODE || 'x-api-key') as PlatoAuthMode
  if (mode === 'authorization') return { Authorization: `Bearer ${apiKey}` }
  if (mode === 'both') return { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey }
  return { 'x-api-key': apiKey }
}

function cleanValue(raw: string | undefined, fallback: string) {
  if (!raw) return fallback
  const normalized = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '')
    .slice(0, 18)
  return normalized || fallback
}

function fallbackFromPrompt(prompt: string, id: string): NamingResultItem {
  const industryMatched = prompt.match(/(?:所属)?行业(?:赛道)?(?:为|是|：|:)?\s*([^\n，。；;、]+)/i)
  const styleMatched = prompt.match(/(?:画面)?风格(?:为|是|：|:)?\s*([^\n，。；;、]+)/i)
  const colorMatched = prompt.match(/(?:主)?色调(?:为|是|：|:)?\s*([^\n，。；;、]+)/i)
  return {
    id,
    industry: cleanValue(industryMatched?.[1], '通用'),
    style: cleanValue(styleMatched?.[1], '默认风格'),
    color: cleanValue(colorMatched?.[1], '多色'),
  }
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}

export async function generateNamingByGemini(items: NamingRequestItem[]): Promise<NamingResponse> {
  if (!items.length) return { items: [] }
  const baseUrl = getBaseUrl()
  const authHeaders = getAuthHeaders()
  if (!baseUrl || !authHeaders) {
    return { items: items.map((i) => fallbackFromPrompt(i.prompt, i.id)) }
  }

  const path = process.env.PLATO_CHAT_COMPLETIONS_PATH || '/v1/chat/completions'
  const model = process.env.PLATO_MODEL_NAMING || 'gemini-3.1-flash-lite-preview'

  const instruction =
    '你是图片命名助手。请从每条提示词中提取行业、风格、颜色。只输出JSON，格式为{"items":[{"id":"...","industry":"...","style":"...","color":"..."}]}。字段必须是简短中文。'

  const payloadItems = items.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    imageUrl: item.imageUrl || '',
  }))

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: instruction },
          {
            role: 'user',
            content: `请提取命名标签：${JSON.stringify({ items: payloadItems })}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('Empty content')

    const parsed = JSON.parse(extractJson(content)) as NamingResponse
    if (!Array.isArray(parsed?.items)) throw new Error('Bad JSON')

    const map = new Map(parsed.items.map((i) => [i.id, i]))
    const normalized = items.map((item) => {
      const hit = map.get(item.id)
      if (!hit) return fallbackFromPrompt(item.prompt, item.id)
      return {
        id: item.id,
        industry: cleanValue(hit.industry, '通用'),
        style: cleanValue(hit.style, '默认风格'),
        color: cleanValue(hit.color, '多色'),
      }
    })
    return { items: normalized }
  } catch {
    return { items: items.map((i) => fallbackFromPrompt(i.prompt, i.id)) }
  }
}
