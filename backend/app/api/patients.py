from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db import models
from app.db.database import get_db
from app.schemas import (
    PatientProfileOut,
    PatientProfileUpdate,
    RecordEntryCreate,
    RecordEntryOut,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _compute_age(date_of_birth: Optional[str]) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    except ValueError:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _compute_bmi(height_cm: Optional[float], weight_kg: Optional[float]) -> Optional[float]:
    if not height_cm or not weight_kg:
        return None
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


def _profile_to_out(profile: models.PatientProfile) -> PatientProfileOut:
    return PatientProfileOut(
        id=profile.id,
        user_id=profile.user_id,
        date_of_birth=profile.date_of_birth,
        gender=profile.gender,
        blood_group=profile.blood_group,
        allergies=profile.allergies,
        height_cm=profile.height_cm,
        weight_kg=profile.weight_kg,
        phone=profile.phone,
        address=profile.address,
        emergency_contact_name=profile.emergency_contact_name,
        emergency_contact_phone=profile.emergency_contact_phone,
        smoking_status=profile.smoking_status,
        alcohol_use=profile.alcohol_use,
        chronic_conditions=profile.chronic_conditions,
        family_history=profile.family_history,
        full_name=profile.user.full_name if profile.user else None,
        email=profile.user.email if profile.user else None,
        age=_compute_age(profile.date_of_birth),
        bmi=_compute_bmi(profile.height_cm, profile.weight_kg),
    )


@router.get("", response_model=List[PatientProfileOut])
def list_patients(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles("admin", "doctor")),
):
    profiles = db.query(models.PatientProfile).all()
    return [_profile_to_out(p) for p in profiles]


@router.get("/me/profile", response_model=PatientProfileOut)
def get_my_profile(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return _profile_to_out(profile)


@router.put("/me/profile", response_model=PatientProfileOut)
def update_my_profile(
    payload: PatientProfileUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("patient")),
):
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _profile_to_out(profile)


def _get_profile_or_404(db: Session, profile_id: int) -> models.PatientProfile:
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    return profile


def _authorize_patient_access(user: models.User, profile: models.PatientProfile):
    if user.role in ("admin", "doctor"):
        return
    if user.role == "patient" and user.id == profile.user_id:
        return
    raise HTTPException(status_code=403, detail="Not authorized to view this patient's records")


@router.get("/{profile_id}", response_model=PatientProfileOut)
def get_patient(
    profile_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = _get_profile_or_404(db, profile_id)
    _authorize_patient_access(user, profile)
    return _profile_to_out(profile)


@router.put("/{profile_id}", response_model=PatientProfileOut)
def update_patient(
    profile_id: int,
    payload: PatientProfileUpdate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles("admin", "doctor")),
):
    """Admin/doctor intake: fill in or correct a patient's details directly."""
    profile = _get_profile_or_404(db, profile_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return _profile_to_out(profile)


@router.get("/{profile_id}/records", response_model=List[RecordEntryOut])
def list_records(
    profile_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = _get_profile_or_404(db, profile_id)
    _authorize_patient_access(user, profile)
    records = (
        db.query(models.MedicalRecordEntry)
        .filter(models.MedicalRecordEntry.patient_id == profile_id)
        .order_by(models.MedicalRecordEntry.date.desc())
        .all()
    )
    return records


@router.post("/{profile_id}/records", response_model=RecordEntryOut)
def add_record(
    profile_id: int,
    payload: RecordEntryCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles("admin", "doctor")),
):
    _get_profile_or_404(db, profile_id)
    entry = models.MedicalRecordEntry(patient_id=profile_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
