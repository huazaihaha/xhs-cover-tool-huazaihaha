import type { ModelName } from '../../shared/types'

type Props = {
  value: ModelName
  onChange: (value: ModelName) => void
}

const models: Array<{ value: ModelName; title: string }> = [
  { value: 'image2', title: 'Image2（海报/文字排版）' },
]

export default function ModelSelector({ value, onChange }: Props) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-semibold text-emerald-200">选择生成模型</div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModelName)}
        className="w-full rounded-xl border border-white/20 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-300/50"
      >
        {models.map((m) => (
          <option key={m.value} value={m.value} className="bg-zinc-900 text-zinc-100">
            {m.title}
          </option>
        ))}
      </select>
    </div>
  )
}
