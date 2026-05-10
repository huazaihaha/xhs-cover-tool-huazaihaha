import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { resolveAppDataDir } from './dataPath.js'

type VerifyPurpose = 'register' | 'login'

type UserRecord = {
  id: string
  email: string
  passwordHash: string
  passwordSalt: string
  createdAt: string
}

type SessionRecord = {
  token: string
  userId: string
  expiresAt: number
}

type VerifyCodeRecord = {
  email: string
  purpose: VerifyPurpose
  code: string
  expiresAt: number
}

type UserFileShape = {
  users: UserRecord[]
}

const dataDir = resolveAppDataDir()
const usersFile = path.resolve(dataDir, 'users.json')

const sessions = new Map<string, SessionRecord>()
const verifyCodes = new Map<string, VerifyCodeRecord>()

let usersLoaded = false
let users: UserRecord[] = []

function nowMs() {
  return Date.now()
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function emailKey(email: string, purpose: VerifyPurpose) {
  return `${normalizeEmail(email)}:${purpose}`
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

async function ensureUsersLoaded() {
  if (usersLoaded) return
  await fs.mkdir(dataDir, { recursive: true })
  try {
    const raw = await fs.readFile(usersFile, 'utf-8')
    const parsed = JSON.parse(raw) as UserFileShape
    users = Array.isArray(parsed?.users) ? parsed.users : []
  } catch {
    users = []
    await fs.writeFile(usersFile, JSON.stringify({ users: [] }, null, 2), 'utf-8')
  }
  usersLoaded = true
}

async function saveUsers() {
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), 'utf-8')
}

function randomCode() {
  return String(crypto.randomInt(100000, 999999))
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex')
}

function cleanupExpired() {
  const t = nowMs()
  for (const [key, value] of verifyCodes.entries()) {
    if (value.expiresAt <= t) verifyCodes.delete(key)
  }
  for (const [token, value] of sessions.entries()) {
    if (value.expiresAt <= t) sessions.delete(token)
  }
}

export async function createVerifyCode(email: string, purpose: VerifyPurpose) {
  await ensureUsersLoaded()
  cleanupExpired()
  const code = randomCode()
  const expiresAt = nowMs() + 10 * 60 * 1000
  verifyCodes.set(emailKey(email, purpose), {
    email: normalizeEmail(email),
    purpose,
    code,
    expiresAt,
  })
  return { code, expiresAt }
}

export async function verifyCode(email: string, purpose: VerifyPurpose, code: string) {
  await ensureUsersLoaded()
  cleanupExpired()
  const rec = verifyCodes.get(emailKey(email, purpose))
  if (!rec) return false
  if (rec.code !== code.trim()) return false
  verifyCodes.delete(emailKey(email, purpose))
  return true
}

export async function findUserByEmail(email: string) {
  await ensureUsersLoaded()
  return users.find((u) => u.email === normalizeEmail(email)) || null
}

export async function registerUser(email: string, password: string) {
  await ensureUsersLoaded()
  const normalized = normalizeEmail(email)
  if (users.some((u) => u.email === normalized)) return null
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: normalized,
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  await saveUsers()
  return user
}

export function verifyPassword(user: UserRecord, password: string) {
  const inputHash = hashPassword(password, user.passwordSalt)
  const a = Buffer.from(user.passwordHash, 'hex')
  const b = Buffer.from(inputHash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function createSession(userId: string) {
  cleanupExpired()
  const token = randomToken()
  const expiresAt = nowMs() + 7 * 24 * 60 * 60 * 1000
  sessions.set(token, { token, userId, expiresAt })
  return { token, expiresAt }
}

export async function getUserByToken(token: string) {
  await ensureUsersLoaded()
  cleanupExpired()
  const rec = sessions.get(token)
  if (!rec) return null
  return users.find((u) => u.id === rec.userId) || null
}

export function revokeSession(token: string) {
  sessions.delete(token)
}

export async function sendCodeEmail(email: string, code: string) {
  const from = process.env.AUTH_EMAIL_FROM
  const resendApiKey = process.env.AUTH_RESEND_API_KEY
  const resendBaseUrl = process.env.AUTH_RESEND_BASE_URL || 'https://api.resend.com'
  const resendTimeout = Number(process.env.AUTH_RESEND_TIMEOUT_MS || 10000)
  const smtpHost = process.env.AUTH_SMTP_HOST
  const smtpPort = Number(process.env.AUTH_SMTP_PORT || 0)
  const smtpUser = process.env.AUTH_SMTP_USER
  const smtpPass = process.env.AUTH_SMTP_PASS
  const connectTimeout = Number(process.env.AUTH_SMTP_CONNECT_TIMEOUT_MS || 10000)
  const greetingTimeout = Number(process.env.AUTH_SMTP_GREETING_TIMEOUT_MS || 10000)
  const socketTimeout = Number(process.env.AUTH_SMTP_SOCKET_TIMEOUT_MS || 15000)
  if (from && resendApiKey) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), resendTimeout)
    try {
      const resp = await fetch(`${resendBaseUrl.replace(/\/+$/, '')}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: '登录验证码',
          text: `你的验证码是：${code}，10分钟内有效。`,
        }),
        signal: controller.signal,
      })
      const raw = await resp.text()
      if (!resp.ok) {
        console.error(
          `[Auth Resend] failed to=${email} status=${resp.status} body=${raw.slice(0, 300)}`,
        )
      } else {
        console.log(
          `[Auth Resend] sent to=${email} status=${resp.status} body=${raw.slice(0, 300)}`,
        )
        return { delivery: 'resend' as const }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Auth Resend] failed to=${email} error=${msg}`)
    } finally {
      clearTimeout(timer)
    }
  }

  if (!from || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.log(`[Auth Mock Email] to=${email} code=${code}`)
    return { delivery: 'mock' as const }
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: connectTimeout,
    greetingTimeout,
    socketTimeout,
  })

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: '登录验证码',
      text: `你的验证码是：${code}，10分钟内有效。`,
    })
    console.log(
      `[Auth SMTP] sent to=${email} host=${smtpHost} port=${smtpPort} secure=${smtpPort === 465} messageId=${info.messageId || 'n/a'}`,
    )
    return { delivery: 'smtp' as const }
  } catch (err) {
    const e = err as {
      code?: string
      message?: string
      command?: string
      responseCode?: number
      response?: string
      errno?: string
      syscall?: string
      address?: string
      port?: number
    }
    console.error(
      `[Auth SMTP] failed to=${email} host=${smtpHost} port=${smtpPort} secure=${smtpPort === 465} code=${e.code || 'n/a'} responseCode=${e.responseCode || 'n/a'} command=${e.command || 'n/a'} errno=${e.errno || 'n/a'} syscall=${e.syscall || 'n/a'} message=${e.message || 'unknown'}`,
    )
    throw err
  }
}
