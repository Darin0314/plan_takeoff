import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Upload, FileText, Loader2,
  CheckCircle2, Clock, AlertCircle, Play, RefreshCw, CopyPlus, Pencil, Check, X
} from 'lucide-react'
import { api } from '../lib/api.js'

const TRADES = [
  { value: 'roofing',    label: 'Roofing',       color: 'bg-orange-600' },
  { value: 'framing',    label: 'Framing',        color: 'bg-yellow-600' },
  { value: 'drywall',    label: 'Drywall',        color: 'bg-purple-600' },
  { value: 'electrical', label: 'Electrical',     color: 'bg-blue-600' },
  { value: 'hvac',       label: 'HVAC',           color: 'bg-cyan-600' },
  { value: 'plumbing',   label: 'Plumbing',       color: 'bg-teal-600' },
  { value: 'concrete',   label: 'Concrete',       color: 'bg-stone-600' },
  { value: 'site_work',  label: 'Site Work',      color: 'bg-green-600' },
  { value: 'all',        label: 'All Trades',     color: 'bg-slate-600' },
]

const SHEET_TYPE_COLORS = {
  cover: 'bg-slate-600', specs: 'bg-slate-600', architectural: 'bg-blue-700',
  structural: 'bg-orange-700', civil: 'bg-green-700', mechanical: 'bg-cyan-700',
  electrical: 'bg-yellow-700', plumbing: 'bg-teal-700', landscape: 'bg-emerald-700',
  accessibility: 'bg-purple-700', fire: 'bg-red-700', other: 'bg-slate-600',
}

function statusIcon(status) {
  if (status === 'complete')    return <CheckCircle2 size={16} className="text-green-400" />
  if (status === 'processing')  return <Loader2 size={16} className="text-blue-400 animate-spin" />
  if (status === 'error')       return <AlertCircle size={16} className="text-red-400" />
  return <Clock size={16} className="text-slate-400" />
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [runningTrade, setRunningTrade] = useState(null)
  const fileRef = useRef()
  const pollRef = useRef()

  useEffect(() => {
    load()
    return () => clearInterval(pollRef.current)
  }, [id])

  async function load() {
    try {
      const data = await api.getProject(id)
      setProject(data.project)
      // Poll if any processing is in progress
      const hasProcessing =
        data.project.files?.some(f => f.process_status === 'processing') ||
        data.project.runs?.some(r => r.status === 'processing' || r.status === 'pending')
      if (hasProcessing) startPolling()
    } finally {
      setLoading(false)
    }
  }

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const data = await api.getProject(id)
      setProject(data.project)
      const still =
        data.project.files?.some(f => f.process_status === 'processing') ||
        data.project.runs?.some(r => r.status === 'processing' || r.status === 'pending')
      if (!still) clearInterval(pollRef.current)
    }, 3000)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.uploadFile(id, fd)
      startPolling()
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
      fileRef.current.value = ''
    }
  }

  async function handleRunTakeoff(trade) {
    setRunningTrade(trade)
    try {
      await api.runTakeoff(id, trade)
      startPolling()
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setRunningTrade(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading…
    </div>
  )
  if (!project) return <div className="text-red-400">Project not found</div>

  const { files = [], runs = [] } = project

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
        <Link to="/" className="hover:text-white transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-white">{project.name}</span>
      </div>

      {/* Project Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.client_name && <p className="text-slate-400 mt-1">{project.client_name}</p>}
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              {project.address && <span>{project.address}</span>}
              {project.permit_number && <span>Permit: {project.permit_number}</span>}
              <span className="capitalize">{project.project_type?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: Plan Sets */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Plan Sets</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload PDF
            </button>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
          </div>

          {files.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-10 text-center cursor-pointer transition-colors"
            >
              <Upload size={32} className="mx-auto mb-2 text-slate-500" />
              <p className="text-slate-400">Drop a PDF plan set here or click to upload</p>
              <p className="text-slate-600 text-sm mt-1">Supports full plan sets up to 200MB</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map(f => (
                <div key={f.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {statusIcon(f.process_status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{f.original_filename}</p>
                      <p className="text-slate-500 text-xs">
                        {f.page_count ? `${f.page_count} pages` : 'Processing…'} ·{' '}
                        {f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      f.process_status === 'complete'    ? 'bg-green-900 text-green-300' :
                      f.process_status === 'processing'  ? 'bg-blue-900 text-blue-300' :
                      f.process_status === 'error'       ? 'bg-red-900 text-red-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {f.process_status}
                    </span>
                  </div>

                  {/* Sheet list */}
                  {f.sheet_count > 0 && (
                    <SheetList fileId={f.id} sheetCount={f.sheet_count} />
                  )}
                  {f.process_status === 'error' && f.process_error && (
                    <p className="text-red-400 text-xs mt-2">{f.process_error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Takeoffs */}
        <div className="col-span-2">
          <h2 className="text-lg font-semibold text-white mb-3">Run Takeoff</h2>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
            <p className="text-slate-400 text-sm mb-3">Select a trade to extract quantities from the uploaded plans.</p>
            <div className="grid grid-cols-2 gap-2">
              {TRADES.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleRunTakeoff(t.value)}
                  disabled={files.every(f => f.process_status !== 'complete') || runningTrade === t.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${t.value === 'all' ? 'col-span-2' : ''}
                    ${t.color} hover:brightness-110 active:scale-95`}
                >
                  {runningTrade === t.value
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Play size={14} />
                  }
                  {t.label}
                </button>
              ))}
            </div>
            {files.every(f => f.process_status !== 'complete') && (
              <p className="text-slate-500 text-xs mt-2 text-center">Upload and process a plan set first</p>
            )}
          </div>

          {/* Previous Runs */}
          {runs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Previous Runs</h3>
              <div className="space-y-2">
                {runs.map(r => (
                  <button
                    key={r.id}
                    onClick={() => r.status === 'complete' && navigate(`/takeoffs/${r.id}`)}
                    disabled={r.status !== 'complete'}
                    className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:opacity-60 disabled:cursor-default rounded-lg p-3 text-left transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusIcon(r.status)}
                        <span className="text-white text-sm font-medium capitalize">
                          {r.trade.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.item_count > 0 && (
                          <span className="text-xs text-slate-400">{r.item_count} items</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === 'complete'   ? 'bg-green-900 text-green-300' :
                          r.status === 'processing' ? 'bg-blue-900 text-blue-300' :
                          r.status === 'error'      ? 'bg-red-900 text-red-300' :
                          'bg-slate-700 text-slate-400'
                        }`}>{r.status}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Floor Multipliers */}
          {files.some(f => f.process_status === 'complete') && (
            <FloorMultiplierPanel projectId={id} />
          )}
        </div>
      </div>
    </div>
  )
}

function SheetList({ fileId, sheetCount }) {
  const [sheets, setSheets]     = useState(null)
  const [expanded, setExpanded] = useState(false)

  async function load() {
    if (sheets) { setExpanded(!expanded); return }
    const data = await api.getFileSheets(fileId)
    setSheets(data.sheets || [])
    setExpanded(true)
  }

  return (
    <div>
      <button
        onClick={load}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <FileText size={12} />
        {sheetCount} sheet{sheetCount !== 1 ? 's' : ''} detected
        {expanded ? ' ▲' : ' ▼'}
      </button>
      {expanded && sheets && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {sheets.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`px-1.5 py-0.5 rounded text-white text-xs ${SHEET_TYPE_COLORS[s.sheet_type] || 'bg-slate-600'}`}>
                {s.sheet_number || `p.${s.page_number + 1}`}
              </span>
              <span className="truncate">{s.sheet_title || s.sheet_type}</span>
              {s.drawing_scale && <span className="text-slate-600 ml-auto shrink-0">{s.drawing_scale}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FloorMultiplierPanel({ projectId }) {
  const [sheets, setSheets]       = useState(null)
  const [detecting, setDetecting] = useState(false)

  async function runDetection() {
    setDetecting(true)
    try {
      await api.detectFloors(projectId)
      setTimeout(async () => {
        await loadMultipliers()
        setDetecting(false)
      }, 4000)
    } catch (_) { setDetecting(false) }
  }

  async function loadMultipliers() {
    const data = await api.getFloorMultipliers(projectId)
    setSheets(data.sheets || [])
  }

  const nonTrivial = (sheets || []).filter(s => parseFloat(s.floor_multiplier) > 1)

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
          <CopyPlus size={14} className="text-violet-400" /> Floor Multipliers
        </h3>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="flex items-center gap-1.5 text-xs bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg transition-colors"
        >
          {detecting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {detecting ? 'Detecting…' : 'Auto-Detect'}
        </button>
      </div>

      {sheets === null ? (
        <button
          onClick={loadMultipliers}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Load multipliers ▼
        </button>
      ) : (
        <div>
          {nonTrivial.length === 0 ? (
            <p className="text-slate-500 text-xs italic">No repeat floors detected. Run auto-detect or set manually below.</p>
          ) : (
            <p className="text-xs text-violet-300 mb-2">{nonTrivial.length} typical floor{nonTrivial.length !== 1 ? 's' : ''} detected</p>
          )}
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {(sheets || []).filter(s => s.sheet_number || s.sheet_title).map(s => (
              <MultiplierRow key={s.id} sheet={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MultiplierRow({ sheet: initialSheet }) {
  const [sheet, setSheet]     = useState(initialSheet)
  const [editing, setEditing] = useState(false)
  const [multVal, setMultVal] = useState('')
  const [noteVal, setNoteVal] = useState('')
  const [saving, setSaving]   = useState(false)

  function startEdit() {
    setMultVal(String(parseFloat(sheet.floor_multiplier) || 1))
    setNoteVal(sheet.floor_multiplier_note || '')
    setEditing(true)
  }

  async function save() {
    const m = parseFloat(multVal)
    if (isNaN(m) || m < 1) return
    setSaving(true)
    try {
      const res = await api.updateSheetMultiplier(sheet.id, {
        floor_multiplier: m,
        floor_multiplier_note: noteVal.trim(),
      })
      setSheet(res.sheet)
      setEditing(false)
    } catch (_) {}
    setSaving(false)
  }

  const mult      = parseFloat(sheet.floor_multiplier) || 1
  const isTypical = mult > 1

  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1 text-xs group ${isTypical ? 'bg-violet-900/20' : 'bg-slate-800/40'}`}>
      <span className={`font-mono shrink-0 px-1.5 py-0.5 rounded text-white ${
        sheet.sheet_type === 'architectural' ? 'bg-blue-700' :
        sheet.sheet_type === 'structural'    ? 'bg-orange-700' : 'bg-slate-600'
      }`}>
        {sheet.sheet_number || '—'}
      </span>
      <span className="text-slate-300 truncate flex-1">{sheet.sheet_title || sheet.sheet_type}</span>
      {editing ? (
        <>
          <input type="number" min="1" step="1" value={multVal} onChange={e => setMultVal(e.target.value)}
            className="w-14 bg-slate-700 border border-violet-500 rounded px-1.5 py-0.5 text-white text-center focus:outline-none" />
          <input type="text" value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="note"
            className="w-24 bg-slate-700 border border-violet-500 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none" />
          <button onClick={save} disabled={saving} className="p-0.5 text-green-400 hover:text-green-300">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={() => setEditing(false)} className="p-0.5 text-slate-400 hover:text-slate-200"><X size={12} /></button>
        </>
      ) : (
        <>
          <span className={`font-mono font-bold shrink-0 ${isTypical ? 'text-violet-300' : 'text-slate-500'}`}>
            ×{mult.toFixed(0)}
          </span>
          {sheet.floor_multiplier_note && (
            <span className="text-slate-500 truncate max-w-[80px]" title={sheet.floor_multiplier_note}>
              {sheet.floor_multiplier_note}
            </span>
          )}
          <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-200 transition-opacity">
            <Pencil size={11} />
          </button>
        </>
      )}
    </div>
  )
}
