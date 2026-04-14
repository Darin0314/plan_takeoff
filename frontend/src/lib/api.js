const BASE = '/api'

async function req(method, path, body, isFormData = false) {
  const opts = {
    method,
    credentials: 'include',
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
  toggleFileActive: (fileId)  => req('PUT',  `/files/${fileId}/active`),
  reorderFile:      (fileId, direction) => req('PUT', `/files/${fileId}/reorder`, { direction }),
  reprocessFile:    (fileId)  => req('POST', `/files/${fileId}/reprocess`),

  // Takeoffs
  runTakeoff:         (projectId, trade) => req('POST', `/projects/${projectId}/takeoffs`, { trade }),
  getProjectTakeoffs: (projectId)        => req('GET',  `/projects/${projectId}/takeoffs`),
  getTakeoff:         (runId)            => req('GET',  `/takeoffs/${runId}`),
  runAllTrades:       (projectId)        => req('POST', `/projects/${projectId}/takeoffs/all-trades`),
  getBatchStatus:     (projectId)        => req('GET',  `/projects/${projectId}/takeoffs/batch-status`),

  // Sheets
  getProjectSheets:      (projectId)        => req('GET',  `/projects/${projectId}/sheets`),
  detectFloors:          (projectId)        => req('POST', `/projects/${projectId}/detect-floors`),
  getFloorMultipliers:   (projectId)        => req('GET',  `/projects/${projectId}/floor-multipliers`),
  updateSheetMultiplier: (sheetId, data)    => req('PUT',  `/sheets/${sheetId}`, data),
  detectUnitTypes:       (projectId)        => req('POST', `/projects/${projectId}/detect-unit-types`),
  getUnitTypes:          (projectId)        => req('GET',  `/projects/${projectId}/unit-types`),
  updateSheetUnitType:   (sheetId, data)    => req('PUT',  `/sheets/${sheetId}/unit-type`, data),

  // Item overrides
  updateItem:    (itemId, data) => req('PUT',  `/takeoff-items/${itemId}`, data),
  resetItem:     (itemId)       => req('POST', `/takeoff-items/${itemId}/reset`),
  setItemCost:   (itemId, data) => req('PUT',  `/takeoff-items/${itemId}/cost`, data),
  setAnnotation: (itemId, data) => req('PUT',  `/takeoff-items/${itemId}/annotation`, data),

  // File breakdown
  getFileBreakdown: (runId) => req('GET', `/takeoffs/${runId}/file-breakdown`),

  // Activity log
  getProjectActivity: (projectId, page = 1) => req('GET', `/projects/${projectId}/activity?page=${page}`),

  // Diff / revision tracking
  getDiff: (newRunId, baselineRunId) => req('GET', `/takeoffs/${newRunId}/diff?baseline=${baselineRunId}`),

  // Project comparison
  compareProjects: (idA, idB, trade) => req('GET', `/projects/compare?a=${idA}&b=${idB}&trade=${trade}`),

  // Share links
  createShare:  (runId, data)  => req('POST',   `/takeoffs/${runId}/share`, data),
  getShares:    (runId)        => req('GET',    `/takeoffs/${runId}/shares`),
  revokeShare:  (token)        => req('DELETE', `/shares/${token}`),
  getSharedRun: (token)        => fetch('/api/share/' + token, { credentials: 'include' }).then(r => r.json()),

  // Supplier price lists
  getSupplierLists:    ()              => req('GET',    '/supplier-price-lists'),
  deleteSupplierList:  (id)            => req('DELETE', `/supplier-price-lists/${id}`),
  getSupplierMatch:    (runId, listId) => req('GET',    `/takeoffs/${runId}/supplier-match?list=${listId}`),
  uploadSupplierList:  (formData)      => fetch('/api/supplier-price-lists', {
    method: 'POST',
    credentials: 'include',
    body: formData,  // multipart — no Content-Type header, browser sets boundary
  }).then(r => r.json()),

  // Cost estimating
  getCostSummary: (runId)         => req('GET',    `/takeoffs/${runId}/cost-summary`),
  getUnitCosts:   (trade)         => req('GET',    `/unit-costs${trade ? `?trade=${trade}` : ''}`),
  createUnitCost: (data)          => req('POST',   '/unit-costs', data),
  updateUnitCost: (id, data)      => req('PUT',    `/unit-costs/${id}`, data),
  deleteUnitCost: (id)            => req('DELETE', `/unit-costs/${id}`),

  // Sheet notes
  getSheetNotes:    (sheetId)       => req('GET',    `/sheets/${sheetId}/notes`),
  createSheetNote:  (sheetId, data) => req('POST',   `/sheets/${sheetId}/notes`, data),
  deleteSheetNote:  (noteId)        => req('DELETE', `/sheet-notes/${noteId}`),

  // Annotations (Phase 17)
  generateAnnotation: (sheetId, trade) => req('POST', `/sheets/${sheetId}/annotate?trade=${trade}`),
  getAnnotation:      (sheetId, trade) => req('GET',  `/sheets/${sheetId}/annotate?trade=${trade}`),
  getRunAnnotations:  (runId, trade)   => req('GET',  `/takeoffs/${runId}/annotations${trade ? `?trade=${trade}` : ''}`),
}
