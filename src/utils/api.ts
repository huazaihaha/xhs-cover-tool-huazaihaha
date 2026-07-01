import type {
  GenerateRequest,
  GenerateResponse,
  GenerateResultItem,
  GenerateStreamEvent,
  NamingRequest,
  NamingResponse,
  ArticleSlicerRequest,
  ArticleSlicerResponse,
} from '../../shared/types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function withApiBase(path: string) {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL}${path}`
}

export async function generateImages(
  body: GenerateRequest,
  signal?: AbortSignal,
  token?: string,
  onItem?: (idx: number, item: GenerateResultItem) => void,
) {
  const res = await fetch(withApiBase('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => ({ items: [] }))) as GenerateResponse
    return { ok: res.ok, status: res.status, ...json }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const items: GenerateResultItem[] = []
  let quota: GenerateResponse['quota']
  let errorMessage: string | undefined

  const consumeLine = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as GenerateStreamEvent
    if (event.type === 'quota') {
      quota = event.quota
    } else if (event.type === 'item') {
      items[event.idx] = event.item
      onItem?.(event.idx, event.item)
    } else if (event.type === 'error') {
      errorMessage = event.message
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIdx: number
    while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)
      consumeLine(line)
    }
  }
  if (buffer.trim()) consumeLine(buffer)

  if (errorMessage) {
    return { ok: false, status: res.status, items, message: errorMessage, quota }
  }
  return { ok: true, status: res.status, items, quota }
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

export async function generateArticleSlices(body: ArticleSlicerRequest): Promise<ArticleSlicerResponse> {
  const requestBody = JSON.stringify(body)
  console.log('[Slicer API] Request body:', requestBody)
  
  const res = await fetch(withApiBase('/api/slicer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  })
  
  const json = (await res.json()) as ArticleSlicerResponse
  console.log('[Slicer API] Raw response:', JSON.stringify(json, null, 2))
  
  return json
}

type AuthUser = { id: string; email: string }
type UsageQuota = { limit: number; used: number; remaining: number; month: string }

type AuthResponse = {
  success: boolean
  token?: string
  user?: AuthUser
  error?: string
}

type UsageQuotaResponse = {
  success: boolean
  canGrantQuota?: boolean
  quota?: UsageQuota
  error?: string
}

type GrantUsageQuotaResponse = {
  success: boolean
  message?: string
  quota?: UsageQuota
  target?: { id: string; email: string }
  error?: string
}

type AccountUsageStatsResponse = {
  success: boolean
  items?: Array<{
    userId: string
    account: string
    totalGenerated: number
    todayGenerated: number
  }>
  error?: string
}

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authRegister(body: { email: string; password: string }) {
  const res = await fetch(withApiBase('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as AuthResponse
  return { ok: res.ok, ...json }
}

export async function authLoginWithPassword(body: { email: string; password: string }) {
  const res = await fetch(withApiBase('/api/auth/login/password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as AuthResponse
  return { ok: res.ok, ...json }
}

export async function authMe(token: string) {
  const res = await fetch(withApiBase('/api/auth/me'), {
    headers: {
      ...authHeaders(token),
    },
  })
  const json = (await res.json()) as AuthResponse
  return { ok: res.ok, ...json }
}

export async function authLogout(token: string) {
  const res = await fetch(withApiBase('/api/auth/logout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
  })
  const json = (await res.json()) as AuthResponse
  return { ok: res.ok, ...json }
}

export async function authGetUsageQuota(token: string) {
  const res = await fetch(withApiBase('/api/usage/quota'), {
    headers: {
      ...authHeaders(token),
    },
  })
  const json = (await res.json()) as UsageQuotaResponse
  return { ok: res.ok, status: res.status, ...json }
}

export async function authGrantUsageQuota(
  token: string,
  body: { account: string; grantCount: number },
) {
  const res = await fetch(withApiBase('/api/usage/grant'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as GrantUsageQuotaResponse
  return { ok: res.ok, ...json }
}

export async function authGetAccountUsageStats(token: string) {
  const headers = {
    ...authHeaders(token),
  }
  const paths = ['/api/usage/account-stats', '/api/usage/accountStats', '/api/usage/stats/accounts']
  let lastResponse: { ok: boolean; status: number; json: AccountUsageStatsResponse } | null = null

  for (const path of paths) {
    const res = await fetch(withApiBase(path), { headers })
    const json = (await res.json().catch(() => ({ success: false, error: '请求失败' }))) as AccountUsageStatsResponse
    lastResponse = { ok: res.ok, status: res.status, json }
    // If endpoint exists (even with 401/403), stop fallback attempts.
    if (res.status !== 404) {
      return { ok: res.ok, status: res.status, ...json }
    }
  }

  if (!lastResponse) {
    return { ok: false, status: 500, success: false, error: '请求失败' }
  }
  return {
    ok: lastResponse.ok,
    status: lastResponse.status,
    ...lastResponse.json,
  }
}
