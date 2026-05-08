import { cn } from '@/lib/utils'
import type { ModelName } from '../../shared/types'
import { Image } from 'lucide-react'

type Props = {
  value: ModelName
  onChange: (value: ModelName) => void
}

const models: Array<{
  value: ModelName
  title: string
  desc: string
  icon: typeof Image
}> = [
  { value: 'image2', title: 'Image2', desc: '更偏“海报/文字排版”与稳定质感', icon: Image },
]

export default function ModelSelector({ value, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-50">模型</div>
        <div className="text-xs text-zinc-400">生成后仍可进入编辑器做二次修改</div>
      </div>
      <div className="grid gap-2">
        {models.map((m) => {
          const active = m.value === value
          const Icon = m.icon
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(m.value)}
              className={cn(
                'group rounded-2xl border p-3 text-left transition',
                active
                  ? 'border-emerald-300/30 bg-emerald-300/10'
                  : 'border-white/10 bg-zinc-950/30 hover:border-white/20 hover:bg-white/5',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-50">{m.title}</div>
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border',
                    active
                      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                      : 'border-white/10 bg-white/5 text-zinc-200',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xs text-zinc-400">{m.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
