export type ModelName = 'image2'

export type GenerateRequest = {
  prompts: string[]
  model: ModelName
  size?: string
  quality?: 'low' | 'medium' | 'high' | 'auto'
  referenceImages?: string[]
  promptReferenceImages?: string[][]
}

export type GenerateTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type GenerateResultItem = {
  id: string
  prompt: string
  model: ModelName
  status: GenerateTaskStatus
  imageUrl?: string
  errorMessage?: string
  createdAt: string
}

export type GenerateResponse = {
  items: GenerateResultItem[]
  errorCode?: 'AUTH_REQUIRED' | 'FREE_QUOTA_EXCEEDED' | 'FREE_QUOTA_INSUFFICIENT'
  message?: string
  quota?: {
    limit: number
    used: number
    remaining: number
    month: string
  }
}

export type GenerateQuota = NonNullable<GenerateResponse['quota']>

export type GenerateStreamEvent =
  | { type: 'quota'; quota: GenerateQuota }
  | { type: 'item'; idx: number; item: GenerateResultItem }
  | { type: 'done' }
  | { type: 'error'; message: string }

export type NamingRequestItem = {
  id: string
  prompt: string
  imageUrl?: string
}

export type NamingRequest = {
  items: NamingRequestItem[]
}

export type NamingResultItem = {
  id: string
  industry: string
  style: string
  color: string
}

export type NamingResponse = {
  items: NamingResultItem[]
}

export type SlicerTemplate = {
  id: string
  name: string
  description?: string
  template: string
}

export type SlicePrompt = {
  id: string
  content: string
  sourceSection?: string
  index: number
}

export type ArticleSlicerRequest = {
  content: string
  template: string
  count?: number
}

export type ArticleSlicerResponse = {
  success: boolean
  slices: SlicePrompt[]
  error?: string
}
