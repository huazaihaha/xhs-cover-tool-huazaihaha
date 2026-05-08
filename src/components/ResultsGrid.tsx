import { cn } from '@/lib/utils'
import type { GenerateResultItem } from '../../shared/types'
import { Check, Copy, ExternalLink, ImageOff, Loader2, RotateCcw } from 'lucide-react'

type Item = GenerateResultItem & {
  proxyUrl?: string
}

type Props = {
  items: Item[]
  selected: Record<string, boolean>
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onCopyPrompt: (prompt: string) => void
  onRetry: (id: string) => void
}

function StatusBadge({ status }: { status: Item['status'] }) {
  if (status === 'running') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        生成中
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-[11px] text-rose-200">
        <ImageOff className="h-3 w-3" />
        失败
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] text-emerald-200">
      <Check className="h-3 w-3" />
      完成
    </div>
  )
}

export default function ResultsGrid({
  items,
  selected,
  onToggle,
  onOpen,
  onCopyPrompt,
  onRetry,
}: Props) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">
        生成结果会出现在这里
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map((it) => {
        const checked = !!selected[it.id]
        const src = it.proxyUrl || it.imageUrl
        return (
          <div
            key={it.id}
            className={cn(
              'group relative overflow-hidden rounded-2xl border bg-zinc-950/30 transition',
              checked
                ? 'border-emerald-300 bg-emerald-300/10 shadow-[0_0_0_2px_rgba(110,231,183,0.45),0_0_24px_rgba(16,185,129,0.4)]'
                : 'border-white/10 hover:border-white/20',
            )}
          >
            {checked ? <div className="pointer-events-none absolute inset-0 z-[1] bg-emerald-300/10" /> : null}
            <button
              type="button"
              onClick={() => onToggle(it.id)}
              className={cn(
                'absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur transition',
                checked
                  ? 'border-emerald-200 bg-emerald-300 text-zinc-950 shadow-[0_0_0_2px_rgba(16,185,129,0.45)]'
                  : 'border-white/10 bg-zinc-950/40 text-zinc-200 hover:bg-white/5',
              )}
              aria-label="选择"
            >
              {checked ? <Check className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-white/40" />}
            </button>

            <div className="absolute right-3 top-3 z-10">
              <StatusBadge status={it.status} />
            </div>

            <div className="aspect-[3/4] w-full bg-zinc-950">
              {src && it.status === 'succeeded' ? (
                <img
                  src={src}
                  alt={it.prompt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                  {it.status === 'running' ? '生成中…' : '无图片'}
                </div>
              )}
            </div>

            <div className="space-y-2 p-3">
              <div className="line-clamp-2 text-xs text-zinc-200">{it.prompt}</div>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-zinc-500">{it.model}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCopyPrompt(it.prompt)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
                    aria-label="复制提示词"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {it.status === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => onRetry(it.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-amber-300 transition hover:bg-amber-400/10 hover:text-amber-200"
                      aria-label="重新生成"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpen(it.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
                      aria-label="编辑"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
