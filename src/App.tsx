import { useEffect } from 'react'
import { HashRouter as Router, Navigate, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Editor from '@/pages/Editor'
import Library from '@/pages/Library'
import Settings from '@/pages/Settings'
import AuthPage from '@/pages/Auth'
import { useAuthStore } from '@/store/useAuthStore'
import { authMe } from '@/utils/api'

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)
  if (!hydrated) return <div className="min-h-screen bg-zinc-950" />
  if (!token) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const hydrated = useAuthStore((s) => s.hydrated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    if (!hydrated || !token) return
    authMe(token)
      .then((resp) => {
        if (resp.ok && resp.user) {
          if (!user || user.id !== resp.user.id) setAuth(token, resp.user)
        } else {
          clearAuth()
        }
      })
      .catch(() => clearAuth())
  }, [hydrated, token, user, setAuth, clearAuth])

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Protected><Editor /></Protected>} />
        <Route path="/library" element={<Protected><Library /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
      </Routes>
    </Router>
  )
}
