import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

type UsageRecord = {
  userId: string
  month: string
  count: number
  updatedAt: string
}

type BonusRecord = {
  userId: string
  month: string
  bonus: number
  updatedAt: string
}

type UsageFileShape = {
  records: UsageRecord[]
  bonuses?: BonusRecord[]
}

type ConsumeQuotaResult = {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  requested: number
  month: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../data')
const usageFile = path.resolve(dataDir, 'usage.json')

let loaded = false
let records: UsageRecord[] = []
let bonuses: BonusRecord[] = []

function currentMonthKey(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function freeMonthlyLimit() {
  const envLimit = Number(process.env.FREE_MONTHLY_LIMIT || 25)
  return Number.isFinite(envLimit) && envLimit > 0 ? Math.floor(envLimit) : 25
}

async function ensureLoaded() {
  if (loaded) return
  await fs.mkdir(dataDir, { recursive: true })
  try {
    const raw = await fs.readFile(usageFile, 'utf-8')
    const parsed = JSON.parse(raw) as UsageFileShape
    records = Array.isArray(parsed?.records) ? parsed.records : []
    bonuses = Array.isArray(parsed?.bonuses) ? parsed.bonuses : []
  } catch {
    records = []
    bonuses = []
    await fs.writeFile(usageFile, JSON.stringify({ records: [], bonuses: [] }, null, 2), 'utf-8')
  }
  loaded = true
}

async function saveRecords() {
  await fs.writeFile(usageFile, JSON.stringify({ records, bonuses }, null, 2), 'utf-8')
}

function getOrCreateRecord(userId: string, month: string) {
  let rec = records.find((r) => r.userId === userId && r.month === month)
  if (!rec) {
    rec = {
      userId,
      month,
      count: 0,
      updatedAt: new Date().toISOString(),
    }
    records.push(rec)
  }
  return rec
}

function getOrCreateBonusRecord(userId: string, month: string) {
  let rec = bonuses.find((r) => r.userId === userId && r.month === month)
  if (!rec) {
    rec = {
      userId,
      month,
      bonus: 0,
      updatedAt: new Date().toISOString(),
    }
    bonuses.push(rec)
  }
  return rec
}

export async function getMonthlyQuota(userId: string, now = new Date()): Promise<ConsumeQuotaResult> {
  await ensureLoaded()
  const baseLimit = freeMonthlyLimit()
  const month = currentMonthKey(now)
  const rec = records.find((r) => r.userId === userId && r.month === month)
  const bonusRec = bonuses.find((r) => r.userId === userId && r.month === month)
  const bonus = Math.max(0, bonusRec?.bonus || 0)
  const limit = baseLimit + bonus
  const used = rec?.count || 0
  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    requested: 0,
    month,
  }
}

export async function consumeMonthlyQuota(
  userId: string,
  requestedCount: number,
  now = new Date(),
): Promise<ConsumeQuotaResult> {
  await ensureLoaded()
  const requested = Number.isFinite(requestedCount) ? Math.max(0, Math.floor(requestedCount)) : 0
  const baseLimit = freeMonthlyLimit()
  const month = currentMonthKey(now)
  const rec = getOrCreateRecord(userId, month)
  const bonusRec = getOrCreateBonusRecord(userId, month)
  const limit = baseLimit + Math.max(0, bonusRec.bonus)
  const used = rec.count
  const remaining = Math.max(0, limit - used)

  if (requested < 1 || requested > remaining) {
    return {
      allowed: false,
      limit,
      used,
      remaining,
      requested,
      month,
    }
  }

  rec.count += requested
  rec.updatedAt = new Date().toISOString()
  await saveRecords()

  return {
    allowed: true,
    limit,
    used: rec.count,
    remaining: Math.max(0, limit - rec.count),
    requested,
    month,
  }
}

export async function grantMonthlyQuota(
  userId: string,
  grantCount: number,
  now = new Date(),
): Promise<ConsumeQuotaResult> {
  await ensureLoaded()
  const amount = Number.isFinite(grantCount) ? Math.max(0, Math.floor(grantCount)) : 0
  if (amount < 1) {
    return getMonthlyQuota(userId, now)
  }

  const month = currentMonthKey(now)
  const bonusRec = getOrCreateBonusRecord(userId, month)
  bonusRec.bonus += amount
  bonusRec.updatedAt = new Date().toISOString()
  await saveRecords()
  return getMonthlyQuota(userId, now)
}
