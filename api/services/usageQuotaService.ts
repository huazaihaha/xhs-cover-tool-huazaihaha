import fs from 'fs/promises'
import path from 'path'
import { resolveAppDataDir } from './dataPath.js'
import { hasUpstashRedis, redisCommand } from './upstashRedis.js'

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

type DailyUsageRecord = {
  userId: string
  day: string
  count: number
  updatedAt: string
}

type UsageFileShape = {
  records: UsageRecord[]
  bonuses?: BonusRecord[]
  dailyRecords?: DailyUsageRecord[]
}

type ConsumeQuotaResult = {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  requested: number
  month: string
}

const dataDir = resolveAppDataDir()
const usageFile = path.resolve(dataDir, 'usage.json')

let loaded = false
let records: UsageRecord[] = []
let bonuses: BonusRecord[] = []
let dailyRecords: DailyUsageRecord[] = []

function currentMonthKey(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function currentDayKey(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
    dailyRecords = Array.isArray(parsed?.dailyRecords) ? parsed.dailyRecords : []
  } catch {
    records = []
    bonuses = []
    dailyRecords = []
    await fs.writeFile(
      usageFile,
      JSON.stringify({ records: [], bonuses: [], dailyRecords: [] }, null, 2),
      'utf-8',
    )
  }
  loaded = true
}

async function saveRecords() {
  await fs.writeFile(
    usageFile,
    JSON.stringify({ records, bonuses, dailyRecords }, null, 2),
    'utf-8',
  )
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

function getOrCreateDailyRecord(userId: string, day: string) {
  let rec = dailyRecords.find((r) => r.userId === userId && r.day === day)
  if (!rec) {
    rec = {
      userId,
      day,
      count: 0,
      updatedAt: new Date().toISOString(),
    }
    dailyRecords.push(rec)
  }
  return rec
}

function usedQuotaKey(userId: string, month: string) {
  return `xhs:quota:used:${userId}:${month}`
}

function bonusQuotaKey(userId: string, month: string) {
  return `xhs:quota:bonus:${userId}:${month}`
}

function totalUsageKey(userId: string) {
  return `xhs:usage:total:${userId}`
}

function dailyUsageKey(userId: string, day: string) {
  return `xhs:usage:daily:${userId}:${day}`
}

export async function getMonthlyQuota(userId: string, now = new Date()): Promise<ConsumeQuotaResult> {
  if (hasUpstashRedis()) {
    const baseLimit = freeMonthlyLimit()
    const month = currentMonthKey(now)
    const usedRaw = await redisCommand<string>('get', [usedQuotaKey(userId, month)])
    const bonusRaw = await redisCommand<string>('get', [bonusQuotaKey(userId, month)])
    const used = Math.max(0, Number(usedRaw || 0))
    const bonus = Math.max(0, Number(bonusRaw || 0))
    const limit = baseLimit + bonus
    return {
      allowed: used < limit,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      requested: 0,
      month,
    }
  }
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
  if (hasUpstashRedis()) {
    const requested = Number.isFinite(requestedCount) ? Math.max(0, Math.floor(requestedCount)) : 0
    const baseLimit = freeMonthlyLimit()
    const month = currentMonthKey(now)
    const usedRaw = await redisCommand<string>('get', [usedQuotaKey(userId, month)])
    const bonusRaw = await redisCommand<string>('get', [bonusQuotaKey(userId, month)])
    const used = Math.max(0, Number(usedRaw || 0))
    const bonus = Math.max(0, Number(bonusRaw || 0))
    const limit = baseLimit + bonus
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
    const nextUsed = await redisCommand<number>('incrby', [usedQuotaKey(userId, month), requested])
    const today = currentDayKey(now)
    await redisCommand<number>('incrby', [totalUsageKey(userId), requested])
    await redisCommand<number>('incrby', [dailyUsageKey(userId, today), requested])
    const usedAfter = Math.max(0, Number(nextUsed || used + requested))
    return {
      allowed: true,
      limit,
      used: usedAfter,
      remaining: Math.max(0, limit - usedAfter),
      requested,
      month,
    }
  }
  await ensureLoaded()
  const requested = Number.isFinite(requestedCount) ? Math.max(0, Math.floor(requestedCount)) : 0
  const baseLimit = freeMonthlyLimit()
  const month = currentMonthKey(now)
  const day = currentDayKey(now)
  const rec = getOrCreateRecord(userId, month)
  const bonusRec = getOrCreateBonusRecord(userId, month)
  const dailyRec = getOrCreateDailyRecord(userId, day)
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
  dailyRec.count += requested
  dailyRec.updatedAt = new Date().toISOString()
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

type AccountUsageStat = {
  userId: string
  totalGenerated: number
  todayGenerated: number
}

export async function getAccountUsageStats(
  userIds: string[],
  now = new Date(),
): Promise<AccountUsageStat[]> {
  const normalizedIds = Array.from(new Set(userIds.map((v) => String(v || '').trim()).filter(Boolean)))
  if (!normalizedIds.length) return []

  if (hasUpstashRedis()) {
    const day = currentDayKey(now)
    const rows = await Promise.all(
      normalizedIds.map(async (userId) => {
        const totalRaw = await redisCommand<string>('get', [totalUsageKey(userId)])
        const todayRaw = await redisCommand<string>('get', [dailyUsageKey(userId, day)])
        return {
          userId,
          totalGenerated: Math.max(0, Number(totalRaw || 0)),
          todayGenerated: Math.max(0, Number(todayRaw || 0)),
        }
      }),
    )
    return rows
  }

  await ensureLoaded()
  const day = currentDayKey(now)
  return normalizedIds.map((userId) => {
    const totalGenerated = records
      .filter((r) => r.userId === userId)
      .reduce((acc, cur) => acc + Math.max(0, cur.count || 0), 0)
    const todayGenerated = dailyRecords
      .filter((r) => r.userId === userId && r.day === day)
      .reduce((acc, cur) => acc + Math.max(0, cur.count || 0), 0)
    return { userId, totalGenerated, todayGenerated }
  })
}

export async function grantMonthlyQuota(
  userId: string,
  grantCount: number,
  now = new Date(),
): Promise<ConsumeQuotaResult> {
  if (hasUpstashRedis()) {
    const amount = Number.isFinite(grantCount) ? Math.max(0, Math.floor(grantCount)) : 0
    if (amount < 1) return getMonthlyQuota(userId, now)
    const month = currentMonthKey(now)
    await redisCommand<number>('incrby', [bonusQuotaKey(userId, month), amount])
    return getMonthlyQuota(userId, now)
  }
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
