import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Layers3, LogOut, Settings2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { authLogout } from '@/utils/api'

const items = [
  { to: '/', label: '工作台', icon: Sparkles },
  { to: '/library', label: '图库', icon: Layers3 },
  { to: '/settings', label: '设置', icon: Settings2 },
]

export default function TopNav() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <div className="text-sm font-semibold tracking-[0.24em] text-zinc-100">
            COVER FORGE
          </div>
          <div className="text-xs text-zinc-400">小红书封面批量生成</div>
        </div>
        <div className="flex items-center gap-2">
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
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
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
          <div className="ml-2 hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 md:inline-flex">
            {user?.email || '未登录'}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (token) await authLogout(token).catch(() => null)
              clearAuth()
            }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </div>
    </div>
  )
}
