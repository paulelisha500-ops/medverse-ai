from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db import models
from app.nlp.medication_data import check_interactions, get_drug_directory
from app.schemas import DrugDirectoryResponse, MedicationCheckRequest, MedicationCheckResponse

router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.post("/check", response_model=MedicationCheckResponse)
def check(
    payload: MedicationCheckRequest,
    _user: models.User = Depends(get_current_user),
):
    interactions = check_interactions(payload.medications)
    return MedicationCheckResponse(interactions=interactions, checked=payload.medications)


@router.get("/directory", response_model=DrugDirectoryResponse)
def directory(_user: models.User = Depends(get_current_user)):
    """Full drug list (generic + brand names + typical dosage) for autocomplete."""
    return DrugDirectoryResponse(drugs=get_drug_directory())
