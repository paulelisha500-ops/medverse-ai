"""
Trains lightweight logistic regression risk models on synthetically generated
data with realistic feature-risk relationships. Training on validated
clinical datasets and going through regulatory review would be required
before using this to inform real medical decisions.
"""
import os
import pickle

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
DIABETES_MODEL_PATH = os.path.join(DATA_DIR, "diabetes_risk_model.pkl")
HEART_MODEL_PATH = os.path.join(DATA_DIR, "heart_risk_model.pkl")

FEATURES = ["age", "bmi", "systolic_bp", "glucose", "cholesterol", "smoker", "family_history", "activity_level"]


def _synthetic_dataset(n=4000, seed=42, condition="diabetes"):
    rng = np.random.default_rng(seed)
    age = rng.uniform(18, 85, n)
    bmi = rng.uniform(16, 45, n)
    systolic_bp = rng.uniform(90, 190, n)
    glucose = rng.uniform(70, 250, n)
    cholesterol = rng.uniform(120, 320, n)
    smoker = rng.integers(0, 2, n)
    family_history = rng.integers(0, 2, n)
    activity_level = rng.integers(0, 3, n)  # 0 low, 1 moderate, 2 high

    X = np.column_stack([age, bmi, systolic_bp, glucose, cholesterol, smoker, family_history, activity_level])

    if condition == "diabetes":
        z = (
            0.030 * (age - 45)
            + 0.090 * (bmi - 25)
            + 0.040 * (glucose - 100)
            + 0.60 * family_history
            + 0.40 * smoker
            - 0.35 * activity_level
            - 3.0
        )
    else:  # heart disease
        z = (
            0.045 * (age - 45)
            + 0.050 * (bmi - 25)
            + 0.020 * (systolic_bp - 120)
            + 0.015 * (cholesterol - 180)
            + 0.70 * family_history
            + 0.55 * smoker
            - 0.30 * activity_level
            - 3.2
        )

    prob = 1 / (1 + np.exp(-z))
    y = rng.binomial(1, prob)
    return X, y


def train_and_save(condition: str, path: str) -> None:
    X, y = _synthetic_dataset(condition=condition)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000)
    model.fit(X_scaled, y)

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump({"model": model, "scaler": scaler, "features": FEATURES}, f)


def ensure_models_trained() -> None:
    if not os.path.exists(DIABETES_MODEL_PATH):
        train_and_save("diabetes", DIABETES_MODEL_PATH)
    if not os.path.exists(HEART_MODEL_PATH):
        train_and_save("heart", HEART_MODEL_PATH)


if __name__ == "__main__":
    train_and_save("diabetes", DIABETES_MODEL_PATH)
    train_and_save("heart", HEART_MODEL_PATH)
    print(f"Diabetes model saved to {DIABETES_MODEL_PATH}")
    print(f"Heart disease model saved to {HEART_MODEL_PATH}")
