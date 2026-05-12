import { cn } from '@/lib/utils'
import { useGenerateSettingsStore, type GenerateQuality } from '@/store/useGenerateSettingsStore'

const sizeOptions: Array<{ value: string; label: string }> = [
  { value: '1024x1024', label: '方形 1024' },
  { value: '1024x1536', label: '竖版 1024×1536' },
  { value: '1536x1024', label: '横版 1536×1024' },
]

const qualityOptions: Array<{ value: GenerateQuality; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

export default function GenerateParamsPanel() {
  const size = useGenerateSettingsStore((s) => s.size)
  const quality = useGenerateSettingsStore((s) => s.quality)
  const setSize = useGenerateSettingsStore((s) => s.setSize)
  const setQuality = useGenerateSettingsStore((s) => s.setQuality)
  const reset = useGenerateSettingsStore((s) => s.reset)

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-emerald-200">高级参数</div>
          <div className="text-[11px] text-zinc-400">会自动保存为默认值</div>
        </div>
        <button
          type="button"
          onClick={reset}
          className={cn(
            'rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-200 transition',
            'bg-white/5 hover:bg-white/10 hover:text-zinc-50',
          )}
        >
          重置
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[11px] text-zinc-300">尺寸</div>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-300/50"
          >
            {sizeOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-100">
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-300">质量</div>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as GenerateQuality)}
            className="w-full rounded-xl border border-white/20 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-300/50"
          >
            {qualityOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-100">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
