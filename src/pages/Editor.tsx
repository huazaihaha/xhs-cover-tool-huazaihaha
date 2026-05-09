import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '@/components/TopNav'
import CanvasEditor from '@/components/CanvasEditor'
import { useGalleryStore } from '@/store/useGalleryStore'
import { ArrowLeft } from 'lucide-react'

export default function Editor() {
  const navigate = useNavigate()
  const { id } = useParams()

  const item = useGalleryStore(
    (s) => s.items.find((i) => i.id === id) || null,
  )
  const setEditedUrl = useGalleryStore((s) => s.setEditedUrl)

  const imageUrl = useMemo(() => {
    if (!item) return null
    return item.imageUrl || item.proxyUrl || null
  }, [item])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="text-xs text-zinc-500">
            {item ? item.model : ''} · {item ? new Date(item.createdAt).toLocaleString() : ''}
          </div>
        </div>

        {!item || !imageUrl ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">
            找不到这张图片的记录，请回到工作台重新生成
          </div>
        ) : (
          <CanvasEditor
            imageUrl={imageUrl}
            defaultText={item.prompt}
            onExport={(dataUrl) => {
              setEditedUrl(item.id, dataUrl)
              navigate('/library')
            }}
          />
        )}
      </div>
    </div>
  )
}
