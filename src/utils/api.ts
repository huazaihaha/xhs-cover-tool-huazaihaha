import type {
  GenerateRequest,
  GenerateResponse,
  NamingRequest,
  NamingResponse,
} from '../../shared/types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function withApiBase(path: string) {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL}${path}`
}

export async function generateImages(body: GenerateRequest, signal?: AbortSignal) {
  const res = await fetch(withApiBase('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  const json = (await res.json()) as GenerateResponse
  return json
}

export async function checkHealth() {
  const res = await fetch(withApiBase('/api/health'))
  return res.ok
}

export async function generateNaming(body: NamingRequest) {
  const res = await fetch(withApiBase('/api/naming'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as NamingResponse
  return json
}
