import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox } from 'fabric'
import { cn } from '@/lib/utils'
import { AlignCenter, AlignLeft, AlignRight, Download, Type } from 'lucide-react'

type Props = {
  imageUrl: string
  defaultText?: string
  onExport: (dataUrl: string) => void
}

const CANVAS_W = 1080
const CANVAS_H = 1440

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export default function CanvasEditor({ imageUrl, defaultText, onExport }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)

  const [textColor, setTextColor] = useState('#ffffff')
  const [textSize, setTextSize] = useState(88)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')

  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return

    const c = new Canvas(el, {
      width: CANVAS_W,
      height: CANVAS_H,
      preserveObjectStacking: true,
      selection: true,
    })
    fabricRef.current = c

    const load = async () => {
      const img = await FabricImage.fromURL(imageUrl)
      img.set({ selectable: false, evented: false })

      const scale = Math.max(CANVAS_W / img.width!, CANVAS_H / img.height!)
      img.scale(scale)
      img.set({
        left: (CANVAS_W - img.getScaledWidth()) / 2,
        top: (CANVAS_H - img.getScaledHeight()) / 2,
      })
      c.add(img)
      c.sendObjectToBack(img)
      c.requestRenderAll()
    }

    load()

    return () => {
      c.dispose()
      fabricRef.current = null
    }
  }, [imageUrl])

  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    const active = c.getActiveObject()
    if (!active || !(active instanceof Textbox)) return
    active.set({ fill: textColor, fontSize: textSize, textAlign })
    c.requestRenderAll()
  }, [textColor, textSize, textAlign])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-3">
        <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-xl border border-white/10 bg-black">
          <div className="aspect-[3/4] w-full">
            <canvas
              ref={canvasElRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="h-full w-full"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <div className="text-sm font-semibold text-zinc-50">编辑</div>
          <div className="text-xs text-zinc-400">选中元素后可调颜色/字号/对齐</div>
        </div>

        <button
          type="button"
          onClick={() => {
            const c = fabricRef.current
            if (!c) return
            const tb = new Textbox(defaultText || '标题', {
              left: 120,
              top: 140,
              width: CANVAS_W - 240,
              fill: textColor,
              fontSize: textSize,
              fontWeight: 700,
              textAlign,
              splitByGrapheme: true,
            })
            c.add(tb)
            c.setActiveObject(tb)
            c.requestRenderAll()
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:bg-white/15"
        >
          <Type className="h-4 w-4" />
          添加文字
        </button>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
            <div className="text-xs text-zinc-400">文字颜色</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-9 overflow-hidden rounded-xl border border-white/10 bg-transparent p-0"
              />
              <input
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/10 bg-transparent px-3 text-xs text-zinc-200 outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
            <div className="text-xs text-zinc-400">字号</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={24}
                max={160}
                value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                className="w-full accent-emerald-300"
              />
              <div className="w-10 text-right text-xs text-zinc-200">{textSize}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
          <div className="text-xs text-zinc-400">对齐</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['left', 'center', 'right'] as const).map((v) => {
              const active = v === textAlign
              const Icon = v === 'left' ? AlignLeft : v === 'right' ? AlignRight : AlignCenter
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTextAlign(v)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition',
                    active
                      ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const c = fabricRef.current
              if (!c) return
              const dataUrl = c.toDataURL({ format: 'png', multiplier: 1 })
              onExport(dataUrl)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
          >
            <Download className="h-4 w-4" />
            保存到图库
          </button>

          <button
            type="button"
            onClick={() => {
              const c = fabricRef.current
              if (!c) return
              const dataUrl = c.toDataURL({ format: 'png', multiplier: 1 })
              downloadDataUrl(dataUrl, 'cover.png')
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:bg-white/15"
          >
            <Download className="h-4 w-4" />
            导出
          </button>
        </div>
      </div>
    </div>
  )
}
