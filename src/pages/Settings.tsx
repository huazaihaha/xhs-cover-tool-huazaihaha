import { useEffect, useMemo, useState } from 'react'
import TopNav from '@/components/TopNav'
import { useAuthStore } from '@/store/useAuthStore'
import { useGalleryStore } from '@/store/useGalleryStore'
import { authGetAccountUsageStats, authGetUsageQuota, authGrantUsageQuota } from '@/utils/api'

const ACCOUNT_STATS_ADMIN = '1067363705@qq.com'

type AccountUsageStat = {
  userId: string
  account: string
  totalGenerated: number
  todayGenerated: number
}

export default function Settings() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const quota = useAuthStore((s) => s.quota)
  const setQuota = useAuthStore((s) => s.setQuota)
  const loginCount = useAuthStore((s) => s.loginCount)
  const firstLoginAt = useAuthStore((s) => s.firstLoginAt)
  const galleryItems = useGalleryStore((s) => s.items)
  const [canGrantQuota, setCanGrantQuota] = useState(false)
  const [grantAccount, setGrantAccount] = useState('')
  const [grantCount, setGrantCount] = useState('25')
  const [grantBusy, setGrantBusy] = useState(false)
  const [grantMessage, setGrantMessage] = useState('')
  const [accountStats, setAccountStats] = useState<AccountUsageStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const canViewAccountStats = (user?.email || '').toLowerCase() === ACCOUNT_STATS_ADMIN

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

  useEffect(() => {
    let cancelled = false
    if (!token) return
    void authGetUsageQuota(token)
      .then((resp) => {
        if (cancelled) return
        if (resp.ok) {
          setCanGrantQuota(!!resp.canGrantQuota)
          if (resp.quota) setQuota(resp.quota)
        } else {
          setCanGrantQuota(false)
        }
      })
      .catch(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
    }
  }, [token, setQuota])

  useEffect(() => {
    let cancelled = false
    if (!token || !canViewAccountStats) return
    setStatsLoading(true)
    setStatsError('')
    void authGetAccountUsageStats(token)
      .then((resp) => {
        if (cancelled) return
        if (!resp.ok) {
          setStatsError(resp.error || '账号统计加载失败')
          setAccountStats([])
          return
        }
        setAccountStats(resp.items || [])
      })
      .catch(() => {
        if (cancelled) return
        setStatsError('账号统计加载失败，请稍后重试')
      })
      .finally(() => {
        if (cancelled) return
        setStatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, canViewAccountStats])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4">
          <div className="text-lg font-semibold text-emerald-200">账号与使用统计</div>
          <div className="text-sm text-zinc-400">查看当前账号和本地使用数据</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-5">
            <div className="text-sm text-emerald-100">本月剩余额度</div>
            <div className="mt-2 text-3xl font-bold text-emerald-200">
              {quota ? quota.remaining : '--'}
            </div>
            <div className="mt-1 text-xs text-emerald-100/80">
              {quota ? `已用 ${quota.used}/${quota.limit}` : '登录后自动获取'}
            </div>
          </div>

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

        {canGrantQuota ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-5">
            <div className="text-base font-semibold text-emerald-200">额度下发（白名单）</div>
            <div className="mt-1 text-xs text-zinc-300">仅白名单用户可见，用于向指定账号派发生成额度</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <input
                value={grantAccount}
                onChange={(e) => setGrantAccount(e.target.value)}
                placeholder="输入账号名称（邮箱）"
                className="w-full rounded-xl border border-white/20 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-300/60"
              />
              <input
                type="number"
                min={1}
                value={grantCount}
                onChange={(e) => setGrantCount(e.target.value)}
                placeholder="下发额度"
                className="w-full rounded-xl border border-white/20 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-300/60"
              />
              <button
                type="button"
                disabled={grantBusy || !token}
                onClick={async () => {
                  if (!token) return
                  const account = grantAccount.trim()
                  const amount = Number(grantCount)
                  if (!account || !Number.isFinite(amount) || amount < 1) {
                    setGrantMessage('请输入有效账号和下发额度')
                    return
                  }
                  setGrantBusy(true)
                  setGrantMessage('')
                  try {
                    const resp = await authGrantUsageQuota(token, { account, grantCount: Math.floor(amount) })
                    if (!resp.ok) {
                      setGrantMessage(resp.error || '额度下发失败')
                      return
                    }
                    setGrantMessage(resp.message || '额度下发成功')
                    if (resp.target?.email === user?.email && resp.quota) {
                      setQuota(resp.quota)
                    }
                  } catch {
                    setGrantMessage('额度下发失败，请稍后重试')
                  } finally {
                    setGrantBusy(false)
                  }
                }}
                className={
                  grantBusy || !token
                    ? 'cursor-not-allowed rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-500'
                    : 'rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200'
                }
              >
                {grantBusy ? '下发中...' : '下发额度'}
              </button>
            </div>
            {grantMessage ? <div className="mt-3 text-xs text-zinc-200">{grantMessage}</div> : null}
          </div>
        ) : null}

        {canViewAccountStats ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-base font-semibold text-emerald-200">账号生成数据统计</div>
            <div className="mt-1 text-xs text-zinc-400">
              统计字段：账号名称、累计生成图片数量、今日生成图片数量
            </div>

            {statsLoading ? <div className="mt-4 text-sm text-zinc-400">加载中...</div> : null}
            {statsError ? <div className="mt-4 text-sm text-rose-300">{statsError}</div> : null}
            {!statsLoading && !statsError ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-zinc-400">
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-2 font-medium">账号名称</th>
                      <th className="px-3 py-2 font-medium">累计生成图片数量</th>
                      <th className="px-3 py-2 font-medium">今日生成图片数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountStats.length ? (
                      accountStats.map((row) => (
                        <tr key={row.userId} className="border-b border-white/5">
                          <td className="px-3 py-2 text-zinc-100">{row.account}</td>
                          <td className="px-3 py-2 text-emerald-200">{row.totalGenerated}</td>
                          <td className="px-3 py-2 text-emerald-200">{row.todayGenerated}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-4 text-zinc-500" colSpan={3}>
                          暂无统计数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
