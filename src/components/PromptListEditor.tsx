import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckSquare, CopyPlus, Plus, Square, Trash2 } from 'lucide-react'

type Props = {
  prompts: string[]
  onChange: (prompts: string[]) => void
}

export default function PromptListEditor({ prompts, onChange }: Props) {
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const [selected, setSelected] = useState<Record<number, boolean>>({})

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

  useEffect(() => {
    setSelected((prev) => {
      const next: Record<number, boolean> = {}
      for (let i = 0; i < prompts.length; i += 1) {
        if (prev[i]) next[i] = true
      }
      return next
    })
  }, [prompts.length])

  const selectedCount = useMemo(
    () => prompts.reduce((acc, _, idx) => (selected[idx] ? acc + 1 : acc), 0),
    [prompts, selected],
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-50">提示词</div>
          <div className="text-xs text-zinc-400">支持无限条，点击右侧按钮快速复制上一条再微调</div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...prompts, ''])}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/25"
        >
          <Plus className="h-4 w-4" />
          新增
        </button>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (selectedCount === prompts.length) {
              setSelected({})
              return
            }
            const next: Record<number, boolean> = {}
            for (let i = 0; i < prompts.length; i += 1) next[i] = true
            setSelected(next)
          }}
          className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
        >
          {selectedCount === prompts.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          全选
        </button>
        <button
          type="button"
          disabled={!selectedCount}
          onClick={() => {
            if (!selectedCount) return
            const next = prompts.filter((_, idx) => !selected[idx])
            onChange(next.length ? next : [''])
            setSelected({})
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition',
            selectedCount
              ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
              : 'cursor-not-allowed bg-white/5 text-zinc-600',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          批量删除（{selectedCount}）
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
            <button
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [idx]: !s[idx] }))}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition',
                selected[idx] ? 'bg-emerald-400/20 text-emerald-200' : 'hover:bg-white/5 hover:text-zinc-50',
              )}
              aria-label="选择提示词"
            >
              {selected[idx] ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
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
        <div>已输入 {prompts.filter((p) => p.trim()).length} 条</div>
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
