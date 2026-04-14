/**
 * DiffPanel — compare two runs of the same trade on the same project.
 * Shows added / changed / removed / unchanged item buckets.
 */
import { useState, useEffect } from 'react'
import { Loader2, Plus, Minus, ArrowRight, Equal, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { api } from '../lib/api.js'

export default function DiffPanel({ runId, projectId, trade }) {
  const [runs, setRuns]               = useState([])
  const [baselineId, setBaselineId]   = useState('')
  const [diff, setDiff]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [filter, setFilter]           = useState('all') // all | added | changed | removed | unchanged

  // Load all completed runs for this project/trade to populate the baseline picker
  useEffect(() => {
    api.getProjectTakeoffs(projectId)
      .then(d => {
        const eligible = (d.runs || []).filter(r =>
          r.status === 'complete' &&
          r.trade  === trade      &&
          String(r.id) !== String(runId)
        ).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        setRuns(eligible)
        if (eligible.length > 0) setBaselineId(String(eligible[0].id))
      })
      .catch(() => {})
      .finally(() => setLoadingRuns(false))
  }, [projectId, trade, runId])

  async function runDiff() {
    if (!baselineId) return
    setLoading(true)
    setDiff(null)
    try {
      const d = await api.getDiff(runId, baselineId)
      setDiff(d)
    } catch (_) {}
    setLoading(false)
  }

  if (loadingRuns) return (
    <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
      <Loader2 className="animate-spin" size={18} /> Loading runs…
    </div>
  )

  if (runs.length === 0) return (
    <div className="text-center py-12 text-slate-500">
      <p className="text-sm">No other completed runs of this trade to compare against.</p>
      <p className="text-xs mt-1 text-slate-600">Run the takeoff again after making changes to enable comparison.</p>
    </div>
  )

  const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'
  const fmtDelta = (d) => {
    if (d == null) return null
    const sign = d > 0 ? '+' : ''
    return sign + Number(d).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  // Group items into category sections
  function groupByCategory(items) {
    const out = {}
    for (const item of items) {
      const cat = item.category || 'General'
      if (!out[cat]) out[cat] = []
      out[cat].push(item)
    }
    return out
  }

  const buckets = diff ? {
    added:     diff.added     || [],
    changed:   diff.changed   || [],
    removed:   diff.removed   || [],
    unchanged: diff.unchanged || [],
  } : null

  const visibleAdded     = filter === 'all' || filter === 'added'
  const visibleChanged   = filter === 'all' || filter === 'changed'
  const visibleRemoved   = filter === 'all' || filter === 'removed'
  const visibleUnchanged = filter === 'all' || filter === 'unchanged'

  return (
    <div>
      {/* Baseline picker */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300 font-medium">Compare against:</span>
        <div className="relative">
          <select
            value={baselineId}
            onChange={e => { setBaselineId(e.target.value); setDiff(null) }}
            className="appearance-none bg-slate-700 border border-slate-600 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                Run #{r.id} — {r.completed_at ? new Date(r.completed_at).toLocaleString() : 'unknown'} ({r.item_count ?? '?'} items)
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <button
          onClick={runDiff}
          disabled={!baselineId || loading}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {/* Results */}
      {diff && buckets && (
        <div>
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { key: 'added',     label: 'Added',     count: buckets.added.length,     bg: 'bg-green-900/40',  border: 'border-green-700',  text: 'text-green-300',  num: 'text-green-400' },
              { key: 'changed',   label: 'Changed',   count: buckets.changed.length,   bg: 'bg-amber-900/40',  border: 'border-amber-700',  text: 'text-amber-300',  num: 'text-amber-400' },
              { key: 'removed',   label: 'Removed',   count: buckets.removed.length,   bg: 'bg-red-900/40',    border: 'border-red-700',    text: 'text-red-300',    num: 'text-red-400' },
              { key: 'unchanged', label: 'Unchanged', count: buckets.unchanged.length, bg: 'bg-slate-800',     border: 'border-slate-700',  text: 'text-slate-400',  num: 'text-slate-300' },
            ].map(({ key, label, count, bg, border, text, num }) => (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? 'all' : key)}
                className={`${bg} border ${border} rounded-xl p-4 text-center cursor-pointer transition-all ${
                  filter === key ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500' : 'hover:brightness-125'
                }`}
              >
                <div className={`text-3xl font-bold ${num}`}>{count}</div>
                <div className={`text-xs font-medium mt-1 ${text}`}>{label.toUpperCase()}</div>
              </button>
            ))}
          </div>

          {/* Baseline info */}
          <div className="text-xs text-slate-500 mb-4 flex items-center gap-2">
            <span>Baseline: Run #{diff.baseline_run?.id} ({diff.summary.total_old} items)</span>
            <span>→</span>
            <span>This run: Run #{diff.new_run?.id} ({diff.summary.total_new} items)</span>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="ml-auto text-blue-400 hover:text-blue-300">Show all</button>
            )}
          </div>

          {/* Added items */}
          {visibleAdded && buckets.added.length > 0 && (
            <DiffSection
              title="Added"
              count={buckets.added.length}
              accent="border-l-green-500"
              headerBg="bg-green-900/20"
              badge="bg-green-500/20 text-green-300"
              icon={<Plus size={14} className="text-green-400" />}
              grouped={groupByCategory(buckets.added)}
              renderItem={(item) => (
                <DiffItemRow
                  description={item.description}
                  qty={fmt(item.quantity)}
                  unit={item.unit}
                  notes={item.unit_notes}
                  confidence={item.confidence}
                  rowClass="bg-green-950/20"
                  qtyClass="text-green-300"
                />
              )}
            />
          )}

          {/* Changed items */}
          {visibleChanged && buckets.changed.length > 0 && (
            <DiffSection
              title="Changed"
              count={buckets.changed.length}
              accent="border-l-amber-500"
              headerBg="bg-amber-900/20"
              badge="bg-amber-500/20 text-amber-300"
              icon={<TrendingUp size={14} className="text-amber-400" />}
              grouped={groupByCategory(buckets.changed.map(c => c.item))}
              renderItem={(item) => {
                const entry = buckets.changed.find(c => c.item.id === item.id || c.item === item)
                if (!entry) return null
                const delta = entry.qty_delta
                const pct   = entry.qty_pct
                return (
                  <DiffItemRow
                    description={item.description}
                    qty={
                      <span className="flex items-center justify-end gap-1.5">
                        <span className="line-through text-slate-500">{fmt(entry.old_quantity)}</span>
                        <ArrowRight size={11} className="text-slate-500 flex-shrink-0" />
                        <span className="text-amber-300 font-semibold">{fmt(entry.new_quantity)}</span>
                        {delta != null && delta !== 0 && (
                          <span className={`text-xs ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ({fmtDelta(delta)}{pct != null ? ` / ${delta > 0 ? '+' : ''}${pct}%` : ''})
                          </span>
                        )}
                      </span>
                    }
                    unit={
                      entry.unit_changed
                        ? <span className="flex items-center gap-1">
                            <span className="line-through text-slate-500">{entry.old_unit || '—'}</span>
                            <ArrowRight size={10} className="text-slate-500" />
                            <span className="text-amber-300">{entry.new_unit || '—'}</span>
                          </span>
                        : item.unit
                    }
                    notes={item.unit_notes}
                    confidence={item.confidence}
                    rowClass="bg-amber-950/20"
                    qtyClass="text-amber-300"
                  />
                )
              }}
            />
          )}

          {/* Removed items */}
          {visibleRemoved && buckets.removed.length > 0 && (
            <DiffSection
              title="Removed"
              count={buckets.removed.length}
              accent="border-l-red-500"
              headerBg="bg-red-900/20"
              badge="bg-red-500/20 text-red-300"
              icon={<Minus size={14} className="text-red-400" />}
              grouped={groupByCategory(buckets.removed)}
              renderItem={(item) => (
                <DiffItemRow
                  description={item.description}
                  qty={fmt(item.quantity)}
                  unit={item.unit}
                  notes={item.unit_notes}
                  confidence={item.confidence}
                  rowClass="bg-red-950/20"
                  qtyClass="text-red-300 line-through"
                />
              )}
            />
          )}

          {/* Unchanged items (collapsed by default, only shown if filter === unchanged or all+explicit) */}
          {visibleUnchanged && buckets.unchanged.length > 0 && (
            <DiffSection
              title="Unchanged"
              count={buckets.unchanged.length}
              accent="border-l-slate-600"
              headerBg="bg-slate-800"
              badge="bg-slate-700 text-slate-400"
              icon={<Equal size={14} className="text-slate-500" />}
              grouped={groupByCategory(buckets.unchanged)}
              collapsedByDefault={filter === 'all'}
              renderItem={(item) => (
                <DiffItemRow
                  description={item.description}
                  qty={fmt(item.quantity)}
                  unit={item.unit}
                  notes={item.unit_notes}
                  confidence={item.confidence}
                  rowClass="opacity-50"
                  qtyClass="text-slate-400"
                />
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DiffSection({ title, count, accent, headerBg, badge, icon, grouped, renderItem, collapsedByDefault = false }) {
  const [collapsed, setCollapsed] = useState(collapsedByDefault)

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden border-l-4 ${accent} mb-4`}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`w-full px-5 py-3 ${headerBg} border-b border-slate-700 flex items-center justify-between hover:brightness-110 transition-all`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-white">{title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{count}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-slate-700/50">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-5 py-1.5 bg-slate-750 text-xs text-slate-400 font-medium border-b border-slate-700/50">
                {category}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-700/30">
                    <th className="text-left px-5 py-1.5 font-medium">Description</th>
                    <th className="text-right px-4 py-1.5 font-medium w-48">Quantity</th>
                    <th className="text-left px-4 py-1.5 font-medium w-20">Unit</th>
                    <th className="text-left px-4 py-1.5 font-medium hidden sm:table-cell">Notes</th>
                    <th className="text-center px-4 py-1.5 font-medium w-20">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id ?? idx}>
                      {renderItem(item)}
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

function DiffItemRow({ description, qty, unit, notes, confidence, rowClass, qtyClass }) {
  const confColors = {
    high:   'text-green-400',
    medium: 'text-yellow-400',
    low:    'text-red-400',
  }
  const confLabels = { high: 'High', medium: 'Med', low: 'Low' }

  return (
    <>
      <td className={`px-5 py-2.5 text-sm text-white ${rowClass}`}>{description}</td>
      <td className={`px-4 py-2.5 text-sm text-right ${qtyClass} ${rowClass}`}>
        {typeof qty === 'string' ? qty : qty}
      </td>
      <td className={`px-4 py-2.5 text-sm text-slate-400 ${rowClass}`}>{unit || '—'}</td>
      <td className={`px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell ${rowClass}`}>{notes || ''}</td>
      <td className={`px-4 py-2.5 text-xs text-center font-medium ${confColors[confidence] || 'text-slate-400'} ${rowClass}`}>
        {confLabels[confidence] || confidence || '—'}
      </td>
    </>
  )
}
