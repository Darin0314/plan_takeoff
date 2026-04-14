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
- [x] 6.2: Unit type detection — unit_type_name / unit_type_count / unit_type_note columns on plan_sheets; unit_type_detector.py (Haiku vision) finds "Type A × 12" annotations on architectural sheets; _apply_unit_type_multipliers in dispatcher compounds on top of floor multipliers; FastAPI routes POST /detect-unit-types + GET /unit-types/{id} + PUT /sheets/{id}/unit-type; PHP ProjectController detectUnitTypes/unitTypes/updateSheetUnitType; UnitTypePanel + UnitTypeRow in ProjectDetail (pink accent, Auto-Detect + inline edit per sheet)
- [x] 6.3: Confidence scoring improvements — backend post-processing in dispatcher: null-qty items forced to 'low', multi-sheet items (2+ sources, no 'low') boosted from 'medium' → 'high' with calc note; frontend: confidence summary bar with clickable filter buttons (All / High / Medium / Needs Review), low-confidence rows get red tint + ShieldAlert icon, empty-filter state shows "Show all" link

### Auth (added 2026-04-14)
- [x] users table, PHP session auth (POST /auth/login, POST /auth/logout, GET /auth/me), session guard on all API routes, React Login page + auth context in App.jsx, Layout shows user name + Sign out button
- Users: info@robinhoodroofs.com, info@hvaconly.com, paul@performanceconstruction.co (passwords in memory)

### Phase 7 — Cost Estimating
- [x] 7.1: DB schema — unit_costs table (trade/category/unit + material/labor rates, 28 seeded defaults), unit_cost_material + unit_cost_labor columns on takeoff_items; PHP UnitCost model + CostController (GET/POST/PUT/DELETE /unit-costs, PUT /takeoff-items/{id}/cost, GET /takeoffs/{id}/cost-summary with auto-match defaults + category subtotals + grand total); frontend api.js methods added
- [x] 7.2: Cost assignment UI — Quantities | Cost Estimate tab switcher on TakeoffResults; CostPanel component with grand total banner (material/labor/total), per-category tables with inline cost editing (pencil on hover, Enter/Esc), auto-populated from unit_costs defaults (grey) or per-item overrides (amber); costs reload after each save
- [x] 7.3: Cost summary panel — by_trade grouping added to cost-summary backend (sorted by total); CostPanel shows trade breakdown section (visible when >1 trade): stacked mat/labor progress bar per trade showing % of project total, item count, mat/lab/total columns; single-trade runs skip this section
- [x] 7.4: PDF + CSV export include cost columns — when cost data exists, PDF switches to compressed column layout (desc/qty/unit/notes/conf/mat/lab/total) + cost totals banner at bottom; CSV export fetches cost-summary and appends Mat/Unit/Lab/Unit/Total Cost columns

### Phase 8 — Revision Tracking
- [x] 8.1: Re-run diff engine — DiffController.php; GET /takeoffs/{id}/diff?baseline={runId}; items matched by normalized category+description; returns added/removed/changed/unchanged buckets with qty_delta + qty_pct; api.js getDiff() wired
- [x] 8.2: Diff UI — DiffPanel.jsx; "Compare" tab added to TakeoffResults; baseline picker (dropdown of prior same-trade runs); 4 color-coded summary cards (green/amber/red/slate); Added/Changed/Removed/Unchanged sections each collapsible, grouped by category; Changed rows show old→new qty with delta+%, unit changes shown inline; Unchanged collapsed by default when viewing all

### Phase 9 — Annotations
- [x] 9.1: Per-item flag/note field — flag ENUM(review/confirmed/exclude) + annotation TEXT added to takeoff_items; PUT /takeoff-items/{id}/annotation endpoint; Flag button on ItemRow hover (always visible when set, blue); annotation editor expands as second row with flag picker (toggle buttons) + note textarea + save/cancel; flag badge + note shown inline in description cell; exclude rows get red tint
- [x] 9.2: Flag filter + export annotations in CSV/PDF — flag filter row (Any Flag / Review / Confirmed / Exclude with counts) appears below confidence filter when any flags exist; combined confidence+flag filter logic with "Clear filters" link; CSV export adds Flag + Annotation columns; PDF itemRow renders flag pill badge + annotation note below description in both basic and cost layouts; summaryBlock adds Flagged stat

### Phase 10 — Multi-file Stats
- [x] 10.1: Per-file breakdown — GET /takeoffs/{id}/file-breakdown endpoint maps source_sheets → plan_sheets → project_files; returns per-file item counts, sheet refs, page counts; "Files" tab added to TakeoffResults with summary bar (total files/items/contributing files) + per-file cards (item count, % bar, sheet ref chips, page count); unmatched items warning when source sheets aren't indexed
- [x] 10.2: File management UI — sort_order + is_active columns added to project_files; up/down arrows to reorder files within project (swap sort_order); eye/eye-off toggle to deactivate file (excluded from takeoffs + dispatcher filters is_active=1); re-process button (complete/error files) clears plan_sheets + resets to pending + retriggers FastAPI; FileCard component replaces inline file cards in ProjectDetail; run-takeoff buttons and floor/unit panels only activate when at least one active complete file exists

### Phase 11 — Project Comparison
- [x] 11.1: Compare two projects side-by-side — select two projects, align by trade + category, show qty diff
  - `ProjectCompareController.php` — `GET /projects/compare?a=&b=&trade=`; finds latest complete run per project per trade; aligns items by category+normalized-description; returns aligned rows (both/a_only/b_only) with delta+pct
  - `ProjectComparison.jsx` — `/compare` route; project A/B dropdowns + trade picker; grouped-by-category table with filter bar (All/Changed/Only A/Only B); color-coded rows (amber=changed, red=a_only, green=b_only); TrendingUp/Down delta badges; summary cards
  - "Compare" button added to ProjectList header

### Phase 12 — Share / Send Report
- [x] 12.1: DB + backend — `shared_reports` table (UUID token, run_id, expires_at, created_by, view_count), PHP create-share endpoint (POST /takeoffs/{id}/share), public read-only endpoint (GET /share/{token}, no auth); revoke DELETE /shares/{token}; list GET /takeoffs/{id}/shares
- [x] 12.2: Public share page — `SharedTakeoff.jsx` at `/share/:token`; no login required; project header (name/address/permit/client), trade badge, run date, item count; items grouped by category with confidence badges; cost summary cards (material/labor/total) when available; PDF download via `/api/takeoffs/{id}/pdf?token={token}` (token-gated public PDF); App.jsx restructured to bypass auth for `/share/*` routes
- [x] 12.3: Share UI — "Share" button (violet) in TakeoffResults header; modal with expiry picker (no expiry/24h/7d/30d) + "Create Link" button; existing links listed with: full URL input (read-only), Copy button (green flash on copy), Revoke button (red), view count, expiry date, created date; expired links shown dimmed in red

### Phase 13 — Material Supplier Price Feed
- [x] 13.1: DB schema — `supplier_price_lists` + `supplier_prices` tables migrated. `SupplierController`: POST /supplier-price-lists (multipart CSV upload, flexible header matching via alias map, strips currency symbols, skips blank rows, updates row_count), GET /supplier-price-lists, DELETE /supplier-price-lists/{id} (cascade). api.js: getSupplierLists, uploadSupplierList (raw FormData, no Content-Type header), deleteSupplierList.
- [x] 13.2: Price matching engine — GET /takeoffs/{runId}/supplier-match?list={listId}. 3-tier matching: (1) exact category+description, (2) contains/substring, (3) Jaccard word-overlap ≥ 0.5 (stop-words filtered). Returns per-item: matched bool, match_type, match_score, supplier_unit_price, extended_cost (qty×price), default_unit_cost, default_extended, delta (savings vs default). Summary: matched/unmatched counts, total_supplier_cost, total_default_cost, total_savings. api.js: getSupplierMatch(runId, listId).
- [ ] 13.3: Supplier UI — "Supplier Prices" tab in TakeoffResults; supplier list picker; matched rows show supplier price + extended cost alongside existing unit cost defaults; unmatched rows flagged; summary total at top; Supplier Price Lists management page linked from header

### Phase 14 — Takeoff History & Audit Trail
- [ ] 14.1: DB + backend — `activity_log` table (project_id, run_id, user_id, action, detail JSON, created_at); log events: run.started, run.completed, run.failed, item.override, item.reset, item.cost_set, item.annotated, file.uploaded, file.reprocessed, share.created; GET /projects/{id}/activity
- [ ] 14.2: UI — "History" tab in ProjectDetail; timeline list (icon+color per action type, user name, timestamp, detail summary); filter by action type; paginated (50/page)

### Phase 15 — Multi-Trade Run Dashboard
- [ ] 15.1: Backend — POST /projects/{id}/takeoffs/all-trades; queues one run per trade (roofing/framing/drywall/electrical/hvac/plumbing/concrete/site_work) sequentially via FastAPI; GET /projects/{id}/takeoffs/batch-status returns per-trade status (pending/processing/complete/error/not_run) with item counts
- [ ] 15.2: UI — "Run All Trades" button in ProjectDetail; live progress board replaces run button after click; per-trade status cards (spinner/check/error icon, item count on complete); auto-navigates to most-recently-completed trade when done; polling stops when all trades reach terminal state

### Phase 16 — Notes & Markup on Sheet Images
- [ ] 16.1: DB + backend — `sheet_notes` table (sheet_id, x_pct, y_pct, note TEXT, color, created_by, created_at); POST /sheets/{id}/notes, GET /sheets/{id}/notes, DELETE /sheet-notes/{id}
- [ ] 16.2: UI — annotation layer in SheetModal; click on image to drop a pin (colored circle); pin shows note in tooltip on hover; "Add Note" mode toggle button in modal header; note input popover on click; existing pins listed in sidebar; delete button per note

## Next Up: Phase 13.3 — Supplier UI (tab in TakeoffResults + Supplier Price Lists management page)
