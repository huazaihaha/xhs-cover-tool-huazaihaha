type RedisResult<T = unknown> = {
  result?: T
  error?: string
}

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '')
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ''

export function hasUpstashRedis() {
  return !!REDIS_URL && !!REDIS_TOKEN
}

export async function redisCommand<T = unknown>(
  cmd: string,
  args: Array<string | number> = [],
): Promise<T | null> {
  if (!hasUpstashRedis()) return null
  const path = [cmd.toLowerCase(), ...args.map((v) => encodeURIComponent(String(v)))].join('/')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const resp = await fetch(`${REDIS_URL}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
      signal: controller.signal,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`UPSTASH_HTTP_${resp.status}:${text.slice(0, 120)}`)
    }
    const json = (await resp.json()) as RedisResult<T>
    if (json.error) throw new Error(`UPSTASH_ERROR:${json.error}`)
    return (json.result ?? null) as T | null
  } finally {
    clearTimeout(timer)
  }
}

