import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  authLoginWithCode,
  authLoginWithPassword,
  authRegister,
  authSendCode,
} from '@/utils/api'
import { useAuthStore } from '@/store/useAuthStore'

type AuthTab = 'register' | 'login'
type LoginMode = 'password' | 'code'

export default function AuthPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [tab, setTab] = useState<AuthTab>('register')
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const codePurpose = useMemo(
    () => (tab === 'register' ? 'register' : 'login') as 'register' | 'login',
    [tab],
  )
  const isRegister = tab === 'register'
  const isLoginByCode = tab === 'login' && loginMode === 'code'

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <div className="text-2xl font-semibold">账号中心</div>
          <div className="mt-1 text-sm text-zinc-400">通过 Tab 切换注册与登录，支持邮箱验证码和密码两种方式</div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          <button
            type="button"
            onClick={() => {
              setTab('register')
              setMsg('')
            }}
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-medium transition',
              tab === 'register'
                ? 'bg-emerald-300 text-zinc-950'
                : 'bg-transparent text-zinc-300 hover:bg-white/10',
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
              'rounded-xl px-3 py-2 text-sm font-medium transition',
              tab === 'login'
                ? 'bg-emerald-300 text-zinc-950'
                : 'bg-transparent text-zinc-300 hover:bg-white/10',
            )}
          >
            登录账号
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          {tab === 'login' ? (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('password')
                  setMsg('')
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs transition',
                  loginMode === 'password'
                    ? 'bg-white/15 text-zinc-100'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10',
                )}
              >
                密码登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('code')
                  setMsg('')
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs transition',
                  loginMode === 'code'
                    ? 'bg-white/15 text-zinc-100'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10',
                )}
              >
                验证码登录
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-300/40"
          />

          {(isRegister || isLoginByCode) ? (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="邮箱验证码"
                className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-300/40"
              />
              <button
                type="button"
                disabled={sending}
                onClick={async () => {
                  setSending(true)
                  setMsg('')
                  try {
                    const resp = await authSendCode({ email, purpose: codePurpose })
                    if (!resp.ok) {
                      setMsg(resp.error || '发送失败')
                    } else if (resp.debugCode) {
                      setMsg(`验证码已发送（开发模式验证码：${resp.debugCode}）`)
                    } else {
                      setMsg('验证码已发送，请查看邮箱')
                    }
                  } finally {
                    setSending(false)
                  }
                }}
                className={cn(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-xs transition',
                  sending
                    ? 'cursor-not-allowed bg-white/5 text-zinc-600'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/15',
                )}
              >
                {sending ? '发送中' : '发送验证码'}
              </button>
            </div>
          ) : null}

          {(isRegister || !isLoginByCode) ? (
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={isRegister ? '设置密码（至少6位）' : '密码'}
              className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-300/40"
            />
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setMsg('')
              try {
                const resp =
                  isRegister
                    ? await authRegister({ email, code, password })
                    : loginMode === 'password'
                      ? await authLoginWithPassword({ email, password })
                      : await authLoginWithCode({ email, code })
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
              'w-full rounded-xl px-3 py-2 text-sm font-semibold transition',
              busy
                ? 'cursor-not-allowed bg-white/10 text-zinc-500'
                : 'bg-emerald-300 text-zinc-950 hover:bg-emerald-200',
            )}
          >
            {busy ? '提交中...' : isRegister ? '注册并登录' : '登录'}
          </button>
        </div>

        {msg ? <div className="mt-3 text-xs text-zinc-400">{msg}</div> : null}
        </div>
      </div>
    </div>
  )
}
