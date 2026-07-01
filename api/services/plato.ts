import pLimit from 'p-limit'
import { Agent } from 'undici'

const platoAgent = new Agent({
  headersTimeout: Number(process.env.PLATO_REQUEST_TIMEOUT_MS) || 90_000,
  bodyTimeout: Number(process.env.PLATO_REQUEST_TIMEOUT_MS) || 90_000,
  connectTimeout: 15_000,
})

type PlatoAuthMode = 'x-api-key' | 'authorization' | 'both'

type PlatoGenerateOptions = {
  prompt: string
  model: string
  size?: string
  quality?: string
  images?: string[]
  async?: boolean
}

type PlatoGenerateOutput = {
  url?: string
  b64_json?: string
}

function getBaseUrl() {
  const raw = process.env.PLATO_BASE_URL
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

function getAuthHeaders() {
  const apiKey = process.env.PLATO_API_KEY
  if (!apiKey) return null
  const mode = (process.env.PLATO_AUTH_MODE || 'x-api-key') as PlatoAuthMode
  if (mode === 'authorization') return { Authorization: `Bearer ${apiKey}` }
  if (mode === 'both') return { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey }
  return { 'x-api-key': apiKey }
}

function getGenerationsPath() {
  return process.env.PLATO_GENERATIONS_PATH || '/v1/images/generations'
}

function getTasksPathPrefix() {
  return process.env.PLATO_TASKS_PATH_PREFIX || '/v1/images/tasks'
}

async function requestJson(url: string, init: RequestInit) {
  console.log(`[plato] ${init.method || 'GET'} ${url}`)
  const res = await fetch(url, { ...init, dispatcher: platoAgent } as RequestInit)
  const text = await res.text()
  console.log(`[plato] response ${res.status} ${text.slice(0, 500)}`)
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message =
      typeof json?.message === 'string'
        ? json.message
        : typeof json?.error === 'string'
          ? json.error
          : typeof json?.error?.message === 'string'
            ? json.error.message
            : `HTTP ${res.status}`
    throw new Error(message)
  }
  return json
}

function pickFirstImage(payload: unknown): PlatoGenerateOutput {
  const d = (payload as { data?: Array<{ url?: unknown; b64_json?: unknown }> })?.data?.[0]
  if (!d) return {}
  return {
    url: typeof d.url === 'string' ? d.url : undefined,
    b64_json: typeof d.b64_json === 'string' ? d.b64_json : undefined,
  }
}

async function pollTask(baseUrl: string, taskId: string) {
  const authHeaders = getAuthHeaders()
  if (!authHeaders) throw new Error('Missing PLATO_API_KEY')
  const tasksPrefix = getTasksPathPrefix()
  const url = `${baseUrl}${tasksPrefix}/${encodeURIComponent(taskId)}`

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const payload = await requestJson(url, {
      method: 'GET',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
    })

    const status = payload?.data?.status
    if (status === 'SUCCESS') {
      const inner = payload?.data?.data
      return pickFirstImage(inner)
    }
    if (status === 'FAILURE') {
      const reason =
        typeof payload?.data?.fail_reason === 'string' && payload.data.fail_reason
          ? payload.data.fail_reason
          : 'Generation failed'
      throw new Error(reason)
    }

    await new Promise((r) => setTimeout(r, 1500))
  }

  throw new Error('Generation timeout')
}

async function platoGenerateOnceAttempt(
  options: PlatoGenerateOptions,
): Promise<PlatoGenerateOutput> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('Missing PLATO_BASE_URL')
  const authHeaders = getAuthHeaders()
  if (!authHeaders) throw new Error('Missing PLATO_API_KEY')

  const generationsPath = getGenerationsPath()
  const asyncMode =
    typeof options.async === 'boolean'
      ? options.async
      : process.env.PLATO_ASYNC === 'true'

  const url = `${baseUrl}${generationsPath}${asyncMode ? '?async=true' : ''}`
  const payload = await requestJson(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
      image: options.images,
      referenceImageUrls: options.images,
      n: 1,
      response_format: 'url',
    }),
  })

  if (asyncMode) {
    const taskId =
      typeof payload?.task_id === 'string'
        ? payload.task_id
        : typeof payload?.data?.task_id === 'string'
          ? payload.data.task_id
          : typeof payload?.data === 'string'
            ? payload.data
            : null
    if (!taskId) throw new Error('Missing task_id')
    return pollTask(baseUrl, taskId)
  }

  return pickFirstImage(payload)
}

const MAX_ATTEMPTS = 3

export async function platoGenerateOne(
  options: PlatoGenerateOptions,
): Promise<PlatoGenerateOutput> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await platoGenerateOnceAttempt(options)
    } catch (err) {
      lastError = err
      console.error(
        `[plato] attempt ${attempt}/${MAX_ATTEMPTS} failed for prompt "${options.prompt.slice(0, 30)}...":`,
        err instanceof Error ? err.message : err,
      )
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Generation failed')
}

export type PlatoGenerateSettled = { output?: PlatoGenerateOutput; errorMessage?: string }

export async function platoGenerateMany(
  items: PlatoGenerateOptions[],
  concurrency = 10,
  onItemSettled?: (index: number, result: PlatoGenerateSettled) => void,
): Promise<PlatoGenerateSettled[]> {
  const limit = pLimit(concurrency)
  return Promise.all(
    items.map((item, idx) =>
      limit(async (): Promise<PlatoGenerateSettled> => {
        let settled: PlatoGenerateSettled
        try {
          settled = { output: await platoGenerateOne(item) }
        } catch (err) {
          settled = { errorMessage: err instanceof Error ? err.message : 'Generation failed' }
        }
        onItemSettled?.(idx, settled)
        return settled
      }),
    ),
  )
}
