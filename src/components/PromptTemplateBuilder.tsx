import { useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
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
  onGenerate: (prompts: string[]) => void
}

const STORAGE_KEY = 'xhs-cover-template-builder-v1'
const EXAMPLE_TEMPLATE = `帮我生成一个PPT可视化排版风格的小红书首图封面，要求如下：
1.尺寸比例为3:4；
2.所属行业赛道为：{{行业名称}}；
3.整体色调采用：{{颜色}}；`

function extractPlaceholders(template: string) {
  const regex = /(?:{{\s*([^{}]+?)\s*}}|【\s*([^【】]+?)\s*】)/g
  const names: string[] = []
  const seen = new Set<string>()
  let matched: RegExpExecArray | null = null
  while (true) {
    matched = regex.exec(template)
    if (!matched) break
    const name = (matched[1] || matched[2] || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function renderTemplate(template: string, mapping: Record<string, string>) {
  return template.replace(/(?:{{\s*([^{}]+?)\s*}}|【\s*([^【】]+?)\s*】)/g, (_, rawA: string, rawB: string) => {
    const raw = rawA || rawB
    const key = raw.trim()
    return Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : ''
  })
}

function countInputLines(valuesText: string) {
  if (!valuesText.trim()) return 0
  return valuesText
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean).length
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

export default function PromptTemplateBuilder({ onGenerate }: Props) {
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

  const placeholders = useMemo(() => extractPlaceholders(template), [template])
  const syncParamsFromTemplate = (tpl: string) => {
    const detected = extractPlaceholders(tpl)
    if (!detected.length) {
      setMessage('未识别到参数，请先在模版中填写参数标记')
      return 0
    }
    setParams((prev) => {
      const byName = new Map(prev.map((p) => [p.name.trim(), p]))
      const synced = detected.map((name, idx) => {
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
        if (!n || detected.includes(n)) continue
        synced.push(item)
      }
      return synced
    })
    return detected.length
  }

  return (
    <div className="max-h-[78vh] overflow-y-auto p-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-zinc-50">设置提示词模版</div>
          <div className="text-xs text-white">模版中的参数请用{'{{参数名}}'}格式，参数值按行填写</div>
        </div>
        <button
          type="button"
          onClick={() =>
            setParams((prev) => [
              ...prev,
              { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: '', valuesText: '' },
            ])
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10 hover:text-zinc-50"
        >
          <Plus className="h-4 w-4" />
          新增参数
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div />
          <button
            type="button"
            onClick={() => {
              setTemplate(EXAMPLE_TEMPLATE)
              const count = syncParamsFromTemplate(EXAMPLE_TEMPLATE)
              setMessage(count ? `已插入示例，并识别 ${count} 个参数` : '已插入示例')
            }}
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-100 transition hover:bg-white/15"
          >
            插入示例
          </button>
        </div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={7}
          placeholder={EXAMPLE_TEMPLATE}
          className="w-full resize-y rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-500">
            检测到参数：{placeholders.length ? placeholders.join('、') : '无'}
          </div>
          <button
            type="button"
            onClick={() => {
              const count = syncParamsFromTemplate(template)
              if (!count) return
              setMessage(`已识别 ${count} 个参数`)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/25"
          >
            <Sparkles className="h-4 w-4" />
            识别参数
          </button>
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
            <div className="mt-1 text-right text-[11px] text-zinc-500">
              已输入 {countInputLines(param.valuesText)} 行
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">按参数行对齐生成，不做数量限制</div>
        <button
          type="button"
          onClick={() => {
            const tpl = template.trim()
            if (!tpl) {
              setMessage('请先填写模版')
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

            if (!unique.length) {
              setMessage('未生成有效提示词，请检查参数值')
              return
            }
            onGenerate(unique)
            setMessage(`已生成 ${unique.length} 条提示词`)
          }}
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition',
            'bg-emerald-300 text-zinc-950 hover:bg-emerald-200',
          )}
        >
          <Sparkles className="h-4 w-4" />
          自动生成提示词
        </button>
      </div>

      {message ? <div className="mt-2 text-xs text-zinc-400">{message}</div> : null}
    </div>
  )
}
