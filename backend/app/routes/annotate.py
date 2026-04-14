"""
Phase 17.1 — Annotation routes.

POST /api/sheets/{sheet_id}/annotate?trade={trade}   — generate annotated image
GET  /api/sheets/{sheet_id}/annotate?trade={trade}   — fetch existing annotation record
"""
import pymysql
from fastapi import APIRouter, HTTPException, Query
from app.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
from app.services.annotation_service import annotate_sheet

router = APIRouter()

VALID_TRADES = ['roofing','framing','drywall','electrical','hvac','plumbing','concrete','site_work']


def _db():
    return pymysql.connect(host=DB_HOST, port=DB_PORT, db=DB_NAME,
                           user=DB_USER, passwd=DB_PASS, charset='utf8mb4')


@router.post('/sheets/{sheet_id}/annotate')
async def generate_annotation(sheet_id: int, trade: str = Query(...)):
    if trade not in VALID_TRADES:
        raise HTTPException(status_code=422, detail=f'Invalid trade: {trade}')
    try:
        result = annotate_sheet(sheet_id, trade)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/sheets/{sheet_id}/annotate')
async def get_annotation(sheet_id: int, trade: str = Query(...)):
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, trade, annotated_image_path, region_count, created_at
                   FROM sheet_annotations WHERE sheet_id = %s AND trade = %s""",
                (sheet_id, trade)
            )
            row = cur.fetchone()
        if not row:
            return {'exists': False}
        return {
            'exists':               True,
            'id':                   row[0],
            'trade':                row[1],
            'annotated_image_path': row[2],
            'region_count':         row[3],
            'created_at':           str(row[4]),
        }
    finally:
        conn.close()
