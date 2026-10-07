// app/ml/risk_model.assess, evaluated in the browser. The scaler and
// logistic-regression parameters are the API's own fitted models, exported
// by scripts/export_browser_data.py, so both editions give identical scores.

import risk from './data/risk-models.json'
import { pyRound } from './http.js'

function predict(model, featureValues) {
  const scaled = featureValues.map((x, i) => (x - model.mean[i]) / model.scale[i])
  const z = scaled.reduce((sum, x, i) => sum + x * model.coef[i], model.intercept)
  const prob = 1 / (1 + Math.exp(-z))
  const contributions = scaled.map((x, i) => [risk.features[i], model.coef[i] * x])
  // Array.prototype.sort is stable, like Python's sorted(): ties keep feature order.
  const ranked = contributions.sort((a, b) => b[1] - a[1])
  const topFactors = ranked.slice(0, 3).filter(([, c]) => c > 0).map(([f]) => f)
  return [pyRound(prob * 100, 1), topFactors]
}

export function assess({ age, bmi, systolic_bp, glucose, cholesterol, smoker, family_history, activity_level }) {
  const featureValues = [
    age, bmi, systolic_bp, glucose, cholesterol,
    smoker ? 1 : 0, family_history ? 1 : 0, activity_level,
  ]
  const [diabetesPct, diabetesFactors] = predict(risk.models.diabetes, featureValues)
  const [heartPct, heartFactors] = predict(risk.models.heart, featureValues)

  const allFactors = [...new Set([...diabetesFactors, ...heartFactors])]
  let tips = allFactors.filter((f) => f in risk.tips).map((f) => risk.tips[f]).slice(0, 4)
  if (!tips.length) {
    tips = ['Keep up regular check-ups and a balanced lifestyle to maintain your current risk level.']
  }

  return {
    diabetes_risk_pct: diabetesPct,
    heart_disease_risk_pct: heartPct,
    diabetes_top_factors: diabetesFactors,
    heart_top_factors: heartFactors,
    tips,
  }
}
