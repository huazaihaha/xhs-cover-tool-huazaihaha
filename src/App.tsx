import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Editor from '@/pages/Editor'
import Library from '@/pages/Library'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  )
}
