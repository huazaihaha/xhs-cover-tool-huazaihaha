import { useEffect, useState } from 'react'
import TopNav from '@/components/TopNav'
import { checkHealth } from '@/utils/api'
import { cn } from '@/lib/utils'
import { CheckCircle2, CircleAlert, Copy } from 'lucide-react'

export default function Settings() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    checkHealth()
      .then((v) => setOk(v))
      .catch(() => setOk(false))
  }, [])

  const snippet = `cp .env.example .env\n\n# 然后填写：\n# PLATO_BASE_URL=https://api.bltcy.ai/\n# PLATO_API_KEY=你的key\n# PLATO_AUTH_MODE=x-api-key\n# PLATO_MODEL_IMAGE2=gpt-image-2-all\n\nnpm run dev`

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-50">服务状态</div>
                <div className="text-xs text-zinc-400">前端通过 /api 代理访问本地 Express 服务</div>
              </div>
              {ok === null ? (
                <div className="text-xs text-zinc-500">检测中…</div>
              ) : ok ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  正常
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200">
                  <CircleAlert className="h-4 w-4" />
                  异常
                </div>
              )}
            </div>
            <div className="mt-4 text-xs text-zinc-400">
              如果显示异常，通常是后端未启动或端口被占用；请确认终端里同时跑着 client 与 server。
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-zinc-50">柏拉图对接配置</div>
            <div className="mt-1 text-xs text-zinc-400">
              出于安全原因，API Key 默认仅放在服务端环境变量，不会暴露到浏览器。
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">快速配置</div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(snippet)
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
                >
                  <Copy className="h-4 w-4" />
                  复制
                </button>
              </div>
              <pre className={cn('mt-3 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300')}>
                {snippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
