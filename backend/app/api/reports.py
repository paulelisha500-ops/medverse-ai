from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.nlp.extraction import analyze_report
from app.schemas import ReportAnalyzeRequest, ReportAnalyzeResponse

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/analyze", response_model=ReportAnalyzeResponse)
def analyze(
    payload: ReportAnalyzeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = analyze_report(payload.text)

    record = models.ReportSummary(
        user_id=user.id,
        raw_text=payload.text,
        entities=result["entities"],
        patient_summary=result["patient_summary"],
        clinical_summary=result["clinical_summary"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ReportAnalyzeResponse(
        id=record.id,
        entities=result["entities"],
        patient_summary=result["patient_summary"],
        clinical_summary=result["clinical_summary"],
    )


@router.get("")
def list_reports(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    reports = (
        db.query(models.ReportSummary)
        .filter(models.ReportSummary.user_id == user.id)
        .order_by(models.ReportSummary.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "entities": r.entities,
            "patient_summary": r.patient_summary,
            "clinical_summary": r.clinical_summary,
            "created_at": r.created_at,
        }
        for r in reports
    ]
