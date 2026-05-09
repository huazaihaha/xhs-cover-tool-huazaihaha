import { useMemo } from 'react'
import TopNav from '@/components/TopNav'
import { useAuthStore } from '@/store/useAuthStore'
import { useGalleryStore } from '@/store/useGalleryStore'

export default function Settings() {
  const user = useAuthStore((s) => s.user)
  const loginCount = useAuthStore((s) => s.loginCount)
  const firstLoginAt = useAuthStore((s) => s.firstLoginAt)
  const galleryItems = useGalleryStore((s) => s.items)

  const generatedCount = useMemo(
    () => galleryItems.filter((i) => i.status === 'succeeded' || !!i.editedUrl).length,
    [galleryItems],
  )

  const usageDays = useMemo(() => {
    if (!firstLoginAt) return user ? 1 : 0
    const first = new Date(firstLoginAt).getTime()
    if (Number.isNaN(first)) return user ? 1 : 0
    const diff = Date.now() - first
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
  }, [firstLoginAt, user])
  const usageCount = loginCount || (user ? 1 : 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4">
          <div className="text-lg font-semibold text-emerald-200">账号与使用统计</div>
          <div className="text-sm text-zinc-400">查看当前账号和本地使用数据</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">当前登录账号</div>
            <div className="mt-2 break-all text-base font-semibold text-zinc-100">{user?.email || '未登录'}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">累计生成图片数量</div>
            <div className="mt-2 text-3xl font-bold text-emerald-200">{generatedCount}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">用户登录使用次数</div>
            <div className="mt-2 text-3xl font-bold text-emerald-200">{usageCount}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">用户使用天数</div>
            <div className="mt-2 text-3xl font-bold text-emerald-200">{usageDays}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
