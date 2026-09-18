from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str


class StaffCreate(UserCreate):
    role: str  # "doctor" or "admin" — only usable by an existing admin


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Patient records ----------

class PatientProfileUpdate(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None


class PatientProfileOut(BaseModel):
    id: int
    user_id: int
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class RecordEntryCreate(BaseModel):
    type: str
    title: str
    details: Optional[str] = None


class RecordEntryOut(BaseModel):
    id: int
    type: str
    title: str
    details: Optional[str] = None
    date: datetime

    class Config:
        from_attributes = True


# ---------- Assistant / RAG ----------

class ChatRequest(BaseModel):
    message: str
    patient_id: Optional[int] = None


class ChatSource(BaseModel):
    title: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource]


class ChatHistoryItem(BaseModel):
    role: str
    content: str
    created_at: datetime


# ---------- Reports / NLP ----------

class ReportAnalyzeRequest(BaseModel):
    text: str


class ReportAnalyzeResponse(BaseModel):
    id: int
    entities: dict
    patient_summary: str
    clinical_summary: Optional[str] = None


# ---------- Risk prediction ----------

class RiskAssessRequest(BaseModel):
    age: float = Field(ge=1, le=120)
    bmi: float = Field(ge=10, le=70)
    systolic_bp: float = Field(ge=70, le=250)
    glucose: float = Field(ge=40, le=500)
    cholesterol: float = Field(ge=80, le=500)
    smoker: bool = False
    family_history: bool = False
    activity_level: int = Field(ge=0, le=2, description="0=low, 1=moderate, 2=high")


class RiskAssessResponse(BaseModel):
    diabetes_risk_pct: float
    heart_disease_risk_pct: float
    diabetes_top_factors: List[str]
    heart_top_factors: List[str]
    tips: List[str]


# ---------- Medications ----------

class MedicationCheckRequest(BaseModel):
    medications: List[str]


class InteractionOut(BaseModel):
    drug_a: str
    drug_b: str
    description: str
    severity: Optional[str] = None
    source: Optional[str] = None  # "fda_label" | "curated"
    excerpt: Optional[str] = None


class MedicationCheckResponse(BaseModel):
    interactions: List[InteractionOut]
    checked: List[str]


# ---------- Appointments ----------

class AppointmentCreate(BaseModel):
    doctor_id: int
    patient_id: Optional[int] = None  # required when staff books on a patient's behalf
    scheduled_at: datetime
    reason: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    scheduled_at: datetime
    reason: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DoctorOut(BaseModel):
    id: int
    full_name: str


# ---------- Medication reminders ----------

class ReminderCreate(BaseModel):
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[str] = None


class ReminderUpdate(BaseModel):
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    active: Optional[bool] = None


class ReminderOut(BaseModel):
    id: int
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[str] = None
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReminderLogCreate(BaseModel):
    status: str  # "taken" | "skipped"


class ReminderProgress(BaseModel):
    reminder_id: int
    medication_name: str
    taken_count: int
    skipped_count: int
    adherence_pct: float


class ReminderProgressResponse(BaseModel):
    reminders: List[ReminderProgress]
    overall_adherence_pct: float
