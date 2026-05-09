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

type Mode = 'register' | 'login-password' | 'login-code'

export default function AuthPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [mode, setMode] = useState<Mode>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const codePurpose = useMemo(
    () => (mode === 'register' ? 'register' : 'login') as 'register' | 'login',
    [mode],
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-5">
          <div className="text-lg font-semibold">登录 / 注册</div>
          <div className="text-xs text-zinc-400">支持邮箱验证码注册、邮箱密码登录、邮箱验证码登录</div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={cn(
              'rounded-xl px-2 py-2 text-xs transition',
              mode === 'register'
                ? 'bg-emerald-300 text-zinc-950'
                : 'bg-white/5 text-zinc-300 hover:bg-white/10',
            )}
          >
            注册
          </button>
          <button
            type="button"
            onClick={() => setMode('login-password')}
            className={cn(
              'rounded-xl px-2 py-2 text-xs transition',
              mode === 'login-password'
                ? 'bg-emerald-300 text-zinc-950'
                : 'bg-white/5 text-zinc-300 hover:bg-white/10',
            )}
          >
            密码登录
          </button>
          <button
            type="button"
            onClick={() => setMode('login-code')}
            className={cn(
              'rounded-xl px-2 py-2 text-xs transition',
              mode === 'login-code'
                ? 'bg-emerald-300 text-zinc-950'
                : 'bg-white/5 text-zinc-300 hover:bg-white/10',
            )}
          >
            验证码登录
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-300/40"
          />

          {mode !== 'login-password' ? (
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

          {mode !== 'login-code' ? (
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={mode === 'register' ? '设置密码（至少6位）' : '密码'}
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
                  mode === 'register'
                    ? await authRegister({ email, code, password })
                    : mode === 'login-password'
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
            {busy ? '提交中...' : mode === 'register' ? '注册并登录' : '登录'}
          </button>
        </div>

        {msg ? <div className="mt-3 text-xs text-zinc-400">{msg}</div> : null}
      </div>
    </div>
  )
}

