import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Layers3, LogOut, Settings2, Sparkles, FileText, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { authGetUsageQuota, authLogout } from '@/utils/api'

const navItems = [
  { to: '/', label: '工作台', icon: Sparkles },
  { to: '/article-to-images', label: '一稿多图', icon: FileText },
  { to: '/library', label: '图库', icon: Layers3 },
]

const PUBLIC_BASE = import.meta.env.BASE_URL || '/'

function withPublicBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${PUBLIC_BASE}${normalizedPath}`
}

export default function TopNav() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const quota = useAuthStore((s) => s.quota)
  const setQuota = useAuthStore((s) => s.setQuota)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const handleLogout = async () => {
    await authLogout(token).catch(() => null)
    clearAuth()
    setSettingsOpen(false)
  }

  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      <div className="flex h-[108px] w-full items-center justify-between px-6">
        <img
          src={withPublicBase('/logo.png')}
          alt="点赞AI"
          className="h-[104px] w-auto object-contain"
        />
        <div className="flex items-center gap-3">
          {navItems.map((it) => {
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition',
                  settingsOpen
                    ? 'bg-white/10 text-zinc-50'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-50',
                )}
              >
                <Settings2 className="h-4 w-4" />
                设置
                <ChevronDown className={cn('h-3 w-3 transition-transform', settingsOpen && 'rotate-180')} />
              </button>
              
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-white/10 bg-zinc-900/95 py-2 shadow-xl backdrop-blur">
                  <Link
                    to="/settings"
                    onClick={() => setSettingsOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 transition"
                  >
                    <Settings2 className="h-4 w-4 text-zinc-400" />
                    账号设置
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 transition"
                  >
                    <LogOut className="h-4 w-4 text-zinc-400" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/25 hover:text-emerald-100"
            >
              登录 / 注册
            </Link>
          )}
          
          {token && quota ? (
            <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              本月剩余 {quota.remaining}/{quota.limit}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
