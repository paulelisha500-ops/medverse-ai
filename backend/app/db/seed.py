from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db import models

DEMO_USERS = [
    {
        "email": "admin@medverse.ai",
        "password": "Admin@123",
        "full_name": "Ava Administrator",
        "role": "admin",
    },
    {
        "email": "doctor@medverse.ai",
        "password": "Doctor@123",
        "full_name": "Dr. Sam Rivera",
        "role": "doctor",
    },
    {
        "email": "patient@medverse.ai",
        "password": "Patient@123",
        "full_name": "Jordan Patient",
        "role": "patient",
    },
]

DEMO_RECORDS = [
    {"type": "condition", "title": "Type 2 Diabetes", "details": "Diagnosed 2022, managed with metformin."},
    {"type": "medication", "title": "Metformin 500mg", "details": "Twice daily with meals."},
    {"type": "lab", "title": "Fasting Glucose", "details": "126 mg/dL (Jan 2026)."},
    {"type": "visit", "title": "Annual Check-up", "details": "Routine visit, blood pressure 128/82."},
    {"type": "vaccination", "title": "Influenza Vaccine", "details": "Administered October 2025."},
]


def run_seed(db: Session) -> None:
    """Idempotent: only seeds if the users table is empty."""
    if db.query(models.User).first() is not None:
        return

    created = {}
    for u in DEMO_USERS:
        user = models.User(
            email=u["email"],
            hashed_password=hash_password(u["password"]),
            full_name=u["full_name"],
            role=u["role"],
        )
        db.add(user)
        db.flush()
        created[u["role"]] = user

    patient_profile = models.PatientProfile(
        user_id=created["patient"].id,
        date_of_birth="1990-04-12",
        gender="Non-binary",
        blood_group="O+",
        allergies="Penicillin",
    )
    db.add(patient_profile)
    db.flush()

    for r in DEMO_RECORDS:
        db.add(
            models.MedicalRecordEntry(
                patient_id=patient_profile.id,
                type=r["type"],
                title=r["title"],
                details=r["details"],
            )
        )

    db.commit()
    print("Seeded demo users: admin@medverse.ai / doctor@medverse.ai / patient@medverse.ai (see README for passwords)")
