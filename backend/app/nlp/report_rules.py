"""
Rule-based report understanding: the analysis used when no LLM is configured
(the default, and what a keyless Hugging Face Space runs), and the fallback
when a configured LLM call fails.

Before this, a report analyzed without an LLM came back with no diagnoses, no
medications and "A summary could not be generated" — even for the app's own
sample report, which names metformin and prediabetes outright.

Everything here is deterministic pattern matching against data this app
already ships:
- medications: the curated drug directory and brand aliases (medication_data)
- conditions: a lexicon of common chronic/acute conditions with abbreviations,
  skipping negated ("no evidence of pneumonia") and family-history mentions
- lab flags: standard adult reference ranges, with SI-unit detection
- follow-up: sentences carrying follow-up/referral/recheck language
"""
import math
import re
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from app.nlp.medication_data import BRAND_TO_GENERIC, DRUG_INFO

# ---------------------------------------------------------------------------
# Sentences
# ---------------------------------------------------------------------------


def split_sentences(text: str) -> List[str]:
    """Splits on line breaks and on sentence punctuation followed by space, so
    decimals like "6.7%" stay intact."""
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


# ---------------------------------------------------------------------------
# Medications
# ---------------------------------------------------------------------------

# openFDA "brand" aliases that are store brands, manufacturers or plain phrases.
# Fine in an autocomplete, but scanning free text for them would turn "stool
# softener" or "dandruff" into a medication mention.
_NOT_DRUG_MENTIONS = {
    "dandruff", "exchange select", "fleet", "kroger antifungal", "laxative gentle",
    "medi-first", "nix", "silka antifungal", "stool softener", "topco associates",
    "winco", "womens laxative",
}

# Names that are also routine lab analytes ("Potassium: 4.1 mmol/L", "Vitamin D,
# 25-OH: 18 ng/mL") or common words in clinical prose ("iron deficiency"). These
# count as a medication only when a dose follows them directly.
_NEEDS_DOSE = {
    "adenosine", "adrenaline", "atropine", "calcium", "digoxin", "dopamine", "epinephrine",
    "estradiol", "folic acid", "glucosamine", "heparin", "insulin", "iron", "lithium",
    "magnesium", "melatonin", "niacin", "norepinephrine", "omega-3", "potassium",
    "probiotics", "progesterone", "testosterone", "turmeric", "vasopressin", "vitamin b12",
    "vitamin d", "vitamin k", "zinc",
}

# A dose: "500mg", "2,000 IU", "10 units". The lookahead rejects concentrations
# (mg/dL, mcg/mL, mmol/L) so lab results never read as doses; "mg/day" passes.
_DOSE = (
    r"\d[\d,]*(?:\.\d+)?\s*(?:mg|mcg|µg|ug|g|ml|iu|units?|meq)\b"
    r"(?!\s*/\s*(?:dl|l|ml)\b)"
)
_FREQUENCY = (
    r"(?:once|twice|three times|four times)\s+(?:a\s+)?(?:daily|day|weekly|week)"
    r"|every\s+\d+\s+(?:hours?|hrs?|days?|weeks?)"
    r"|at bedtime|as needed|daily|nightly|weekly|qd|bid|tid|qid|qhs|prn"
)
# Formulation words that may sit between a name and its dose ("Metformin ER 500 mg").
_FORMULATION = r"(?:\s+(?:er|xr|sr|ir|xl|la|cr|dr|odt|tablets?|tabs?|capsules?|caps?|oral|po))*"
_DOSE_AFTER_NAME = re.compile(
    rf"^{_FORMULATION}\s*[:\-]?\s*(?P<dose>{_DOSE})(?:\s*,?\s*(?P<freq>{_FREQUENCY})\b)?",
    re.IGNORECASE,
)

_MED_EXCLUDE_BEFORE = re.compile(
    r"allerg|intoleran|discontinu|stopped|\bstop\b|avoid|no longer|\bheld\b|\bhold\b|reaction to",
    re.IGNORECASE,
)
_MED_EXCLUDE_AFTER = re.compile(
    r"^\W*(?:(?:was|were|is|has been)\s+)?(?:discontinued|stopped|held|allergy|allergic)",
    re.IGNORECASE,
)


@lru_cache(maxsize=1)
def _medication_pattern() -> Tuple[re.Pattern, Dict[str, str]]:
    names: Dict[str, str] = {}  # lowercase mention -> generic
    for generic in DRUG_INFO:
        names[generic] = generic
    for brand, generic in BRAND_TO_GENERIC.items():
        if brand not in _NOT_DRUG_MENTIONS and generic in DRUG_INFO:
            names.setdefault(brand, generic)
    # Longest first, so "insulin glargine" wins over "insulin".
    alternation = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    return re.compile(rf"(?<![\w-])(?:{alternation})(?![\w-])", re.IGNORECASE), names


def find_medications(text: str) -> List[str]:
    """Medications mentioned as current/prescribed, with dose and frequency when
    stated: e.g. "metformin 500mg twice daily", "atorvastatin (Lipitor) 20 mg"."""
    pattern, names = _medication_pattern()
    found: Dict[str, str] = {}
    for sentence in split_sentences(text):
        for match in pattern.finditer(sentence):
            mention = match.group(0)
            generic = names[mention.lower()]
            if generic in found:
                continue
            before = sentence[max(0, match.start() - 60):match.start()]
            after = sentence[match.end():]
            if _MED_EXCLUDE_BEFORE.search(before) or _MED_EXCLUDE_AFTER.search(after[:40]):
                continue
            dose = _DOSE_AFTER_NAME.match(after)
            if generic in _NEEDS_DOSE and not dose:
                continue
            label = generic if mention.lower() == generic else f"{generic} ({mention})"
            if dose:
                label += " " + dose.group("dose")
                if dose.group("freq"):
                    label += " " + dose.group("freq")
            found[generic] = label
    return list(found.values())


# ---------------------------------------------------------------------------
# Conditions
# ---------------------------------------------------------------------------

CONDITIONS: List[Tuple[str, str]] = [
    ("Type 2 diabetes", r"type\s*(?:2|ii)\s+diabetes(?:\s+mellitus)?|diabetes mellitus,?\s+type\s*(?:2|ii)|t2dm|niddm"),
    ("Type 1 diabetes", r"type\s*(?:1|i)\s+diabetes(?:\s+mellitus)?|diabetes mellitus,?\s+type\s*(?:1|i)|t1dm|iddm"),
    ("Prediabetes", r"pre-?diabet(?:es|ic)|impaired fasting glucose|impaired glucose tolerance"),
    ("Diabetes", r"diabetes(?:\s+mellitus)?|diabetic"),
    ("Hypertension", r"hypertension|hypertensive|high blood pressure|htn"),
    ("Hyperlipidemia", r"hyperlipid(?:a)?emia|dyslipid(?:a)?emia|hypercholesterol(?:a)?emia|high cholesterol|hld"),
    ("Coronary artery disease", r"coronary artery disease|coronary heart disease|ischemic heart disease|cad"),
    ("Myocardial infarction", r"myocardial infarction|heart attack|n?stemi"),
    ("Heart failure", r"(?:congestive\s+)?heart failure|chf|hfref|hfpef"),
    ("Atrial fibrillation", r"atrial fibrillation|a-?fib"),
    ("Stroke", r"stroke|cerebrovascular accident|cva"),
    ("Transient ischemic attack", r"transient ischemic attack|tia"),
    ("Deep vein thrombosis", r"deep vein thrombosis|dvt"),
    ("Pulmonary embolism", r"pulmonary embolism"),
    ("Chronic kidney disease", r"chronic kidney disease|ckd(?:\s+stage\s+\d[ab]?)?|renal insufficiency"),
    ("Acute kidney injury", r"acute kidney injury|aki"),
    ("Asthma", r"asthma"),
    ("COPD", r"copd|chronic obstructive pulmonary disease|emphysema"),
    ("Pneumonia", r"pneumonia"),
    ("Sleep apnea", r"(?:obstructive\s+)?sleep apnea|osa"),
    ("Hypothyroidism", r"hypothyroid(?:ism)?|hashimoto'?s"),
    ("Hyperthyroidism", r"hyperthyroid(?:ism)?|graves'? disease"),
    ("Anemia", r"an(?:a)?emi(?:a|c)"),
    ("Obesity", r"obesity|obese"),
    ("Fatty liver disease", r"fatty liver(?:\s+disease)?|nafld|masld|hepatic steatosis"),
    ("GERD", r"gerd|gastro-?(?:o)?esophageal reflux(?:\s+disease)?|acid reflux"),
    ("Osteoarthritis", r"osteoarthritis"),
    ("Rheumatoid arthritis", r"rheumatoid arthritis"),
    ("Osteoporosis", r"osteoporosis"),
    ("Osteopenia", r"osteopenia"),
    ("Gout", r"gout"),
    ("Depression", r"depression|major depressive disorder|mdd"),
    ("Anxiety", r"anxiety(?:\s+disorder)?|generalized anxiety disorder"),
    ("Migraine", r"migraines?"),
    ("Epilepsy", r"epilepsy|seizure disorder"),
    ("Urinary tract infection", r"urinary tract infection|uti"),
    ("Vitamin D deficiency", r"vitamin d deficiency|vitamin d insufficiency"),
    ("Iron deficiency", r"iron deficiency"),
    ("COVID-19", r"covid(?:-19)?|sars-cov-2"),
]

_CONDITION_PATTERNS = [
    (name, re.compile(rf"(?<![\w-])(?:{pattern})(?![\w-])", re.IGNORECASE)) for name, pattern in CONDITIONS
]

# NegEx-style negation: a cue in the few words before a mention, unless a
# terminator ("but", "has", ";") separates them, or a cue right after it.
_NEGATION_BEFORE = re.compile(
    r"\b(?:no|not|denies|denied|without|negative for|free of|absence of|ruled out|rule out|r/o"
    r"|no evidence of|no signs? of|unlikely)\b",
    re.IGNORECASE,
)
_NEGATION_TERMINATOR = re.compile(
    r"\b(?:but|however|although|though|except|has|have|presents?|reports?|diagnosed)\b|[;:]",
    re.IGNORECASE,
)
_NEGATION_AFTER = re.compile(
    r"^\W*(?:(?:was|is|has been|were)\s+)?(?:ruled out|excluded|unlikely|negative|not (?:present|seen|found))",
    re.IGNORECASE,
)
_FAMILY = re.compile(
    r"family history|\bfhx?\b|\b(?:mother|father|brother|sister|sibling|parent|grand(?:mother|father|parent))s?\b",
    re.IGNORECASE,
)


def _is_negated(sentence: str, start: int, end: int) -> bool:
    window = " ".join(sentence[:start].split()[-6:])
    terminators = list(_NEGATION_TERMINATOR.finditer(window))
    if terminators:
        window = window[terminators[-1].end():]
    return bool(_NEGATION_BEFORE.search(window) or _NEGATION_AFTER.search(sentence[end:end + 40]))


def find_conditions(text: str) -> List[str]:
    """Conditions the report attributes to the patient, in order of first
    mention. Negated and family-history mentions are left out, and a specific
    match ("prediabetes") suppresses a generic one inside it ("diabetes")."""
    found: List[str] = []
    for sentence in split_sentences(text):
        spans: List[Tuple[int, int, str]] = []
        for name, pattern in _CONDITION_PATTERNS:
            for match in pattern.finditer(sentence):
                spans.append((match.start(), match.end(), name))
        # Longest span wins where mentions overlap.
        spans.sort(key=lambda s: (-(s[1] - s[0]), s[0]))
        kept: List[Tuple[int, int, str]] = []
        for start, end, name in spans:
            if any(start < k_end and k_start < end for k_start, k_end, _ in kept):
                continue
            kept.append((start, end, name))
        for start, end, name in sorted(kept):
            if _FAMILY.search(sentence[:start]) or _is_negated(sentence, start, end):
                continue
            if name not in found:
                found.append(name)
    # "Diabetes" adds nothing once a specific type was found.
    if "Diabetes" in found and any(n in found for n in ("Type 1 diabetes", "Type 2 diabetes")):
        found.remove("Diabetes")
    return found


# ---------------------------------------------------------------------------
# Follow-up
# ---------------------------------------------------------------------------

_FOLLOW_UP = re.compile(
    r"follow[- ]?up|re-?check|\brepeat\b|return (?:in|to)|\brefer(?:red|ral)?\b|\bschedule"
    r"|\bin \d+\s*(?:days?|weeks?|months?)\b|\brecommend",
    re.IGNORECASE,
)


def find_follow_up(text: str, limit: int = 5) -> List[str]:
    items: List[str] = []
    for sentence in split_sentences(text):
        if _FOLLOW_UP.search(sentence) and sentence not in items:
            items.append(sentence[:200])
    return items[:limit]


# ---------------------------------------------------------------------------
# Lab flags
# ---------------------------------------------------------------------------

# (label, conventional unit, [(upper bound exclusive, status), ...], reference, si)
# si = (side, threshold, to_conventional, si_unit): a value past the threshold
# (below it for mmol/L analytes, above it for g/L, µmol/L and mmol/mol ones) is
# read as SI and converted before banding. Adult ranges, general reference
# only: individual labs, age and sex shift them.
_INF = math.inf
LAB_RANGES = {
    "glucose": ("Fasting glucose", "mg/dL", [(70, "low"), (100, "normal"), (126, "borderline"), (_INF, "high")],
                "70–99 mg/dL fasting", ("below", 35, lambda v: v * 18.0, "mmol/L")),
    # IFCC reporting (mmol/mol) is common outside the US: 48 mmol/mol = 6.5%.
    "hba1c": ("HbA1c", "%", [(5.7, "normal"), (6.5, "borderline"), (_INF, "high")],
              "below 5.7%", ("above", 20, lambda v: 0.09148 * v + 2.152, "mmol/mol")),
    "total_cholesterol": ("Total cholesterol", "mg/dL", [(200, "normal"), (240, "borderline"), (_INF, "high")],
                          "below 200 mg/dL", ("below", 20, lambda v: v * 38.67, "mmol/L")),
    "ldl": ("LDL cholesterol", "mg/dL", [(130, "normal"), (160, "borderline"), (_INF, "high")],
            "below 130 mg/dL (below 100 optimal)", ("below", 20, lambda v: v * 38.67, "mmol/L")),
    "hdl": ("HDL cholesterol", "mg/dL", [(40, "low"), (_INF, "normal")],
            "40 mg/dL or higher", ("below", 5, lambda v: v * 38.67, "mmol/L")),
    "creatinine": ("Creatinine", "mg/dL", [(0.6, "low"), (1.31, "normal"), (_INF, "high")],
                   "about 0.6–1.3 mg/dL", ("above", 20, lambda v: v / 88.4, "µmol/L")),
    "hemoglobin": ("Hemoglobin", "g/dL", [(12, "low"), (17.6, "normal"), (_INF, "high")],
                   "about 12–17.5 g/dL (varies by sex)", ("above", 30, lambda v: v / 10, "g/L")),
    "tsh": ("TSH", "mIU/L", [(0.4, "low"), (4.01, "normal"), (_INF, "high")],
            "about 0.4–4.0 mIU/L", None),
}

_SI_UNITS = {"mmol/l", "µmol/l", "umol/l", "g/l", "mmol/mol"}


def _status(value: float, bands) -> str:
    for upper, status in bands:
        if value < upper:
            return status
    return bands[-1][1]


def _blood_pressure_flag(raw: str) -> Optional[Dict]:
    match = re.match(r"(\d{2,3})\s*/\s*(\d{2,3})", raw)
    if not match:
        return None
    systolic, diastolic = int(match.group(1)), int(match.group(2))
    # ACC/AHA 2017 categories.
    if systolic < 90 or diastolic < 60:
        status = "low"
    elif systolic >= 130 or diastolic >= 80:
        status = "high"
    elif systolic >= 120:
        status = "borderline"
    else:
        status = "normal"
    return {
        "test": "blood_pressure", "label": "Blood pressure", "value": f"{systolic}/{diastolic}",
        "unit": "mmHg", "status": status, "reference": "below 120/80 mmHg",
    }


def flag_lab_values(measurements: Dict[str, Dict[str, Optional[str]]]) -> List[Dict]:
    """measurements: {test: {"value": "126", "unit": "mg/dl" or None}} as
    produced by extraction.extract_lab_measurements."""
    flags = []
    for test, measured in measurements.items():
        if test == "blood_pressure":
            flag = _blood_pressure_flag(measured["value"])
            if flag:
                flags.append(flag)
            continue
        spec = LAB_RANGES.get(test)
        if not spec:
            continue
        try:
            value = float(measured["value"].replace(",", "").rstrip("."))
        except ValueError:
            continue
        label, unit, bands, reference, si = spec
        unit_written = (measured.get("unit") or "").lower()
        comparable, shown_unit = value, unit
        if si:
            side, threshold, to_conventional, si_unit = si
            looks_si = value < threshold if side == "below" else value > threshold
            if unit_written in _SI_UNITS or (not unit_written and looks_si):
                comparable, shown_unit = to_conventional(value), si_unit
        flags.append({
            "test": test, "label": label, "value": measured["value"].rstrip("."), "unit": shown_unit,
            "status": _status(comparable, bands), "reference": reference,
        })
    return flags


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------


def _join(items: List[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _in_sentence(label: str) -> str:
    """"Fasting glucose" -> "fasting glucose"; leaves "HbA1c", "LDL ..." alone."""
    first = label.split()[0]
    return label[0].lower() + label[1:] if first[1:].islower() else label


def _reading(flag: Dict) -> str:
    unit = "" if flag["unit"] == "%" else " "
    return f"{flag['value']}{unit}{flag['unit']}"


def build_summaries(conditions, medications, follow_up, lab_flags) -> Tuple[str, str]:
    out_of_range = [f for f in lab_flags if f["status"] != "normal"]

    patient: List[str] = []
    if lab_flags:
        patient.append(f"This report lists {len(lab_flags)} lab result{'s' if len(lab_flags) != 1 else ''}.")
        if out_of_range:
            readings = [f"{_in_sentence(f['label'])} ({_reading(f)}) is {f['status']}" for f in out_of_range]
            patient.append(f"Outside the usual range: {_join(readings)}.")
        else:
            patient.append("All of them are within typical reference ranges.")
    if conditions:
        patient.append(f"It mentions {_join([_in_sentence(c) for c in conditions])}.")
    if medications:
        patient.append(f"Medications mentioned: {_join(medications)}.")
    if follow_up:
        patient.append(f"Next steps noted in the report: {' '.join(follow_up)}")
    if not patient:
        patient.append("No lab values, conditions or medications were recognized in this text.")
    patient.append(
        "Reference ranges vary between labs and between people, so go over these results with "
        "your doctor before making any changes."
    )

    marks = {"high": " (H)", "low": " (L)", "borderline": " (borderline)", "normal": ""}
    clinical: List[str] = []
    if lab_flags:
        clinical.append("Labs: " + "; ".join(f"{f['label']} {_reading(f)}{marks[f['status']]}" for f in lab_flags) + ".")
    if conditions:
        clinical.append("Problems: " + "; ".join(conditions) + ".")
    if medications:
        clinical.append("Medications: " + "; ".join(medications) + ".")
    if follow_up:
        clinical.append("Plan/follow-up: " + " ".join(follow_up))
    if not clinical:
        clinical.append("No structured findings recognized.")
    clinical.append("[Automated rule-based extraction; verify against the source report.]")

    return " ".join(patient), " ".join(clinical)


def analyze_with_rules(text: str, measurements: Dict[str, Dict[str, Optional[str]]]) -> Dict:
    conditions = find_conditions(text)
    medications = find_medications(text)
    follow_up = find_follow_up(text)
    lab_flags = flag_lab_values(measurements)
    patient_summary, clinical_summary = build_summaries(conditions, medications, follow_up, lab_flags)
    return {
        "diagnoses": conditions,
        "medications": medications,
        "follow_up": follow_up,
        "lab_flags": lab_flags,
        "patient_summary": patient_summary,
        "clinical_summary": clinical_summary,
    }
