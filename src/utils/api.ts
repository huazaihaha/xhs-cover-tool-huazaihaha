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

type AuthUser = { id: string; email: string }

type AuthResponse = {
  success: boolean
  token?: string
  user?: AuthUser
  error?: string
  debugCode?: string
  delivery?: 'mock' | 'smtp'
}

function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authSendCode(body: { email: string; purpose: 'register' | 'login' }) {
  const res = await fetch(withApiBase('/api/auth/send-code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as AuthResponse
  return { ok: res.ok, ...json }
}

export async function authRegister(body: { email: string; code: string; password: string }) {
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

export async function authLoginWithCode(body: { email: string; code: string }) {
  const res = await fetch(withApiBase('/api/auth/login/code'), {
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
