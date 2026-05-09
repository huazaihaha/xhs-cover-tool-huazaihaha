import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthUser = {
  id: string
  email: string
}

type AuthState = {
  token: string
  user: AuthUser | null
  hydrated: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  setHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: '',
      user: null,
      hydrated: false,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: '', user: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'xhs-cover-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)

