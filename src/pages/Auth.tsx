import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  authLoginWithPassword,
  authRegister,
} from '@/utils/api'
import { useAuthStore } from '@/store/useAuthStore'

type AuthTab = 'register' | 'login'

export default function AuthPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [tab, setTab] = useState<AuthTab>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const isRegister = tab === 'register'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_10%_10%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(52rem_28rem_at_90%_8%,rgba(16,185,129,0.2),transparent_60%)]" />
      <div className="grid min-h-screen w-full lg:grid-cols-2">
        <div className="flex min-h-screen items-center justify-center bg-zinc-950/78 px-8 py-10">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/85 p-6 shadow-[0_20px_60px_-40px_rgba(255,255,255,0.25)]">
            <div className="mb-6">
              <div className="text-2xl font-semibold text-zinc-50">欢迎回来</div>
              <div className="mt-1 text-sm text-zinc-300">登录您的账号开始创作</div>
            </div>
            <div className="mb-5 flex border-b border-white/15">
              <button
                type="button"
                onClick={() => {
                  setTab('register')
                  setMsg('')
                }}
                className={cn(
                  'flex-1 border-b-2 px-2 py-2.5 text-sm font-semibold transition',
                  tab === 'register'
                    ? 'border-emerald-300 text-emerald-200'
                    : 'border-transparent text-zinc-300 hover:text-zinc-100',
                )}
              >
                注册账号
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                  setMsg('')
                }}
                className={cn(
                  'flex-1 border-b-2 px-2 py-2.5 text-sm font-semibold transition',
                  tab === 'login'
                    ? 'border-emerald-300 text-emerald-200'
                    : 'border-transparent text-zinc-300 hover:text-zinc-100',
                )}
              >
                登录账号
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                className="w-full rounded-xl border border-white/40 bg-zinc-950/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-white/80"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={isRegister ? '设置密码（至少6位）' : '密码'}
                className="w-full rounded-xl border border-white/40 bg-zinc-950/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-white/80"
              />

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setMsg('')
                  try {
                    const resp =
                      isRegister
                        ? await authRegister({ email, password })
                        : await authLoginWithPassword({ email, password })
                    if (!resp.ok || !resp.token || !resp.user) {
                      setMsg(resp.error || '操作失败')
                      return
                    }
                    setAuth(resp.token, resp.user)
                    navigate('/')
                  } finally {
                    setBusy(false)
                  }
                }}
                className={cn(
                  'w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  busy
                    ? 'cursor-not-allowed bg-white/10 text-zinc-500'
                    : 'bg-emerald-300 text-zinc-950 hover:bg-emerald-200',
                )}
              >
                {busy ? '提交中...' : isRegister ? '注册并登录' : '登录'}
              </button>
            </div>

            {msg ? <div className="mt-3 text-xs text-zinc-300">{msg}</div> : null}
          </div>
        </div>

        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500/70 via-emerald-500/60 to-zinc-900 px-8 py-10">
          <div className="absolute -left-10 -top-12 h-56 w-56 rounded-full bg-emerald-300/20" />
          <div className="absolute -bottom-16 right-10 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative max-w-lg text-center">
            <div
              className="text-5xl font-extrabold leading-tight text-white"
              style={{ fontFamily: '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif' }}
            >
              点赞AI -批量生图版
            </div>
            <div className="mt-5 text-lg font-medium leading-relaxed text-zinc-100">
              批量生成小红书卡片、商品图、海报等设计素材
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
