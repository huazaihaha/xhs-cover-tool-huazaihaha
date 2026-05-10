import { Router, type Request, type Response } from 'express'
import { getImage } from '../services/imageStore.js'

const router = Router()

function isPrivateIp(host: string) {
  const v4 =
    /^(?<a>\d{1,3})\.(?<b>\d{1,3})\.(?<c>\d{1,3})\.(?<d>\d{1,3})$/.exec(host)
  if (v4?.groups) {
    const a = Number(v4.groups.a)
    const b = Number(v4.groups.b)
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  if (host === 'localhost') return true
  if (host === '::1') return true
  return false
}

function parseRemoteUrl(input: string) {
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname) return null
    if (isPrivateIp(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

router.get('/b64/:id', (req: Request, res: Response) => {
  const id = req.params.id
  const value = getImage(id)
  if (!value) {
    res.status(404).end()
    return
  }

  res.setHeader('Content-Type', value.contentType)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(Buffer.from(value.bytes))
})

router.get('/', async (req: Request, res: Response) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : ''
  const url = parseRemoteUrl(raw)
  if (!url) {
    res.status(400).json({ success: false, error: 'Invalid url' })
    return
  }

  try {
    const fetchOnce = async (acceptEncoding?: string) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      try {
        const upstream = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'image/*,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (compatible; CoverToolImageProxy/1.0)',
            ...(acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {}),
          },
          signal: controller.signal,
        })
        if (!upstream.ok || !upstream.body) {
          throw new Error('UPSTREAM_BAD_RESPONSE')
        }
        const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
        const arr = await upstream.arrayBuffer()
        if (!arr.byteLength) {
          throw new Error('EMPTY_IMAGE')
        }
        return { contentType, buffer: Buffer.from(arr) }
      } finally {
        clearTimeout(timeout)
      }
    }

    let result: { contentType: string; buffer: Buffer }
    try {
      // First try default encoding.
      result = await fetchOnce()
    } catch {
      // Retry once with identity encoding to avoid some upstream stalls.
      result = await fetchOnce('identity')
    }

    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(result.buffer)
  } catch {
    res.status(502).json({ success: false, error: 'Upstream error' })
  }
})

export default router
