from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "admin":
        return {
            "role": "admin",
            "total_patients": db.query(models.PatientProfile).count(),
            "total_doctors": db.query(models.User).filter(models.User.role == "doctor").count(),
            "total_chats": db.query(models.ChatMessage).filter(models.ChatMessage.role == "user").count(),
            "total_reports_analyzed": db.query(models.ReportSummary).count(),
            "total_risk_assessments": db.query(models.RiskAssessment).count(),
            "records_by_type": [
                {"type": t, "count": c}
                for t, c in db.query(models.MedicalRecordEntry.type, func.count(models.MedicalRecordEntry.id))
                .group_by(models.MedicalRecordEntry.type)
                .all()
            ],
        }

    if user.role == "doctor":
        return {
            "role": "doctor",
            "total_patients": db.query(models.PatientProfile).count(),
            "total_reports_analyzed": db.query(models.ReportSummary).filter(
                models.ReportSummary.user_id == user.id
            ).count(),
            "total_chats": db.query(models.ChatMessage).filter(
                models.ChatMessage.user_id == user.id, models.ChatMessage.role == "user"
            ).count(),
        }

    # patient
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user.id).first()
    record_count = 0
    if profile:
        record_count = db.query(models.MedicalRecordEntry).filter(
            models.MedicalRecordEntry.patient_id == profile.id
        ).count()

    last_risk = (
        db.query(models.RiskAssessment)
        .filter(models.RiskAssessment.user_id == user.id)
        .order_by(models.RiskAssessment.created_at.desc())
        .first()
    )

    return {
        "role": "patient",
        "record_count": record_count,
        "total_chats": db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == user.id, models.ChatMessage.role == "user"
        ).count(),
        "total_reports_analyzed": db.query(models.ReportSummary).filter(
            models.ReportSummary.user_id == user.id
        ).count(),
        "last_risk_assessment": {
            "diabetes_risk_pct": last_risk.diabetes_risk_pct,
            "heart_disease_risk_pct": last_risk.heart_disease_risk_pct,
        } if last_risk else None,
    }
