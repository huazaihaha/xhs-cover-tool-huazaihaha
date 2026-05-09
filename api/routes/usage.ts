import { Router, type Request, type Response } from 'express'
import { findUserByEmail, getUserByToken } from '../services/authService.js'
import { getMonthlyQuota, grantMonthlyQuota } from '../services/usageQuotaService.js'
import { isQuotaAdmin } from '../services/quotaAdminService.js'

const router = Router()

function readBearerToken(req: Request) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7).trim()
}

router.get('/quota', async (req: Request, res: Response): Promise<void> => {
  const token = readBearerToken(req)
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ success: false, error: '登录已失效' })
    return
  }
  const quota = await getMonthlyQuota(user.id)
  const canGrantQuota = isQuotaAdmin(user.email)
  res.status(200).json({
    success: true,
    canGrantQuota,
    quota: {
      limit: quota.limit,
      used: quota.used,
      remaining: quota.remaining,
      month: quota.month,
    },
  })
})

router.post('/grant', async (req: Request, res: Response): Promise<void> => {
  const token = readBearerToken(req)
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ success: false, error: '登录已失效' })
    return
  }
  if (!isQuotaAdmin(user.email)) {
    res.status(403).json({ success: false, error: '无权限操作' })
    return
  }

  const account = String(req.body?.account || '').trim().toLowerCase()
  const grantCount = Number(req.body?.grantCount)
  const amount = Number.isFinite(grantCount) ? Math.floor(grantCount) : 0
  if (!account || amount < 1) {
    res.status(400).json({ success: false, error: '请输入有效账号和下发额度' })
    return
  }

  const targetUser = await findUserByEmail(account)
  if (!targetUser) {
    res.status(404).json({ success: false, error: '目标账号不存在' })
    return
  }

  const quota = await grantMonthlyQuota(targetUser.id, amount)
  res.status(200).json({
    success: true,
    message: `已向 ${targetUser.email} 下发 ${amount} 次额度`,
    target: {
      id: targetUser.id,
      email: targetUser.email,
    },
    quota: {
      limit: quota.limit,
      used: quota.used,
      remaining: quota.remaining,
      month: quota.month,
    },
  })
})

export default router
