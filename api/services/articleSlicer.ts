import type { ArticleSlicerRequest, ArticleSlicerResponse, SlicePrompt } from '../../shared/types.js'
import { nanoid } from 'nanoid'

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

function extractJson(text: string): string {
  console.log('[ArticleSlicer] extractJson input:', JSON.stringify(text))
  
  // First try to find fenced code blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    console.log('[ArticleSlicer] Found fenced block')
    return fenced[1].trim()
  }
  
  // Try to find JSON array directly
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  console.log('[ArticleSlicer] JSON array search - start:', start, 'end:', end)
  
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1)
    try {
      JSON.parse(candidate)
      console.log('[ArticleSlicer] Valid JSON array found')
      return candidate
    } catch {
      // Not valid JSON, continue
      console.log('[ArticleSlicer] Not valid JSON array')
    }
  }
  
  // If the entire text is a JSON string (model returned "[\"...\"]"), unwrap it
  try {
    const parsed = JSON.parse(text.trim())
    console.log('[ArticleSlicer] Parsed outer JSON, type:', typeof parsed, 'isArray:', Array.isArray(parsed))
    if (Array.isArray(parsed)) return JSON.stringify(parsed)
    if (typeof parsed === 'string') {
      console.log('[ArticleSlicer] Parsed is string, trying to parse inner:', parsed)
      // The model returned a JSON-encoded string, try to parse it again
      try {
        const inner = JSON.parse(parsed)
        console.log('[ArticleSlicer] Inner parse, isArray:', Array.isArray(inner))
        if (Array.isArray(inner)) return JSON.stringify(inner)
      } catch {
        console.log('[ArticleSlicer] Inner parse failed')
      }
      // Just return the unwrapped string
      return parsed
    }
  } catch (e) {
    console.log('[ArticleSlicer] Outer JSON parse failed:', e)
  }
  
  console.log('[ArticleSlicer] Returning raw text')
  return text.trim()
}

function parseSlicesFromText(text: string): string[] {
  // Attempt to parse JSON first in case the model decides to use it
  try {
    const extracted = extractJson(text)
    const parsed = JSON.parse(extracted)
    if (Array.isArray(parsed)) {
      const arr = parsed
        .map((item) => {
          if (typeof item === 'string') return item.trim()
          if (typeof item === 'object' && item !== null) {
            return (item.prompt || item.content || item.text || item.title || '').toString().trim()
          }
          return ''
        })
        .filter(Boolean)
      if (arr.length > 0) return arr
    }
  } catch {
    // Ignore and fallback to text parsing
  }
  
  // Fallback: parse as line/paragraph-separated text
  let cleanText = text.replace(/```[a-z]*\n/gi, '').replace(/```/g, '')
  
  const blocks = cleanText.split(/\n/)
  
  const slices: string[] = []
  let currentSlice = ''

  for (const block of blocks) {
    let line = block.trim()
    if (!line) {
      if (currentSlice.length > 10) {
        slices.push(currentSlice)
        currentSlice = ''
      }
      continue
    }

    // Check if this line looks like a new list item (even without blank lines between them)
    const isNewItem = /^(\d+[\.\)\]]|\-|\*|【?图\d+】?|【?提示词\d+】?|【?配图\d+】?|【?画面\d+】?)\s*/i.test(line)
    if (isNewItem && currentSlice.length > 10) {
      slices.push(currentSlice)
      currentSlice = ''
    }

    // Remove leading numbers, bullets (e.g. "1. ", "2) ", "- ")
    line = line.replace(/^(\d+[\.\)\]]|\-|\*)\s*/, '').trim()
    
    // Filter out obvious conversational filler or short meta-lines
    if (
      line.length > 0 &&
      !line.includes('以下是') &&
      !line.includes('为您生成') &&
      !line.startsWith('***')
    ) {
      // Clean up common prefix like "提示词1：" or "图1：" or "【配图1】"
      line = line.replace(/^(【)?(提示词|配图|图|画面)\s*\d+[】:：]\s*/i, '')
      
      if (currentSlice) {
        currentSlice += ' ' + line
      } else {
        currentSlice = line
      }
    }
  }

  if (currentSlice.length > 10) {
    slices.push(currentSlice)
  }
  
  return slices
}

export async function generateArticleSlices(request: ArticleSlicerRequest): Promise<ArticleSlicerResponse> {
  const { content, template, count = 10 } = request
  
  if (!content || content.trim().length < 50) {
    return {
      success: false,
      slices: [],
      error: '文章内容太短，至少需要50个字符',
    }
  }
  
  if (!template || template.trim().length < 10) {
    return {
      success: false,
      slices: [],
      error: '切片提示词模板太短，至少需要10个字符',
    }
  }
  
  const baseUrl = getBaseUrl()
  const authHeaders = getAuthHeaders()
  
  if (!baseUrl || !authHeaders) {
    const fallbackSlices = generateFallbackSlices(content, count)
    return {
      success: true,
      slices: fallbackSlices,
    }
  }
  
  const path = process.env.PLATO_CHAT_COMPLETIONS_PATH || '/v1/chat/completions'
  const model = process.env.PLATO_MODEL_SLICER || 'gemini-3-pro-preview'
  
  // Directly use the user's highly detailed template as the system instruction
  const instruction = template

  // Direct call to LLM, enforcing no JSON but structured plain text
  const requestBody = {
    model,
    temperature: 0.7,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: instruction },
      { role: 'user', content: content },
    ],
  }
  
  console.log('[ArticleSlicer] === LLM REQUEST ===')
  console.log('URL:', `${baseUrl}${path}`)
  console.log('Body:', JSON.stringify(requestBody, null, 2))
  
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    
    const data = await res.json()
    const contentText = data?.choices?.[0]?.message?.content
    
    console.log('[ArticleSlicer] === LLM RESPONSE ===')
    console.log('Full response:', JSON.stringify(data, null, 2))
    console.log('contentText type:', typeof contentText)
    console.log('contentText length:', contentText?.length)
    console.log('contentText:', JSON.stringify(contentText))
    
    if (typeof contentText !== 'string' || !contentText.trim()) {
      throw new Error('模型返回内容为空')
    }
    
    const sliceTexts = parseSlicesFromText(contentText)
    
    console.log('[ArticleSlicer] Parsed slices:', sliceTexts)
    console.log('[ArticleSlicer] Slice count:', sliceTexts.length, '(requested:', count, ')')
    
    if (sliceTexts.length === 0) {
      const fallbackSlices = generateFallbackSlices(content, count)
      return {
        success: true,
        slices: fallbackSlices,
      }
    }
    
    const slices: SlicePrompt[] = sliceTexts.slice(0, count).map((text, idx) => ({
      id: nanoid(),
      content: text,
      index: idx + 1,
    }))
    
    return {
      success: true,
      slices,
    }
  } catch (error) {
    console.error('Article slicer error:', error)
    const fallbackSlices = generateFallbackSlices(content, count)
    return {
      success: true,
      slices: fallbackSlices,
    }
  }
}

function generateFallbackSlices(content: string, count: number): SlicePrompt[] {
  // Extract actual manuscript content to avoid slicing the prompt parameters
  let actualContent = content
  const marker = '【参考稿件】：'
  const markerIdx = content.indexOf(marker)
  if (markerIdx >= 0) {
    actualContent = content.substring(markerIdx + marker.length)
  }

  const paragraphs = actualContent
    .split(/[。！？\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10 && p.length < 200)
  
  if (paragraphs.length === 0) {
    const sentences = content.split(/(?<=[，。、])/).filter((s) => s.trim().length > 5)
    return sentences.slice(0, count).map((sentence, idx) => ({
      id: nanoid(),
      content: `小红书封面风格，${sentence.trim()}`,
      index: idx + 1,
    }))
  }
  
  const selectedParagraphs = paragraphs.slice(0, Math.min(count, paragraphs.length))
  
  return selectedParagraphs.map((paragraph, idx) => ({
    id: nanoid(),
    content: `小红书封面风格，${paragraph.trim()}`,
    index: idx + 1,
  }))
}
