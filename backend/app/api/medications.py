from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db import models
from app.nlp.drug_data import check_pair_live
from app.nlp.medication_data import check_curated_pair
from app.schemas import InteractionOut, MedicationCheckRequest, MedicationCheckResponse

router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.post("/check", response_model=MedicationCheckResponse)
def check(
    payload: MedicationCheckRequest,
    _user: models.User = Depends(get_current_user),
):
    meds = [m for m in payload.medications if m.strip()]
    interactions = []

    for i in range(len(meds)):
        for j in range(i + 1, len(meds)):
            drug_a, drug_b = meds[i], meds[j]
            live = check_pair_live(drug_a, drug_b)

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
                ))
            elif live["status"] == "unavailable":
                curated = check_curated_pair(drug_a, drug_b)
                if curated:
                    interactions.append(InteractionOut(**curated))
            # "no_match": both official labels were checked and neither
            # mentions the other — trust that over the curated list.

    return MedicationCheckResponse(interactions=interactions, checked=meds)
