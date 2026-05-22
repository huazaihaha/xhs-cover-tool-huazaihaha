import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import PromptListEditor from '@/components/PromptListEditor'
import PromptTemplateBuilder from '@/components/PromptTemplateBuilder'
import ModelSelector from '@/components/ModelSelector'
import GenerateParamsPanel from '@/components/GenerateParamsPanel'
import ResultsGrid from '@/components/ResultsGrid'
import { cn } from '@/lib/utils'
import { generateImages, generateNaming } from '@/utils/api'
import { buildCoverFilename, buildCoverFilenameByTags } from '@/utils/filename'
import type { GenerateResultItem, ModelName } from '../../shared/types'
import { useGalleryStore } from '@/store/useGalleryStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useGenerateSettingsStore } from '@/store/useGenerateSettingsStore'
import { Download, Loader2, Sparkles, Square, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Item = GenerateResultItem & { proxyUrl?: string; namingTags?: NamingTag }
type ReferenceImage = { id: string; name: string; dataUrl: string }
type NamingTag = { industry?: string; style?: string; color?: string }

const MAX_REFERENCE_IMAGES = 10

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const PUBLIC_BASE = import.meta.env.BASE_URL || '/'

function withApiBase(path: string) {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL}${path}`
}

function withPublicBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${PUBLIC_BASE}${normalizedPath}`
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
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 2000)
}

export default function Home() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const quota = useAuthStore((s) => s.quota)
  const setQuota = useAuthStore((s) => s.setQuota)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const size = useGenerateSettingsStore((s) => s.size)
  const quality = useGenerateSettingsStore((s) => s.quality)
  const upsertItems = useGalleryStore((s) => s.upsertItems)
  const items = useGalleryStore((s) => s.workspaceItems)
  const busy = useGalleryStore((s) => s.workspaceBusy)
  const appendWorkspaceItems = useGalleryStore((s) => s.appendWorkspaceItems)
  const replaceWorkspaceRun = useGalleryStore((s) => s.replaceWorkspaceRun)
  const setWorkspaceBusy = useGalleryStore((s) => s.setWorkspaceBusy)
  const setNamingTags = useGalleryStore((s) => s.setNamingTags)

  const [prompts, setPrompts] = useState<string[]>([''])

  // Listen for newly imported prompts from ArticleToImages
  useEffect(() => {
    const checkAndImportPrompts = (promptsToImport: string[]) => {
      if (Array.isArray(promptsToImport) && promptsToImport.length > 0) {
        setPrompts(prev => {
          // If the first input is empty, replace it. Otherwise append.
          if (prev.length === 1 && !prev[0].trim()) {
            return [...promptsToImport]
          }
          return [...prev, ...promptsToImport]
        })
      }
    }

    // 1. Check sessionStorage (handles cross-page navigation where Home wasn't mounted)
    const pendingImports = sessionStorage.getItem('pending-import-prompts')
    if (pendingImports) {
      try {
        checkAndImportPrompts(JSON.parse(pendingImports))
      } catch (e) {
        console.error('Failed to parse pending imports', e)
      }
      sessionStorage.removeItem('pending-import-prompts')
    }

    // 2. Listen to CustomEvent (handles case where Home is already mounted)
    const handleImportPrompts = (e: CustomEvent<string[]>) => {
      if (e.detail) checkAndImportPrompts(e.detail)
    }
    
    window.addEventListener('import-prompts' as any, handleImportPrompts as any)
    return () => {
      window.removeEventListener('import-prompts' as any, handleImportPrompts as any)
    }
  }, [])
  const [model, setModel] = useState<ModelName>('image2')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [quotaNotice, setQuotaNotice] = useState('')
  const [qrBroken, setQrBroken] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ src: string; prompt: string } | null>(null)
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
  const handleAuthExpired = () => {
    clearAuth()
    setQuotaNotice('登录已失效，请重新登录')
    navigate('/auth')
  }
  const openQuotaLimitModal = () => {
    setQuotaModalOpen(true)
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
    if (quota && quota.remaining < 1) {
      openQuotaLimitModal()
      return
    }
    const runningItem: Item = {
      ...target,
      status: 'running',
      errorMessage: undefined,
    }
    appendWorkspaceItems([runningItem])
    upsertItems([runningItem])

    try {
      setQuotaNotice('本次重试将消耗 1 次额度')
      const res = await generateImages({
        prompts: [target.prompt],
        model: target.model,
        size,
        quality,
        referenceImages: referenceImages.map((img) => img.dataUrl),
      }, undefined, token)
      if (!res.ok) {
        if (res.errorCode === 'AUTH_REQUIRED' || res.status === 401) {
          appendWorkspaceItems([target])
          upsertItems([target])
          handleAuthExpired()
          return
        }
        if (res.quota) setQuota(res.quota)
        if (res.errorCode === 'FREE_QUOTA_EXCEEDED' || res.errorCode === 'FREE_QUOTA_INSUFFICIENT') {
          openQuotaLimitModal()
          appendWorkspaceItems([target])
          upsertItems([target])
          return
        }
        throw new Error(res.message || '生成失败')
      }
      if (res.quota) {
        setQuota(res.quota)
        setQuotaNotice(`已消耗 1 次额度，当前剩余 ${res.quota.remaining}/${res.quota.limit}`)
      }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      const failedItem: Item = {
        ...target,
        status: 'failed',
        errorMessage: message,
      }
      appendWorkspaceItems([failedItem])
      upsertItems([failedItem])
    }
  }

  const addResultAsReference = async (id: string) => {
    const target = items.find((it) => it.id === id)
    if (!target || target.status !== 'succeeded') return
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
      setQuotaNotice(`参考图最多 ${MAX_REFERENCE_IMAGES} 张，请先移除后再添加`)
      return
    }
    const src = target.proxyUrl || target.imageUrl
    if (!src) return
    try {
      const resp = await fetch(src)
      if (!resp.ok) throw new Error('加载图片失败')
      const blob = await resp.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('读取图片失败'))
        reader.readAsDataURL(blob)
      })
      if (!dataUrl) throw new Error('图片格式不支持')
      setReferenceImages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: `结果图_${prev.length + 1}.png`,
          dataUrl,
        },
      ])
      setQuotaNotice('已添加为参考图，可继续生成')
    } catch {
      setQuotaNotice('添加参考图失败，请重试')
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
          <GenerateParamsPanel />
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
                      const inputEl = e.currentTarget
                      const files = Array.from(inputEl.files || [])
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
                      inputEl.value = ''
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
                  if (quota && quota.remaining < normalized.length) {
                    openQuotaLimitModal()
                    return
                  }

                  const runId = `run_${Date.now()}`
                  setQuotaNotice(`本次将消耗 ${normalized.length} 次额度`)
                  const controller = new AbortController()
                  activeRunRef.current = { runId, controller }
                  setWorkspaceBusy(true)
                  setSelected({})
                  setQuotaNotice('')

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
                      size,
                      quality,
                      referenceImages: referenceImages.map((img) => img.dataUrl),
                    }, controller.signal, token)
                    if (!res.ok) {
                      if (res.errorCode === 'AUTH_REQUIRED' || res.status === 401) {
                        replaceWorkspaceRun(runId, [])
                        handleAuthExpired()
                        return
                      }
                      if (res.quota) setQuota(res.quota)
                      if (res.errorCode === 'FREE_QUOTA_EXCEEDED' || res.errorCode === 'FREE_QUOTA_INSUFFICIENT') {
                        replaceWorkspaceRun(runId, [])
                        openQuotaLimitModal()
                        return
                      }
                      throw new Error(res.message || 'Generation failed')
                    }
                    if (res.quota) {
                      setQuota(res.quota)
                      setQuotaNotice(
                        `本次已消耗 ${normalized.length} 次额度，当前剩余 ${res.quota.remaining}/${res.quota.limit}`,
                      )
                    }
                    const next: Item[] = res.items.map((it) => ({
                      ...it,
                      proxyUrl: toProxyUrl(it.imageUrl),
                    }))
                    replaceWorkspaceRun(runId, next)
                    upsertItems(next)
                    void ensureNamingReady(next)
                  } catch (err) {
                    const stopped = controller.signal.aborted
                    const message = err instanceof Error ? err.message : 'Generation failed'
                    if (!stopped && message.includes('免费额度')) {
                      replaceWorkspaceRun(runId, [])
                      openQuotaLimitModal()
                      return
                    }
                    const failed: Item[] = normalized.map((prompt, idx) => ({
                      id: `${runId}_${idx}`,
                      prompt,
                      model,
                      status: 'failed',
                      errorMessage: stopped ? 'Stopped' : message,
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
                    const settled = await Promise.allSettled(
                      selectedSucceeded.map(async (it, idx) => {
                        const candidates = [it.proxyUrl, it.imageUrl].filter(Boolean) as string[]
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
                    const failedCount = settled.length - successCount
                    if (!successCount) {
                      setQuotaNotice('批量下载失败，请稍后重试')
                      return
                    }
                    const zipped = await zip.generateAsync({ type: 'blob' })
                    downloadBlob(zipped, `covers_${stamp}.zip`)
                    if (failedCount > 0) {
                      setQuotaNotice(`已下载 ${successCount} 张，${failedCount} 张下载失败`)
                    } else {
                      setQuotaNotice('')
                    }
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

          {quotaNotice ? (
            <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
              {quotaNotice}
            </div>
          ) : null}
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
            onPreview={(src, prompt) => setPreviewImage({ src, prompt })}
            onAddReference={addResultAsReference}
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
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl">
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
                aria-label="关闭弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            <PromptTemplateBuilder
              onGenerate={(generatedPrompts) => {
                setPrompts((prev) => [...prev, ...generatedPrompts])
                setTemplateModalOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}

      {quotaModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-200/25 bg-zinc-900/95 p-6 text-center shadow-[0_30px_100px_-40px_rgba(16,185,129,0.65)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(28rem_16rem_at_50%_-10%,rgba(16,185,129,0.24),transparent_70%),radial-gradient(24rem_14rem_at_100%_110%,rgba(59,130,246,0.18),transparent_70%)]" />
            <div className="relative">
              <div className="text-2xl font-bold text-zinc-50">本月可使用剩余额度不足</div>
              <div className="mt-3 text-sm leading-6 text-zinc-100/95">
                若你想购买更多使用额度，请微信扫码添加三白微信，获取更多使用额度。
              </div>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white p-3">
                {!qrBroken ? (
                  <img
                    src={withPublicBase('/wechat-qr.png')}
                    alt="三白微信二维码"
                    className="mx-auto w-full max-w-[280px] rounded-xl"
                    onError={() => setQrBroken(true)}
                  />
                ) : (
                  <div className="mx-auto flex h-[280px] w-full max-w-[280px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-600">
                    未检测到二维码图片，请将二维码文件放到 public/wechat-qr.png
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuotaModalOpen(false)}
              className="relative mt-5 inline-flex rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
            >
              我知道了
            </button>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
              aria-label="关闭预览"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.prompt}
              className="max-h-[78vh] w-full rounded-2xl object-contain"
            />
            <div className="mt-3 line-clamp-2 text-sm text-zinc-300">{previewImage.prompt}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
