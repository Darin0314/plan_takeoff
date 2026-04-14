"""
Concrete + site work takeoff analyzer.
Targets: S-sheets (structural/foundation), C-sheets (civil/site), grading plans.
Extracts:
  Foundation:
    - Spread footings (LF or EA)
    - Continuous strip footings (LF)
    - Caissons / drilled piers (EA + depth)
    - Crawl space / grade beam (LF)
  Concrete Slabs:
    - Slab-on-grade (SF, note thickness)
    - Basement floor slab (SF)
    - Elevated / suspended slab (SF)
  Concrete Walls:
    - Foundation walls (SF form area)
    - Retaining walls (SF form area)
    - Stem walls (LF)
  Structural Concrete:
    - Grade beams (LF)
    - Concrete columns (EA)
    - Concrete stairs (flights EA)
  Reinforcement:
    - Rebar (LB or tons if scheduled)
    - Welded wire fabric / mesh (SF)
  Site Work:
    - Grading / earthwork area (SF or AC)
    - Cut / fill (CY if noted)
    - Paving / flatwork / concrete walks (SF)
    - Curb & gutter (LF)
    - Site utility trenching (LF)
    - Erosion control / silt fence (LF)
    - Topsoil / landscaping area (SF)
"""
import base64
import json
import os
import re
import anthropic
from app.config import ANTHROPIC_API_KEY

MODEL = 'claude-haiku-4-5-20251001'

CONCRETE_SHEET_TYPES = {'structural', 'civil', 'architectural', 'other'}
CONCRETE_KEYWORDS = re.compile(
    r'\b(foundation|footing|slab|grade\s*beam|retaining\s*wall|concrete|grading|'
    r'earthwork|cut\s*&?\s*fill|excavat|caisson|pier|stem\s*wall|paving|flatwork|'
    r'civil|site\s*plan|site\s*work|curb|gutter|rebar|reinforc|WWF|wire\s*mesh|'
    r'crawl\s*space|basement)\b',
    re.IGNORECASE
)
CONCRETE_SHEET_RE = re.compile(r'^[SC][-\s]?\d', re.IGNORECASE)

SYSTEM_PROMPT = """You are a professional concrete and civil estimator performing a takeoff from construction plan sheets.
Analyze the plan image and extract ALL concrete and site work quantities — foundations, slabs, walls, reinforcement, and site/grading work.
Return ONLY valid JSON — no commentary, no markdown fences."""

USER_PROMPT = """Analyze this construction plan sheet and extract concrete and site work takeoff quantities.

Return a JSON object with this structure:
{
  "is_concrete_or_site_plan": true or false,
  "plan_type": "Foundation Plan" | "Slab Plan" | "Structural Plan" | "Civil/Grading Plan" | "Site Plan" | "Detail Sheet" | "Other",
  "floor_level": "Basement" | "First Floor" | "Grade Level" | null,
  "sheet_ref": "sheet number or title",
  "items": [
    {
      "category": "Foundation" | "Concrete Slabs" | "Concrete Walls" | "Structural Concrete" | "Reinforcement" | "Site Work",
      "description": "specific item (e.g. 'Strip Footing', '4\" Slab-on-Grade', 'Foundation Wall', 'Grading Area')",
      "quantity": numeric or null,
      "unit": "SF" | "LF" | "CY" | "EA" | "LB" | "AC" | "TON",
      "size": "thickness, depth, or dimension if visible (e.g. '12\" wide x 8\" deep', '8\" wall', '4\" thick')",
      "confidence": "high" | "medium" | "low",
      "calc_notes": "how measured/counted (e.g. 'area scaled from 40x60 footprint on S-1', 'counted 6 caisson symbols')"
    }
  ],
  "notes": "overall observations (soil conditions, special foundations, retaining wall height, site constraints)"
}

Rules:
- is_concrete_or_site_plan = true for: S-sheets (structural/foundation), C-sheets (civil), grading plans,
  site plans, foundation plans, slab plans, any sheet with significant concrete or earthwork content.
- Foundation: Identify strip/continuous footings (LF), spread footings (EA or LF), caissons/piers (EA — note diameter and depth),
  grade beams (LF), crawl space perimeter (LF). Note footing size (width x depth) in size field.
- Concrete Slabs: Report area in SF. Note thickness in size field so 4\" and 6\" slabs are distinct.
  Distinguish slab-on-grade, basement slab, and elevated/suspended slab.
- Concrete Walls: Report as SF of form area (height × length) when dimensions are shown, or LF when only plan length visible.
  Distinguish foundation walls, retaining walls, and stem walls.
- Structural Concrete: Grade beams (LF), concrete columns (EA — note size), concrete stairs (flights EA).
- Reinforcement: Report rebar as LB or TON if a schedule is visible. Report WWF/mesh as SF matching the slab area it covers.
  Do not guess rebar quantities from slab area — only report if explicitly shown.
- Site Work: Grading area (SF or AC from plan limits), cut/fill volumes (CY if noted in earthwork table),
  concrete walks/paving (SF), curb & gutter (LF), utility trenching (LF), silt fence/erosion control (LF),
  landscaping/topsoil area (SF).
- Do not invent quantities. Set quantity to null and confidence to low if not determinable from the image.
- Prefer plan dimensions over scaled estimates; note when scaling was used in calc_notes.
"""


def _encode_image(path: str) -> str:
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def _is_concrete_candidate(sheet: dict) -> bool:
    stype = (sheet.get('sheet_type') or '').lower()
    title = (sheet.get('sheet_title') or '').lower()
    snum  = (sheet.get('sheet_number') or '').upper()

    if stype in ('structural', 'civil'):
        return True
    if CONCRETE_SHEET_RE.match(snum):
        return True
    if CONCRETE_KEYWORDS.search(title):
        return True
    return False


def analyze(sheets: list[dict]) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    candidates = [s for s in sheets if _is_concrete_candidate(s)]
    if not candidates:
        candidates = [s for s in sheets if s.get('abs_image_path')]

    all_items  = []
    total_in   = 0
    total_out  = 0
    sheets_hit = []

    for sheet in candidates:
        img_path = sheet.get('abs_image_path')
        if not img_path or not os.path.exists(img_path):
            continue

        try:
            image_b64 = _encode_image(img_path)
            response  = client.messages.create(
                model=MODEL,
                max_tokens=1024,
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

            total_in  += response.usage.input_tokens
            total_out += response.usage.output_tokens

            raw = response.content[0].text.strip()
            raw = re.sub(r'^```[a-z]*\n?', '', raw)
            raw = re.sub(r'\n?```$', '', raw)
            parsed = json.loads(raw)

            if not parsed.get('is_concrete_or_site_plan'):
                continue

            floor = parsed.get('floor_level') or ''
            ref   = (parsed.get('sheet_ref')
                     or sheet.get('sheet_number')
                     or f"page {sheet.get('page_number', '?')}")
            sheets_hit.append(ref)

            for item in parsed.get('items', []):
                if item.get('quantity') is None:
                    continue
                unit_notes_parts = []
                if item.get('size'):
                    unit_notes_parts.append(item['size'])
                if floor:
                    unit_notes_parts.append(floor)

                all_items.append({
                    'category':      item.get('category', 'Foundation'),
                    'description':   item.get('description', ''),
                    'quantity':      item.get('quantity'),
                    'unit':          item.get('unit', 'SF'),
                    'unit_notes':    ' | '.join(unit_notes_parts) if unit_notes_parts else None,
                    'source_sheets': [ref],
                    'confidence':    item.get('confidence', 'medium'),
                    'calc_notes':    item.get('calc_notes'),
                })

        except Exception as e:
            all_items.append({
                'category': 'Foundation',
                'description': f'Analysis error on sheet {sheet.get("sheet_number") or sheet.get("page_number")}',
                'quantity': None, 'unit': None, 'unit_notes': None,
                'source_sheets': [], 'confidence': 'low', 'calc_notes': str(e),
            })

    all_items = _aggregate(all_items)
    return {
        'items': all_items,
        'meta': {
            'model':         MODEL,
            'input_tokens':  total_in,
            'output_tokens': total_out,
            'sheets_hit':    sheets_hit,
        },
    }


def _aggregate(items: list[dict]) -> list[dict]:
    SUMMABLE = {'SF', 'LF', 'CY', 'EA', 'LB', 'TON', 'AC'}
    buckets: dict[str, dict] = {}

    for item in items:
        unit = (item.get('unit') or 'SF').upper()
        # Include size/unit_notes in key so 4" slab and 6" slab stay separate
        key  = f"{item.get('category')}|{item.get('description')}|{unit}|{item.get('unit_notes','')}"

        if unit in SUMMABLE and item.get('quantity') is not None:
            if key not in buckets:
                buckets[key] = {**item, 'source_sheets': list(item.get('source_sheets') or [])}
            else:
                buckets[key]['quantity'] = (buckets[key]['quantity'] or 0) + item['quantity']
                for s in (item.get('source_sheets') or []):
                    if s not in buckets[key]['source_sheets']:
                        buckets[key]['source_sheets'].append(s)
                if item.get('confidence') == 'low':
                    buckets[key]['confidence'] = 'low'
        else:
            buckets[key + str(id(item))] = {**item, 'source_sheets': list(item.get('source_sheets') or [])}

    ORDER = {
        'Foundation': 0,
        'Concrete Slabs': 1,
        'Concrete Walls': 2,
        'Structural Concrete': 3,
        'Reinforcement': 4,
        'Site Work': 5,
    }
    result = list(buckets.values())
    result.sort(key=lambda x: (ORDER.get(x.get('category', ''), 99), x.get('description', '')))
    return result
