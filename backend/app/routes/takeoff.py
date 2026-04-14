import pymysql
import pymysql.cursors
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from app.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
from app.services.takeoff_dispatcher import run_takeoff_job
from app.services import floor_detector

router = APIRouter()


class RunTakeoffRequest(BaseModel):
    run_id: int
    project_id: int
    trade: str


class DetectFloorsRequest(BaseModel):
    project_id: int


@router.post("/run-takeoff")
async def run_takeoff(request: RunTakeoffRequest, background_tasks: BackgroundTasks):
    """
    Triggered by PHP after creating a takeoff_runs row.
    Dispatches to the correct trade analyzer in the background.
    """
    background_tasks.add_task(run_takeoff_job, request.run_id, request.project_id, request.trade)
    return {"run_id": request.run_id, "status": "processing"}


@router.post("/detect-floors")
async def detect_floors(request: DetectFloorsRequest, background_tasks: BackgroundTasks):
    """
    Runs floor repeat detection on all candidate sheets for a project.
    Writes floor_multiplier + floor_multiplier_note to plan_sheets rows.
    Runs in background; client polls /floor-multipliers/{project_id} for results.
    """
    background_tasks.add_task(floor_detector.detect_for_project, request.project_id)
    return {"project_id": request.project_id, "status": "detecting"}


@router.get("/floor-multipliers/{project_id}")
async def floor_multipliers(project_id: int):
    """Returns all sheets for a project that have floor_multiplier != 1."""
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT, db=DB_NAME,
        user=DB_USER, passwd=DB_PASS,
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT ps.id, ps.sheet_number, ps.sheet_title, ps.sheet_type,
                          ps.floor_multiplier, ps.floor_multiplier_note
                   FROM plan_sheets ps
                   JOIN project_files pf ON pf.id = ps.file_id
                   WHERE pf.project_id = %s
                   ORDER BY ps.file_id, ps.page_number""",
                (project_id,)
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return {"sheets": rows}
