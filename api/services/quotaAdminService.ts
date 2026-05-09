function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function readWhitelistFromEnv() {
  const raw = process.env.QUOTA_ADMIN_WHITELIST || process.env.QUOTA_ADMIN_EMAILS || ''
  if (!raw.trim()) return new Set<string>()
  const emails = raw
    .split(',')
    .map((s) => normalizeEmail(s))
    .filter(Boolean)
  return new Set(emails)
}

export function isQuotaAdmin(email: string) {
  if (!email) return false
  const whitelist = readWhitelistFromEnv()
  return whitelist.has(normalizeEmail(email))
}

