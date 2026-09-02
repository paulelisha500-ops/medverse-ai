from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.ml.risk_model import assess
from app.schemas import RiskAssessRequest, RiskAssessResponse

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.post("/assess", response_model=RiskAssessResponse)
def assess_risk(
    payload: RiskAssessRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = assess(
        age=payload.age,
        bmi=payload.bmi,
        systolic_bp=payload.systolic_bp,
        glucose=payload.glucose,
        cholesterol=payload.cholesterol,
        smoker=payload.smoker,
        family_history=payload.family_history,
        activity_level=payload.activity_level,
    )

    db.add(
        models.RiskAssessment(
            user_id=user.id,
            inputs=payload.model_dump(),
            diabetes_risk_pct=result["diabetes_risk_pct"],
            heart_disease_risk_pct=result["heart_disease_risk_pct"],
        )
    )
    db.commit()

    return RiskAssessResponse(**result)
