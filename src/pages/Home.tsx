import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import PromptListEditor from '@/components/PromptListEditor'
import ModelSelector from '@/components/ModelSelector'
import ResultsGrid from '@/components/ResultsGrid'
import { cn } from '@/lib/utils'
import { generateImages, generateNaming } from '@/utils/api'
import { buildCoverFilename, buildCoverFilenameByTags } from '@/utils/filename'
import type { GenerateResultItem, ModelName } from '../../shared/types'
import { useGalleryStore } from '@/store/useGalleryStore'
import { Download, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Item = GenerateResultItem & { proxyUrl?: string }
type ReferenceImage = { id: string; name: string; dataUrl: string }

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function withApiBase(path: string) {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL}${path}`
}

function toProxyUrl(imageUrl?: string) {
  if (!imageUrl) return undefined
  if (imageUrl.startsWith('/api/')) return withApiBase(imageUrl)
  return withApiBase(`/api/image?url=${encodeURIComponent(imageUrl)}`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Home() {
  const navigate = useNavigate()
  const upsertItems = useGalleryStore((s) => s.upsertItems)
  const items = useGalleryStore((s) => s.workspaceItems)
  const busy = useGalleryStore((s) => s.workspaceBusy)
  const appendWorkspaceItems = useGalleryStore((s) => s.appendWorkspaceItems)
  const replaceWorkspaceRun = useGalleryStore((s) => s.replaceWorkspaceRun)
  const setWorkspaceBusy = useGalleryStore((s) => s.setWorkspaceBusy)

  const [prompts, setPrompts] = useState<string[]>([''])
  const [model, setModel] = useState<ModelName>('image2')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const succeeded = useMemo(
    () => items.filter((i) => i.status === 'succeeded' && (i.proxyUrl || i.imageUrl)),
    [items],
  )
  const selectedSucceeded = useMemo(
    () => succeeded.filter((i) => selected[i.id]),
    [succeeded, selected],
  )
  const failedItems = useMemo(
    () => items.filter((i) => i.status === 'failed'),
    [items],
  )

  const canGenerate = prompts.some((p) => p.trim()) && !busy

  const retryOne = async (target: Item) => {
    const runningItem: Item = {
      ...target,
      status: 'running',
      errorMessage: undefined,
    }
    appendWorkspaceItems([runningItem])
    upsertItems([runningItem])

    try {
      const res = await generateImages({
        prompts: [target.prompt],
        model: target.model,
        referenceImages: referenceImages.map((img) => img.dataUrl),
      })
      const out = res.items[0]
      if (!out) throw new Error('Empty response')
      const nextItem: Item = {
        ...target,
        status: out.status,
        imageUrl: out.imageUrl,
        errorMessage: out.errorMessage,
        proxyUrl: toProxyUrl(out.imageUrl),
      }
      appendWorkspaceItems([nextItem])
      upsertItems([nextItem])
    } catch {
      const failedItem: Item = {
        ...target,
        status: 'failed',
        errorMessage: 'Generation failed',
      }
      appendWorkspaceItems([failedItem])
      upsertItems([failedItem])
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <PromptListEditor prompts={prompts} onChange={setPrompts} max={10} />
          <ModelSelector value={model} onChange={setModel} />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">参考图</div>
                    <div className="text-[11px] text-zinc-500">最多 4 张，单张建议不超过 4MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
                      referenceImages.length < 4
                        ? 'bg-white/10 text-zinc-200 hover:bg-white/15 hover:text-zinc-50'
                        : 'cursor-not-allowed bg-white/5 text-zinc-600',
                    )}
                    disabled={referenceImages.length >= 4}
                  >
                    <Upload className="h-4 w-4" />
                    上传
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (!files.length) return

                      const slots = Math.max(0, 4 - referenceImages.length)
                      const selectedFiles = files.slice(0, slots)
                      const loaded = await Promise.all(
                        selectedFiles.map(
                          (file) =>
                            new Promise<ReferenceImage | null>((resolve) => {
                              if (file.size > 4 * 1024 * 1024) {
                                resolve(null)
                                return
                              }
                              const reader = new FileReader()
                              reader.onload = () => {
                                const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                                if (!dataUrl) {
                                  resolve(null)
                                  return
                                }
                                resolve({
                                  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                  name: file.name,
                                  dataUrl,
                                })
                              }
                              reader.onerror = () => resolve(null)
                              reader.readAsDataURL(file)
                            }),
                        ),
                      )
                      setReferenceImages((prev) => [...prev, ...loaded.filter(Boolean) as ReferenceImage[]])
                      e.currentTarget.value = ''
                    }}
                  />
                </div>

                {referenceImages.length ? (
                  <div className="grid grid-cols-4 gap-2">
                    {referenceImages.map((img) => (
                      <div key={img.id} className="group relative overflow-hidden rounded-xl border border-white/10">
                        <img src={img.dataUrl} alt={img.name} className="aspect-square w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReferenceImages((prev) => prev.filter((x) => x.id !== img.id))}
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-zinc-200 transition hover:bg-black/80 hover:text-zinc-50"
                          aria-label="移除参考图"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-600">未上传参考图</div>
                )}
              </div>

              <button
                type="button"
                disabled={!canGenerate}
                onClick={async () => {
                  const normalized = prompts
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .slice(0, 10)
                  if (!normalized.length) return

                  const runId = `run_${Date.now()}`
                  setWorkspaceBusy(true)
                  setSelected({})

                  const running: Item[] = normalized.map((prompt, idx) => ({
                    id: `${runId}_${idx}`,
                    prompt,
                    model,
                    status: 'running',
                    createdAt: new Date().toISOString(),
                  }))
                  appendWorkspaceItems(running)

                  try {
                    const res = await generateImages({
                      prompts: normalized,
                      model,
                      referenceImages: referenceImages.map((img) => img.dataUrl),
                    })
                    const next: Item[] = res.items.map((it) => ({
                      ...it,
                      proxyUrl: toProxyUrl(it.imageUrl),
                    }))
                    replaceWorkspaceRun(runId, next)
                    upsertItems(next)
                  } catch {
                    const failed: Item[] = normalized.map((prompt, idx) => ({
                      id: `${runId}_failed_${idx}`,
                      prompt,
                      model,
                      status: 'failed',
                      errorMessage: 'Generation failed',
                      createdAt: new Date().toISOString(),
                    }))
                    replaceWorkspaceRun(runId, failed)
                    upsertItems(failed)
                  } finally {
                    setWorkspaceBusy(false)
                  }
                }}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  canGenerate
                    ? 'bg-emerald-300 text-zinc-950 hover:bg-emerald-200'
                    : 'cursor-not-allowed bg-white/10 text-zinc-500',
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                批量生成（最多10）
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedSucceeded.length}
                  onClick={async () => {
                    const zip = new JSZip()
                    const ts = new Date()
                    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
                    const namingRes = await generateNaming({
                      items: selectedSucceeded.map((it) => ({
                        id: it.id,
                        prompt: it.prompt,
                        imageUrl: it.proxyUrl || it.imageUrl,
                      })),
                    }).catch(() => ({ items: [] as { id: string; industry: string; style: string; color: string }[] }))
                    const namingMap = new Map(namingRes.items.map((i) => [i.id, i]))

                    await Promise.all(
                      selectedSucceeded.map(async (it, idx) => {
                        const url = it.proxyUrl || it.imageUrl
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
                    downloadBlob(zipped, `covers_${stamp}.zip`)
                  }}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                    selectedSucceeded.length
                      ? 'bg-white/10 text-zinc-50 hover:bg-white/15'
                      : 'cursor-not-allowed bg-white/5 text-zinc-600',
                  )}
                >
                  <Download className="h-4 w-4" />
                  批量下载（{selectedSucceeded.length}）
                </button>

                <button
                  type="button"
                  onClick={() => setSelected({})}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
                  aria-label="清空选择"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-500">
                下载通过 zip 打包；编辑与历史可在「图库」查看；可配合参考图进行生图
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-50">结果</div>
              <div className="text-xs text-zinc-400">
                点击卡片右下角进入编辑器；勾选后可批量下载
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {}
                for (const it of succeeded) next[it.id] = true
                setSelected(next)
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition',
                succeeded.length
                  ? 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
              disabled={!succeeded.length}
            >
              全选完成项
            </button>
            <button
              type="button"
              onClick={async () => {
                if (busy || !failedItems.length) return
                setWorkspaceBusy(true)
                try {
                  await Promise.all(failedItems.map((it) => retryOne(it)))
                } finally {
                  setWorkspaceBusy(false)
                }
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition',
                failedItems.length && !busy
                  ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
                  : 'cursor-not-allowed bg-white/5 text-zinc-600',
              )}
              disabled={!failedItems.length || busy}
            >
              一键重试失败项（{failedItems.length}）
            </button>
          </div>

          <ResultsGrid
            items={items}
            selected={selected}
            onToggle={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
            onOpen={(id) => navigate(`/editor/${id}`)}
            onRetry={async (id) => {
              if (busy) return
              const target = items.find((it) => it.id === id)
              if (!target || target.status !== 'failed') return
              setWorkspaceBusy(true)
              try {
                await retryOne(target)
              } finally {
                setWorkspaceBusy(false)
              }
            }}
            onCopyPrompt={async (prompt) => {
              try {
                await navigator.clipboard.writeText(prompt)
              } catch {
                // ignore clipboard permission errors
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
