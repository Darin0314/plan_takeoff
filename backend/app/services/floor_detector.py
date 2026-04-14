"""
Phase 6.1: Repeat floor detection.

Analyzes floor plan and structural sheets looking for "typical floor" indicators:
  - Title: "TYPICAL FLOOR PLAN", "2ND-14TH FLOOR PLAN (TYPICAL)"
  - Notes: "APPLIES TO FLOORS 3 THROUGH 15", "FLOORS 4-12 IDENTICAL TO THIS PLAN"
  - Unit counts: "UNIT TYPE A (TYP.) — 24 UNITS", "REPEATED 6 TIMES"
  - Mirror notes: "MIRROR OF FLOOR 1" (treated as multiplier = 0, excluded)

Returns per-sheet: floor_multiplier (float ≥ 1.0) + floor_multiplier_note (string)
Default multiplier = 1.0 (not a typical floor / applies to one floor only).
"""
import base64
import json
import os
import re
import anthropic
import pymysql
import pymysql.cursors
from app.config import ANTHROPIC_API_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, STORAGE_PATH

MODEL = 'claude-haiku-4-5-20251001'

# Only analyze sheets that could contain floor count annotations
FLOOR_SHEET_TYPES = {'architectural', 'structural', 'other'}
FLOOR_SHEET_RE    = re.compile(r'^[AS][-\s]?\d', re.IGNORECASE)
FLOOR_KEYWORDS    = re.compile(
    r'\b(floor\s*plan|level|story|storey|typical|repeat|unit\s*type|unit\s*plan)\b',
    re.IGNORECASE
)

SYSTEM_PROMPT = """You are a construction estimator analyzing plan sheets for repeated floor patterns.
Your job is to determine whether a floor plan sheet represents more than one floor of a building,
and if so, how many floors it applies to.
Return ONLY valid JSON — no commentary, no markdown."""

USER_PROMPT = """Analyze this construction plan sheet and determine if it represents a TYPICAL or REPEATED floor.

Look for:
1. Title block notes: "TYPICAL FLOOR PLAN", "2ND-14TH FLOOR PLAN (TYP.)", "FLOORS 3 THRU 15 IDENTICAL"
2. General notes or keynotes: "APPLIES TO ALL FLOORS EXCEPT AS NOTED", "THIS PLAN REPEATS X FLOORS"
3. Unit type counts: "UNIT TYPE A — 24 UNITS", "TYPE B (TYP.)"
4. Floor range callouts: "3RD THROUGH 12TH FLOOR PLAN"

Return a JSON object:
{
  "is_typical_floor": true or false,
  "floor_count": number of floors this sheet represents (1 if not typical, null if cannot determine),
  "floor_range": "human-readable range, e.g. 'Floors 3-14' or 'Unit Type A (24 units)'" or null,
  "is_mirror": true if sheet is a mirror/reflected repeat of another (count separately, do not multiply),
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation of what you found (max 120 chars)"
}

Rules:
- is_typical_floor = true ONLY when you can see explicit text or notation indicating the plan applies to multiple floors/units
- floor_count must be an integer ≥ 2 when is_typical_floor is true; use null if the count isn't legible
- If the title says "FIRST FLOOR PLAN" or "2ND FLOOR PLAN" with no repeat notation → is_typical_floor = false, floor_count = 1
- If the sheet is a site plan, roof plan, elevation, section, or detail → is_typical_floor = false, floor_count = 1
- is_mirror = true when sheet is labeled as a "MIRROR" or "REVERSE" of another plan — do NOT multiply these
"""


def _encode_image(path: str) -> str:
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def _is_candidate(sheet: dict) -> bool:
    stype = (sheet.get('sheet_type') or '').lower()
    title = (sheet.get('sheet_title') or '').lower()
    snum  = (sheet.get('sheet_number') or '').upper()

    if stype in FLOOR_SHEET_TYPES:
        return True
    if FLOOR_SHEET_RE.match(snum):
        return True
    if FLOOR_KEYWORDS.search(title):
        return True
    return False


def _db():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, db=DB_NAME,
        user=DB_USER, passwd=DB_PASS,
        cursorclass=pymysql.cursors.DictCursor
    )


def _save_multiplier(conn, sheet_id: int, multiplier: float, note: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE plan_sheets SET floor_multiplier = %s, floor_multiplier_note = %s WHERE id = %s",
            (multiplier, note[:200] if note else None, sheet_id)
        )
    conn.commit()


def detect_for_project(project_id: int) -> dict:
    """
    Run floor detection on all candidate sheets for a project.
    Returns summary: { sheets_analyzed, typical_found, results: [...] }
    """
    conn = _db()
    try:
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
    finally:
        conn.close()

    if not sheets:
        return {'sheets_analyzed': 0, 'typical_found': 0, 'results': []}

    client    = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    results   = []
    analyzed  = 0
    typical   = 0

    conn = _db()
    try:
        for sheet in sheets:
            if not _is_candidate(sheet):
                continue

            img_path = None
            if sheet.get('page_image_path'):
                img_path = os.path.join(STORAGE_PATH, sheet['page_image_path'])
            if not img_path or not os.path.exists(img_path):
                continue

            analyzed += 1
            try:
                image_b64 = _encode_image(img_path)
                response  = client.messages.create(
                    model=MODEL,
                    max_tokens=256,
                    system=SYSTEM_PROMPT,
                    messages=[{
                        'role': 'user',
                        'content': [
                            {
                                'type': 'image',
                                'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': image_b64},
                            },
                            {'type': 'text', 'text': USER_PROMPT},
                        ],
                    }],
                )

                raw = response.content[0].text.strip()
                raw = re.sub(r'^```[a-z]*\n?', '', raw)
                raw = re.sub(r'\n?```$', '', raw)
                parsed = json.loads(raw)

                is_typical = parsed.get('is_typical_floor', False)
                is_mirror  = parsed.get('is_mirror', False)
                count      = parsed.get('floor_count')
                floor_range = parsed.get('floor_range') or ''
                confidence = parsed.get('confidence', 'medium')
                reasoning  = parsed.get('reasoning', '')

                # Determine final multiplier
                if is_mirror:
                    multiplier = 1.0
                    note = f'Mirror/reflected plan — not multiplied. {reasoning}'.strip()
                elif is_typical and isinstance(count, (int, float)) and count >= 2:
                    multiplier = float(count)
                    note = floor_range or reasoning
                    typical += 1
                else:
                    multiplier = 1.0
                    note = None

                _save_multiplier(conn, sheet['id'], multiplier, note)

                results.append({
                    'sheet_id':     sheet['id'],
                    'sheet_number': sheet.get('sheet_number'),
                    'sheet_title':  sheet.get('sheet_title'),
                    'multiplier':   multiplier,
                    'note':         note,
                    'confidence':   confidence,
                    'is_mirror':    is_mirror,
                })

            except Exception as e:
                results.append({
                    'sheet_id':     sheet['id'],
                    'sheet_number': sheet.get('sheet_number'),
                    'sheet_title':  sheet.get('sheet_title'),
                    'multiplier':   1.0,
                    'note':         f'Detection error: {e}',
                    'confidence':   'low',
                    'is_mirror':    False,
                })
    finally:
        conn.close()

    return {
        'sheets_analyzed': analyzed,
        'typical_found':   typical,
        'results':         results,
    }
