import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import { useGalleryStore } from '@/store/useGalleryStore'
import { cn } from '@/lib/utils'
import { buildCoverFilename, buildCoverFilenameByTags } from '@/utils/filename'
import { generateNaming } from '@/utils/api'
import { Check, Download, Trash2, X } from 'lucide-react'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Library() {
  const items = useGalleryStore((s) => s.items)
  const removeItems = useGalleryStore((s) => s.removeItems)
  const clear = useGalleryStore((s) => s.clear)

  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const selectedItems = useMemo(
    () => items.filter((i) => selected[i.id]),
    [items, selected],
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-50">图库</div>
            <div className="text-xs text-zinc-400">这里保存你生成过与编辑过的封面（本地浏览器存储）</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {}
                for (const it of items) next[it.id] = true
                setSelected(next)
              }}
              disabled={!items.length}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition',
                items.length
                  ? 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              全选
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
                const namingRes = await generateNaming({
                  items: selectedItems.map((it) => ({
                    id: it.id,
                    prompt: it.prompt,
                    imageUrl: it.editedUrl || it.proxyUrl || it.imageUrl,
                  })),
                }).catch(() => ({ items: [] as { id: string; industry: string; style: string; color: string }[] }))
                const namingMap = new Map(namingRes.items.map((i) => [i.id, i]))

                await Promise.all(
                  selectedItems.map(async (it, idx) => {
                    const url = it.editedUrl || it.proxyUrl || it.imageUrl
                    if (!url) return
                    const res = await fetch(url)
                    const blob = await res.blob()
                    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : 'bin'
                    const tags = namingMap.get(it.id)
                    const filename = tags
                      ? buildCoverFilenameByTags(tags, idx + 1, ext)
                      : buildCoverFilename(it.prompt, idx + 1, ext)
                    zip.file(filename, blob)
                  }),
                )

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
            <button
              type="button"
              disabled={!items.length}
              onClick={() => {
                clear()
                setSelected({})
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
                items.length
                  ? 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
            >
              清空图库
            </button>
          </div>
        </div>

        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-zinc-400">
            还没有任何记录，去工作台批量生成吧
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((it) => {
              const checked = !!selected[it.id]
              const src = it.editedUrl || it.proxyUrl || it.imageUrl
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
        )}
      </div>
    </div>
  )
}
