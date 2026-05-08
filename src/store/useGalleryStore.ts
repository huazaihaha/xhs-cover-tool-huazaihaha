import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GenerateResultItem } from '../../shared/types'

type StoredItem = GenerateResultItem & {
  proxyUrl?: string
  editedUrl?: string
}

type WorkspaceItem = GenerateResultItem & {
  proxyUrl?: string
}

type GalleryState = {
  items: StoredItem[]
  workspaceItems: WorkspaceItem[]
  workspaceBusy: boolean
  upsertItems: (items: StoredItem[]) => void
  appendWorkspaceItems: (items: WorkspaceItem[]) => void
  replaceWorkspaceRun: (runId: string, items: WorkspaceItem[]) => void
  setWorkspaceBusy: (busy: boolean) => void
  setEditedUrl: (id: string, editedUrl: string) => void
  removeItems: (ids: string[]) => void
  clear: () => void
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set) => ({
      items: [],
      workspaceItems: [],
      workspaceBusy: false,
      upsertItems: (incoming) =>
        set((state) => {
          const map = new Map(state.items.map((i) => [i.id, i]))
          for (const item of incoming) map.set(item.id, item)
          return { items: Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }
        }),
      appendWorkspaceItems: (incoming) =>
        set((state) => {
          const existingIds = new Set(state.workspaceItems.map((i) => i.id))
          const next = [...state.workspaceItems]

          for (const item of incoming) {
            const idx = next.findIndex((i) => i.id === item.id)
            if (idx >= 0) {
              next[idx] = item
            }
          }

          const newItems = incoming.filter((item) => !existingIds.has(item.id))
          return {
            workspaceItems: [...newItems, ...next],
          }
        }),
      replaceWorkspaceRun: (runId, incoming) =>
        set((state) => {
          const runPrefix = `${runId}_`
          const runIndices: number[] = []
          for (let i = 0; i < state.workspaceItems.length; i += 1) {
            if (state.workspaceItems[i].id.startsWith(runPrefix)) runIndices.push(i)
          }

          const insertAt = runIndices.length ? Math.min(...runIndices) : 0
          const incomingIds = new Set(incoming.map((i) => i.id))
          const remained = state.workspaceItems.filter(
            (i) => !i.id.startsWith(runPrefix) && !incomingIds.has(i.id),
          )
          const next = [...remained]
          next.splice(insertAt, 0, ...incoming)
          return {
            workspaceItems: next,
          }
        }),
      setWorkspaceBusy: (workspaceBusy) => set({ workspaceBusy }),
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
        workspaceItems: state.workspaceItems.map(({ id, prompt, model, status, imageUrl, createdAt, proxyUrl }) => ({
          id,
          prompt,
          model,
          status,
          imageUrl,
          createdAt,
          proxyUrl,
        })),
        workspaceBusy: state.workspaceBusy,
      }),
    },
  ),
)
