from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db import models
from app.db.database import get_db
from app.schemas import (
    ReminderCreate,
    ReminderLogCreate,
    ReminderOut,
    ReminderProgress,
    ReminderProgressResponse,
    ReminderUpdate,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

PROGRESS_WINDOW_DAYS = 7


@router.post("", response_model=ReminderOut)
def create_reminder(
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    reminder = models.MedicationReminder(user_id=user.id, **payload.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("", response_model=List[ReminderOut])
def list_reminders(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    return (
        db.query(models.MedicationReminder)
        .filter(models.MedicationReminder.user_id == user.id)
        .order_by(models.MedicationReminder.active.desc(), models.MedicationReminder.created_at.desc())
        .all()
    )


def _get_own_reminder(db: Session, user: models.User, reminder_id: int) -> models.MedicationReminder:
    reminder = (
        db.query(models.MedicationReminder)
        .filter(models.MedicationReminder.id == reminder_id, models.MedicationReminder.user_id == user.id)
        .first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    reminder = _get_own_reminder(db, user, reminder_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/{reminder_id}/log")
def log_reminder(
    reminder_id: int,
    payload: ReminderLogCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    reminder = _get_own_reminder(db, user, reminder_id)
    if payload.status not in ("taken", "skipped"):
        raise HTTPException(status_code=400, detail="status must be 'taken' or 'skipped'")
    db.add(models.MedicationLog(reminder_id=reminder.id, status=payload.status))
    db.commit()
    return {"ok": True}


@router.get("/progress", response_model=ReminderProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    reminders = (
        db.query(models.MedicationReminder)
        .filter(models.MedicationReminder.user_id == user.id)
        .all()
    )
    since = datetime.utcnow() - timedelta(days=PROGRESS_WINDOW_DAYS)

    results = []
    total_taken = 0
    total_logged = 0
    for reminder in reminders:
        logs = [log for log in reminder.logs if log.taken_at >= since]
        taken = sum(1 for log in logs if log.status == "taken")
        skipped = sum(1 for log in logs if log.status == "skipped")
        total = taken + skipped
        adherence = round((taken / total) * 100, 1) if total else 0.0
        total_taken += taken
        total_logged += total
        results.append(
            ReminderProgress(
                reminder_id=reminder.id,
                medication_name=reminder.medication_name,
                taken_count=taken,
                skipped_count=skipped,
                adherence_pct=adherence,
            )
        )

    overall = round((total_taken / total_logged) * 100, 1) if total_logged else 0.0
    return ReminderProgressResponse(reminders=results, overall_adherence_pct=overall)
