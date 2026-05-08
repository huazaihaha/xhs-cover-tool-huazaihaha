import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import type { GenerateRequest, GenerateResponse, ModelName } from '../../shared/types.js'
import { platoGenerateMany } from '../services/plato.js'
import { putBase64Image } from '../services/imageStore.js'

const router = Router()

function modelToProvider(model: ModelName) {
  if (model === 'image2') return process.env.PLATO_MODEL_IMAGE2 || 'gpt-image-2'
  return process.env.PLATO_MODEL_IMAGE2 || 'gpt-image-2'
}

router.post(
  '/',
  async (req: Request, res: Response<GenerateResponse>): Promise<void> => {
    const body = req.body as GenerateRequest
    const prompts = Array.isArray(body?.prompts) ? body.prompts : []
    const referenceImages = Array.isArray(body?.referenceImages)
      ? body.referenceImages
          .filter((i): i is string => typeof i === 'string')
          .map((i) => i.trim())
          .filter(Boolean)
          .slice(0, 4)
      : []
    const model = body?.model

    if (!model || model !== 'image2') {
      res.status(400).json({ items: [] })
      return
    }
    if (prompts.length < 1 || prompts.length > 10) {
      res.status(400).json({ items: [] })
      return
    }

    const normalizedPrompts = prompts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .slice(0, 10)

    if (normalizedPrompts.length < 1) {
      res.status(400).json({ items: [] })
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

    try {
      const outputs = await platoGenerateMany(
        normalizedPrompts.map((prompt) => ({
          prompt,
          model: providerModel,
          size: body.size,
          quality: body.quality,
          images: referenceImages.length ? referenceImages : undefined,
        })),
        10,
      )

      const items = initialItems.map((item, idx) => {
        const out = outputs[idx]
        if (out?.url) {
          return { ...item, status: 'succeeded' as const, imageUrl: out.url }
        }
        if (out?.b64_json) {
          const imageId = putBase64Image(out.b64_json)
          return {
            ...item,
            status: 'succeeded' as const,
            imageUrl: `/api/image/b64/${imageId}`,
          }
        }
        return {
          ...item,
          status: 'failed' as const,
          errorMessage: 'Empty response',
        }
      })

      res.status(200).json({ items })
    } catch (e) {
      const message = 'Generation failed'
      const items = initialItems.map((item) => ({
        ...item,
        status: 'failed' as const,
        errorMessage: message,
      }))
      res.status(200).json({ items })
    }
  },
)

export default router
