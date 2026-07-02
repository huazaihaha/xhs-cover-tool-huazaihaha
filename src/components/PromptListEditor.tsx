import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckSquare, ChevronDown, CopyPlus, Plus, Sparkles, Square, Trash2, Upload, X } from 'lucide-react'

export type PromptRow = { text: string; images: string[] }

type Props = {
  rows: PromptRow[]
  onChange: (rows: PromptRow[]) => void
  onOpenTemplateBuilder: () => void
  refMode: 'unified' | 'perPrompt'
}

const MAX_IMAGES_PER_PROMPT = 4
const MAX_IMAGE_SIZE = 4 * 1024 * 1024

export default function PromptListEditor({ rows, onChange, onOpenTemplateBuilder, refMode }: Props) {
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState(false)
  const rowFileInputRef = useRef<HTMLInputElement | null>(null)
  const activeRowRef = useRef<number | null>(null)

  const resize = (idx: number) => {
    const el = textareaRefs.current[idx]
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    rows.forEach((_, idx) => resize(idx))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  useEffect(() => {
    setSelected((prev) => {
      const next: Record<number, boolean> = {}
      for (let i = 0; i < rows.length; i += 1) {
        if (prev[i]) next[i] = true
      }
      return next
    })
  }, [rows.length])

  const selectedCount = useMemo(
    () => rows.reduce((acc, _, idx) => (selected[idx] ? acc + 1 : acc), 0),
    [rows, selected],
  )
  const visibleRows = expanded ? rows : rows.slice(0, 5)
  const hiddenCount = Math.max(0, rows.length - 5)

  const updateRowText = (idx: number, text: string) => {
    const next = [...rows]
    next[idx] = { ...next[idx], text }
    onChange(next)
  }

  const removeRowImage = (idx: number, imgIdx: number) => {
    const next = [...rows]
    next[idx] = { ...next[idx], images: next[idx].images.filter((_, i) => i !== imgIdx) }
    onChange(next)
  }

  const openRowUpload = (idx: number) => {
    activeRowRef.current = idx
    rowFileInputRef.current?.click()
  }

  const handleRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget
    const idx = activeRowRef.current
    const files = Array.from(inputEl.files || [])
    inputEl.value = ''
    if (idx === null || !files.length) return

    const currentImages = rows[idx]?.images || []
    const slots = Math.max(0, MAX_IMAGES_PER_PROMPT - currentImages.length)
    const selectedFiles = files.slice(0, slots)
    const loaded = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            if (file.size > MAX_IMAGE_SIZE) {
              resolve(null)
              return
            }
            const reader = new FileReader()
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(file)
          }),
      ),
    )
    const dataUrls = loaded.filter(Boolean) as string[]
    if (!dataUrls.length) return
    const next = [...rows]
    next[idx] = { ...next[idx], images: [...currentImages, ...dataUrls] }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <input
        ref={rowFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleRowFileChange}
      />
      <button
        type="button"
        onClick={onOpenTemplateBuilder}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
      >
        <Sparkles className="h-4 w-4" />
        批量创建提示词
      </button>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-emerald-200">提示词</div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, { text: '', images: [] }])}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-100 transition hover:bg-white/15"
        >
          <Plus className="h-4 w-4" />
          新增
        </button>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (selectedCount === rows.length) {
              setSelected({})
              return
            }
            const next: Record<number, boolean> = {}
            for (let i = 0; i < rows.length; i += 1) next[i] = true
            setSelected(next)
          }}
          className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-100 transition hover:bg-white/10 hover:text-zinc-50"
        >
          {selectedCount === rows.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          全选
        </button>
        <button
          type="button"
          disabled={!selectedCount}
          onClick={() => {
            if (!selectedCount) return
            const next = rows.filter((_, idx) => !selected[idx])
            onChange(next.length ? next : [{ text: '', images: [] }])
            setSelected({})
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition',
            selectedCount
              ? 'bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
              : 'cursor-not-allowed bg-white/5 text-zinc-600',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          批量删除（{selectedCount}）
        </button>
      </div>

      <div className="grid gap-2">
        {visibleRows.map((row, idx) => (
          <div
            key={idx}
            className="group relative rounded-xl border border-white/10 bg-zinc-950/40 p-2"
          >
            <div className="absolute left-2 top-2 inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelected((s) => ({ ...s, [idx]: !s[idx] }))}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 transition',
                  selected[idx] ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 hover:bg-white/15 hover:text-zinc-50',
                )}
                aria-label="选择提示词"
              >
                {selected[idx] ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              </button>
              <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-white/10 px-1.5 text-xs text-zinc-100">
                {idx + 1}
              </div>
            </div>
            <textarea
              ref={(el) => {
                textareaRefs.current[idx] = el
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }
              }}
              value={row.text}
              onChange={(e) => {
                updateRowText(idx, e.target.value)
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
              }}
              placeholder="例如：黑底极简小红书封面，标题“30天减脂计划”，白色粗体字，留足边距"
              rows={1}
              className="max-h-40 min-h-24 w-full resize-none overflow-y-auto rounded-lg bg-transparent px-3 pb-12 pt-11 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const prev = idx > 0 ? rows[idx - 1].text : ''
                  if (!prev) return
                  updateRowText(idx, prev)
                }}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-100 transition',
                  'hover:bg-white/5 hover:text-zinc-50',
                  idx === 0 ? 'opacity-30 hover:bg-transparent hover:text-zinc-100' : '',
                )}
                aria-label="复制上一条"
              >
                <CopyPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = rows.filter((_, i) => i !== idx)
                  onChange(next.length ? next : [{ text: '', images: [] }])
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-100 transition hover:bg-white/5 hover:text-zinc-50"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {refMode === 'perPrompt' ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-white/10 px-1 pt-2">
                {row.images.map((src, imgIdx) => (
                  <div key={imgIdx} className="group/thumb relative h-7 w-7 overflow-hidden rounded-md border border-white/10">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeRowImage(idx, imgIdx)}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 text-zinc-100 opacity-0 transition group-hover/thumb:opacity-100"
                      aria-label="移除该条参考图"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {row.images.length < MAX_IMAGES_PER_PROMPT ? (
                  <button
                    type="button"
                    onClick={() => openRowUpload(idx)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-white/20 text-zinc-400 transition hover:border-white/40 hover:text-zinc-100"
                    aria-label="为该条添加参考图"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {row.images.length === 0 ? (
                  <span className="text-[11px] text-zinc-500">未设置参考图</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-yellow-300 transition hover:bg-white/5 hover:text-yellow-200"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded ? 'rotate-180' : 'rotate-0')} />
          {expanded ? '收起多余提示词' : `展开剩余 ${hiddenCount} 条提示词`}
        </button>
      ) : null}

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-100">
        <div>已输入 {rows.filter((r) => r.text.trim()).length} 条</div>
        <button
          type="button"
          onClick={() => onChange([{ text: '', images: [] }])}
          className="rounded-full px-3 py-1.5 text-xs text-zinc-100 transition hover:bg-white/5 hover:text-zinc-50"
        >
          清空
        </button>
      </div>
    </div>
  )
}
