import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, MapPin, Hash, Layers, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '../lib/api.js'

const PROJECT_TYPES = [
  { value: 'residential',  label: 'Residential' },
  { value: 'multi_family', label: 'Multi-Family' },
  { value: 'commercial',   label: 'Commercial' },
  { value: 'mixed_use',    label: 'Mixed Use' },
  { value: 'other',        label: 'Other' },
]

export default function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ name: '', address: '', permit_number: '', client_name: '', project_type: 'residential', notes: '' })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await api.getProjects()
      setProjects(data.projects || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api.createProject(form)
      navigate(`/projects/${data.id}`)
    } catch (err) {
      alert(err.message)
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="animate-spin mr-2" size={20} /> Loading projects…
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 text-sm mt-1">Upload plan sets and run AI takeoffs by trade</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> New Project
        </button>
      </div>

      {/* New Project Form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Project</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Project Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="Park Multi-Family Bldg A"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Client Name</label>
              <input
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="General Contractor or Owner"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Permit Number</label>
              <input
                value={form.permit_number}
                onChange={e => setForm(f => ({ ...f, permit_number: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="BLD-2024-3544"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Project Address</label>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="4th & Park, Spokane Valley, WA 99216"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Project Type</label>
              <select
                value={form.project_type}
                onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Project'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white px-4 py-2 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project List */}
      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No projects yet</p>
          <p className="text-sm">Create a project and upload a PDF plan set to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-xl p-5 text-left transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderOpen size={18} className="text-blue-400" />
                    <h3 className="font-semibold text-white text-lg">{p.name}</h3>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                      {p.project_type.replace('_', ' ')}
                    </span>
                  </div>
                  {p.client_name && <p className="text-slate-400 text-sm ml-6">{p.client_name}</p>}
                  <div className="flex items-center gap-4 mt-2 ml-6 text-sm text-slate-500">
                    {p.address && <span className="flex items-center gap-1"><MapPin size={13} />{p.address}</span>}
                    {p.permit_number && <span className="flex items-center gap-1"><Hash size={13} />{p.permit_number}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm text-slate-400">
                  <div className="text-center">
                    <div className="text-white font-semibold">{p.file_count}</div>
                    <div className="text-xs">plan set{p.file_count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-semibold">{p.run_count}</div>
                    <div className="text-xs">takeoff{p.run_count !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronRight size={20} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
