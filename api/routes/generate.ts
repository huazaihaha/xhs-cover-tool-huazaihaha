import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import type { GenerateRequest, GenerateResultItem, GenerateStreamEvent, ModelName } from '../../shared/types.js'
import { platoGenerateMany } from '../services/plato.js'
import { putBase64Image } from '../services/imageStore.js'
import { consumeMonthlyQuota, getMonthlyQuota } from '../services/usageQuotaService.js'
import { getUserByToken } from '../services/authService.js'

const router = Router()

function readBearerToken(req: Request) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7).trim()
}

function modelToProvider(model: ModelName) {
  if (model === 'image2') return process.env.PLATO_MODEL_IMAGE2 || 'gpt-image-2'
  return process.env.PLATO_MODEL_IMAGE2 || 'gpt-image-2'
}

router.post(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    const token = readBearerToken(req)
    const user = token ? await getUserByToken(token) : null
    if (!user) {
      res.status(401).json({
        items: [],
        errorCode: 'AUTH_REQUIRED',
        message: '请先登录后再生成',
      })
      return
    }

    const body = req.body as GenerateRequest
    const prompts = Array.isArray(body?.prompts) ? body.prompts : []
    const sanitizeImages = (list: unknown): string[] =>
      Array.isArray(list)
        ? list
            .filter((i): i is string => typeof i === 'string')
            .map((i) => i.trim())
            .filter(Boolean)
            .slice(0, 4)
        : []
    const referenceImages = sanitizeImages(body?.referenceImages)
    const rawPromptReferenceImages = Array.isArray(body?.promptReferenceImages)
      ? body.promptReferenceImages
      : []
    const model = body?.model

    if (!model || model !== 'image2') {
      res.status(400).json({ items: [] })
      return
    }
    if (prompts.length < 1) {
      res.status(400).json({ items: [] })
      return
    }

    const combined = prompts
      .map((p, idx) => ({
        prompt: typeof p === 'string' ? p.trim() : '',
        images: sanitizeImages(rawPromptReferenceImages[idx]),
      }))
      .filter((item) => item.prompt)

    if (combined.length < 1) {
      res.status(400).json({ items: [] })
      return
    }

    const normalizedPrompts = combined.map((item) => item.prompt)

    const quotaResult = await consumeMonthlyQuota(user.id, normalizedPrompts.length)
    if (!quotaResult.allowed) {
      const quotaSnapshot = await getMonthlyQuota(user.id)
      const wechat = process.env.SALES_WECHAT || '请联系微信咨询套餐'
      res.status(429).json({
        items: [],
        errorCode: 'FREE_QUOTA_EXCEEDED',
        message: `本月免费额度已用完（${quotaSnapshot.used}/${quotaSnapshot.limit}）。如需继续使用，请联系微信：${wechat}`,
        quota: {
          limit: quotaSnapshot.limit,
          used: quotaSnapshot.used,
          remaining: quotaSnapshot.remaining,
          month: quotaSnapshot.month,
        },
      })
      return
    }

    const createdAt = new Date().toISOString()
    const providerModel = modelToProvider(model)

    const initialItems = normalizedPrompts.map((prompt) => ({
      id: nanoid(),
      prompt,
      model,
      status: 'running' as const,
      createdAt,
    }))

    res.status(200)
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')

    const writeEvent = (event: GenerateStreamEvent) => {
      res.write(`${JSON.stringify(event)}\n`)
    }

    writeEvent({
      type: 'quota',
      quota: {
        limit: quotaResult.limit,
        used: quotaResult.used,
        remaining: quotaResult.remaining,
        month: quotaResult.month,
      },
    })

    try {
      await platoGenerateMany(
        combined.map((item) => ({
          prompt: item.prompt,
          model: providerModel,
          size: body.size,
          quality: body.quality,
          images: item.images.length
            ? item.images
            : referenceImages.length
              ? referenceImages
              : undefined,
        })),
        10,
        (idx, settled) => {
          const base = initialItems[idx]
          let item: GenerateResultItem
          if (settled.output?.url) {
            item = { ...base, status: 'succeeded', imageUrl: settled.output.url }
          } else if (settled.output?.b64_json) {
            const imageId = putBase64Image(settled.output.b64_json)
            item = { ...base, status: 'succeeded', imageUrl: `/api/image/b64/${imageId}` }
          } else {
            item = { ...base, status: 'failed', errorMessage: settled.errorMessage || 'Empty response' }
          }
          writeEvent({ type: 'item', idx, item })
        },
      )
    } catch (err) {
      console.error('[generate] platoGenerateMany failed:', err)
      writeEvent({ type: 'error', message: 'Generation failed' })
    } finally {
      writeEvent({ type: 'done' })
      res.end()
    }
  },
)

export default router
