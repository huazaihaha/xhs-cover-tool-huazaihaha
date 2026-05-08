import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CopyPlus, Plus, Trash2 } from 'lucide-react'

type Props = {
  prompts: string[]
  onChange: (prompts: string[]) => void
  max?: number
}

export default function PromptListEditor({ prompts, onChange, max = 10 }: Props) {
  const canAdd = prompts.length < max
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const resize = (idx: number) => {
    const el = textareaRefs.current[idx]
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    prompts.forEach((_, idx) => resize(idx))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts.length])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-50">提示词</div>
          <div className="text-xs text-zinc-400">最多 {max} 条，点击右侧按钮快速复制上一条再微调</div>
        </div>
        <button
          type="button"
          onClick={() => (canAdd ? onChange([...prompts, '']) : null)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
            canAdd
              ? 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
              : 'cursor-not-allowed bg-white/5 text-zinc-500',
          )}
        >
          <Plus className="h-4 w-4" />
          新增
        </button>
      </div>

      <div className="grid gap-2">
        {prompts.map((value, idx) => (
          <div
            key={idx}
            className="group flex items-stretch gap-2 rounded-xl border border-white/10 bg-zinc-950/40 p-2"
          >
            <div className="flex w-8 items-center justify-center text-xs text-zinc-500">
              {idx + 1}
            </div>
            <textarea
              ref={(el) => {
                textareaRefs.current[idx] = el
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }
              }}
              value={value}
              onChange={(e) => {
                const next = [...prompts]
                next[idx] = e.target.value
                onChange(next)
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
              }}
              placeholder="例如：黑底极简小红书封面，标题“30天减脂计划”，白色粗体字，留足边距"
              rows={1}
              className="max-h-40 min-h-10 w-full resize-none overflow-auto rounded-lg bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const prev = idx > 0 ? prompts[idx - 1] : ''
                  if (!prev) return
                  const next = [...prompts]
                  next[idx] = prev
                  onChange(next)
                }}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition',
                  'hover:bg-white/5 hover:text-zinc-50',
                  idx === 0 ? 'opacity-30 hover:bg-transparent hover:text-zinc-300' : '',
                )}
                aria-label="复制上一条"
              >
                <CopyPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = prompts.filter((_, i) => i !== idx)
                  onChange(next.length ? next : [''])
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <div>
          已输入 {prompts.filter((p) => p.trim()).length} / {max}
        </div>
        <button
          type="button"
          onClick={() => onChange([''])}
          className="rounded-full px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
        >
          清空
        </button>
      </div>
    </div>
  )
}
