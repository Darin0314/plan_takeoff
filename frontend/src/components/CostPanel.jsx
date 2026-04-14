/**
 * CostPanel — shows cost estimate for a takeoff run.
 * Loads /takeoffs/{runId}/cost-summary, lets users edit unit costs inline.
 */
import { useState, useEffect, useCallback } from 'react'
import { Loader2, DollarSign, Pencil, Check, X } from 'lucide-react'
import { api } from '../lib/api.js'

const TRADE_META = {
  roofing:    { label: 'Roofing',     color: 'bg-orange-500',  text: 'text-orange-300' },
  framing:    { label: 'Framing',     color: 'bg-amber-600',   text: 'text-amber-300'  },
  drywall:    { label: 'Drywall',     color: 'bg-zinc-400',    text: 'text-zinc-300'   },
  electrical: { label: 'Electrical',  color: 'bg-yellow-400',  text: 'text-yellow-300' },
  hvac:       { label: 'HVAC',        color: 'bg-cyan-500',    text: 'text-cyan-300'   },
  plumbing:   { label: 'Plumbing',    color: 'bg-blue-500',    text: 'text-blue-300'   },
  concrete:   { label: 'Concrete',    color: 'bg-stone-400',   text: 'text-stone-300'  },
  site_work:  { label: 'Site Work',   color: 'bg-green-500',   text: 'text-green-300'  },
  all:        { label: 'All Trades',  color: 'bg-violet-500',  text: 'text-violet-300' },
}

const TRADE_COLORS = Object.fromEntries(
  Object.entries(TRADE_META).map(([k, v]) => [k, v.text])
)

function fmt(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CostRow({ item, onSaved }) {
  const [editing, setEditing]   = useState(false)
  const [mat, setMat]           = useState('')
  const [lab, setLab]           = useState('')
  const [saving, setSaving]     = useState(false)

  function startEdit() {
    setMat(item.unit_cost_material_effective != null ? String(item.unit_cost_material_effective) : '')
    setLab(item.unit_cost_labor_effective    != null ? String(item.unit_cost_labor_effective)    : '')
    setEditing(true)
  }

  function cancelEdit() { setEditing(false) }

  async function save() {
    setSaving(true)
    try {
      await api.setItemCost(item.id, {
        unit_cost_material: parseFloat(mat) || 0,
        unit_cost_labor:    parseFloat(lab) || 0,
      })
      onSaved()
      setEditing(false)
    } catch (_) {}
    setSaving(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter')  save()
    if (e.key === 'Escape') cancelEdit()
  }

  const qty = item.quantity != null ? Number(item.quantity) : null
  const isOverride = item.cost_source === 'override'

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors group">
      <td className="px-5 py-2.5 text-sm text-white">{item.description}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300">
        {qty != null ? qty.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        <span className="text-slate-500 ml-1 text-xs">{item.unit || ''}</span>
      </td>

      {/* Unit cost material */}
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number" min="0" step="0.01" value={mat}
            onChange={e => setMat(e.target.value)} onKeyDown={onKeyDown}
            className="w-20 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-white font-mono text-sm text-right focus:outline-none"
          />
        ) : (
          <span className={`font-mono text-sm ${isOverride ? 'text-amber-300' : 'text-slate-300'}`}>
            {item.unit_cost_material_effective != null ? fmt(item.unit_cost_material_effective) : '—'}
          </span>
        )}
      </td>

      {/* Unit cost labor */}
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number" min="0" step="0.01" value={lab}
            onChange={e => setLab(e.target.value)} onKeyDown={onKeyDown}
            className="w-20 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-white font-mono text-sm text-right focus:outline-none"
          />
        ) : (
          <span className={`font-mono text-sm ${isOverride ? 'text-amber-300' : 'text-slate-300'}`}>
            {item.unit_cost_labor_effective != null ? fmt(item.unit_cost_labor_effective) : '—'}
          </span>
        )}
      </td>

      {/* Total */}
      <td className="px-4 py-2.5 text-right font-mono text-sm text-white font-medium">
        {fmt(item.total_cost)}
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5 w-16">
        <div className="flex items-center justify-center gap-1">
          {editing ? (
            <>
              <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-green-700/40 text-green-400" title="Save (Enter)">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={cancelEdit} className="p-1 rounded hover:bg-slate-600 text-slate-400" title="Cancel (Esc)">
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 text-slate-400 transition-all"
              title="Edit unit costs"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function CostPanel({ runId, trade }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.getCostSummary(runId)
      setData(d)
    } catch (_) {}
    setLoading(false)
  }, [runId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={18} /> Loading cost estimate…
    </div>
  )
  if (!data) return <div className="text-red-400 text-sm">Failed to load cost summary.</div>

  const tradeClass = TRADE_COLORS[trade] || TRADE_COLORS.all

  // Group items by category
  const grouped = data.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Grand total banner */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-wrap gap-6">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Material</div>
          <div className="text-xl font-bold text-green-300">{fmt(data.grand_material)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Labor</div>
          <div className="text-xl font-bold text-blue-300">{fmt(data.grand_labor)}</div>
        </div>
        <div className="border-l border-slate-600 pl-6">
          <div className="text-xs text-slate-400 mb-0.5">Total Estimate</div>
          <div className={`text-2xl font-bold ${tradeClass}`}>{fmt(data.grand_total)}</div>
        </div>
        <div className="ml-auto text-right text-xs text-slate-500 self-end">
          <div>Hover any row to edit unit costs</div>
          <div>Amber = manually overridden · Grey = library default</div>
        </div>
      </div>

      {/* By-trade breakdown — shown when multiple trades present */}
      {Object.keys(data.by_trade || {}).length > 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Cost by Trade</h3>
          <div className="space-y-3">
            {Object.entries(data.by_trade).map(([tradeKey, sub]) => {
              const meta     = TRADE_META[tradeKey] || TRADE_META.all
              const pct      = data.grand_total > 0 ? (sub.total / data.grand_total) * 100 : 0
              const matPct   = sub.total > 0 ? (sub.material / sub.total) * 100 : 0
              return (
                <div key={tradeKey}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.color}`} />
                      <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
                      <span className="text-xs text-slate-500">{sub.items} item{sub.items !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Mat <span className="text-green-300">{fmt(sub.material)}</span></span>
                      <span>Lab <span className="text-blue-300">{fmt(sub.labor)}</span></span>
                      <span className={`font-medium w-24 text-right ${meta.text}`}>{fmt(sub.total)}</span>
                      <span className="text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  {/* Stacked bar: material (green) + labor (blue) */}
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                    <div className="bg-green-500/70 h-full" style={{ width: `${pct * matPct / 100}%` }} />
                    <div className="bg-blue-500/70 h-full" style={{ width: `${pct * (100 - matPct) / 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/70" /> Material</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70" /> Labor</span>
            <span className="ml-auto">Bar width = % of total project cost</span>
          </div>
        </div>
      )}

      {/* Per-category tables */}
      {Object.entries(grouped).map(([category, catItems]) => {
        const sub = data.by_category[category] || {}
        return (
          <div key={category} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-750 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <DollarSign size={14} className="text-slate-400" />
                {category}
              </h3>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Mat: <span className="text-green-300">{fmt(sub.material)}</span></span>
                <span>Lab: <span className="text-blue-300">{fmt(sub.labor)}</span></span>
                <span className="font-medium text-white">{fmt(sub.total)}</span>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="text-left px-5 py-2 font-medium">Description</th>
                  <th className="text-right px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">$/Unit Mat</th>
                  <th className="text-right px-4 py-2 font-medium">$/Unit Lab</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {catItems.map(item => (
                  <CostRow key={item.id} item={item} onSaved={load} />
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
