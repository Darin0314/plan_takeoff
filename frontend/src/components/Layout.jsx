import { Outlet, Link } from 'react-router-dom'
import { Layers, LogOut, PackageSearch } from 'lucide-react'

export default function Layout({ user, onLogout }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:text-blue-400 transition-colors">
          <Layers size={22} className="text-blue-400" />
          Plan Takeoff AI
        </Link>
        <span className="text-slate-500 text-sm">Construction Quantity Extraction</span>
        <Link
          to="/supplier-prices"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-violet-300 transition-colors"
        >
          <PackageSearch size={15} /> Supplier Prices
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-slate-400">{user.name || user.email}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                title="Sign out"
              >
                <LogOut size={13} /> Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
