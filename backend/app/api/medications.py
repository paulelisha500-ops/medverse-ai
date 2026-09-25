from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.db import models
from app.nlp.dose_conversion import convert_dose, get_conversion_families
from app.nlp.drug_data import check_pair_live, lookup_drug
from app.nlp.medication_data import check_curated_pair, get_drug_directory
from app.schemas import (
    ConversionFamiliesResponse,
    DoseConversionRequest,
    DoseConversionResponse,
    DrugDirectoryResponse,
    InteractionOut,
    MedicationCheckRequest,
    MedicationCheckResponse,
)

router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.post("/check", response_model=MedicationCheckResponse)
def check(
    payload: MedicationCheckRequest,
    _user: models.User = Depends(get_current_user),
):
    # Unique, non-blank names (case-insensitive) so a drug is never paired with itself.
    names, seen = [], set()
    for raw in payload.medications:
        name = raw.strip()[:100]
        if name and name.lower() not in seen:
            seen.add(name.lower())
            names.append(name)

    # One lookup per drug (not per pair), fetched concurrently.
    with ThreadPoolExecutor(max_workers=4) as pool:
        infos = dict(zip(names, pool.map(lookup_drug, names)))

    unverified = [n for n in names if infos[n]["label_text"] is None]
    interactions = []

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            drug_a, drug_b = names[i], names[j]
            live = check_pair_live(drug_a, drug_b, infos[drug_a], infos[drug_b])

            if live["status"] == "hit":
                interactions.append(InteractionOut(
                    drug_a=drug_a,
                    drug_b=drug_b,
                    description=(
                        f"{live['mentioned_drug']} is mentioned in {live['labeled_drug']}'s "
                        "official FDA labeling as a potential interaction."
                    ),
                    source="fda_label",
                    excerpt=live["excerpt"],
                    severity=(check_curated_pair(drug_a, drug_b) or {}).get("severity"),
                ))
            elif live["status"] == "unavailable":
                curated = check_curated_pair(drug_a, drug_b)
                if curated:
                    interactions.append(InteractionOut(**curated))

    return MedicationCheckResponse(interactions=interactions, checked=names, unverified=unverified)


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
