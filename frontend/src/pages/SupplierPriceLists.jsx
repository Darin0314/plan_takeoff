import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, Trash2, PackageSearch, FileText, CalendarDays, Hash } from 'lucide-react'
import { api } from '../lib/api.js'

export default function SupplierPriceLists() {
  const [lists, setLists]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)

  // Upload form state
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [file, setFile]         = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await api.getSupplierLists()
      setLists(data.lists || [])
    } finally {
      setLoading(false)
    }
  }

  async function upload(e) {
    e.preventDefault()
    if (!file || !name.trim()) return
    setUploading(true)
    setError(null)
    setSuccess(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', name.trim())
      if (desc.trim()) fd.append('description', desc.trim())
      const data = await api.uploadSupplierList(fd)
      if (data.error) {
        setError(data.error + (data.hint ? ` — ${data.hint}` : ''))
      } else {
        setSuccess(`Imported "${data.list.name}" with ${data.list.row_count.toLocaleString()} prices.`)
        setLists(prev => [data.list, ...prev])
        setName('')
        setDesc('')
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch (err) {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function deleteList(id, listName) {
    if (!confirm(`Delete "${listName}" and all its prices?`)) return
    setDeleting(id)
    try {
      await api.deleteSupplierList(id)
      setLists(prev => prev.filter(l => l.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PackageSearch size={22} className="text-violet-400" />
          Supplier Price Lists
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload CSV price lists to compare against takeoff quantities. Required columns: <code className="bg-slate-700 px-1 rounded text-xs">trade</code>, <code className="bg-slate-700 px-1 rounded text-xs">category</code>, <code className="bg-slate-700 px-1 rounded text-xs">description</code>, <code className="bg-slate-700 px-1 rounded text-xs">unit_price</code>. Column <code className="bg-slate-700 px-1 rounded text-xs">unit</code> is optional.
        </p>
      </div>

      {/* Upload form */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Import New Price List</h2>
        <form onSubmit={upload} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">List Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. ABC Supply — Spring 2026"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Roofing + framing materials"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">CSV File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
                file ? 'border-violet-500 bg-violet-900/20' : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => setFile(e.target.files[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-violet-300">
                  <FileText size={16} /> {file.name}
                  <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="text-slate-400 text-sm">
                  <Upload size={18} className="mx-auto mb-1 text-slate-500" />
                  Click to select CSV file
                </div>
              )}
            </div>
          </div>

          {error   && <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg px-3 py-2">{error}</div>}
          {success && <div className="bg-green-900/40 border border-green-700 text-green-300 text-xs rounded-lg px-3 py-2">{success}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file || !name.trim()}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Importing…' : 'Import List'}
            </button>
          </div>
        </form>
      </div>

      {/* Existing lists */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Imported Lists</h2>
          <span className="text-xs text-slate-500">{lists.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={16} /> Loading…
          </div>
        ) : lists.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">No price lists imported yet.</div>
        ) : (
          <ul className="divide-y divide-slate-700">
            {lists.map(l => (
              <li key={l.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-700/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-white">{l.name}</div>
                  {l.description && <div className="text-xs text-slate-400 mt-0.5">{l.description}</div>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Hash size={11} /> {Number(l.row_count).toLocaleString()} prices</span>
                    <span className="flex items-center gap-1"><CalendarDays size={11} /> {new Date(l.imported_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteList(l.id, l.name)}
                  disabled={deleting === l.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-red-900/40 hover:bg-red-800 text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {deleting === l.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
