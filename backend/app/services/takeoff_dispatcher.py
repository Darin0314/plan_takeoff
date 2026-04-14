"""
Takeoff dispatcher — fetches plan sheets for a project, routes to the correct trade analyzer.
Each analyzer receives a list of sheet dicts (with page_image_path, sheet_type, sheet_number, etc.)
and returns a list of takeoff item dicts to be written to takeoff_items.
"""
import json
import pymysql
import pymysql.cursors
from app.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, STORAGE_PATH
from app.services.analyzers import roofing, framing, electrical, hvac, plumbing, concrete

TRADE_ANALYZERS = {
    'roofing':    roofing.analyze,
    'framing':    framing.analyze,
    'drywall':    framing.analyze,    # same analyzer, dispatcher filters by category
    'electrical': electrical.analyze,
    'hvac':       hvac.analyze,
    'plumbing':   plumbing.analyze,
    'concrete':   concrete.analyze,
    'sitework':   concrete.analyze,   # same analyzer, dispatcher filters by category
}


def _db():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, db=DB_NAME,
        user=DB_USER, passwd=DB_PASS,
        cursorclass=pymysql.cursors.DictCursor
    )


def _set_run_status(conn, run_id: int, status: str, extra: dict = None):
    sets   = ["status = %s"]
    vals   = [status]
    extra  = extra or {}

    if status == 'processing':
        sets.append("started_at = NOW()")
    if status in ('complete', 'error'):
        sets.append("completed_at = NOW()")

    for field in ('error_message', 'sheets_analyzed', 'ai_model',
                  'total_input_tokens', 'total_output_tokens'):
        if field in extra:
            sets.append(f"{field} = %s")
            vals.append(extra[field])

    vals.append(run_id)
    with conn.cursor() as cur:
        cur.execute(f"UPDATE takeoff_runs SET {', '.join(sets)} WHERE id = %s", vals)
    conn.commit()


def _insert_item(conn, run_id: int, item: dict, order: int):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO takeoff_items
                 (run_id, category, description, quantity, unit, unit_notes,
                  source_sheets, confidence, calc_notes, sort_order)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                run_id,
                item.get('category', 'General'),
                item.get('description', ''),
                item.get('quantity'),
                item.get('unit'),
                item.get('unit_notes'),
                json.dumps(item['source_sheets']) if item.get('source_sheets') else None,
                item.get('confidence', 'medium'),
                item.get('calc_notes'),
                order,
            )
        )


def run_takeoff_job(run_id: int, project_id: int, trade: str):
    """
    1. Look up the project's completed files and their plan_sheets.
    2. Route to the appropriate trade analyzer.
    3. Write returned items to takeoff_items.
    4. Update run status throughout.
    """
    conn = _db()
    try:
        _set_run_status(conn, run_id, 'processing')

        # Fetch all sheets for this project (complete files only)
        with conn.cursor() as cur:
            cur.execute(
                """SELECT ps.*
                   FROM plan_sheets ps
                   JOIN project_files pf ON pf.id = ps.file_id
                   WHERE pf.project_id = %s AND pf.process_status = 'complete'
                   ORDER BY ps.file_id, ps.page_number""",
                (project_id,)
            )
            sheets = cur.fetchall()

        if not sheets:
            _set_run_status(conn, run_id, 'error',
                            {'error_message': 'No processed sheets found for this project'})
            return

        # Resolve absolute paths for analyzers (page_image_path is relative to storage root)
        import os
        for s in sheets:
            if s.get('page_image_path'):
                s['abs_image_path'] = os.path.join(STORAGE_PATH, s['page_image_path'])

        analyzer = TRADE_ANALYZERS.get(trade)
        if analyzer is None:
            _set_run_status(conn, run_id, 'error',
                            {'error_message': f"No analyzer implemented for trade: {trade}"})
            return

        result = analyzer(sheets)   # returns {'items': [...], 'meta': {...}}
        items  = result.get('items', [])

        # Filter items to the requested trade category
        FRAMING_CATS  = {'Exterior Framing', 'Interior Framing', 'Bearing Walls', 'Floor System', 'Roof Framing'}
        DRYWALL_CATS  = {'Wall Drywall', 'Ceiling Drywall', 'Soffit/Special'}
        CONCRETE_CATS = {'Foundation', 'Concrete Slabs', 'Concrete Walls', 'Structural Concrete', 'Reinforcement'}
        SITEWORK_CATS = {'Site Work'}
        if trade == 'framing':
            items = [i for i in items if i.get('category') in FRAMING_CATS]
        elif trade == 'drywall':
            items = [i for i in items if i.get('category') in DRYWALL_CATS]
        elif trade == 'concrete':
            items = [i for i in items if i.get('category') in CONCRETE_CATS]
        elif trade == 'sitework':
            items = [i for i in items if i.get('category') in SITEWORK_CATS]
        meta   = result.get('meta', {})

        # Clear any previous items for this run (idempotent re-run)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM takeoff_items WHERE run_id = %s", (run_id,))

        for i, item in enumerate(items):
            _insert_item(conn, run_id, item, i)

        conn.commit()

        sheets_used = list({s['sheet_number'] for s in sheets if s.get('sheet_number')})
        _set_run_status(conn, run_id, 'complete', {
            'sheets_analyzed':      json.dumps(sheets_used),
            'ai_model':             meta.get('model'),
            'total_input_tokens':   meta.get('input_tokens'),
            'total_output_tokens':  meta.get('output_tokens'),
        })

    except Exception as e:
        try:
            _set_run_status(conn, run_id, 'error', {'error_message': str(e)})
        except Exception:
            pass
        raise
    finally:
        conn.close()
