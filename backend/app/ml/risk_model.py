import pickle

import numpy as np

from app.ml.train_risk_model import DIABETES_MODEL_PATH, FEATURES, HEART_MODEL_PATH, ensure_models_trained

_diabetes_bundle = None
_heart_bundle = None

TIPS = {
    "age": "Age-related risk can't be changed, but regular screening becomes more important over time.",
    "bmi": "Gradual, sustainable weight management can meaningfully lower this risk factor.",
    "systolic_bp": "Reducing sodium intake and staying active can help lower blood pressure over time.",
    "glucose": "Reducing refined carbohydrates and regular exercise both help regulate blood glucose.",
    "cholesterol": "A diet lower in saturated fat and higher in fiber can help improve cholesterol levels.",
    "smoker": "Quitting smoking is one of the highest-impact changes for both of these risk categories.",
    "family_history": "Family history can't be changed, but it's a good reason to screen earlier and more often.",
    "activity_level": "Increasing regular physical activity meaningfully lowers both risk categories.",
}


def _load():
    global _diabetes_bundle, _heart_bundle
    ensure_models_trained()
    if _diabetes_bundle is None:
        with open(DIABETES_MODEL_PATH, "rb") as f:
            _diabetes_bundle = pickle.load(f)
    if _heart_bundle is None:
        with open(HEART_MODEL_PATH, "rb") as f:
            _heart_bundle = pickle.load(f)


def _predict(bundle, feature_values):
    X = np.array([feature_values])
    X_scaled = bundle["scaler"].transform(X)
    prob = bundle["model"].predict_proba(X_scaled)[0][1]
    coefs = bundle["model"].coef_[0]
    contributions = coefs * X_scaled[0]
    ranked = sorted(zip(FEATURES, contributions), key=lambda x: -x[1])
    top_factors = [f for f, c in ranked[:3] if c > 0]
    return round(float(prob) * 100, 1), top_factors


def assess(age, bmi, systolic_bp, glucose, cholesterol, smoker, family_history, activity_level):
    _load()
    feature_values = [
        age, bmi, systolic_bp, glucose, cholesterol,
        int(bool(smoker)), int(bool(family_history)), activity_level,
    ]

    diabetes_pct, diabetes_factors = _predict(_diabetes_bundle, feature_values)
    heart_pct, heart_factors = _predict(_heart_bundle, feature_values)

    all_factors = list(dict.fromkeys(diabetes_factors + heart_factors))
    tips = [TIPS[f] for f in all_factors if f in TIPS][:4]
    if not tips:
        tips = ["Keep up regular check-ups and a balanced lifestyle to maintain your current risk level."]

    return {
        "diabetes_risk_pct": diabetes_pct,
        "heart_disease_risk_pct": heart_pct,
        "diabetes_top_factors": diabetes_factors,
        "heart_top_factors": heart_factors,
        "tips": tips,
    }
