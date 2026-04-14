const BASE = '/api'

async function req(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  }
  const res = await fetch(BASE + path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  // Projects
  getProjects:      ()        => req('GET',    '/projects'),
  getProject:       (id)      => req('GET',    `/projects/${id}`),
  createProject:    (data)    => req('POST',   '/projects', data),
  updateProject:    (id, data)=> req('PUT',    `/projects/${id}`, data),
  deleteProject:    (id)      => req('DELETE', `/projects/${id}`),

  // Files
  uploadFile:       (projectId, formData) => req('POST', `/projects/${projectId}/upload`, formData, true),
  getFileSheets:    (fileId)  => req('GET',    `/files/${fileId}/sheets`),
  getProjectFiles:  (projectId) => req('GET',  `/projects/${projectId}/files`),

  // Takeoffs
  runTakeoff:         (projectId, trade) => req('POST', `/projects/${projectId}/takeoffs`, { trade }),
  getProjectTakeoffs: (projectId)        => req('GET',  `/projects/${projectId}/takeoffs`),
  getTakeoff:         (runId)            => req('GET',  `/takeoffs/${runId}`),

  // Sheets
  getProjectSheets:      (projectId)        => req('GET',  `/projects/${projectId}/sheets`),
  detectFloors:          (projectId)        => req('POST', `/projects/${projectId}/detect-floors`),
  getFloorMultipliers:   (projectId)        => req('GET',  `/projects/${projectId}/floor-multipliers`),
  updateSheetMultiplier: (sheetId, data)    => req('PUT',  `/sheets/${sheetId}`, data),

  // Item overrides
  updateItem:  (itemId, data) => req('PUT',  `/takeoff-items/${itemId}`, data),
  resetItem:   (itemId)       => req('POST', `/takeoff-items/${itemId}/reset`),
}
