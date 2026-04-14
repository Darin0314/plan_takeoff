import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitCompareArrows, Loader2, ArrowLeft, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { api } from '../lib/api.js'

const TRADES = [
  { value: 'roofing',    label: 'Roofing',     color: 'text-orange-400' },
  { value: 'framing',    label: 'Framing',     color: 'text-amber-400' },
  { value: 'drywall',    label: 'Drywall',     color: 'text-zinc-400' },
  { value: 'electrical', label: 'Electrical',  color: 'text-yellow-400' },
  { value: 'hvac',       label: 'HVAC',        color: 'text-cyan-400' },
  { value: 'plumbing',   label: 'Plumbing',    color: 'text-blue-400' },
  { value: 'concrete',   label: 'Concrete',    color: 'text-stone-400' },
  { value: 'site_work',  label: 'Site Work',   color: 'text-green-400' },
  { value: 'all_trades', label: 'All Trades',  color: 'text-purple-400' },
]

const TRADE_BORDER = {
  roofing: 'border-l-orange-500', framing: 'border-l-amber-600', drywall: 'border-l-zinc-400',
  electrical: 'border-l-yellow-400', hvac: 'border-l-cyan-500', plumbing: 'border-l-blue-500',
  concrete: 'border-l-stone-400', site_work: 'border-l-green-500', all_trades: 'border-l-purple-500',
}

function fmtQty(val) {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function DeltaBadge({ delta, pct }) {
  if (delta === null || delta === undefined) return null
  if (delta === 0) return <span className="text-slate-500 text-xs">no change</span>
  const up = delta > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{fmtQty(delta)}
      {pct !== null && <span className="opacity-70 ml-0.5">({up ? '+' : ''}{pct}%)</span>}
    </span>
  )
}

export default function ProjectComparison() {
  const navigate  = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [idA,      setIdA]      = useState('')
  const [idB,      setIdB]      = useState('')
  const [trade,    setTrade]    = useState('roofing')
  const [result,   setResult]   = useState(null)
  const [comparing, setComparing] = useState(false)
  const [error,    setError]    = useState(null)
  const [filter,   setFilter]   = useState('all') // all | diff | a_only | b_only

  useEffect(() => {
    api.getProjects().then(d => setProjects(d.projects || [])).finally(() => setLoading(false))
  }, [])

  async function runCompare() {
    if (!idA || !idB || !trade) return
    setComparing(true)
    setError(null)
    setResult(null)
    setFilter('all')
    try {
      const data = await api.compareProjects(idA, idB, trade)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setComparing(false)
    }
  }

  const rows = result?.rows || []
  const filteredRows = rows.filter(r => {
    if (filter === 'all')    return true
    if (filter === 'diff')   return r.side === 'both' && r.changed
    if (filter === 'a_only') return r.side === 'a_only'
    if (filter === 'b_only') return r.side === 'b_only'
    return true
  })

  // Group by category
  const grouped = {}
  for (const row of filteredRows) {
    const cat = row.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(row)
  }

  const tradeBorder = TRADE_BORDER[trade] || 'border-l-slate-600'
  const tradeLabel  = TRADES.find(t => t.value === trade)?.label || trade

  const summary = result?.summary
  const hasRunA = !!result?.run_a
  const hasRunB = !!result?.run_b

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading projects…
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompareArrows size={24} className="text-purple-400" />
            Project Comparison
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Compare takeoff quantities side-by-side across two projects</p>
        </div>
      </div>

      {/* Picker panel */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Project A */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Project A</label>
            <select
              value={idA}
              onChange={e => setIdA(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id} disabled={String(p.id) === String(idB)}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Project B */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Project B</label>
            <select
              value={idB}
              onChange={e => setIdB(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id} disabled={String(p.id) === String(idA)}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Trade */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Trade</label>
            <select
              value={trade}
              onChange={e => setTrade(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {TRADES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={runCompare}
            disabled={!idA || !idB || comparing}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors"
          >
            {comparing ? <Loader2 size={16} className="animate-spin" /> : <GitCompareArrows size={16} />}
            {comparing ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 flex items-center gap-3 text-red-300">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {/* No run warning */}
      {result && (!hasRunA || !hasRunB) && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-6 flex items-center gap-3 text-amber-300">
          <AlertCircle size={18} className="shrink-0" />
          {!hasRunA && !hasRunB
            ? `Neither project has a complete ${tradeLabel} takeoff run.`
            : !hasRunA
            ? `${result.project_a.name} has no complete ${tradeLabel} takeoff run.`
            : `${result.project_b.name} has no complete ${tradeLabel} takeoff run.`}
        </div>
      )}

      {/* Summary cards */}
      {result && hasRunA && hasRunB && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Items Changed"  value={summary.both_diff}  color="text-amber-400" />
          <SummaryCard label="Only in A"       value={summary.only_a}     color="text-red-400" />
          <SummaryCard label="Only in B"       value={summary.only_b}     color="text-green-400" />
          <SummaryCard label="Matching"         value={summary.both_same}  color="text-slate-400" />
        </div>
      )}

      {/* Results table */}
      {result && hasRunA && hasRunB && rows.length > 0 && (
        <div className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden border-l-4 ${tradeBorder}`}>

          {/* Project name header */}
          <div className="px-6 py-4 border-b border-slate-700">
            <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr_auto_auto] gap-2 items-center">
              <div className="col-span-2">
                <span className="text-xs text-slate-400 uppercase tracking-wide">Project A</span>
                <p className="text-white font-medium truncate">{result.project_a.name}</p>
                <p className="text-slate-500 text-xs">Run: {result.run_a?.completed_at?.slice(0,10) || '—'}</p>
              </div>
              <div />
              <div className="col-span-2">
                <span className="text-xs text-slate-400 uppercase tracking-wide">Project B</span>
                <p className="text-white font-medium truncate">{result.project_b.name}</p>
                <p className="text-slate-500 text-xs">Run: {result.run_b?.completed_at?.slice(0,10) || '—'}</p>
              </div>
              <div className="col-span-2" />
            </div>
          </div>

          {/* Filter bar */}
          <div className="px-6 py-3 border-b border-slate-700 flex gap-2 flex-wrap">
            {[
              { key: 'all',    label: `All (${rows.length})` },
              { key: 'diff',   label: `Changed (${summary.both_diff})` },
              { key: 'a_only', label: `Only A (${summary.only_a})` },
              { key: 'b_only', label: `Only B (${summary.only_b})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-xs text-slate-500 hover:text-slate-300 ml-1 transition-colors">
                Clear filter
              </button>
            )}
          </div>

          {/* Column headers */}
          <div className="px-6 py-2 grid grid-cols-[160px_1fr_80px_80px_80px_80px_120px] gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-700">
            <div>Category</div>
            <div>Description</div>
            <div className="text-right">Qty A</div>
            <div>Unit</div>
            <div className="text-right">Qty B</div>
            <div>Unit</div>
            <div className="text-center">Delta (B−A)</div>
          </div>

          {/* Rows grouped by category */}
          {Object.entries(grouped).map(([cat, catRows]) => (
            <div key={cat}>
              <div className="px-6 py-1.5 bg-slate-900/40 border-b border-slate-700/60">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</span>
              </div>
              {catRows.map((row, i) => <CompareRow key={i} row={row} />)}
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500 text-sm">
              No items match this filter.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {result && hasRunA && hasRunB && rows.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <Minus size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">No takeoff items found for {tradeLabel} in either project.</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

function CompareRow({ row }) {
  const isAOnly  = row.side === 'a_only'
  const isBOnly  = row.side === 'b_only'
  const changed  = row.side === 'both' && row.changed

  let rowBg = ''
  if (isAOnly)  rowBg = 'bg-red-900/10 hover:bg-red-900/20'
  else if (isBOnly) rowBg = 'bg-green-900/10 hover:bg-green-900/20'
  else if (changed) rowBg = 'bg-amber-900/10 hover:bg-amber-900/20'
  else rowBg = 'hover:bg-slate-700/30'

  return (
    <div className={`px-6 py-2.5 grid grid-cols-[160px_1fr_80px_80px_80px_80px_120px] gap-2 items-center border-b border-slate-700/40 text-sm transition-colors ${rowBg}`}>
      <div /> {/* Category handled by group header */}
      <div className="text-slate-200 text-xs">{row.description}</div>

      {/* Qty A */}
      <div className={`text-right font-mono text-xs tabular-nums ${isAOnly ? 'text-red-300' : isBOnly ? 'text-slate-600' : 'text-slate-300'}`}>
        {isAOnly ? <span className="text-red-400">{fmtQty(row.qty_a)}</span> : fmtQty(row.qty_a)}
      </div>
      <div className="text-slate-500 text-xs">{row.unit_a || '—'}</div>

      {/* Qty B */}
      <div className={`text-right font-mono text-xs tabular-nums ${isBOnly ? 'text-green-300' : isAOnly ? 'text-slate-600' : 'text-slate-300'}`}>
        {isBOnly ? <span className="text-green-400">{fmtQty(row.qty_b)}</span> : fmtQty(row.qty_b)}
      </div>
      <div className="text-slate-500 text-xs">{row.unit_b || '—'}</div>

      {/* Delta */}
      <div className="text-center">
        {isAOnly && <span className="text-xs text-red-400 font-medium">only in A</span>}
        {isBOnly && <span className="text-xs text-green-400 font-medium">only in B</span>}
        {row.side === 'both' && (
          changed
            ? <DeltaBadge delta={row.delta} pct={row.pct} />
            : <span className="text-slate-600 text-xs">—</span>
        )}
      </div>
    </div>
  )
}
