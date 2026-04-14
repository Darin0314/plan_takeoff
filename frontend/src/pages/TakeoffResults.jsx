import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, Download, CheckCircle2, AlertCircle, Info, X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react'
import { api } from '../lib/api.js'

const CONFIDENCE_COLORS = {
  high:   'text-green-400 bg-green-900/40',
  medium: 'text-yellow-400 bg-yellow-900/40',
  low:    'text-red-400 bg-red-900/40',
}

const TRADE_COLORS = {
  roofing:   { border: 'border-l-orange-500',  badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',  dot: 'bg-orange-500',  label: 'Roofing' },
  framing:   { border: 'border-l-amber-600',   badge: 'bg-amber-600/20 text-amber-300 border-amber-600/40',    dot: 'bg-amber-600',   label: 'Framing' },
  drywall:   { border: 'border-l-zinc-400',    badge: 'bg-zinc-400/20 text-zinc-300 border-zinc-400/40',       dot: 'bg-zinc-400',    label: 'Drywall' },
  electrical:{ border: 'border-l-yellow-400',  badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40', dot: 'bg-yellow-400',  label: 'Electrical' },
  hvac:      { border: 'border-l-cyan-500',    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',       dot: 'bg-cyan-500',    label: 'HVAC' },
  plumbing:  { border: 'border-l-blue-500',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',       dot: 'bg-blue-500',    label: 'Plumbing' },
  concrete:  { border: 'border-l-stone-400',   badge: 'bg-stone-400/20 text-stone-300 border-stone-400/40',    dot: 'bg-stone-400',   label: 'Concrete' },
  site_work: { border: 'border-l-green-500',   badge: 'bg-green-500/20 text-green-300 border-green-500/40',    dot: 'bg-green-500',   label: 'Site Work' },
  all:       { border: 'border-l-violet-500',  badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40', dot: 'bg-violet-500',  label: 'All Trades' },
}

export default function TakeoffResults() {
  const { runId } = useParams()
  const [run, setRun]         = useState(null)
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [sheetMap, setSheetMap] = useState({})   // sheet_number → sheet row
  const [modalSheet, setModalSheet] = useState(null)

  useEffect(() => { load() }, [runId])

  async function load() {
    try {
      const data = await api.getTakeoff(runId)
      setRun(data.run)
      setItems(data.items || [])
      if (data.run?.project_id) {
        try {
          const sd = await api.getProjectSheets(data.run.project_id)
          const map = {}
          for (const s of sd.sheets || []) {
            if (s.sheet_number) map[s.sheet_number] = s
            // also index by page label for fallback matches
            map[`page ${s.page_number + 1}`] = s
          }
          setSheetMap(map)
        } catch (_) {}
      }
    } finally {
      setLoading(false)
    }
  }

  const openSheet = useCallback((ref) => {
    const sheet = sheetMap[ref]
    if (sheet) setModalSheet(sheet)
  }, [sheetMap])

  const closeModal = useCallback(() => setModalSheet(null), [])

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

  const tradeColor = TRADE_COLORS[run?.trade] || TRADE_COLORS.all

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
        <Link to="/" className="hover:text-white transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${run.project_id}`} className="hover:text-white transition-colors">Project</Link>
        <span>/</span>
        <span className="text-white">{tradeColor.label} Takeoff</span>
      </div>

      {/* Header */}
      <div className={`bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6 border-l-4 ${tradeColor.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{tradeColor.label} Takeoff</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${tradeColor.badge}`}>
                {tradeColor.label}
              </span>
            </div>
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
            <div key={category} className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden border-l-4 ${tradeColor.border}`}>
              <div className="px-5 py-3 bg-slate-750 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tradeColor.dot}`} />
                  <h3 className="font-semibold text-white">{category}</h3>
                </div>
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
                        <SourceSheetChips refs={parseRefs(item.source_sheets)} sheetMap={sheetMap} onOpen={openSheet} />
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

      {modalSheet && <SheetModal sheet={modalSheet} onClose={closeModal} />}
    </div>
  )
}

// Parse source_sheets — stored as JSON string or already an array
function parseRefs(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [raw] }
}

function SourceSheetChips({ refs, sheetMap, onOpen }) {
  if (!refs.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {refs.map((ref, i) => {
        const hasImage = !!sheetMap[ref]
        return (
          <button
            key={i}
            onClick={() => hasImage && onOpen(ref)}
            title={hasImage ? `View sheet ${ref}` : ref}
            className={`text-xs px-1.5 py-0.5 rounded font-mono border transition-colors ${
              hasImage
                ? 'border-blue-500/50 bg-blue-900/30 text-blue-300 hover:bg-blue-800/50 cursor-pointer'
                : 'border-slate-600 bg-slate-700/30 text-slate-400 cursor-default'
            }`}
          >
            {ref}
          </button>
        )
      })}
    </div>
  )
}

function SheetModal({ sheet, onClose }) {
  const [zoom, setZoom] = useState(1)
  const imgUrl = `/storage/${sheet.page_image_path}`

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-blue-300 font-semibold">{sheet.sheet_number || `Page ${sheet.page_number + 1}`}</span>
          {sheet.sheet_title && <span className="text-white">{sheet.sheet_title}</span>}
          {sheet.drawing_scale && <span className="text-slate-400 text-sm">{sheet.drawing_scale}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom out"
          ><ZoomOut size={16} /></button>
          <span className="text-slate-400 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom in"
          ><ZoomIn size={16} /></button>
          <a
            href={imgUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            title="Open full size in new tab"
          ><ExternalLink size={16} /></a>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors ml-1"
            title="Close (Esc)"
          ><X size={18} /></button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center p-6"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={imgUrl}
          alt={sheet.sheet_title || sheet.sheet_number || 'Plan sheet'}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}
          className="max-w-none rounded shadow-2xl"
        />
      </div>
    </div>
  )
}
