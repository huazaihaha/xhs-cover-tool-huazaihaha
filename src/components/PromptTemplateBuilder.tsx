import { useEffect, useMemo, useState } from 'react'
import { Braces, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TemplateParam = {
  id: string
  name: string
  valuesText: string
}

type PersistedState = {
  template: string
  params: Array<{ name: string; valuesText: string }>
}

type Props = {
  remainingSlots: number
  onGenerate: (prompts: string[]) => void
}

const STORAGE_KEY = 'xhs-cover-template-builder-v1'

function extractPlaceholders(template: string) {
  const regex = /{{\s*([^{}]+?)\s*}}/g
  const names: string[] = []
  const seen = new Set<string>()
  let matched: RegExpExecArray | null = null
  while (true) {
    matched = regex.exec(template)
    if (!matched) break
    const name = matched[1].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function renderTemplate(template: string, mapping: Record<string, string>) {
  return template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, raw: string) => {
    const key = raw.trim()
    return Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : ''
  })
}

function buildAlignedRows(keys: string[], valuesMap: Record<string, string[]>) {
  if (!keys.length) return [{}]

  const lengths = keys.map((k) => valuesMap[k]?.length || 0)
  const expected = lengths[0] || 0
  if (!expected) return []
  if (!lengths.every((len) => len === expected)) return null

  const rows: Record<string, string>[] = []
  for (let i = 0; i < expected; i += 1) {
    const row: Record<string, string> = {}
    for (const key of keys) {
      row[key] = valuesMap[key][i] || ''
    }
    rows.push(row)
  }
  return rows
}

export default function PromptTemplateBuilder({ remainingSlots, onGenerate }: Props) {
  const [template, setTemplate] = useState('')
  const [params, setParams] = useState<TemplateParam[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistedState
      if (typeof parsed?.template === 'string') setTemplate(parsed.template)
      if (Array.isArray(parsed?.params)) {
        setParams(
          parsed.params.map((p, idx) => ({
            id: `p_${Date.now()}_${idx}`,
            name: typeof p?.name === 'string' ? p.name : '',
            valuesText: typeof p?.valuesText === 'string' ? p.valuesText : '',
          })),
        )
      }
    } catch {
      setMessage('模版缓存读取失败，已使用空配置')
    }
  }, [])

  useEffect(() => {
    const payload: PersistedState = {
      template,
      params: params.map((p) => ({ name: p.name, valuesText: p.valuesText })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [template, params])

  useEffect(() => {
    const placeholders = extractPlaceholders(template)
    if (!placeholders.length) return
    setParams((prev) => {
      const byName = new Map(prev.map((p) => [p.name.trim(), p]))
      const synced = placeholders.map((name, idx) => {
        const existing = byName.get(name)
        return (
          existing || {
            id: `p_${Date.now()}_${idx}`,
            name,
            valuesText: '',
          }
        )
      })
      for (const item of prev) {
        const n = item.name.trim()
        if (!n || placeholders.includes(n)) continue
        synced.push(item)
      }
      return synced
    })
  }, [template])

  const placeholders = useMemo(() => extractPlaceholders(template), [template])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-50">提示词模版工厂</div>
          <div className="text-xs text-zinc-400">占位符写法：{'{{参数名}}'}，参数值按换行输入</div>
        </div>
        <button
          type="button"
          onClick={() =>
            setParams((prev) => [
              ...prev,
              { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: '', valuesText: '' },
            ])
          }
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/15 hover:text-zinc-50"
        >
          <Plus className="h-4 w-4" />
          新增参数
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
        <div className="mb-2 text-[11px] text-zinc-500">模版文本</div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={4}
          placeholder="例：帮我生成{{行业}}赛道的{{风格}}风格小红书封面，主色调{{颜色}}"
          className="w-full resize-y rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <Braces className="h-3.5 w-3.5" />
          检测到占位符：{placeholders.length ? placeholders.join('、') : '无'}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {params.map((param) => (
          <div key={param.id} className="rounded-xl border border-white/10 bg-zinc-950/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <input
                value={param.name}
                onChange={(e) => {
                  const v = e.target.value
                  setParams((prev) => prev.map((p) => (p.id === param.id ? { ...p, name: v } : p)))
                }}
                placeholder="参数名（如：行业）"
                className="w-48 rounded-lg bg-black/30 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => setParams((prev) => prev.filter((p) => p.id !== param.id))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/5 hover:text-zinc-50"
                aria-label="删除参数"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={param.valuesText}
              onChange={(e) => {
                const v = e.target.value
                setParams((prev) => prev.map((p) => (p.id === param.id ? { ...p, valuesText: v } : p)))
              }}
              rows={3}
              placeholder="每行一个值，例如：\n知识付费\n职场成长"
              className="w-full resize-y rounded-lg bg-black/30 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">剩余可新增提示词：{remainingSlots}</div>
        <button
          type="button"
          onClick={() => {
            const tpl = template.trim()
            if (!tpl) {
              setMessage('请先填写模版')
              return
            }
            if (remainingSlots <= 0) {
              setMessage('已达到 10 条上限，请先删除部分提示词')
              return
            }

            const names = extractPlaceholders(tpl)
            const valuesMap: Record<string, string[]> = {}
            for (const p of params) {
              const key = p.name.trim()
              if (!key) continue
              valuesMap[key] = p.valuesText
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
            }

            const alignedRows = names.length ? buildAlignedRows(names, valuesMap) : [{}]
            if (alignedRows === null) {
              setMessage('参数值行数不一致：请确保每个参数都填写相同行数（例如都为 10 行）')
              return
            }
            const generated = alignedRows
              .map((c) => renderTemplate(tpl, c).trim())
              .filter(Boolean)
            const unique = Array.from(new Set(generated))
            const limited = unique.slice(0, remainingSlots)

            if (!limited.length) {
              setMessage('未生成有效提示词，请检查参数值')
              return
            }
            onGenerate(limited)

            if (limited.length < unique.length) {
              setMessage(`已生成 ${limited.length} 条，超出上限的 ${unique.length - limited.length} 条已忽略`)
            } else {
              setMessage(`已生成 ${limited.length} 条提示词`)
            }
          }}
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition',
            remainingSlots > 0
              ? 'bg-emerald-300 text-zinc-950 hover:bg-emerald-200'
              : 'cursor-not-allowed bg-white/10 text-zinc-500',
          )}
          disabled={remainingSlots <= 0}
        >
          <Sparkles className="h-4 w-4" />
          自动生成提示词
        </button>
      </div>

      {message ? <div className="mt-2 text-xs text-zinc-400">{message}</div> : null}
    </div>
  )
}
