"""
Equivalent-dose conversion tables (opioid, corticosteroid, benzodiazepine).

These are published equivalency references, not a dosing recommendation engine.
Each family carries the caveats a real converter has to state — most importantly
that opioid rotation requires a downward adjustment for incomplete cross-tolerance,
and that methadone's ratio is nonlinear and rises with the existing daily dose.
"""
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Opioids — CDC morphine milligram equivalent (MME) conversion factors.
# Factor is MME per 1 mg of the drug, oral unless noted.
# ---------------------------------------------------------------------------
OPIOID_MME = {
    "morphine": 1.0,
    "codeine": 0.15,
    "hydrocodone": 1.0,
    "hydromorphone": 4.0,
    "oxycodone": 1.5,
    "oxymorphone": 3.0,
    "tramadol": 0.1,
    "tapentadol": 0.4,
    "methadone": 4.7,
}

# Not a linear mg-for-mg conversion; excluded from the calculator on purpose.
OPIOID_EXCLUDED = {
    "fentanyl": "Transdermal fentanyl is dosed in mcg/hour, not mg, and does not "
                "convert linearly. Use a product-specific table.",
    "buprenorphine": "Buprenorphine is a partial agonist with ceiling effects; MME "
                     "conversion is not considered valid.",
}

# ---------------------------------------------------------------------------
# Corticosteroids — approximate anti-inflammatory equivalence, mg per dose
# equivalent to 5 mg of prednisone. Mineralocorticoid effect and duration differ
# between these agents and are not captured by a single ratio.
# ---------------------------------------------------------------------------
STEROID_EQUIV_MG = {
    "hydrocortisone": 20.0,
    "cortisone": 25.0,
    "prednisone": 5.0,
    "prednisolone": 5.0,
    "methylprednisolone": 4.0,
    "triamcinolone": 4.0,
    "dexamethasone": 0.75,
    "betamethasone": 0.6,
}

# ---------------------------------------------------------------------------
# Benzodiazepines — approximate equivalence, mg equal to 10 mg of diazepam.
# Published tables vary; half-life differences matter as much as the ratio.
# ---------------------------------------------------------------------------
BENZO_EQUIV_MG = {
    "diazepam": 10.0,
    "alprazolam": 0.5,
    "clonazepam": 0.5,
    "lorazepam": 1.0,
    "temazepam": 20.0,
    "oxazepam": 30.0,
    "chlordiazepoxide": 25.0,
    "triazolam": 0.25,
    "midazolam": 7.5,
}

FAMILIES = {
    "opioid": {
        "label": "Opioid (morphine milligram equivalents)",
        "reference": "Oral morphine",
        "drugs": sorted(OPIOID_MME),
        "caveats": [
            "Reduce the calculated dose by 25–50% when switching between opioids — "
            "cross-tolerance between agents is incomplete.",
            "Methadone's ratio is nonlinear and increases at higher daily doses; the "
            "single factor used here understates risk above roughly 60 MME/day.",
            "Transdermal fentanyl and buprenorphine are excluded — neither converts "
            "linearly from an oral mg dose.",
        ],
    },
    "corticosteroid": {
        "label": "Corticosteroid (prednisone equivalents)",
        "reference": "Oral prednisone",
        "drugs": sorted(STEROID_EQUIV_MG),
        "caveats": [
            "Equivalence covers anti-inflammatory potency only. Mineralocorticoid "
            "activity and duration of action differ substantially between agents.",
            "Long-term therapy requires a taper — an equivalent dose does not mean an "
            "interchangeable stopping point.",
        ],
    },
    "benzodiazepine": {
        "label": "Benzodiazepine (diazepam equivalents)",
        "reference": "Oral diazepam",
        "drugs": sorted(BENZO_EQUIV_MG),
        "caveats": [
            "Published equivalency tables disagree; treat these as approximate.",
            "Half-lives differ widely (e.g. alprazolam vs diazepam), which affects "
            "withdrawal and accumulation as much as the dose ratio does.",
        ],
    },
}


def get_conversion_families() -> List[Dict]:
    """Metadata for the conversion UI: families, their drugs, and caveats."""
    return [
        {
            "key": key,
            "label": fam["label"],
            "reference": fam["reference"],
            "drugs": fam["drugs"],
            "caveats": fam["caveats"],
        }
        for key, fam in FAMILIES.items()
    ]


def convert_dose(family: str, from_drug: str, to_drug: str, dose_mg: float) -> Dict:
    """Convert a dose between two drugs in the same family.

    Returns a dict with the converted dose plus the caveats that apply. Raises
    ValueError for an unknown family or drug so the API can return a 400.
    """
    fam = FAMILIES.get(family)
    if fam is None:
        raise ValueError(f"Unknown conversion family: {family}")

    from_drug = from_drug.strip().lower()
    to_drug = to_drug.strip().lower()

    for drug in (from_drug, to_drug):
        if drug in OPIOID_EXCLUDED and family == "opioid":
            raise ValueError(OPIOID_EXCLUDED[drug])

    if family == "opioid":
        table = OPIOID_MME
        if from_drug not in table or to_drug not in table:
            raise ValueError("Both medications must be in the opioid conversion table")
        # Convert to MME, then back out to the target drug.
        mme = dose_mg * table[from_drug]
        converted = mme / table[to_drug]
        reference_value = round(mme, 1)
        reference_unit = "MME/day"
    else:
        table = STEROID_EQUIV_MG if family == "corticosteroid" else BENZO_EQUIV_MG
        if from_drug not in table or to_drug not in table:
            raise ValueError("Both medications must be in this conversion table")
        # Ratio of "mg equivalent to one reference dose" between the two drugs.
        converted = dose_mg * (table[to_drug] / table[from_drug])
        reference_value = round(dose_mg / table[from_drug], 2)
        reference_unit = f"× reference dose of {fam['reference'].lower()}"

    return {
        "family": family,
        "from_drug": from_drug,
        "to_drug": to_drug,
        "dose_mg": dose_mg,
        "converted_mg": round(converted, 2),
        "reference_value": reference_value,
        "reference_unit": reference_unit,
        "caveats": fam["caveats"],
    }
