import { Outlet, Link, useLocation } from 'react-router-dom'
import { FileText, Layers } from 'lucide-react'

export default function Layout() {
  const loc = useLocation()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:text-blue-400 transition-colors">
          <Layers size={22} className="text-blue-400" />
          Plan Takeoff AI
        </Link>
        <span className="text-slate-500 text-sm">Construction Quantity Extraction</span>
      </header>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
