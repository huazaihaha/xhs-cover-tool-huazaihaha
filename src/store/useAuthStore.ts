import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthUser = {
  id: string
  email: string
}

type UsageQuota = {
  limit: number
  used: number
  remaining: number
  month: string
}

type AuthState = {
  token: string
  user: AuthUser | null
  loginCount: number
  firstLoginAt: string
  quota: UsageQuota | null
  hydrated: boolean
  setAuth: (token: string, user: AuthUser) => void
  setQuota: (quota: UsageQuota | null) => void
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
      quota: null,
      hydrated: false,
      setAuth: (token, user) =>
        set((state) => ({
          token,
          user,
          loginCount: state.loginCount + 1,
          firstLoginAt: state.firstLoginAt || new Date().toISOString(),
        })),
      setQuota: (quota) => set({ quota }),
      clearAuth: () => set({ token: '', user: null, quota: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'xhs-cover-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        loginCount: state.loginCount,
        firstLoginAt: state.firstLoginAt,
        quota: state.quota,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
