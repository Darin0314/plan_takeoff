import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Download, AlertCircle, Clock, Eye, MapPin, Hash, User } from 'lucide-react'

const TRADE_COLORS = {
  roofing:    { border: 'border-l-orange-500',  badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',  dot: 'bg-orange-500',  label: 'Roofing' },
  framing:    { border: 'border-l-amber-600',   badge: 'bg-amber-600/20 text-amber-300 border-amber-600/40',    dot: 'bg-amber-600',   label: 'Framing' },
  drywall:    { border: 'border-l-zinc-400',    badge: 'bg-zinc-400/20 text-zinc-300 border-zinc-400/40',       dot: 'bg-zinc-400',    label: 'Drywall' },
  electrical: { border: 'border-l-yellow-400',  badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40', dot: 'bg-yellow-400',  label: 'Electrical' },
  hvac:       { border: 'border-l-cyan-500',    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',       dot: 'bg-cyan-500',    label: 'HVAC' },
  plumbing:   { border: 'border-l-blue-500',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',       dot: 'bg-blue-500',    label: 'Plumbing' },
  concrete:   { border: 'border-l-stone-400',   badge: 'bg-stone-400/20 text-stone-300 border-stone-400/40',    dot: 'bg-stone-400',   label: 'Concrete' },
  site_work:  { border: 'border-l-green-500',   badge: 'bg-green-500/20 text-green-300 border-green-500/40',    dot: 'bg-green-500',   label: 'Site Work' },
  all_trades: { border: 'border-l-purple-500',  badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-500',  label: 'All Trades' },
}

const CONF_BADGE = {
  high:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low:    'bg-red-500/20 text-red-300 border-red-500/40',
}

function fmtQty(val) {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fmtCurrency(val) {
  if (!val && val !== 0) return '—'
  return '$' + parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SharedTakeoff() {
  const { token } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/share/' + token)
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Failed to load')
        return json
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading takeoff…
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-8 max-w-md w-full text-center">
        <AlertCircle size={36} className="mx-auto mb-3 text-red-400" />
        <h2 className="text-white font-semibold text-lg mb-2">
          {error.includes('expired') ? 'Link Expired' : 'Link Not Found'}
        </h2>
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    </div>
  )

  const { run, project, items, costs, share } = data
  const tc = TRADE_COLORS[run.trade] || TRADE_COLORS.all_trades

  // Group items by category
  const grouped = {}
  for (const item of (items || [])) {
    const cat = item.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const pdfUrl = `/api/takeoffs/${run.id}/pdf?token=${token}`

  return (
    <div className="min-h-screen bg-slate-900 text-white">

      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">PT</div>
          <span className="text-slate-400 text-sm">Plan Takeoff AI</span>
          <span className="text-slate-600 text-sm">·</span>
          <span className="text-slate-400 text-sm">Shared Report</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {share.expires_at && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> Expires {new Date(share.expires_at).toLocaleDateString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye size={12} /> {share.view_count} view{share.view_count !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Project + run header */}
        <div className={`bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6 border-l-4 ${tc.border}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{project.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                {project.address && (
                  <span className="flex items-center gap-1"><MapPin size={13} />{project.address}</span>
                )}
                {project.permit_number && (
                  <span className="flex items-center gap-1"><Hash size={13} />Permit {project.permit_number}</span>
                )}
                {project.client_name && (
                  <span className="flex items-center gap-1"><User size={13} />{project.client_name}</span>
                )}
              </div>
            </div>
            <a
              href={pdfUrl}
              download
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm shrink-0"
            >
              <Download size={15} /> Download PDF
            </a>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${tc.badge}`}>{tc.label}</span>
            <span className="text-slate-500 text-xs">
              Run completed {run.completed_at ? new Date(run.completed_at).toLocaleDateString() : '—'}
            </span>
            <span className="text-slate-500 text-xs">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Cost summary */}
        {costs && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <CostCard label="Material" value={fmtCurrency(costs.total_material)} color="text-blue-400" />
            <CostCard label="Labor"    value={fmtCurrency(costs.total_labor)}    color="text-amber-400" />
            <CostCard label="Total"    value={fmtCurrency(costs.grand_total)}    color="text-emerald-400" />
          </div>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500">
            No items extracted for this takeoff run.
          </div>
        ) : (
          Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden border-l-4 mb-4 ${tc.border}`}>
              {/* Category header */}
              <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
                <span className="text-sm font-semibold text-white">{category}</span>
                <span className="text-slate-500 text-xs ml-1">({catItems.length})</span>
              </div>

              {/* Column headers */}
              <div className="px-5 py-2 grid grid-cols-[1fr_100px_80px_1fr_80px] gap-3 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-700/50">
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div>Unit</div>
                <div>Notes</div>
                <div className="text-center">Conf.</div>
              </div>

              {/* Item rows */}
              {catItems.map((item, i) => (
                <div
                  key={item.id}
                  className={`px-5 py-2.5 grid grid-cols-[1fr_100px_80px_1fr_80px] gap-3 items-start border-b border-slate-700/30 text-sm
                    ${i % 2 === 1 ? 'bg-slate-900/20' : ''}
                    ${item.confidence === 'low' ? 'bg-red-900/10' : ''}
                  `}
                >
                  <div className="text-slate-200 text-xs leading-snug">{item.description}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${item.is_override ? 'text-amber-300' : 'text-slate-300'}`}>
                    {fmtQty(item.quantity)}
                  </div>
                  <div className="text-slate-500 text-xs">{item.unit || '—'}</div>
                  <div className="text-slate-500 text-xs leading-snug">{item.unit_notes || item.calc_notes || ''}</div>
                  <div className="flex justify-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${CONF_BADGE[item.confidence] || CONF_BADGE.medium}`}>
                      {item.confidence || 'med'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-8">
          Generated by Plan Takeoff AI · Read-only shared report
        </p>
      </main>
    </div>
  )
}

function CostCard({ label, value, color }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}
