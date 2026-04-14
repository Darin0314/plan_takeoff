import { useState, useEffect } from 'react'
import { Loader2, Tag, AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronRight, PackageSearch } from 'lucide-react'
import { api } from '../lib/api.js'

const FMT = (n) => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

export default function SupplierPanel({ runId }) {
  const [lists, setLists]           = useState([])
  const [selectedList, setSelected] = useState('')
  const [match, setMatch]           = useState(null)
  const [loading, setLoading]       = useState(false)
  const [listsLoading, setListsLoading] = useState(true)
  const [collapsed, setCollapsed]   = useState({}) // category → bool
  const [filter, setFilter]         = useState('all') // 'all' | 'matched' | 'unmatched'

  useEffect(() => {
    api.getSupplierLists()
      .then(d => {
        setLists(d.lists || [])
        if (d.lists?.length) setSelected(String(d.lists[0].id))
      })
      .finally(() => setListsLoading(false))
  }, [])

  async function runMatch() {
    if (!selectedList) return
    setLoading(true)
    setMatch(null)
    try {
      const data = await api.getSupplierMatch(runId, selectedList)
      setMatch(data)
    } finally {
      setLoading(false)
    }
  }

  // Group items by category
  const grouped = match ? match.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {}) : {}

  const filteredGrouped = Object.entries(grouped).reduce((acc, [cat, items]) => {
    const filtered = items.filter(i =>
      filter === 'all' ? true :
      filter === 'matched' ? i.matched :
      !i.matched
    )
    if (filtered.length) acc[cat] = filtered
    return acc
  }, {})

  if (listsLoading) return (
    <div className="flex items-center justify-center h-32 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={16} /> Loading price lists…
    </div>
  )

  if (!lists.length) return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
      <PackageSearch size={36} className="mx-auto mb-3 text-slate-500" />
      <p className="text-slate-300 font-medium mb-1">No supplier price lists yet</p>
      <p className="text-slate-500 text-sm">
        Upload a CSV on the{' '}
        <a href="/supplier-prices" className="text-blue-400 hover:text-blue-300 underline">Supplier Price Lists</a>{' '}
        page, then come back to match prices.
      </p>
    </div>
  )

  return (
    <div>
      {/* Picker + Run */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-slate-400 mb-1.5">Supplier Price List</label>
            <select
              value={selectedList}
              onChange={e => { setSelected(e.target.value); setMatch(null) }}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {lists.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} ({Number(l.row_count).toLocaleString()} prices)
                </option>
              ))}
            </select>
          </div>
          <div className="pt-5">
            <button
              onClick={runMatch}
              disabled={loading || !selectedList}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
              Match Prices
            </button>
          </div>
          {match && (
            <div className="pt-5 flex items-center gap-1 text-xs">
              {['all', 'matched', 'unmatched'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded capitalize transition-colors ${
                    filter === f
                      ? 'bg-violet-700 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                  {f === 'matched'   && ` (${match.matched})`}
                  {f === 'unmatched' && ` (${match.unmatched})`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary cards */}
        {match && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <SummaryCard label="Items Matched" value={`${match.matched} / ${match.total_items}`} sub={`${Math.round(match.matched / match.total_items * 100)}% coverage`} color="text-blue-400" />
            <SummaryCard label="Supplier Total" value={FMT(match.total_supplier_cost)} color="text-violet-400" />
            <SummaryCard label="Default Total"  value={FMT(match.total_default_cost)} color="text-slate-300" />
            <SummaryCard
              label={match.total_savings >= 0 ? 'Est. Savings' : 'Est. Premium'}
              value={FMT(Math.abs(match.total_savings))}
              color={match.total_savings >= 0 ? 'text-green-400' : 'text-red-400'}
              icon={match.total_savings >= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            />
          </div>
        )}
      </div>

      {/* Results table */}
      {match && Object.entries(filteredGrouped).map(([cat, items]) => {
        const open = collapsed[cat] !== true
        const catTotal = items.reduce((s, i) => s + (i.extended_cost ?? 0), 0)

        return (
          <div key={cat} className="bg-slate-800 border border-slate-700 rounded-xl mb-3 overflow-hidden">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat}
                <span className="text-xs text-slate-500 font-normal">{items.length} items</span>
              </div>
              {catTotal > 0 && <span className="text-xs text-violet-300 font-medium">{FMT(catTotal)}</span>}
            </button>

            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-slate-700 bg-slate-900/40 text-slate-400">
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-left  px-3 py-2 font-medium">Unit</th>
                      <th className="text-right px-3 py-2 font-medium">Supplier $/unit</th>
                      <th className="text-right px-3 py-2 font-medium">Extended</th>
                      <th className="text-right px-3 py-2 font-medium">Default $/unit</th>
                      <th className="text-right px-3 py-2 font-medium">Default Ext.</th>
                      <th className="text-right px-4 py-2 font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <ItemRow key={item.item_id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {match && Object.keys(filteredGrouped).length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">No items match the current filter.</div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, color, icon }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold flex items-center gap-1 ${color}`}>
        {icon}{value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function ItemRow({ item }) {
  const matched = item.matched

  const deltaColor = !matched ? '' :
    item.delta == null ? '' :
    item.delta > 0 ? 'text-green-400' :
    item.delta < 0 ? 'text-red-400' : 'text-slate-400'

  const DeltaIcon = item.delta > 0 ? TrendingDown : item.delta < 0 ? TrendingUp : Minus

  return (
    <tr className={`border-t border-slate-700/50 ${!matched ? 'bg-amber-900/10' : 'hover:bg-slate-700/30'} transition-colors`}>
      <td className="px-4 py-2.5">
        <div className="text-slate-200">{item.description}</div>
        {matched ? (
          <div className="text-slate-500 mt-0.5">
            Matched: <span className="text-slate-400">{item.supplier_desc}</span>
            {' '}<span className={`text-xs px-1.5 py-0.5 rounded ${
              item.match_type === 'exact'    ? 'bg-green-900/50 text-green-400' :
              item.match_type === 'contains' ? 'bg-blue-900/50 text-blue-400' :
                                               'bg-slate-700 text-slate-400'
            }`}>{item.match_type}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-400 mt-0.5">
            <AlertTriangle size={11} /> No match found
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-slate-300">{item.quantity ?? '—'}</td>
      <td className="px-3 py-2.5 text-slate-400">{item.unit ?? '—'}</td>
      <td className="px-3 py-2.5 text-right text-violet-300">{matched ? FMT(item.supplier_unit_price) : '—'}</td>
      <td className="px-3 py-2.5 text-right font-medium text-white">{matched ? FMT(item.extended_cost) : '—'}</td>
      <td className="px-3 py-2.5 text-right text-slate-400">{item.default_unit_cost != null ? FMT(item.default_unit_cost) : '—'}</td>
      <td className="px-3 py-2.5 text-right text-slate-400">{FMT(item.default_extended)}</td>
      <td className="px-4 py-2.5 text-right">
        {item.delta != null ? (
          <span className={`flex items-center justify-end gap-1 font-medium ${deltaColor}`}>
            <DeltaIcon size={12} />{FMT(Math.abs(item.delta))}
          </span>
        ) : '—'}
      </td>
    </tr>
  )
}
