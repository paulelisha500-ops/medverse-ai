from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.db import models
from app.nlp.dose_conversion import convert_dose, get_conversion_families
from app.nlp.medication_data import check_interactions, get_drug_directory
from app.schemas import (
    ConversionFamiliesResponse,
    DoseConversionRequest,
    DoseConversionResponse,
    DrugDirectoryResponse,
    MedicationCheckRequest,
    MedicationCheckResponse,
)

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


@router.get("/conversion-families", response_model=ConversionFamiliesResponse)
def conversion_families(_user: models.User = Depends(get_current_user)):
    """Available equivalent-dose conversion families and their caveats."""
    return ConversionFamiliesResponse(families=get_conversion_families())


@router.post("/convert", response_model=DoseConversionResponse)
def convert(
    payload: DoseConversionRequest,
    _user: models.User = Depends(get_current_user),
):
    try:
        return DoseConversionResponse(
            **convert_dose(payload.family, payload.from_drug, payload.to_drug, payload.dose_mg)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
