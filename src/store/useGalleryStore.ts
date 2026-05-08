import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GenerateResultItem } from '../../shared/types'

type StoredItem = GenerateResultItem & {
  proxyUrl?: string
  editedUrl?: string
}

type GalleryState = {
  items: StoredItem[]
  upsertItems: (items: StoredItem[]) => void
  setEditedUrl: (id: string, editedUrl: string) => void
  removeItems: (ids: string[]) => void
  clear: () => void
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      items: [],
      upsertItems: (incoming) =>
        set((state) => {
          const map = new Map(state.items.map((i) => [i.id, i]))
          for (const item of incoming) map.set(item.id, item)
          return { items: Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }
        }),
      setEditedUrl: (id, editedUrl) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, editedUrl } : i)),
        })),
      removeItems: (ids) =>
        set((state) => ({ items: state.items.filter((i) => !ids.includes(i.id)) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'xhs-cover-gallery',
      partialize: (state) => ({
        items: state.items.map(({ id, prompt, model, status, imageUrl, createdAt, proxyUrl, editedUrl }) => ({
          id,
          prompt,
          model,
          status,
          imageUrl,
          createdAt,
          proxyUrl,
          editedUrl,
        })),
      }),
    },
  ),
)

