import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Layers3, LogOut, Settings2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { authGetUsageQuota, authLogout } from '@/utils/api'

const items = [
  { to: '/', label: '工作台', icon: Sparkles },
  { to: '/library', label: '图库', icon: Layers3 },
  { to: '/settings', label: '设置', icon: Settings2 },
]

export default function TopNav() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const quota = useAuthStore((s) => s.quota)
  const setQuota = useAuthStore((s) => s.setQuota)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setQuota(null)
      return
    }
    void authGetUsageQuota(token)
      .then((resp) => {
        if (cancelled) return
        if (resp.ok && resp.quota) {
          setQuota(resp.quota)
          return
        }
        if (resp.status === 401) clearAuth()
      })
      .catch(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
    }
  }, [token, setQuota, clearAuth])

  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      <div className="flex w-full items-center justify-between px-6 py-4">
        <div>
          <div
            className="text-3xl font-extrabold leading-none tracking-[0.04em] text-white"
            style={{ fontFamily: '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif' }}
          >
            点赞AI -批量生图版
          </div>
        </div>
        <div className="flex items-center gap-2">
          {token && quota ? (
            <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              本月剩余 {quota.remaining}/{quota.limit}
            </div>
          ) : null}
          {items.map((it) => {
            const active =
              it.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(it.to)
            const Icon = it.icon
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition',
                  active
                    ? 'bg-white/10 text-zinc-50'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-50',
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            )
          })}
          {token ? (
            <button
              type="button"
              onClick={async () => {
                await authLogout(token).catch(() => null)
                clearAuth()
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/25 hover:text-emerald-100"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
