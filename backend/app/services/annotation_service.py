"""
Phase 17.1 — AI Sheet Annotation Service (Option B)

Sends a rendered plan sheet image to Claude Haiku and asks it to identify
regions for a given trade. Claude returns approximate bounding boxes as JSON.
Pillow composites semi-transparent colored rectangles + labels onto the image.
Saves the result to storage/annotated/{sheet_id}_{trade}.jpg.

Long-term goal (Option A): modify trade analyzer prompts to return item-level
bounding boxes so this rendering pipeline can display pixel-accurate redlines.
"""
import base64
import json
import os
import re
import pymysql
import anthropic
from PIL import Image, ImageDraw, ImageFont
from app.config import ANTHROPIC_API_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, STORAGE_PATH

MODEL = 'claude-haiku-4-5-20251001'

ANNOTATED_PATH = os.path.join(STORAGE_PATH, 'annotated')
os.makedirs(ANNOTATED_PATH, exist_ok=True)

# RGBA fill colors per trade (semi-transparent)
TRADE_COLORS = {
    'roofing':    (251, 146,  60, 80),   # orange
    'framing':    (250, 204,  21, 80),   # yellow
    'drywall':    (167, 139, 250, 80),   # purple
    'electrical': ( 96, 165, 250, 80),   # blue
    'hvac':       ( 34, 211, 238, 80),   # cyan
    'plumbing':   ( 45, 212, 191, 80),   # teal
    'concrete':   (168, 162, 158, 80),   # stone
    'site_work':  ( 74, 222, 128, 80),   # green
}
TRADE_BORDER = {
    'roofing':    (234,  88,  12, 200),
    'framing':    (202, 138,   4, 200),
    'drywall':    (124,  58, 237, 200),
    'electrical': ( 37,  99, 235, 200),
    'hvac':       ( 14, 165, 233, 200),
    'plumbing':   ( 20, 184, 166, 200),
    'concrete':   (120, 113, 108, 200),
    'site_work':  ( 22, 163,  74, 200),
}

SYSTEM_PROMPT = """You are a construction plan analyst. Your job is to identify the approximate locations
of trade-specific elements on plan sheets and return their positions as bounding boxes.
Return ONLY valid JSON — no commentary, no markdown fences."""

def _build_prompt(trade: str) -> str:
    trade_label = trade.replace('_', ' ').title()
    return f"""Analyze this construction plan sheet image for {trade_label} elements.

Identify all visible {trade_label}-related elements and return their approximate locations as bounding boxes.
Use percentage coordinates (0-100) relative to the image dimensions.

Return a JSON object:
{{
  "trade": "{trade}",
  "is_relevant": true or false,
  "regions": [
    {{
      "label": "short description of what this region contains (e.g. 'Roof Area', 'Ridge LF', 'Panel P1')",
      "x1_pct": 0-100,
      "y1_pct": 0-100,
      "x2_pct": 0-100,
      "y2_pct": 0-100,
      "confidence": "high" | "medium" | "low"
    }}
  ],
  "notes": "brief summary of what was found"
}}

Rules:
- Only return regions for elements clearly visible on this sheet.
- Bounding boxes should be approximate — err on the side of slightly larger rather than missing the element.
- If the sheet is not relevant to {trade_label} work, return is_relevant: false and an empty regions array.
- Maximum 20 regions per sheet.
- x1 < x2, y1 < y2. All values 0-100."""


def _db():
    return pymysql.connect(host=DB_HOST, port=DB_PORT, db=DB_NAME,
                           user=DB_USER, passwd=DB_PASS, charset='utf8mb4')


def _load_sheet(sheet_id: int) -> dict | None:
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, page_image_path FROM plan_sheets WHERE id = %s",
                (sheet_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return {'id': row[0], 'page_image_path': row[1]}
    finally:
        conn.close()


def _call_claude(image_path: str, trade: str) -> dict:
    with open(image_path, 'rb') as f:
        img_b64 = base64.standard_b64encode(f.read()).decode()

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/jpeg',
                        'data': img_b64,
                    }
                },
                {'type': 'text', 'text': _build_prompt(trade)}
            ]
        }]
    )

    raw = resp.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return json.loads(raw)


def _render_annotations(source_path: str, regions: list, trade: str, out_path: str):
    img = Image.open(source_path).convert('RGBA')
    w, h = img.size

    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    fill   = TRADE_COLORS.get(trade, (200, 200, 200, 70))
    border = TRADE_BORDER.get(trade, (150, 150, 150, 200))

    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
    except Exception:
        font = ImageFont.load_default()

    for region in regions:
        try:
            x1 = int(region['x1_pct'] / 100 * w)
            y1 = int(region['y1_pct'] / 100 * h)
            x2 = int(region['x2_pct'] / 100 * w)
            y2 = int(region['y2_pct'] / 100 * h)
            if x2 <= x1 or y2 <= y1:
                continue

            # Semi-transparent fill
            draw.rectangle([x1, y1, x2, y2], fill=fill)
            # Border
            for t in range(2):
                draw.rectangle([x1+t, y1+t, x2-t, y2-t], outline=border)

            # Label
            label = region.get('label', '')
            if label:
                # Label background
                bbox = draw.textbbox((x1+4, y1+3), label, font=font)
                draw.rectangle([bbox[0]-2, bbox[1]-2, bbox[2]+2, bbox[3]+2],
                               fill=(20, 20, 20, 180))
                draw.text((x1+4, y1+3), label, font=font,
                          fill=(255, 255, 255, 230))
        except Exception:
            continue

    composited = Image.alpha_composite(img, overlay).convert('RGB')
    composited.save(out_path, 'JPEG', quality=88)


def _save_to_db(sheet_id: int, trade: str, rel_path: str, region_count: int):
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sheet_annotations (sheet_id, trade, annotated_image_path, region_count)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  annotated_image_path = VALUES(annotated_image_path),
                  region_count = VALUES(region_count),
                  created_at = CURRENT_TIMESTAMP
            """, (sheet_id, trade, rel_path, region_count))
        conn.commit()
    finally:
        conn.close()


def annotate_sheet(sheet_id: int, trade: str) -> dict:
    """
    Main entry point. Returns dict with annotated_image_path + region_count.
    Raises on error.
    """
    sheet = _load_sheet(sheet_id)
    if not sheet:
        raise ValueError(f'Sheet {sheet_id} not found')

    source_path = os.path.join(STORAGE_PATH, sheet['page_image_path'])
    if not os.path.exists(source_path):
        raise FileNotFoundError(f'Page image not found: {source_path}')

    result = _call_claude(source_path, trade)

    regions = result.get('regions', [])
    is_relevant = result.get('is_relevant', True)

    # Relative path for web serving
    filename    = f'{sheet_id}_{trade}.jpg'
    rel_path    = f'annotated/{filename}'
    out_path    = os.path.join(ANNOTATED_PATH, filename)

    if is_relevant and regions:
        _render_annotations(source_path, regions, trade, out_path)
    else:
        # No relevant content — just copy source as-is so UI doesn't break
        import shutil
        shutil.copy2(source_path, out_path)
        regions = []

    region_count = len(regions)
    _save_to_db(sheet_id, trade, rel_path, region_count)

    return {
        'sheet_id':             sheet_id,
        'trade':                trade,
        'is_relevant':          is_relevant,
        'annotated_image_path': rel_path,
        'region_count':         region_count,
        'notes':                result.get('notes', ''),
    }
