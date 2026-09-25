from datetime import datetime, timezone
from typing import Annotated, List, Optional

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_serializer, field_validator


def _to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Stored datetimes are naive UTC. Aware inputs are converted (not just
    stripped); naive inputs are assumed to already be UTC."""
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _utc_iso(value: datetime) -> str:
    return value.isoformat() + "Z"


# Rejects "" and whitespace-only input with a 422. Without it an empty chat
# message still ran retrieval — returning whatever passage ranked first for
# nothing — and an empty report was saved and counted as analyzed.
NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: NonEmptyStr


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
    height_cm: Optional[float] = Field(default=None, ge=30, le=272)
    weight_kg: Optional[float] = Field(default=None, ge=1, le=500)
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    smoking_status: Optional[str] = None
    alcohol_use: Optional[str] = None
    chronic_conditions: Optional[str] = None
    family_history: Optional[str] = None


class PatientProfileOut(BaseModel):
    id: int
    user_id: int
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    smoking_status: Optional[str] = None
    alcohol_use: Optional[str] = None
    chronic_conditions: Optional[str] = None
    family_history: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    bmi: Optional[float] = None

    class Config:
        from_attributes = True


class RecordEntryCreate(BaseModel):
    type: NonEmptyStr
    title: NonEmptyStr
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
    message: NonEmptyStr
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
    text: NonEmptyStr


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
    medications: List[str] = Field(max_length=10)


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
    unverified: List[str] = []  # drugs whose official label couldn't be found/reached


# ---------- Appointments ----------

class AppointmentCreate(BaseModel):
    doctor_id: int
    patient_id: Optional[int] = None  # required when staff books on a patient's behalf
    scheduled_at: datetime
    reason: Optional[str] = None

    @field_validator("scheduled_at")
    @classmethod
    def _normalize_utc(cls, v):
        return _to_naive_utc(v)


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None

    @field_validator("scheduled_at")
    @classmethod
    def _normalize_utc(cls, v):
        return _to_naive_utc(v)


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

    @field_serializer("scheduled_at", "created_at")
    def _serialize_utc(self, value: datetime) -> str:
        return _utc_iso(value)

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




class DrugInfoOut(BaseModel):
    name: str
    brand_names: List[str]
    dosage: str
    category: str
    fda_class: str = ""
    # "curated" entries have hand-written dosing and can appear in interaction
    # pairs; "reference" entries come from openFDA and carry no dosing regimen.
    tier: str = "curated"


class DrugDirectoryResponse(BaseModel):
    drugs: List[DrugInfoOut]


class ConversionFamilyOut(BaseModel):
    key: str
    label: str
    reference: str
    drugs: List[str]
    caveats: List[str]


class ConversionFamiliesResponse(BaseModel):
    families: List[ConversionFamilyOut]


class DoseConversionRequest(BaseModel):
    family: str
    from_drug: str
    to_drug: str
    dose_mg: float = Field(gt=0, le=10000)


class DoseConversionResponse(BaseModel):
    family: str
    from_drug: str
    to_drug: str
    dose_mg: float
    converted_mg: float
    reference_value: float
    reference_unit: str
    caveats: List[str]
