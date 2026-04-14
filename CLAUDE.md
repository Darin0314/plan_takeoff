# Plan Takeoff AI

Construction plan set PDF → AI-extracted quantities by trade.

## Stack
- PHP 8.3 + React 19 + MariaDB 10.11
- Python FastAPI (uvicorn port 8008) — PDF processing + Claude vision
- nginx port 8106
- pdf2image + poppler (installed system-wide)
- anthropic SDK (from estimate_evaluator venv pattern)

## Paths
- Root: `/home/smokeshow/code/plan_takeoff/`
- PHP API: `api.php` + `src/`
- React source: `frontend/src/`
- React build: `frontend_dist/`
- Storage: `storage/uploads/`, `storage/pages/`, `storage/thumbnails/`
- Backend: `backend/`
- DB: `plan_takeoff` / user: `plan_takeoff_user`

## Ports
- 8106: nginx (frontend + PHP API)
- 8008: uvicorn (FastAPI AI backend)
- 5180: Vite dev server

## GitHub
- Repo: `Darin0314/plan_takeoff`

## Build Progress

### Phase 1 — Foundation ✅ COMPLETE
- [x] 1.1: Directory structure, DB schema (5 tables), MariaDB migration
- [x] 1.2: nginx config, PHP bootstrap (config, models, controllers, api.php)
- [x] 1.3: React 19 + Vite + Tailwind skeleton (Layout, ProjectList, ProjectDetail, TakeoffResults, api.js)

### Phase 2 — PDF Upload + Sheet Detection
- [x] 2.1: Python FastAPI app scaffold + venv — uvicorn on port 8008, systemd service (plan-takeoff.service), all packages installed; added total_pages + processed_pages to takeoff_runs
- [x] 2.2: `/process-pdf` endpoint — pdf2image 150 DPI render, JPEG pages + 400px thumbs per file, plan_sheets rows, project_files status/page_count updated; unique key (file_id, page_number) added; `/file-status/{file_id}` polling endpoint
- [x] 2.3: Claude Haiku title block reader — sheet_type, sheet_number, sheet_title, drawing_scale, scale_factor extracted per page; runs inline in process_pdf_job after render; all data written to plan_sheets
- [x] 2.4: Status polling — project_files.process_status drives frontend poll (already wired in ProjectDetail.jsx); /file-status/{file_id} FastAPI endpoint available

### Phase 3 — Trade Analysis Engine
- [x] 3.1: Roofing takeoff — Claude Haiku reads roof plan sheets; extracts area SF (with pitch factor), ridge/hip/valley/eave/rake LF, dormers/skylights EA; aggregates across multi-sheet sets; dispatcher + /run-takeoff route wired
- [x] 3.2: Framing + drywall — shared analyzer on floor plan sheets; framing trade returns exterior/interior/bearing wall LF + floor system SF; drywall trade returns wall area + ceiling area SF; dispatcher filters by trade category
- [x] 3.3: Electrical — targets E-sheets + RCP plans; counts lighting fixtures by type, receptacles (standard/GFCI/240V), switches, data/comm, panels, special equipment, low-voltage devices; aggregates across floors stripping floor-level notes
- [x] 3.4: HVAC — targets M-sheets + mechanical keyword sheets; extracts AHU/furnace/heat pump/mini-split/ERV equipment counts + tonnage, supply/return/exhaust diffuser + grille counts by size, duct LF when dimensioned, exhaust fans, thermostats/zones
- [x] 3.5: Plumbing — targets P-sheets + plumbing keyword sheets; extracts fixture counts (WC/lav/sink/tub/shower/urinal/floor drain/hose bib/mop sink), equipment (water heater/PRV/backflow/sump/grease trap), supply + DWV + gas pipe LF by size/material
- [x] 3.6: Concrete + site work — S/C-sheet targeting; extracts foundation (strip/spread/caisson/grade beam LF+EA), slabs (SF by thickness), concrete walls (SF form area), structural concrete, reinforcement (LB/SF), site work (grading SF, cut/fill CY, paving SF, curb/gutter LF, trenching LF); two trades: `concrete` + `sitework` share the analyzer, dispatcher filters by category

### Phase 4 — Results UI
- [x] 4.1: Takeoff summary dashboard — TakeoffResults.jsx fully wired to real DB data via api.getTakeoff(runId); items grouped by category, confidence badges, CSV export, calc notes; fixed site_work trade key mismatch; added all-trades mode (runs every analyzer sequentially, aggregates)
- [x] 4.2: Sheet viewer — source sheet refs render as clickable blue chips; SheetModal shows full-size page image with zoom in/out (25% steps), open-in-tab, Esc/click-outside to close; sheet number + title + scale in header; grey chip when sheet not in project
- [x] 4.3: Manual quantity override — pencil icon on row hover → inline qty+unit inputs (Enter/Esc); overridden rows show amber qty + strikethrough original AI value; RotateCcw resets to AI; DB tracks is_override + original_quantity

### Phase 5 — Export
- [x] 5.1: PDF report via FPDF — dark-themed Letter report, per-trade accent colors, project info block, items grouped by category (alternating shading, qty/unit/notes/confidence columns), override indicators (amber qty + grey strikethrough original), summary totals block, page footer; GET /api/takeoffs/{id}/pdf; Export PDF button in results header
- [x] 5.2: CSV export (already wired in TakeoffResults.jsx)

### Phase 6 — Intelligence
- [x] 6.1: Repeat floor detection — floor_multiplier + floor_multiplier_note on plan_sheets; floor_detector.py uses Claude Haiku to find "TYPICAL FLOORS 3-14" style annotations; dispatcher multiplies quantities when all source sheets share same multiplier > 1; FloorMultiplierPanel in ProjectDetail with Auto-Detect button + inline edit per sheet
- [ ] 6.2: Unit type detection (Type A × N, Type B × M)
- [ ] 6.3: Confidence scoring improvements

## Next Up: Phase 6.2 — Unit type detection (Type A × N, Type B × M)
