import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, Download, FileDown, CheckCircle2, AlertCircle, Info, X, ZoomIn, ZoomOut, ExternalLink, Pencil, RotateCcw, Check, ShieldAlert, DollarSign, List, GitCompare, Flag, MessageSquare, Files, Share2, Copy, Trash2, Eye, Clock, Tag } from 'lucide-react'
import { api } from '../lib/api.js'
import CostPanel from '../components/CostPanel.jsx'
import DiffPanel from '../components/DiffPanel.jsx'
import SupplierPanel from '../components/SupplierPanel.jsx'

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
  const [modalSheet, setModalSheet]           = useState(null)
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [flagFilter, setFlagFilter]           = useState('all') // 'all' | 'review' | 'confirmed' | 'exclude' | 'flagged'
  const [activeTab, setActiveTab]             = useState('quantities') // 'quantities' | 'cost'
  const [shareOpen, setShareOpen]             = useState(false)
  const [shares, setShares]                   = useState([])
  const [shareExpiry, setShareExpiry]         = useState('never')  // 'never' | '24h' | '7d' | '30d'
  const [shareCreating, setShareCreating]     = useState(false)
  const [shareCopied, setShareCopied]         = useState(null) // token that was just copied
  const [shareRevoking, setShareRevoking]     = useState(null) // token being revoked

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

  function applyItemUpdate(updatedItem) {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i))
  }

  async function exportCSV() {
    // Fetch cost data to include in export; fall back gracefully if unavailable
    let costMap = {}
    try {
      const costData = await api.getCostSummary(runId)
      for (const item of costData.items || []) {
        costMap[item.id] = item
      }
    } catch (_) {}

    const hasCosts = Object.keys(costMap).length > 0

    const headers = ['Category', 'Description', 'Quantity', 'Unit', 'Notes', 'Confidence', 'Calc Notes', 'Flag', 'Annotation']
    if (hasCosts) headers.push('Mat/Unit ($)', 'Lab/Unit ($)', 'Total Cost ($)')

    const rows = [
      headers,
      ...items.map(i => {
        const row = [
          i.category, i.description, i.quantity ?? '', i.unit ?? '',
          i.unit_notes ?? '', i.confidence, i.calc_notes ?? '',
          i.flag ?? '', i.annotation ?? ''
        ]
        if (hasCosts) {
          const c = costMap[i.id] || {}
          row.push(
            c.unit_cost_material_effective != null ? c.unit_cost_material_effective.toFixed(2) : '',
            c.unit_cost_labor_effective    != null ? c.unit_cost_labor_effective.toFixed(2)    : '',
            c.total_cost                   != null ? c.total_cost.toFixed(2)                   : ''
          )
        }
        return row
      })
    ]

    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `takeoff-${run?.trade}-${runId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function openShareModal() {
    setShareOpen(true)
    try {
      const data = await api.getShares(runId)
      setShares(data.shares || [])
    } catch (_) {}
  }

  async function createShare() {
    setShareCreating(true)
    try {
      const data = await api.createShare(runId, { expires_in: shareExpiry })
      // Backend returns { token, run_id, expires_at, share_url } — build a share row
      setShares(prev => [{ ...data, view_count: 0, created_at: new Date().toISOString() }, ...prev])
      setShareExpiry('never')
    } catch (_) {} finally {
      setShareCreating(false)
    }
  }

  async function revokeShare(token) {
    setShareRevoking(token)
    try {
      await api.revokeShare(token)
      setShares(prev => prev.filter(s => s.token !== token))
    } catch (_) {} finally {
      setShareRevoking(null)
    }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(token)
      setTimeout(() => setShareCopied(null), 2000)
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading…
    </div>
  )
  if (!run) return <div className="text-red-400">Takeoff not found</div>

  // Confidence summary counts
  const confCounts = items.reduce((acc, item) => {
    const c = item.confidence || 'medium'
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  // Flag counts
  const flagCounts = items.reduce((acc, item) => {
    if (item.flag) acc[item.flag] = (acc[item.flag] || 0) + 1
    return acc
  }, {})
  const totalFlagged = Object.values(flagCounts).reduce((s, n) => s + n, 0)

  // Filter items by confidence + flag
  const visibleItems = items.filter(i => {
    const confOk = confidenceFilter === 'all' || i.confidence === confidenceFilter
    const flagOk = flagFilter === 'all'
      ? true
      : flagFilter === 'flagged'
        ? !!i.flag
        : i.flag === flagFilter
    return confOk && flagOk
  })

  // Group visible items by category
  const grouped = visibleItems.reduce((acc, item) => {
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
            <div className="flex items-center gap-2">
              <a
                href={`/api/takeoffs/${runId}/pdf`}
                download
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileDown size={16} /> Export PDF
              </a>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                onClick={openShareModal}
                className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Share2 size={16} /> Share
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Share Takeoff</h2>
              </div>
              <button onClick={() => setShareOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Create new link */}
            <div className="p-5 border-b border-slate-700">
              <p className="text-sm text-slate-400 mb-3">Create a read-only link. Anyone with the link can view this takeoff without logging in.</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 flex-1">
                  <Clock size={14} className="text-slate-400" />
                  <select
                    value={shareExpiry}
                    onChange={e => setShareExpiry(e.target.value)}
                    className="bg-transparent text-sm text-white outline-none flex-1"
                  >
                    <option value="never">No expiry</option>
                    <option value="24h">Expires in 24 hours</option>
                    <option value="7d">Expires in 7 days</option>
                    <option value="30d">Expires in 30 days</option>
                  </select>
                </div>
                <button
                  onClick={createShare}
                  disabled={shareCreating}
                  className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {shareCreating ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  Create Link
                </button>
              </div>
            </div>

            {/* Existing links */}
            <div className="p-5 max-h-72 overflow-y-auto">
              {shares.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No active share links</p>
              ) : (
                <div className="space-y-3">
                  {shares.map(s => {
                    const url = `${window.location.origin}/share/${s.token}`
                    const expired = s.expires_at && new Date(s.expires_at) < new Date()
                    return (
                      <div key={s.token} className={`bg-slate-700/60 border rounded-lg p-3 ${expired ? 'border-red-700/50 opacity-60' : 'border-slate-600'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            readOnly
                            value={url}
                            className="bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 flex-1 min-w-0 font-mono"
                          />
                          <button
                            onClick={() => copyLink(s.token)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                              shareCopied === s.token
                                ? 'bg-green-700 text-white'
                                : 'bg-slate-600 hover:bg-slate-500 text-white'
                            }`}
                          >
                            {shareCopied === s.token ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                          </button>
                          <button
                            onClick={() => revokeShare(s.token)}
                            disabled={shareRevoking === s.token}
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-900/50 hover:bg-red-800 text-red-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {shareRevoking === s.token ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Revoke
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Eye size={11} /> {s.view_count ?? 0} views</span>
                          {s.expires_at ? (
                            <span className={`flex items-center gap-1 ${expired ? 'text-red-400' : ''}`}>
                              <Clock size={11} />
                              {expired ? 'Expired ' : 'Expires '}
                              {new Date(s.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock size={11} /> No expiry</span>
                          )}
                          <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-1 mb-4 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('quantities')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'quantities'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <List size={14} /> Quantities
          </button>
          <button
            onClick={() => setActiveTab('cost')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'cost'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign size={14} /> Cost Estimate
          </button>
          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'diff'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare size={14} /> Compare
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'files'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Files size={14} /> Files
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'supplier'
                ? 'border-violet-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Tag size={14} /> Supplier Prices
          </button>
        </div>
      )}

      {/* Cost tab */}
      {activeTab === 'cost' && items.length > 0 && (
        <CostPanel runId={runId} trade={run?.trade} />
      )}

      {/* Compare tab */}
      {activeTab === 'diff' && (
        <DiffPanel runId={runId} projectId={run?.project_id} trade={run?.trade} />
      )}

      {/* Supplier prices tab */}
      {activeTab === 'supplier' && (
        <SupplierPanel runId={runId} />
      )}

      {/* Files tab */}
      {activeTab === 'files' && (
        <FileBreakdownPanel runId={runId} tradeColor={tradeColor} />
      )}

      {/* Confidence + Flag Filters (quantities tab only) */}
      {activeTab === 'quantities' && items.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4 space-y-3">
          {/* Confidence row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Confidence:</span>
            <button
              onClick={() => setConfidenceFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                confidenceFilter === 'all'
                  ? 'bg-slate-600 border-slate-500 text-white'
                  : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              All <span className="text-slate-300">{items.length}</span>
            </button>
            {(confCounts.high || 0) > 0 && (
              <button
                onClick={() => setConfidenceFilter(confidenceFilter === 'high' ? 'all' : 'high')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  confidenceFilter === 'high'
                    ? 'bg-green-900/60 border-green-600 text-green-300'
                    : 'bg-green-900/20 border-green-800 text-green-400 hover:border-green-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                High <span>{confCounts.high || 0}</span>
              </button>
            )}
            {(confCounts.medium || 0) > 0 && (
              <button
                onClick={() => setConfidenceFilter(confidenceFilter === 'medium' ? 'all' : 'medium')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  confidenceFilter === 'medium'
                    ? 'bg-yellow-900/60 border-yellow-600 text-yellow-300'
                    : 'bg-yellow-900/20 border-yellow-800 text-yellow-400 hover:border-yellow-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                Medium <span>{confCounts.medium || 0}</span>
              </button>
            )}
            {(confCounts.low || 0) > 0 && (
              <button
                onClick={() => setConfidenceFilter(confidenceFilter === 'low' ? 'all' : 'low')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  confidenceFilter === 'low'
                    ? 'bg-red-900/60 border-red-600 text-red-300'
                    : 'bg-red-900/20 border-red-800 text-red-400 hover:border-red-600'
                }`}
              >
                <ShieldAlert size={12} />
                Needs Review <span>{confCounts.low || 0}</span>
              </button>
            )}
          </div>

          {/* Flag row — only when any items have flags */}
          {totalFlagged > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-3">
              <span className="text-xs text-slate-400 font-medium w-20 shrink-0">Flags:</span>
              <button
                onClick={() => setFlagFilter('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  flagFilter === 'all'
                    ? 'bg-slate-600 border-slate-500 text-white'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                All <span className="text-slate-300">{items.length}</span>
              </button>
              <button
                onClick={() => setFlagFilter(flagFilter === 'flagged' ? 'all' : 'flagged')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  flagFilter === 'flagged'
                    ? 'bg-violet-900/60 border-violet-600 text-violet-300'
                    : 'bg-violet-900/20 border-violet-800 text-violet-400 hover:border-violet-600'
                }`}
              >
                <Flag size={11} />
                Any Flag <span>{totalFlagged}</span>
              </button>
              {(flagCounts.review || 0) > 0 && (
                <button
                  onClick={() => setFlagFilter(flagFilter === 'review' ? 'all' : 'review')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    flagFilter === 'review'
                      ? 'bg-yellow-900/60 border-yellow-600 text-yellow-300'
                      : 'bg-yellow-900/20 border-yellow-800 text-yellow-400 hover:border-yellow-600'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                  Review <span>{flagCounts.review}</span>
                </button>
              )}
              {(flagCounts.confirmed || 0) > 0 && (
                <button
                  onClick={() => setFlagFilter(flagFilter === 'confirmed' ? 'all' : 'confirmed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    flagFilter === 'confirmed'
                      ? 'bg-green-900/60 border-green-600 text-green-300'
                      : 'bg-green-900/20 border-green-800 text-green-400 hover:border-green-600'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Confirmed <span>{flagCounts.confirmed}</span>
                </button>
              )}
              {(flagCounts.exclude || 0) > 0 && (
                <button
                  onClick={() => setFlagFilter(flagFilter === 'exclude' ? 'all' : 'exclude')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    flagFilter === 'exclude'
                      ? 'bg-red-900/60 border-red-600 text-red-300'
                      : 'bg-red-900/20 border-red-800 text-red-400 hover:border-red-600'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Exclude <span>{flagCounts.exclude}</span>
                </button>
              )}
            </div>
          )}

          {/* Active filter summary */}
          {(confidenceFilter !== 'all' || flagFilter !== 'all') && (
            <div className="flex items-center gap-3 border-t border-slate-700 pt-3">
              <span className="text-xs text-slate-500">
                Showing {visibleItems.length} of {items.length} items
              </span>
              <button
                onClick={() => { setConfidenceFilter('all'); setFlagFilter('all') }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results (quantities tab only) */}
      {activeTab === 'quantities' && (
        items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p>No items extracted</p>
            {run.error_message && <p className="text-red-400 text-sm mt-2">{run.error_message}</p>}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p>No items match the current filter</p>
            <button onClick={() => { setConfidenceFilter('all'); setFlagFilter('all') }} className="mt-3 text-sm text-blue-400 hover:text-blue-300">Show all items</button>
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
                      <ItemRow key={item.id} item={item} sheetMap={sheetMap} onOpen={openSheet} onUpdate={applyItemUpdate} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      )}

      {modalSheet && <SheetModal sheet={modalSheet} onClose={closeModal} />}
    </div>
  )
}

const FLAG_CONFIG = {
  review:    { label: 'Review',    bg: 'bg-yellow-900/50 border-yellow-700 text-yellow-300', dot: 'bg-yellow-400' },
  confirmed: { label: 'Confirmed', bg: 'bg-green-900/50  border-green-700  text-green-300',  dot: 'bg-green-400'  },
  exclude:   { label: 'Exclude',   bg: 'bg-red-900/50    border-red-700    text-red-300',    dot: 'bg-red-400'    },
}

function ItemRow({ item, sheetMap, onOpen, onUpdate }) {
  const [editing, setEditing]       = useState(false)
  const [qty, setQty]               = useState('')
  const [unit, setUnit]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [annotating, setAnnotating] = useState(false)
  const [flagValue, setFlagValue]   = useState(item.flag || '')
  const [noteValue, setNoteValue]   = useState(item.annotation || '')
  const [savingNote, setSavingNote] = useState(false)
  const qtyRef = useRef()

  // Keep local annotation state in sync when item prop updates
  useEffect(() => {
    setFlagValue(item.flag || '')
    setNoteValue(item.annotation || '')
  }, [item.flag, item.annotation])

  function startEdit() {
    setQty(item.quantity != null ? String(Number(item.quantity)) : '')
    setUnit(item.unit || '')
    setEditing(true)
    setTimeout(() => qtyRef.current?.select(), 0)
  }

  function cancelEdit() { setEditing(false) }

  async function save() {
    const parsed = parseFloat(qty)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    try {
      const res = await api.updateItem(item.id, { quantity: parsed, unit: unit.trim() || item.unit })
      onUpdate(res.item)
      setEditing(false)
    } catch (_) {}
    setSaving(false)
  }

  async function reset() {
    setSaving(true)
    try {
      const res = await api.resetItem(item.id)
      onUpdate(res.item)
    } catch (_) {}
    setSaving(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter')  save()
    if (e.key === 'Escape') cancelEdit()
  }

  async function saveAnnotation() {
    setSavingNote(true)
    try {
      const res = await api.setAnnotation(item.id, {
        flag:       flagValue || null,
        annotation: noteValue || null,
      })
      onUpdate(res.item)
      setAnnotating(false)
    } catch (_) {}
    setSavingNote(false)
  }

  function cancelAnnotation() {
    setFlagValue(item.flag || '')
    setNoteValue(item.annotation || '')
    setAnnotating(false)
  }

  const isOverride  = !!item.is_override
  const hasFlag     = !!item.flag
  const hasNote     = !!item.annotation
  const flagCfg     = FLAG_CONFIG[item.flag] || null

  const rowBg = item.flag === 'exclude'
    ? 'bg-red-950/10'
    : item.confidence === 'low'
      ? 'bg-red-950/10'
      : ''

  return (
    <Fragment>
      <tr className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors group ${rowBg}`}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5 text-white text-sm flex-wrap">
            {item.confidence === 'low' && <ShieldAlert size={13} className="text-red-400 flex-shrink-0" title="Low confidence — verify manually" />}
            {hasFlag && flagCfg && (
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${flagCfg.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${flagCfg.dot}`} />
                {flagCfg.label}
              </span>
            )}
            {item.description}
          </div>
          {item.calc_notes && (
            <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
              <Info size={11} />{item.calc_notes}
            </div>
          )}
          {hasNote && (
            <div className="text-slate-400 text-xs mt-1 flex items-start gap-1 italic">
              <MessageSquare size={11} className="text-slate-500 mt-0.5 flex-shrink-0" />
              {item.annotation}
            </div>
          )}
          <SourceSheetChips refs={parseRefs(item.source_sheets)} sheetMap={sheetMap} onOpen={onOpen} />
        </td>

        {/* Quantity cell */}
        <td className="px-4 py-3 text-right">
          {editing ? (
            <input
              ref={qtyRef}
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={e => setQty(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-24 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-white font-mono text-sm text-right focus:outline-none"
            />
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              {isOverride && (
                <span className="text-xs text-amber-400 font-mono line-through opacity-60">
                  {item.original_quantity != null ? Number(item.original_quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''}
                </span>
              )}
              <span className={`font-mono font-medium ${isOverride ? 'text-amber-300' : 'text-white'}`}>
                {item.quantity != null ? Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
              </span>
            </div>
          )}
        </td>

        {/* Unit cell */}
        <td className="px-4 py-3 text-slate-300 text-sm">
          {editing ? (
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-16 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-white text-sm focus:outline-none"
            />
          ) : (
            item.unit || '—'
          )}
        </td>

        <td className="px-4 py-3 text-slate-400 text-xs">{item.unit_notes || ''}</td>

        {/* Confidence + actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-green-700/40 text-green-400 transition-colors" title="Save (Enter)">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-slate-600 text-slate-400 transition-colors" title="Cancel (Esc)">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[item.confidence] || ''}`}>
                  {item.confidence}
                </span>
                <button
                  onClick={startEdit}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 text-slate-400 transition-all"
                  title="Edit quantity"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setAnnotating(a => !a)}
                  className={`p-1 rounded hover:bg-slate-600 transition-all ${
                    hasFlag || hasNote
                      ? 'text-blue-400'
                      : 'opacity-0 group-hover:opacity-100 text-slate-400'
                  }`}
                  title={hasFlag || hasNote ? 'Edit flag / note' : 'Add flag / note'}
                >
                  <Flag size={12} />
                </button>
                {isOverride && (
                  <button
                    onClick={reset}
                    disabled={saving}
                    className="p-1 rounded hover:bg-slate-600 text-amber-400 transition-colors"
                    title="Reset to AI value"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Annotation editor row */}
      {annotating && (
        <tr className="border-b border-slate-700/50 bg-slate-900/60">
          <td colSpan={5} className="px-5 py-3">
            <div className="flex flex-wrap items-start gap-4">
              {/* Flag picker */}
              <div>
                <div className="text-xs text-slate-500 font-medium mb-1.5">Flag</div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(FLAG_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setFlagValue(flagValue === key ? '' : key)}
                      className={`px-2.5 py-1 rounded border text-xs font-medium transition-all ${
                        flagValue === key
                          ? cfg.bg + ' ring-1 ring-offset-1 ring-offset-slate-900 ring-current'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                  {flagValue && (
                    <button
                      onClick={() => setFlagValue('')}
                      className="px-2 py-1 rounded border border-slate-600 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      title="Clear flag"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Note textarea */}
              <div className="flex-1 min-w-48">
                <div className="text-xs text-slate-500 font-medium mb-1.5">Note</div>
                <textarea
                  rows={2}
                  value={noteValue}
                  onChange={e => setNoteValue(e.target.value)}
                  placeholder="Add a note…"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex items-end gap-2 pb-0.5">
                <button
                  onClick={saveAnnotation}
                  disabled={savingNote}
                  className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
                <button
                  onClick={cancelAnnotation}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// ── File Breakdown Panel ──────────────────────────────────────────────────────
function FileBreakdownPanel({ runId, tradeColor }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFileBreakdown(runId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={18} /> Loading file breakdown…
    </div>
  )
  if (!data) return (
    <div className="text-center py-16 text-slate-500">
      <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
      <p>Could not load file breakdown.</p>
    </div>
  )

  const { files, total_items, unmatched_items } = data
  const filesWithItems = files.filter(f => f.item_count > 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{files.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">PDF Files</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{total_items}</div>
          <div className="text-xs text-slate-400 mt-0.5">Total Items</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{filesWithItems.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Files Contributing</div>
        </div>
        {unmatched_items > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{unmatched_items}</div>
            <div className="text-xs text-slate-400 mt-0.5">Unmatched Items</div>
          </div>
        )}
      </div>

      {/* Per-file cards */}
      <div className="space-y-3">
        {files.map(file => {
          const pct = total_items > 0 ? Math.round((file.item_count / total_items) * 100) : 0
          const hasContrib = file.item_count > 0
          return (
            <div
              key={file.file_id}
              className={`bg-slate-800 border rounded-xl overflow-hidden border-l-4 ${
                hasContrib ? tradeColor.border : 'border-l-slate-600'
              } border-slate-700`}
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileDown size={14} className={hasContrib ? 'text-slate-300' : 'text-slate-500'} />
                      <span className={`font-semibold truncate ${hasContrib ? 'text-white' : 'text-slate-500'}`}>
                        {file.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{file.page_count} page{file.page_count !== 1 ? 's' : ''}</span>
                      {file.sheet_count > 0 && (
                        <span>{file.sheet_count} sheet{file.sheet_count !== 1 ? 's' : ''} referenced</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-bold ${hasContrib ? 'text-white' : 'text-slate-600'}`}>
                      {file.item_count}
                    </div>
                    <div className="text-xs text-slate-400">
                      {hasContrib ? `${pct}% of items` : 'no items'}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {hasContrib && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tradeColor.dot.replace('bg-', 'bg-')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {/* Sheet ref chips */}
                {file.sheet_refs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {file.sheet_refs.map(ref => (
                      <span
                        key={ref}
                        className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {unmatched_items > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 text-sm text-yellow-300">
          <strong>{unmatched_items} item{unmatched_items !== 1 ? 's' : ''}</strong> could not be matched to a specific file —
          their source sheets were not found in the project sheet index.
        </div>
      )}
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
