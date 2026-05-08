export type ModelName = 'image2'

export type GenerateRequest = {
  prompts: string[]
  model: ModelName
  size?: string
  quality?: 'low' | 'medium' | 'high' | 'auto'
  referenceImages?: string[]
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
}
