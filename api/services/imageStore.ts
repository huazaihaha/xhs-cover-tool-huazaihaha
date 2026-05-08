import { nanoid } from 'nanoid'

type StoredImage = {
  bytes: Uint8Array
  contentType: string
  expiresAt: number
}

const store = new Map<string, StoredImage>()

const TTL_MS = 30 * 60 * 1000

function cleanup(now: number) {
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) store.delete(key)
  }
}

export function putBase64Image(base64: string, contentType = 'image/png') {
  const now = Date.now()
  cleanup(now)
  const id = nanoid()
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
  store.set(id, { bytes, contentType, expiresAt: now + TTL_MS })
  return id
}

export function getImage(id: string) {
  const now = Date.now()
  cleanup(now)
  const value = store.get(id)
  if (!value) return null
  if (value.expiresAt <= now) {
    store.delete(id)
    return null
  }
  return value
}

