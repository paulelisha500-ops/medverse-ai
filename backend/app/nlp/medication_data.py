"""
Curated, well-established drug-drug interactions for demo purposes.
This list is illustrative and NOT exhaustive or a substitute for pharmacist
or physician review — see the disclaimer surfaced in the API response.
"""
from typing import List, Dict

INTERACTIONS = [
    {"drugs": ("warfarin", "aspirin"), "description": "Combined use significantly increases bleeding risk.", "severity": "high"},
    {"drugs": ("warfarin", "ibuprofen"), "description": "NSAIDs like ibuprofen increase bleeding risk when combined with warfarin.", "severity": "high"},
    {"drugs": ("warfarin", "ciprofloxacin"), "description": "This antibiotic can increase warfarin's blood-thinning effect.", "severity": "moderate"},
    {"drugs": ("warfarin", "metronidazole"), "description": "This antibiotic can significantly increase warfarin's blood-thinning effect.", "severity": "high"},
    {"drugs": ("lisinopril", "potassium"), "description": "ACE inhibitors combined with potassium supplements can cause dangerously high potassium levels.", "severity": "moderate"},
    {"drugs": ("lisinopril", "ibuprofen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},
    {"drugs": ("lisinopril", "losartan"), "description": "Combining two blood-pressure drug classes like this raises the risk of high potassium and kidney strain.", "severity": "moderate"},
    {"drugs": ("atorvastatin", "grapefruit"), "description": "Grapefruit can raise statin levels in the blood, increasing side-effect risk.", "severity": "low"},
    {"drugs": ("simvastatin", "grapefruit"), "description": "Grapefruit can raise statin levels in the blood, increasing side-effect risk.", "severity": "moderate"},
    {"drugs": ("metformin", "contrast dye"), "description": "Contrast dye used in imaging can rarely cause lactic acidosis when combined with metformin; doctors often pause metformin around scans.", "severity": "moderate"},
    {"drugs": ("sertraline", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("fluoxetine", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("sildenafil", "nitroglycerin"), "description": "This combination can cause a dangerous drop in blood pressure.", "severity": "high"},
    {"drugs": ("alprazolam", "oxycodone"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("diazepam", "morphine"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("levothyroxine", "calcium"), "description": "Calcium supplements can reduce absorption of thyroid medication if taken together.", "severity": "low"},
    {"drugs": ("levothyroxine", "iron"), "description": "Iron supplements can reduce absorption of thyroid medication if taken together.", "severity": "low"},
    {"drugs": ("digoxin", "furosemide"), "description": "Loop diuretics can lower potassium, increasing the risk of digoxin toxicity.", "severity": "moderate"},
    {"drugs": ("clopidogrel", "omeprazole"), "description": "Some proton pump inhibitors may reduce how well clopidogrel prevents clotting.", "severity": "moderate"},
    {"drugs": ("lithium", "ibuprofen"), "description": "NSAIDs can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "hydrochlorothiazide"), "description": "This diuretic can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("methotrexate", "ibuprofen"), "description": "NSAIDs can increase methotrexate levels and toxicity risk.", "severity": "high"},
    {"drugs": ("theophylline", "ciprofloxacin"), "description": "This antibiotic can raise theophylline levels, risking toxicity.", "severity": "moderate"},
    {"drugs": ("diphenhydramine", "alcohol"), "description": "Combining sedating antihistamines with alcohol increases drowsiness and impairment.", "severity": "moderate"},
    {"drugs": ("metoprolol", "verapamil"), "description": "Combining these can cause dangerously slow heart rate.", "severity": "high"},
    {"drugs": ("prednisone", "ibuprofen"), "description": "Combining steroids and NSAIDs raises the risk of stomach ulcers.", "severity": "moderate"},
    {"drugs": ("doxycycline", "calcium"), "description": "Calcium-rich foods or supplements can reduce absorption of this antibiotic.", "severity": "low"},
    {"drugs": ("phenelzine", "sertraline"), "description": "Combining an MAOI with an SSRI can cause life-threatening serotonin syndrome.", "severity": "high"},
    {"drugs": ("acetaminophen", "alcohol"), "description": "Regularly combining these, especially in excess, raises the risk of liver damage.", "severity": "moderate"},
    {"drugs": ("warfarin", "vitamin k"), "description": "Vitamin K can reduce warfarin's blood-thinning effectiveness.", "severity": "moderate"},
]


def normalize(name: str) -> str:
    return name.strip().lower()


def check_interactions(medication_list: List[str]) -> List[Dict]:
    originals = [m for m in medication_list if m.strip()]
    normalized = [normalize(m) for m in originals]
    found = []
    for i in range(len(normalized)):
        for j in range(i + 1, len(normalized)):
            a, b = normalized[i], normalized[j]
            for item in INTERACTIONS:
                pair = set(item["drugs"])
                if {a, b} == pair:
                    found.append({
                        "drug_a": originals[i],
                        "drug_b": originals[j],
                        "description": item["description"],
                        "severity": item["severity"],
                    })
    return found
