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
- [ ] 2.1: Python FastAPI app scaffold + venv (requirements: fastapi, uvicorn, pdf2image, anthropic, pymysql, python-dotenv, pillow)
- [ ] 2.2: `/process-pdf` endpoint — pdf2image render at 150 DPI, store page images + thumbnails
- [ ] 2.3: Claude title block reader — sheet type, sheet number, scale detection per page
- [ ] 2.4: Status polling from PHP → frontend already built (polls every 3s when processing)

### Phase 3 — Trade Analysis Engine
- [ ] 3.1: Roofing takeoff (roof plan → area, ridge/hip/valley LF, eave LF)
- [ ] 3.2: Framing + drywall (floor plan wall LF × floors, wall area, ceiling area)
- [ ] 3.3: Electrical (E-sheets + RCP fixture/device counts)
- [ ] 3.4: HVAC (M-sheets + equipment, duct, vent cover counts)
- [ ] 3.5: Plumbing (P-sheets + fixture schedule counts, pipe runs)
- [ ] 3.6: Concrete + site work (foundation area, slab, grading)

### Phase 4 — Results UI
- [ ] 4.1: Takeoff summary dashboard (already scaffolded in TakeoffResults.jsx — needs real data)
- [ ] 4.2: Sheet viewer (click source sheet → modal with page image)
- [ ] 4.3: Manual quantity override

### Phase 5 — Export
- [ ] 5.1: PDF report generation (FPDF or similar)
- [ ] 5.2: CSV export (already wired in TakeoffResults.jsx)

### Phase 6 — Intelligence
- [ ] 6.1: Repeat floor detection (auto-detect identical floors, multiply quantities)
- [ ] 6.2: Unit type detection (Type A × N, Type B × M)
- [ ] 6.3: Confidence scoring improvements

## Next Up: Phase 2.1 — Python FastAPI scaffold + venv
