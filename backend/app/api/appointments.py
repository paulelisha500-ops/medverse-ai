from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.schemas import AppointmentCreate, AppointmentOut, AppointmentUpdate, DoctorOut

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


def _to_out(appt: models.Appointment, viewer: models.User) -> AppointmentOut:
    data = AppointmentOut.model_validate(appt)
    data.patient_name = appt.patient.full_name if appt.patient else None
    data.doctor_name = appt.doctor.full_name if appt.doctor else None
    if viewer.role == "patient":
        data.notes = None
    return data


@router.get("/doctors", response_model=List[DoctorOut])
def list_doctors(db: Session = Depends(get_db), _user: models.User = Depends(get_current_user)):
    doctors = db.query(models.User).filter(models.User.role == "doctor").all()
    return [DoctorOut(id=d.id, full_name=d.full_name) for d in doctors]


@router.post("", response_model=AppointmentOut)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id, models.User.role == "doctor").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if user.role == "patient":
        patient_id = user.id
        status = "requested"
    else:
        if not payload.patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required when staff books an appointment")
        patient = db.query(models.User).filter(models.User.id == payload.patient_id, models.User.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_id = patient.id
        status = "confirmed"

    appt = models.Appointment(
        patient_id=patient_id,
        doctor_id=doctor.id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
        status=status,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, user)


@router.get("", response_model=List[AppointmentOut])
def list_appointments(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    query = db.query(models.Appointment)
    if user.role == "patient":
        query = query.filter(models.Appointment.patient_id == user.id)
    elif user.role == "doctor":
        query = query.filter(models.Appointment.doctor_id == user.id)
    appointments = query.order_by(models.Appointment.scheduled_at.asc()).all()
    return [_to_out(a, user) for a in appointments]


@router.patch("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role not in ("admin", "doctor"):
        raise HTTPException(status_code=403, detail="Not authorized to update appointments")

    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if user.role == "doctor" and appt.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this appointment")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)

    db.commit()
    db.refresh(appt)
    return _to_out(appt, user)
