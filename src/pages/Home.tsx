import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import PromptListEditor from '@/components/PromptListEditor'
import PromptTemplateBuilder from '@/components/PromptTemplateBuilder'
import ModelSelector from '@/components/ModelSelector'
import ResultsGrid from '@/components/ResultsGrid'
import { cn } from '@/lib/utils'
import { generateImages, generateNaming } from '@/utils/api'
import { buildCoverFilename, buildCoverFilenameByTags } from '@/utils/filename'
import type { GenerateResultItem, ModelName } from '../../shared/types'
import { useGalleryStore } from '@/store/useGalleryStore'
import { useAuthStore } from '@/store/useAuthStore'
import { Download, Loader2, Sparkles, Square, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Item = GenerateResultItem & { proxyUrl?: string; namingTags?: NamingTag }
type ReferenceImage = { id: string; name: string; dataUrl: string }
type NamingTag = { industry?: string; style?: string; color?: string }

const MAX_REFERENCE_IMAGES = 10

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
  const token = useAuthStore((s) => s.token)
  const upsertItems = useGalleryStore((s) => s.upsertItems)
  const items = useGalleryStore((s) => s.workspaceItems)
  const busy = useGalleryStore((s) => s.workspaceBusy)
  const appendWorkspaceItems = useGalleryStore((s) => s.appendWorkspaceItems)
  const replaceWorkspaceRun = useGalleryStore((s) => s.replaceWorkspaceRun)
  const setWorkspaceBusy = useGalleryStore((s) => s.setWorkspaceBusy)
  const setNamingTags = useGalleryStore((s) => s.setNamingTags)

  const [prompts, setPrompts] = useState<string[]>([''])
  const [model, setModel] = useState<ModelName>('image2')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeRunRef = useRef<{ runId: string; controller: AbortController } | null>(null)
  const namingInFlightRef = useRef(false)

  const succeeded = useMemo(
    () => items.filter((i) => i.status === 'succeeded' && (i.proxyUrl || i.imageUrl)),
    [items],
  )
  const selectedSucceeded = useMemo(
    () => succeeded.filter((i) => selected[i.id]),
    [succeeded, selected],
  )
  const allSucceededSelected = useMemo(
    () => !!succeeded.length && succeeded.every((i) => selected[i.id]),
    [succeeded, selected],
  )
  const failedItems = useMemo(
    () => items.filter((i) => i.status === 'failed'),
    [items],
  )
  const runningItems = useMemo(
    () => items.filter((i) => i.status === 'running'),
    [items],
  )

  const canGenerate = prompts.some((p) => p.trim()) && !busy
  const requireAuth = () => {
    if (token) return true
    navigate('/auth')
    return false
  }

  const ensureNamingReady = async (list: Item[]) => {
    const targets = list.filter(
      (it) => it.status === 'succeeded' && (it.proxyUrl || it.imageUrl) && !it.namingTags,
    )
    if (!targets.length || namingInFlightRef.current) return

    namingInFlightRef.current = true
    try {
      const namingRes = await generateNaming({
        items: targets.map((it) => ({
          id: it.id,
          prompt: it.prompt,
          imageUrl: it.proxyUrl || it.imageUrl,
        })),
      }).catch(() => ({ items: [] as Array<{ id: string; industry: string; style: string; color: string }> }))
      if (!namingRes.items.length) return
      setNamingTags(namingRes.items.map((it) => ({ id: it.id, namingTags: it })))
    } finally {
      namingInFlightRef.current = false
    }
  }

  useEffect(() => {
    if (busy && runningItems.length === 0) setWorkspaceBusy(false)
  }, [busy, runningItems.length, setWorkspaceBusy])

  useEffect(() => {
    void ensureNamingReady(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

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
      if (nextItem.status === 'succeeded') void ensureNamingReady([nextItem])
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
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_8%_-10%,rgba(16,185,129,0.15),transparent_60%),radial-gradient(50rem_26rem_at_92%_0%,rgba(59,130,246,0.13),transparent_60%)]" />
      <TopNav />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
        <aside
          className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:border-r lg:border-white/10 lg:pr-4 lg:[&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <PromptListEditor
            prompts={prompts}
            onChange={setPrompts}
            onOpenTemplateBuilder={() => setTemplateModalOpen(true)}
          />
          <div className="h-px bg-white/10" />
          <ModelSelector value={model} onChange={setModel} />
          <div className="h-px bg-white/10" />
          <div className="rounded-2xl bg-zinc-950/25 p-1">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-emerald-200">参考图</div>
                    <div className="text-[11px] text-zinc-100">最多 10 张，单张建议不超过 4MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireAuth()) return
                      fileInputRef.current?.click()
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition',
                      referenceImages.length < MAX_REFERENCE_IMAGES
                        ? 'bg-white/10 text-zinc-100 hover:bg-white/15 hover:text-zinc-50'
                        : 'cursor-not-allowed bg-white/5 text-zinc-600',
                    )}
                    disabled={referenceImages.length >= MAX_REFERENCE_IMAGES}
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

                      const slots = Math.max(0, MAX_REFERENCE_IMAGES - referenceImages.length)
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
                  <div className="grid grid-cols-5 gap-2">
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
                  <div className="text-[11px] text-zinc-100">未上传参考图</div>
                )}
              </div>

          <div className="h-px bg-white/10" />

          <button
                type="button"
                disabled={!canGenerate}
                onClick={async () => {
                  if (!requireAuth()) return
                  const normalized = prompts
                    .map((p) => p.trim())
                    .filter(Boolean)
                  if (!normalized.length) return

                  const runId = `run_${Date.now()}`
                  const controller = new AbortController()
                  activeRunRef.current = { runId, controller }
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
                    }, controller.signal)
                    const next: Item[] = res.items.map((it) => ({
                      ...it,
                      proxyUrl: toProxyUrl(it.imageUrl),
                    }))
                    replaceWorkspaceRun(runId, next)
                    upsertItems(next)
                    void ensureNamingReady(next)
                  } catch {
                    const stopped = controller.signal.aborted
                    const failed: Item[] = normalized.map((prompt, idx) => ({
                      id: `${runId}_${idx}`,
                      prompt,
                      model,
                      status: 'failed',
                      errorMessage: stopped ? 'Stopped' : 'Generation failed',
                      createdAt: new Date().toISOString(),
                    }))
                    replaceWorkspaceRun(runId, failed)
                    upsertItems(failed)
                  } finally {
                    if (activeRunRef.current?.runId === runId) activeRunRef.current = null
                    setWorkspaceBusy(false)
                  }
                }}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  canGenerate
                    ? 'bg-emerald-300 text-zinc-950 hover:bg-emerald-200'
                    : 'cursor-not-allowed bg-white/10 text-zinc-500',
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                批量生成
              </button>
          <button
                type="button"
                disabled={!busy}
                onClick={() => {
                  const active = activeRunRef.current
                  if (active) active.controller.abort()
                  const stopTargetIds = active
                    ? new Set(
                        items
                          .filter((it) => it.status === 'running' && it.id.startsWith(`${active.runId}_`))
                          .map((it) => it.id),
                      )
                    : new Set(items.filter((it) => it.status === 'running').map((it) => it.id))
                  const stoppedItems = items
                    .filter((it) => stopTargetIds.has(it.id))
                    .map((it) => ({
                      ...it,
                      status: 'failed' as const,
                      errorMessage: 'Stopped',
                    }))
                  if (stoppedItems.length) {
                    appendWorkspaceItems(stoppedItems)
                    upsertItems(stoppedItems)
                  }
                  activeRunRef.current = null
                  setWorkspaceBusy(false)
                }}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  busy
                    ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                    : 'cursor-not-allowed bg-white/5 text-zinc-600',
                )}
              >
                <Square className="h-4 w-4" />
                停止生成
              </button>

          <button
                type="button"
                disabled={!selectedSucceeded.length}
                onClick={async () => {
                    if (!requireAuth()) return
                    const zip = new JSZip()
                    const ts = new Date()
                    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`

                    await Promise.all(
                      selectedSucceeded.map(async (it, idx) => {
                        const url = it.proxyUrl || it.imageUrl
                        if (!url) return
                        const res = await fetch(url)
                        const blob = await res.blob()
                        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : 'bin'
                        const tags = it.namingTags as NamingTag | undefined
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
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  selectedSucceeded.length
                    ? 'bg-white/10 text-zinc-50 hover:bg-white/15'
                    : 'cursor-not-allowed bg-white/5 text-zinc-600',
                )}
              >
                <Download className="h-4 w-4" />
                批量下载（{selectedSucceeded.length}）
              </button>

        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <div className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-zinc-400">
              已选 {selectedSucceeded.length} 项
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected((prev) => {
                  const next = { ...prev }
                  if (allSucceededSelected) {
                    for (const it of succeeded) delete next[it.id]
                    return next
                  }
                  for (const it of succeeded) next[it.id] = true
                  return next
                })
              }}
              className={cn(
                'rounded-full border border-white/10 px-3 py-1.5 text-xs transition',
                succeeded.length
                  ? 'bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-transparent text-zinc-600',
              )}
              disabled={!succeeded.length}
            >
              {allSucceededSelected ? '取消全选' : '全选'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!requireAuth()) return
                if (busy || !failedItems.length) return
                setWorkspaceBusy(true)
                try {
                  await Promise.all(failedItems.map((it) => retryOne(it)))
                } finally {
                  setWorkspaceBusy(false)
                }
              }}
              className={cn(
                'rounded-full border border-white/10 px-3 py-1.5 text-xs transition',
                failedItems.length && !busy
                  ? 'bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-zinc-50'
                  : 'cursor-not-allowed bg-transparent text-zinc-600',
              )}
              disabled={!failedItems.length || busy}
            >
              一键重试
            </button>
          </div>

          <ResultsGrid
            items={items}
            selected={selected}
            onToggle={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
            onOpen={(id) => navigate(`/editor/${id}`)}
            onRetry={async (id) => {
              if (!requireAuth()) return
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

      {templateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-50">批量设置提示词</div>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
                aria-label="关闭弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PromptTemplateBuilder
              onGenerate={(generatedPrompts) => {
                setPrompts((prev) => [...prev, ...generatedPrompts])
                setTemplateModalOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
