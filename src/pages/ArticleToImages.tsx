import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import TopNav from '@/components/TopNav'
import { cn } from '@/lib/utils'
import { generateArticleSlices } from '@/utils/api'
import type { SlicePrompt } from '../../shared/types'
import { useGalleryStore } from '@/store/useGalleryStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Upload,
  Sparkles,
  ArrowRight,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  AlertCircle,
  Settings2,
  Wand2,
  ChevronLeft,
  Settings,
  Save,
  Clock,
  History,
  Terminal
} from 'lucide-react'

type LogEntry = {
  id: string
  type: 'request' | 'response' | 'error' | 'info'
  title: string
  content: string
  timestamp: Date
}

const STORAGE_KEY = 'article-slicer-template-v2'
const TEMPLATES_HISTORY_KEY = 'article-slicer-templates-history-v1'
const SLICER_HISTORY_KEY = 'article-slicer-generation-history-v1'

const SCENARIOS = [
  '小红书种草图文配图',
  '短视频分镜',
  '公众号文章插图',
  '网站配图',
  '故事绘本',
  '通用配图'
]

const ASPECT_RATIOS = [
  '3:4',
  '9:16',
  '4:3',
  '16:9',
  '1:1',
  'auto'
]

const DEFAULT_TEMPLATE = `***Role***
你是一个顶尖的视觉策划与 AI 生图提示词生成专家。你擅长从大段文本中提取核心视觉元素，并将其转化为极具吸引力、能准确传达信息且具备“种草感”的配图。

***Task***
基于用户输入的【参考稿件】，结合用户指定的【应用场景】与【所需数量】，策划出具有连贯性、强图文关联的多张静态配图，并输出可直接用于 AI 绘图模型（如 DALL·E 3/GPT-image、Midjourney 等）的高质量中文提示词。

***Work_Flow (策划思考工作流)***
在生成提示词前，请在后台（内部静默执行，绝对不要输出任何思考过程或解释性文字）完成以下思考：

1. **稿件拆解**：将【参考稿件】按逻辑拆分成与【所需数量】相匹配的 N 个核心段落/要点。
2. **视觉赋能**：分析每个段落的文字，思考“用什么静态画面能直观地展示、解释或种草这段文字的内容？”（例如：文稿讲成分，配图则是通透质地的产品特写；文稿讲痛点，配图则是引发共鸣的真实生活场景）。
3. **统一风格设定**：根据【应用场景】，确定全局统一的静态美学风格（如：小红书的冷白皮氛围感摄影、扁平化插画、极简 3D 渲染等），确保生成的 N 张图风格连贯，像是一套完整的视觉配图。

***输出内容规范 (核心要求)***
你必须严格按照【所需数量】（若用户未指定，默认生成 4 张）输出对应的纯中文生图提示词。
**重要限制**：最终输出结果中，**只能包含纯中文的生图提示词**。严禁输出任何配图编号、匹配文案、原理解析、说明性文字或前缀问候语。

每一张图的提示词必须遵循以下要求：

1. **纯中文 Prompt**：
   - 必须是可直接喂给主流 AI 生图模型的中文提示词。
   - **结构公式**：\`[核心主体与具体表现] + [与文稿相关的场景/环境] + [画面情绪/氛围感] + [全局美学风格/材质] + [光影/色调] + [图片尺寸参数]\`。
   - **细节要求**：重在静态画面的内容呈现，必须与文稿内容强相关。具有强烈的画面感，禁用抽象词，必须转化为具体的视觉元素（比如把“很有效”转化为“特写镜头下，皮肤光滑透亮，对比明显”）。
2. **格式规范**：每一张图的中文提示词独立占一行（或一个段落），多张图的提示词之间用空行隔开。

***全局约束与防翻车指南***

1. **绝对禁止漏图**：用户输入的【所需数量】是硬性指标！如果是 5 张，必须输出 5 段独立的中文提示词，绝不允许只输出 1 张或合并输出。
2. **避免重复**：每一段提示词的主体展示角度或场景必须有明显变化（如：图1是带氛围感的环境图，图2是产品/元素的特写图，图3是人物使用场景图），确保多张配图能覆盖稿件的不同信息维度。
3. **参数植入**：必须在每段中文 Prompt 的最后，自动加上与场景匹配的图片尺寸参数（如 \`--ar 3:4\` 或 \`--ar 16:9\`）。`

type ParsedContent = {
  text: string
  fileName?: string
  fileType?: string
}

type TemplateRecord = {
  id: string
  name: string
  content: string
  updatedAt: number
}

type SlicerHistoryRecord = {
  id: string
  timestamp: number
  sourceContent: string
  slices: SlicePrompt[]
  scenario: string
  aspectRatio: string
  sliceCount: number
}

async function parseDocument(file: File): Promise<ParsedContent> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (extension === 'txt' || extension === 'md') {
    const text = await file.text()
    return { text, fileName: file.name, fileType: 'text' }
  }
  
  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const text = await extractTextFromPDF(arrayBuffer)
    return { text, fileName: file.name, fileType: 'PDF' }
  }
  
  if (extension === 'docx' || extension === 'doc') {
    const arrayBuffer = await file.arrayBuffer()
    const text = await extractTextFromDocx(arrayBuffer)
    return { text, fileName: file.name, fileType: 'Word' }
  }
  
  const text = await file.text()
  return { text, fileName: file.name, fileType: 'text' }
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer)
    const textParts: string[] = []
    
    const textDecoder = new TextDecoder('utf-8', { fatal: false })
    const text = textDecoder.decode(uint8Array)
    
    const contentMatch = text.match(/stream[\s\S]*?endstream/i)
    if (contentMatch) {
      const streamContent = contentMatch[0]
        .replace(/stream[\s\S]*?endstream/i, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      const bracketMatches = streamContent.match(/\(([^)]+)\)/g)
      if (bracketMatches) {
        for (const match of bracketMatches) {
          const innerText = match.slice(1, -1)
          if (innerText.length > 2 && /[\u4e00-\u9fa5]/.test(innerText)) {
            textParts.push(innerText)
          }
        }
      }
    }
    
    if (textParts.length === 0) {
      const rawText = text
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      const sentences = rawText.match(/[^.!?。！？]{10,}[.!?。！？]?/g) || []
      textParts.push(...sentences.slice(0, 100))
    }
    
    return textParts.join('\n')
  } catch (error) {
    console.error('PDF extraction error:', error)
    return ''
  }
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const docXml = zip.file('word/document.xml')
    if (!docXml) {
      throw new Error('Invalid DOCX file: word/document.xml not found')
    }
    
    const text = await docXml.async('string')
    const textParts: string[] = []
    
    // Extract text from <w:t> tags
    const wTextMatches = text.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
    if (wTextMatches) {
      for (const match of wTextMatches) {
        const content = match.replace(/<[^>]+>/g, '').trim()
        if (content && content.length > 0) {
          textParts.push(content)
        }
      }
    }
    
    if (textParts.length === 0) {
      const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return plainText
    }
    
    // Group paragraphs somewhat reasonably by adding newlines
    return textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch (error) {
    console.error('DOCX extraction error:', error)
    return ''
  }
}

export default function ArticleToImages() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [content, setContent] = useState('')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [sliceCount, setSliceCount] = useState(4)
  const [scenario, setScenario] = useState(SCENARIOS[0])
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0])
  
  const [slices, setSlices] = useState<SlicePrompt[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsedFile, setParsedFile] = useState<ParsedContent | null>(null)
  
  // View State: 'input' | 'results'
  const [viewState, setViewState] = useState<'input' | 'results'>('input')
  // Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<TemplateRecord[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  
  // Slicer Generation History State
  const [slicerHistory, setSlicerHistory] = useState<SlicerHistoryRecord[]>([])
  
  // Debug Log State
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([])
  const [isDebugOpen, setIsDebugOpen] = useState(false)
  const debugLogsRef = useRef<HTMLDivElement>(null)
  
  const addLog = (type: LogEntry['type'], title: string, content: string) => {
    const entry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      content,
      timestamp: new Date()
    }
    setDebugLogs(prev => [...prev, entry])
    // Also log to console
    if (type === 'error') {
      console.error(`[DEBUG ${title}]`, content)
    } else {
      console.log(`[DEBUG ${title}]`, content)
    }
  }
  
  useEffect(() => {
    if (debugLogsRef.current) {
      debugLogsRef.current.scrollTop = debugLogsRef.current.scrollHeight
    }
  }, [debugLogs])
  
  const appendWorkspaceItems = useGalleryStore((s) => s.appendWorkspaceItems)
  const token = useAuthStore((s) => s.token)
  
  const requireAuth = () => {
    if (token) return true
    navigate('/auth')
    return false
  }
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.template) setTemplate(parsed.template)
        if (parsed.sliceCount) setSliceCount(parsed.sliceCount)
      }
    } catch {
      // ignore
    }
    
    try {
      const history = localStorage.getItem(TEMPLATES_HISTORY_KEY)
      if (history) {
        setSavedTemplates(JSON.parse(history))
      }
    } catch {
      // ignore
    }

    try {
      const genHistory = localStorage.getItem(SLICER_HISTORY_KEY)
      if (genHistory) {
        setSlicerHistory(JSON.parse(genHistory))
      }
    } catch {
      // ignore
    }
  }, [])
  
  useEffect(() => {
    if (template || sliceCount) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ template, sliceCount }),
      )
    }
  }, [template, sliceCount])
  
  useEffect(() => {
    if (savedTemplates.length > 0) {
      localStorage.setItem(TEMPLATES_HISTORY_KEY, JSON.stringify(savedTemplates))
    }
  }, [savedTemplates])

  const handleSaveTemplate = () => {
    const currentTrimmed = template.trim()
    if (!currentTrimmed) return

    setIsTemplateModalOpen(false)

    // Check if it's the same as the latest one or default
    if (currentTrimmed === DEFAULT_TEMPLATE.trim()) return
    if (savedTemplates.length > 0 && savedTemplates[0].content === currentTrimmed) return

    const newRecord: TemplateRecord = {
      id: Date.now().toString(),
      name: `模板 ${new Date().toLocaleString()}`,
      content: currentTrimmed,
      updatedAt: Date.now()
    }
    
    setSavedTemplates(prev => {
      // Keep only last 20 records to prevent localstorage bloat
      const newHistory = [newRecord, ...prev].slice(0, 20)
      return newHistory
    })
  }
  
  const handleDeleteTemplate = (id: string) => {
    setSavedTemplates(prev => prev.filter(t => t.id !== id))
    if (savedTemplates.length === 1) {
      localStorage.removeItem(TEMPLATES_HISTORY_KEY)
    }
  }
  
  const canGenerate = content.trim().length >= 50 && template.trim().length >= 10
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setError('')
      const parsed = await parseDocument(file)
      
      if (!parsed.text || parsed.text.trim().length < 50) {
        setError('文档内容太少，至少需要50个字符')
        return
      }
      
      setContent(parsed.text)
      setParsedFile(parsed)
    } catch (err) {
      setError('文档解析失败，请尝试手动粘贴内容')
      console.error('File upload error:', err)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const handleGenerate = async () => {
    if (!canGenerate) return
    if (!requireAuth()) return
    
    setLoading(true)
    setError('')
    setSlices([])
    setViewState('results')
    
    const formattedContent = `【应用场景】：${scenario}
【所需数量】：${sliceCount}
【图片尺寸】：${aspectRatio}
【参考稿件】：
${content.trim()}`

    addLog('info', '开始生成', `场景: ${scenario}, 尺寸: ${aspectRatio}, 数量: ${sliceCount}`)
    addLog('request', '提交给模型的请求', formattedContent)

    try {
      const result = await generateArticleSlices({
        content: formattedContent,
        template: template.trim(),
        count: sliceCount,
      })
      
      addLog('response', '模型原始响应', JSON.stringify(result, null, 2))
      
      if (!result.success) {
        setError(result.error || '生成失败')
        addLog('error', '生成失败', result.error || '未知错误')
        return
      }
      
      if (result.slices.length === 0) {
        setError('未生成有效的提示词，请调整模板后重试')
        addLog('error', '无效结果', '模型返回了0条提示词')
        return
      }
      
      addLog('info', '解析成功', `生成了 ${result.slices.length} 条提示词`)
      
      setSlices(result.slices)
      
      // Save to generation history
      const newRecord: SlicerHistoryRecord = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        sourceContent: content.trim(),
        slices: result.slices,
        scenario,
        aspectRatio,
        sliceCount
      }
      setSlicerHistory(prev => {
        const updated = [newRecord, ...prev].slice(0, 20) // Keep last 20
        localStorage.setItem(SLICER_HISTORY_KEY, JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      setError('生成切片提示词失败，请稍后重试')
      const errMsg = err instanceof Error ? err.message : String(err)
      addLog('error', '请求异常', errMsg)
      console.error('Generate slices error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleEditSlice = (slice: SlicePrompt) => {
    setEditingId(slice.id)
    setEditingContent(slice.content)
  }
  
  const handleSaveEdit = () => {
    if (!editingId || !editingContent.trim()) return
    
    setSlices((prev) =>
      prev.map((s) =>
        s.id === editingId ? { ...s, content: editingContent.trim() } : s,
      ),
    )
    setEditingId(null)
    setEditingContent('')
  }
  
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingContent('')
  }
  
  const handleDeleteSlice = (id: string) => {
    setSlices((prev) => prev.filter((s) => s.id !== id))
  }
  
  const handleGoToWorkspace = () => {
    if (slices.length === 0) return
    if (!requireAuth()) return
    
    const prompts = slices.map((s) => s.content)
    
    // Instead of appending directly to workspaceItems (which puts them in the results grid),
    // we use sessionStorage to pass the prompts since the Home component might not be mounted yet
    sessionStorage.setItem('pending-import-prompts', JSON.stringify(prompts))
    
    // Also dispatch custom event in case it's already mounted
    const event = new CustomEvent('import-prompts', { detail: prompts })
    window.dispatchEvent(event)
    
    navigate('/')
  }

  const handleRestoreSlicerHistory = (record: SlicerHistoryRecord) => {
    setContent(record.sourceContent)
    setScenario(record.scenario)
    setAspectRatio(record.aspectRatio)
    setSliceCount(record.sliceCount)
    setSlices(record.slices)
    setViewState('results')
  }

  const handleDeleteSlicerHistory = (id: string) => {
    setSlicerHistory(prev => {
      const updated = prev.filter(r => r.id !== id)
      if (updated.length === 0) {
        localStorage.removeItem(SLICER_HISTORY_KEY)
      } else {
        localStorage.setItem(SLICER_HISTORY_KEY, JSON.stringify(updated))
      }
      return updated
    })
  }
  
  const contentLength = content.trim().length
  const isValidContent = contentLength >= 50
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 flex flex-col">
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/10 via-zinc-950 to-zinc-950"></div>
      
      <TopNav />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 relative overflow-x-hidden w-full">
        
        {/* =========================================
            VIEW: INPUT (Step 1)
            ========================================= */}
        {viewState === 'input' && (
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
            {/* Header */}
            <div className="text-center mb-10 space-y-4 w-full relative">
              <div className="flex items-center justify-center gap-4">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900/50 border border-white/5 shadow-2xl shadow-emerald-500/10">
                  <Sparkles className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-50">一稿多图智能解析</h1>
              </div>
              <p className="text-base lg:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mt-4">
                输入你的文稿或者导入文档，AI 将为该内容深度解析，批量生成多个策划分镜或配图的提示词，随后无缝衔接批量生图。
              </p>
            </div>

            {/* Main Input Area */}
            <div className="w-full relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative flex flex-col bg-zinc-900/70 backdrop-blur-2xl rounded-[28px] border border-white/20 overflow-hidden shadow-2xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all duration-300">
                
                {/* File Upload Indicator */}
                {parsedFile && (
                  <div className="flex items-center justify-between bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                        <FileText className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-100">{parsedFile.fileName}</div>
                        <div className="text-xs text-emerald-400/70">{parsedFile.fileType} 文档解析成功</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setContent('')
                        setParsedFile(null)
                      }}
                      className="rounded-full p-2 text-emerald-400/50 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    setParsedFile(null)
                  }}
                  placeholder="在此粘贴你的文章、故事或脚本文案..."
                  className="w-full min-h-[320px] resize-none bg-transparent px-8 py-8 text-lg leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none scrollbar-hide"
                />

                {/* Bottom Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-zinc-900/50 border-t border-white/5">
                  <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 sm:pb-0 scrollbar-hide">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.pdf,.docx,.doc"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors shrink-0"
                    >
                      <Upload className="h-4 w-4 text-emerald-400" />
                      导入文档
                    </button>

                    <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block shrink-0" />

                    <div className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/5 px-3 py-2 shrink-0">
                      <select
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        className="bg-transparent text-zinc-300 outline-none text-sm font-medium cursor-pointer"
                      >
                        {SCENARIOS.map(s => <option key={s} value={s} className="bg-zinc-900 text-zinc-200">{s}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/5 px-3 py-2 shrink-0">
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="bg-transparent text-zinc-300 outline-none text-sm font-medium cursor-pointer"
                      >
                        {ASPECT_RATIOS.map(s => <option key={s} value={s} className="bg-zinc-900 text-zinc-200">{s}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/5 px-3 py-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={sliceCount}
                        onChange={(e) => setSliceCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-12 bg-transparent text-center text-sm font-medium text-emerald-400 outline-none"
                      />
                      <span className="text-xs text-zinc-500 whitespace-nowrap">张配图</span>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block shrink-0" />

                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors shrink-0"
                    >
                      <Settings className="h-4 w-4 text-emerald-400" />
                      自定义切片生成提示词
                    </button>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                    {contentLength > 0 && (
                      <span className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-lg",
                        isValidContent ? "text-zinc-500" : "text-amber-400 bg-amber-400/10"
                      )}>
                        {isValidContent ? `${contentLength} 字` : `还需 ${50 - contentLength} 字`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-8 w-full max-w-md">
              <button
                type="button"
                disabled={!canGenerate || loading}
                onClick={handleGenerate}
                className={cn(
                  'group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] px-8 py-5 text-lg font-bold transition-all duration-300',
                  canGenerate && !loading
                    ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(52,211,153,0.4)] hover:shadow-[0_0_60px_-15px_rgba(52,211,153,0.6)]'
                    : 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed border border-white/5'
                )}
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Wand2 className="h-6 w-6 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                )}
                <span>{loading ? '正在深度解析...' : '开始智能提取切片'}</span>
              </button>
            </div>

            {/* Inline Generation History */}
            {slicerHistory.length > 0 && (
              <div className="w-full mt-16 flex flex-col animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-6 px-2">
                  <History className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-zinc-100">历史生成记录</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {slicerHistory.map((record) => (
                    <div
                      key={record.id}
                      onClick={() => handleRestoreSlicerHistory(record)}
                      className="group cursor-pointer rounded-2xl bg-zinc-900/40 border border-white/10 p-5 hover:bg-zinc-800/80 hover:border-emerald-500/40 transition-all shadow-sm hover:shadow-emerald-500/10"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            {record.scenario}
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-white/5 text-zinc-300 text-xs font-medium border border-white/10">
                            {record.aspectRatio}
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-white/5 text-zinc-300 text-xs font-medium border border-white/10">
                            {record.sliceCount} 张配图
                          </span>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          <span className="text-xs text-zinc-500 font-medium">
                            {new Date(record.timestamp).toLocaleString()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSlicerHistory(record.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-colors p-1.5 rounded-md hover:bg-white/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                        {record.sourceContent}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================
            VIEW: RESULTS (Step 2)
            ========================================= */}
        {viewState === 'results' && (
          <div className="w-full max-w-5xl mx-auto flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setViewState('input')}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3">
                    解析结果
                    {!loading && !error && slices.length > 0 && (
                      <span className="flex h-6 items-center justify-center rounded-full bg-emerald-500/20 px-3 text-sm text-emerald-400 border border-emerald-500/20">
                        {slices.length} 个切片
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    你可以直接点击编辑内容，确认无误后批量导入生图工作台。
                  </p>
                </div>
              </div>
              
              {!loading && !error && slices.length > 0 && (
                <button
                  type="button"
                  onClick={handleGoToWorkspace}
                  className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition-transform active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                >
                  导入提示词后批量生图
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}
            </div>

            {/* Results Container */}
            <div className="flex-1 overflow-y-auto pr-2 pb-20 scrollbar-hide">
              {error && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 mb-6">
                    <AlertCircle className="h-10 w-10 text-rose-400" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-200 mb-2">解析失败</h3>
                  <p className="text-zinc-500 max-w-md text-center">{error}</p>
                  <button
                    onClick={() => {
                      setError('')
                      setViewState('input')
                    }}
                    className="mt-8 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                  >
                    返回重试
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="relative flex h-24 w-24 items-center justify-center mb-8">
                    <div className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-500/20" />
                    <div className="absolute inset-2 animate-pulse rounded-full border-2 border-emerald-400/40" />
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-200 mb-2">正在进行语义切割与画面重构</h3>
                  <p className="text-zinc-500">正在调用大模型提炼核心情节...</p>
                </div>
              )}

              {!loading && !error && slices.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {slices.map((slice, idx) => (
                    <div
                      key={slice.id}
                      className="group relative flex flex-col overflow-hidden rounded-[24px] border border-white/5 bg-zinc-900/40 p-6 transition-all hover:bg-zinc-900/80 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 backdrop-blur-md"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                            {idx + 1}
                          </div>
                          {editingId !== slice.id && (
                            <span className="text-xs text-emerald-400/0 group-hover:text-emerald-400/60 transition-colors flex items-center gap-1">
                              <Edit3 className="h-3 w-3" /> 点击修改
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSlice(slice.id)
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {editingId === slice.id ? (
                        <div className="flex-1 flex flex-col animate-in fade-in duration-200">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="flex-1 w-full resize-none rounded-xl border border-emerald-500/40 bg-black/40 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none focus:border-emerald-400 focus:bg-black/60 transition-all min-h-[120px]"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2 mt-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelEdit()
                              }}
                              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSaveEdit()
                              }}
                              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                            >
                              保存修改
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="flex-1 cursor-text rounded-xl p-3 -mx-3 hover:bg-white/5 transition-colors"
                          onClick={() => handleEditSlice(slice)}
                        >
                          <p className="text-base leading-relaxed text-zinc-300 font-medium">
                            {slice.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
    </div>

    {/* Debug Log Panel */}
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsDebugOpen(!isDebugOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all shadow-lg",
          isDebugOpen 
            ? "bg-emerald-500 text-white" 
            : "bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 border border-white/10 backdrop-blur-md"
        )}
      >
        <Terminal className="h-4 w-4" />
        {debugLogs.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
            {debugLogs.length}
          </span>
        )}
      </button>
      
      {isDebugOpen && (
        <div className="absolute bottom-14 right-0 w-[600px] max-h-[500px] bg-zinc-950/95 border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50 shrink-0">
            <span className="text-sm font-semibold text-zinc-200">调试日志</span>
            <button
              onClick={() => setDebugLogs([])}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              清空
            </button>
          </div>
          <div 
            ref={debugLogsRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs"
          >
            {debugLogs.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">暂无日志</div>
            ) : (
              debugLogs.map((log) => (
                <div 
                  key={log.id}
                  className={cn(
                    "rounded-lg p-3 border",
                    log.type === 'request' && "bg-blue-500/10 border-blue-500/20",
                    log.type === 'response' && "bg-green-500/10 border-green-500/20",
                    log.type === 'error' && "bg-red-500/10 border-red-500/20",
                    log.type === 'info' && "bg-zinc-800/50 border-white/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "font-semibold",
                      log.type === 'request' && "text-blue-400",
                      log.type === 'response' && "text-green-400",
                      log.type === 'error' && "text-red-400",
                      log.type === 'info' && "text-zinc-400"
                    )}>
                      {log.title}
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all text-zinc-300 leading-relaxed max-h-[200px] overflow-y-auto">
                    {log.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>

    {/* =========================================
        MODAL: TEMPLATE CONFIG
        ========================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSaveTemplate} />
          <div className="relative w-full max-w-4xl bg-zinc-950 rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[900px]">
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-zinc-900/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Settings2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">自定义切片生成提示词</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">定制 AI 解析文本时的系统级提示词规则</p>
                </div>
              </div>
              <button
                onClick={handleSaveTemplate}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full h-full resize-none p-8 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none bg-black/20"
                placeholder="输入指导 AI 生成提示词的规则..."
              />

              {/* History Overlay Drawer */}
              {isHistoryOpen && (
                <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-end p-4">
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="关闭"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
                    {savedTemplates.length === 0 ? (
                      <div className="text-center py-12 text-sm text-zinc-500">
                        暂无历史记录。当你修改并保存模板后，系统会自动记录。
                      </div>
                    ) : (
                      savedTemplates.map((t) => (
                        <div
                          key={t.id}
                          className="group relative flex flex-col gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 p-4 transition-colors cursor-pointer"
                          onClick={() => {
                            setTemplate(t.content)
                            setIsHistoryOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-emerald-400/80">{t.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(t.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-all rounded-md hover:bg-white/5"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-sm text-zinc-300 line-clamp-2">{t.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t border-white/5 bg-zinc-900/30">
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      返回编辑
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-8 py-5 border-t border-white/5 bg-zinc-900/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTemplate(DEFAULT_TEMPLATE)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  恢复默认
                </button>
                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    isHistoryOpen ? "bg-emerald-500/20 text-emerald-300" : "text-emerald-400 hover:bg-emerald-500/10"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  历史记录
                </button>
              </div>
              <button
                onClick={handleSaveTemplate}
                className="px-8 py-2.5 rounded-xl bg-emerald-400 text-emerald-950 text-sm font-bold hover:bg-emerald-300 transition-colors shadow-lg shadow-emerald-500/20"
              >
                确认并保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
