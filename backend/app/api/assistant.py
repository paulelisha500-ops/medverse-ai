from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.rag.llm_providers import get_llm_provider
from app.rag.vector_store import search as kb_search
from app.schemas import ChatHistoryItem, ChatRequest, ChatResponse, ChatSource

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

SYSTEM_PROMPT = (
    "You are the MedVerse AI health information assistant, part of a clinical intelligence "
    "platform. Answer using the provided reference context whenever it's relevant. Give clear, "
    "general, educational health information suitable for a general audience. Never provide a "
    "definitive diagnosis or replace clinical judgment. Always encourage the person to consult a "
    "licensed healthcare professional for personal medical decisions, symptoms, or treatment. "
    "If the context doesn't cover the question, say so honestly instead of guessing."
)


def _build_patient_context(db: Session, requester: models.User, patient_id: int) -> str:
    if requester.role not in ("doctor", "admin") and requester.id != patient_id:
        raise HTTPException(status_code=403, detail="Not authorized to use this patient's context")

    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == patient_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    records = (
        db.query(models.MedicalRecordEntry)
        .filter(models.MedicalRecordEntry.patient_id == profile.id)
        .order_by(models.MedicalRecordEntry.date.desc())
        .limit(8)
        .all()
    )
    record_lines = [f"- ({r.type}) {r.title}: {r.details or ''}" for r in records]
    return (
        "\n\nPatient record summary (for clinician context only — do not restate verbatim to the "
        f"patient without care):\nAllergies: {profile.allergies or 'None recorded'}\n"
        + "\n".join(record_lines)
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    patient_context = ""
    if payload.patient_id:
        patient_context = _build_patient_context(db, user, payload.patient_id)

    kb_results = kb_search(payload.message, top_k=4)
    context_block = "\n\n".join(f"[{r['title']}]\n{r['text']}" for r in kb_results)

    user_prompt = f"Context:\n{context_block}{patient_context}\n\nQuestion: {payload.message}"

    provider = get_llm_provider()
    try:
        answer = provider.generate(SYSTEM_PROMPT, user_prompt)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The AI assistant is temporarily unavailable. Please try again in a moment.",
        )

    sources = [ChatSource(title=r["title"], snippet=r["text"][:220]) for r in kb_results]

    db.add(models.ChatMessage(user_id=user.id, role="user", content=payload.message))
    db.add(
        models.ChatMessage(
            user_id=user.id,
            role="assistant",
            content=answer,
            sources=[s.model_dump() for s in sources],
        )
    )
    db.commit()

    return ChatResponse(answer=answer, sources=sources)


@router.get("/history", response_model=List[ChatHistoryItem])
def history(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.user_id == user.id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return [
        ChatHistoryItem(role=m.role, content=m.content, created_at=m.created_at) for m in messages
    ]
