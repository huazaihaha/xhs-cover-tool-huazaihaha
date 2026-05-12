import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GenerateQuality = 'low' | 'medium' | 'high' | 'auto'

type GenerateSettingsState = {
  size: string
  quality: GenerateQuality
  setSize: (size: string) => void
  setQuality: (quality: GenerateQuality) => void
  reset: () => void
}

const defaultState: Pick<GenerateSettingsState, 'size' | 'quality'> = {
  size: '768x1024',
  quality: 'auto',
}

export const useGenerateSettingsStore = create<GenerateSettingsState>()(
  persist(
    (set) => ({
      ...defaultState,
      setSize: (size) => set({ size }),
      setQuality: (quality) => set({ quality }),
      reset: () => set(defaultState),
    }),
    {
      name: 'xhs-cover-generate-settings',
      partialize: (state) => ({
        size: state.size,
        quality: state.quality,
      }),
    },
  ),
)
