import { Router, type Request, type Response } from 'express'
import type { NamingRequest, NamingResponse } from '../../shared/types.js'
import { generateNamingByGemini } from '../services/platoNaming.js'

const router = Router()

router.post('/', async (req: Request, res: Response<NamingResponse>) => {
  const body = req.body as NamingRequest
  const items = Array.isArray(body?.items)
    ? body.items
        .filter((i) => i && typeof i.id === 'string' && typeof i.prompt === 'string')
        .map((i) => ({
          id: i.id.trim(),
          prompt: i.prompt.trim(),
          imageUrl: typeof i.imageUrl === 'string' ? i.imageUrl.trim() : undefined,
        }))
        .filter((i) => i.id && i.prompt)
        .slice(0, 30)
    : []

  if (!items.length) {
    res.status(200).json({ items: [] })
    return
  }

  const output = await generateNamingByGemini(items)
  res.status(200).json(output)
})

export default router
