from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="patient")  # admin | doctor | patient
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient_profile = relationship(
        "PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    allergies = Column(String, nullable=True)

    # Vitals
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)

    # Contact
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)

    # Lifestyle
    smoking_status = Column(String, nullable=True)  # never | former | current
    alcohol_use = Column(String, nullable=True)  # none | occasional | regular

    # Medical background (free-text summary; detailed entries live in MedicalRecordEntry)
    chronic_conditions = Column(Text, nullable=True)
    family_history = Column(Text, nullable=True)

    user = relationship("User", back_populates="patient_profile")
    records = relationship(
        "MedicalRecordEntry", back_populates="patient", cascade="all, delete-orphan"
    )


class MedicalRecordEntry(Base):
    __tablename__ = "medical_record_entries"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False)
    type = Column(String, nullable=False)  # condition | medication | surgery | lab | visit | vaccination
    title = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    date = Column(DateTime, default=datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="records")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    inputs = Column(JSON, nullable=False)
    diabetes_risk_pct = Column(Float, nullable=False)
    heart_disease_risk_pct = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReportSummary(Base):
    __tablename__ = "report_summaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    entities = Column(JSON, nullable=True)
    patient_summary = Column(Text, nullable=True)
    clinical_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
