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

export async function generateImages(body: GenerateRequest, signal?: AbortSignal, token?: string) {
  const res = await fetch(withApiBase('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
    signal,
  })

  const json = (await res.json().catch(() => ({ items: [] }))) as GenerateResponse
  return {
    ok: res.ok,
    status: res.status,
    ...json,
  }
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
  return { ok: res.ok, ...json }
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
