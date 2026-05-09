import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthUser = {
  id: string
  email: string
}

type AuthState = {
  token: string
  user: AuthUser | null
  loginCount: number
  firstLoginAt: string
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
      loginCount: 0,
      firstLoginAt: '',
      hydrated: false,
      setAuth: (token, user) =>
        set((state) => ({
          token,
          user,
          loginCount: state.loginCount + 1,
          firstLoginAt: state.firstLoginAt || new Date().toISOString(),
        })),
      clearAuth: () => set({ token: '', user: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'xhs-cover-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        loginCount: state.loginCount,
        firstLoginAt: state.firstLoginAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
