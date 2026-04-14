import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Download, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { api } from '../lib/api.js'

const CONFIDENCE_COLORS = {
  high:   'text-green-400 bg-green-900/40',
  medium: 'text-yellow-400 bg-yellow-900/40',
  low:    'text-red-400 bg-red-900/40',
}

export default function TakeoffResults() {
  const { runId } = useParams()
  const [run, setRun]   = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [runId])

  async function load() {
    try {
      const data = await api.getTakeoff(runId)
      setRun(data.run)
      setItems(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    const rows = [
      ['Category', 'Description', 'Quantity', 'Unit', 'Notes', 'Confidence', 'Calc Notes'],
      ...items.map(i => [
        i.category, i.description, i.quantity ?? '', i.unit ?? '',
        i.unit_notes ?? '', i.confidence, i.calc_notes ?? ''
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `takeoff-${run?.trade}-${runId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading…
    </div>
  )
  if (!run) return <div className="text-red-400">Takeoff not found</div>

  // Group items by category
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
        <Link to="/" className="hover:text-white transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${run.project_id}`} className="hover:text-white transition-colors">Project</Link>
        <span>/</span>
        <span className="text-white capitalize">{run.trade.replace('_', ' ')} Takeoff</span>
      </div>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">
              {run.trade.replace('_', ' ')} Takeoff
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                {run.status === 'complete'
                  ? <CheckCircle2 size={14} className="text-green-400" />
                  : <AlertCircle size={14} className="text-red-400" />
                }
                {run.status}
              </span>
              <span>{items.length} line items</span>
              {run.ai_model && <span>Model: {run.ai_model}</span>}
              {run.completed_at && (
                <span>Completed {new Date(run.completed_at).toLocaleString()}</span>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p>No items extracted</p>
          {run.error_message && <p className="text-red-400 text-sm mt-2">{run.error_message}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-750 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white">{category}</h3>
                <span className="text-xs text-slate-400">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th className="text-left px-5 py-2 font-medium">Description</th>
                    <th className="text-right px-4 py-2 font-medium">Quantity</th>
                    <th className="text-left px-4 py-2 font-medium">Unit</th>
                    <th className="text-left px-4 py-2 font-medium">Notes</th>
                    <th className="text-center px-4 py-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-white text-sm">{item.description}</div>
                        {item.calc_notes && (
                          <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                            <Info size={11} />{item.calc_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white font-medium">
                        {item.quantity != null ? Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{item.unit || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{item.unit_notes || ''}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[item.confidence] || ''}`}>
                          {item.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
