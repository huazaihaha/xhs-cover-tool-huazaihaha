import { Router, type Request, type Response } from 'express'
import type { ArticleSlicerRequest, ArticleSlicerResponse } from '../../shared/types.js'
import { generateArticleSlices } from '../services/articleSlicer.js'

const router = Router()

router.post(
  '/',
  async (req: Request, res: Response<ArticleSlicerResponse>): Promise<void> => {
    const body = req.body as ArticleSlicerRequest
    
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const template = typeof body?.template === 'string' ? body.template.trim() : ''
    const count = typeof body?.count === 'number' ? Math.min(Math.max(body.count, 1), 20) : 10
    
    if (!content) {
      res.status(400).json({
        success: false,
        slices: [],
        error: '文章内容不能为空',
      })
      return
    }
    
    if (!template) {
      res.status(400).json({
        success: false,
        slices: [],
        error: '切片提示词模板不能为空',
      })
      return
    }
    
    try {
      const result = await generateArticleSlices({
        content,
        template,
        count,
      })
      
      res.status(200).json(result)
    } catch (error) {
      console.error('Article slicer route error:', error)
      res.status(500).json({
        success: false,
        slices: [],
        error: '生成切片提示词失败',
      })
    }
  },
)

export default router
