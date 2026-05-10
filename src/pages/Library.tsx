import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import { useGalleryStore } from '@/store/useGalleryStore'
import { cn } from '@/lib/utils'
import { buildCoverFilename, buildCoverFilenameByTags } from '@/utils/filename'
import { Check, Download, Trash2, X } from 'lucide-react'

type NamingTag = { industry?: string; style?: string; color?: string }
type GroupedBatch = {
  key: string
  label: string
  items: ReturnType<typeof useGalleryStore.getState>['items']
}

function getBatchKey(itemId: string, createdAt: string) {
  const matched = itemId.match(/^(run_\d+)_\d+$/)
  if (matched?.[1]) return matched[1]
  const d = new Date(createdAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `time_${y}${m}${day}${h}${mm}`
}

function getBatchLabel(createdAt: string) {
  return new Date(createdAt).toLocaleString()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 2000)
}

export default function Library() {
  const items = useGalleryStore((s) => s.items)
  const removeItems = useGalleryStore((s) => s.removeItems)

  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const selectedItems = useMemo(
    () => items.filter((i) => selected[i.id]),
    [items, selected],
  )
  const groupedBatches = useMemo(() => {
    const grouped = new Map<string, GroupedBatch>()
    for (const item of items) {
      const key = getBatchKey(item.id, item.createdAt)
      const existing = grouped.get(key)
      if (existing) {
        existing.items.push(item)
        continue
      }
      grouped.set(key, {
        key,
        label: getBatchLabel(item.createdAt),
        items: [item],
      })
    }
    return Array.from(grouped.values()).sort((a, b) => {
      const ta = Math.max(...a.items.map((i) => new Date(i.createdAt).getTime()))
      const tb = Math.max(...b.items.map((i) => new Date(i.createdAt).getTime()))
      return tb - ta
    })
  }, [items])
  const latestBatch = groupedBatches[0]
  const allItemsSelected = useMemo(
    () => !!items.length && items.every((i) => selected[i.id]),
    [items, selected],
  )
  const latestBatchAllSelected = useMemo(
    () => !!latestBatch?.items.length && latestBatch.items.every((i) => selected[i.id]),
    [latestBatch, selected],
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold text-emerald-200">图库</div>
            <div className="text-sm text-zinc-400">温馨提醒！图片保存在本地浏览器，暂未保存云端。</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected((prev) => {
                  const next = { ...prev }
                  if (allItemsSelected) {
                    for (const it of items) delete next[it.id]
                    return next
                  }
                  for (const it of items) next[it.id] = true
                  return next
                })
              }}
              disabled={!items.length}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition',
                items.length
                  ? 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              {allItemsSelected ? '取消全选' : '全选'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!latestBatch) return
                setSelected((prev) => {
                  const next = { ...prev }
                  if (latestBatchAllSelected) {
                    for (const it of latestBatch.items) delete next[it.id]
                    return next
                  }
                  for (const it of latestBatch.items) next[it.id] = true
                  return next
                })
              }}
              disabled={!latestBatch}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition',
                latestBatch
                  ? 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              {latestBatchAllSelected ? '取消最近批次' : '选择最近批次'}
            </button>
            <button
              type="button"
              onClick={() => setSelected({})}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
              aria-label="清空选择"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!selectedItems.length}
              onClick={async () => {
                const zip = new JSZip()
                const ts = new Date()
                const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
                const settled = await Promise.allSettled(
                  selectedItems.map(async (it, idx) => {
                    const candidates = [it.editedUrl, it.proxyUrl, it.imageUrl].filter(Boolean) as string[]
                    if (!candidates.length) throw new Error('Missing image url')
                    let blob: Blob | null = null
                    for (const url of candidates) {
                      try {
                        const res = await fetch(url)
                        if (!res.ok) continue
                        blob = await res.blob()
                        if (!blob.size) continue
                        const isImageType = /^image\//.test(blob.type || '')
                        if (isImageType || !blob.type) break
                      } catch {
                        // try next candidate
                      }
                    }
                    if (!blob) throw new Error('Download failed')
                    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : 'bin'
                    const tags = it.namingTags as NamingTag | undefined
                    const filename = tags
                      ? buildCoverFilenameByTags(tags, idx + 1, ext)
                      : buildCoverFilename(it.prompt, idx + 1, ext)
                    zip.file(filename, blob)
                  }),
                )
                const successCount = settled.filter((r) => r.status === 'fulfilled').length
                if (!successCount) return

                const zipped = await zip.generateAsync({ type: 'blob' })
                downloadBlob(zipped, `library_${stamp}.zip`)
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
                selectedItems.length
                  ? 'bg-white/10 text-zinc-50 hover:bg-white/15'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              <Download className="h-4 w-4" />
              下载（{selectedItems.length}）
            </button>
            <button
              type="button"
              disabled={!selectedItems.length}
              onClick={() => {
                removeItems(selectedItems.map((i) => i.id))
                setSelected({})
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
                selectedItems.length
                  ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </div>
        </div>

        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-zinc-400">
            还没有任何记录，去工作台批量生成吧
          </div>
        ) : (
          <div className="space-y-4">
            {groupedBatches.map((batch, batchIdx) => (
              <div key={batch.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs text-zinc-400">
                    批次 {groupedBatches.length - batchIdx} · {batch.label} · {batch.items.length} 张
                  </div>
                  {(() => {
                    const batchAllSelected = batch.items.length > 0 && batch.items.every((it) => selected[it.id])
                    return (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = { ...prev }
                        if (batchAllSelected) {
                          for (const it of batch.items) delete next[it.id]
                          return next
                        }
                        for (const it of batch.items) next[it.id] = true
                        return next
                      })
                    }}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-100 transition hover:bg-white/15"
                  >
                    {batchAllSelected ? '取消本批次' : '选择本批次'}
                  </button>
                    )
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {batch.items.map((it) => {
                    const checked = !!selected[it.id]
                    const src = it.editedUrl || it.imageUrl || it.proxyUrl
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [it.id]: !s[it.id] }))}
                        className={cn(
                          'group relative overflow-hidden rounded-2xl border bg-zinc-950/30 text-left transition',
                          checked
                            ? 'border-emerald-300 bg-emerald-300/10 shadow-[0_0_0_2px_rgba(110,231,183,0.45),0_0_24px_rgba(16,185,129,0.4)]'
                            : 'border-white/10 hover:border-white/20',
                        )}
                      >
                        {checked ? (
                          <>
                            <div className="pointer-events-none absolute inset-0 z-[1] bg-emerald-300/10" />
                            <div className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-300 text-zinc-950 shadow-[0_0_0_2px_rgba(16,185,129,0.45)]">
                              <Check className="h-4 w-4" />
                            </div>
                          </>
                        ) : null}
                        <div className="aspect-[3/4] w-full bg-black">
                          {src ? (
                            <img src={src} alt={it.prompt} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-zinc-600">无图片</div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="line-clamp-2 text-xs text-zinc-200">{it.prompt}</div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                            <div>{it.model}</div>
                            <div>{new Date(it.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
