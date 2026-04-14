import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout.jsx'
import ProjectList from './pages/ProjectList.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import TakeoffResults from './pages/TakeoffResults.jsx'
import ProjectComparison from './pages/ProjectComparison.jsx'
import SupplierPriceLists from './pages/SupplierPriceLists.jsx'
import SharedTakeoff from './pages/SharedTakeoff.jsx'
import Login from './pages/Login.jsx'
import { authApi } from './lib/auth.js'

function AuthedApp({ user, setUser }) {
  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={() => { authApi.logout(); setUser(null) }} />}>
        <Route index element={<ProjectList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/takeoffs/:runId" element={<TakeoffResults />} />
        <Route path="/compare" element={<ProjectComparison />} />
        <Route path="/supplier-prices" element={<SupplierPriceLists />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const location = useLocation()
  const [user,     setUser]     = useState(null)
  const [checking, setChecking] = useState(true)

  // Public share routes skip auth entirely
  const isShareRoute = location.pathname.startsWith('/share/')

  useEffect(() => {
    if (isShareRoute) { setChecking(false); return }
    authApi.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [isShareRoute])

  // Always render share routes without auth
  if (isShareRoute) {
    return (
      <Routes>
        <Route path="/share/:token" element={<SharedTakeoff />} />
      </Routes>
    )
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading…
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return <AuthedApp user={user} setUser={setUser} />
}
