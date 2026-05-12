import { Router, type Request, type Response } from 'express'
import {
  createSession,
  findUserByEmail,
  getUserByToken,
  registerUser,
  revokeSession,
  verifyPassword,
} from '../services/authService.js'

const router = Router()

function readBearerToken(req: Request) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7).trim()
}

function readClientIp(req: Request) {
  const xForwardedFor = String(req.headers['x-forwarded-for'] || '').trim()
  const fromHeader = xForwardedFor ? xForwardedFor.split(',')[0].trim() : ''
  const raw = fromHeader || req.ip || req.socket.remoteAddress || ''
  if (!raw) return ''
  if (raw === '::1') return '127.0.0.1'
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailValid || password.length < 6) {
    res.status(400).json({ success: false, error: '邮箱格式不正确或密码过短' })
    return
  }

  const clientIp = readClientIp(req)
  const result = await registerUser(email, password, clientIp)
  if (!result.ok) {
    if ('reason' in result && result.reason === 'IP_LIMITED') {
      res.status(429).json({ success: false, error: '同一IP仅允许注册一个账号' })
      return
    }
    res.status(400).json({ success: false, error: '邮箱已注册' })
    return
  }

  const session = createSession(result.user.id)
  res.status(200).json({
    success: true,
    token: session.token,
    user: { id: result.user.id, email: result.user.email },
  })
})

router.post('/login/password', async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) {
    res.status(400).json({ success: false, error: '参数不完整' })
    return
  }

  const user = await findUserByEmail(email)
  if (!user || !verifyPassword(user, password)) {
    res.status(400).json({ success: false, error: '邮箱或密码错误' })
    return
  }

  const session = createSession(user.id)
  res.status(200).json({
    success: true,
    token: session.token,
    user: { id: user.id, email: user.email },
  })
})

router.get('/me', async (req: Request, res: Response): Promise<void> => {
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
  res.status(200).json({
    success: true,
    user: { id: user.id, email: user.email },
  })
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = readBearerToken(req)
  if (token) revokeSession(token)
  res.status(200).json({ success: true })
})

export default router
