"""
Curated, well-established drug-drug interactions for demo purposes.

This is an original, hand-curated compilation covering the major interacting drug
classes taught in clinical pharmacology (anticoagulants, NSAIDs, serotonergic agents,
CNS depressants, statins, cardiac drugs, etc.) — it is illustrative and NOT exhaustive
or a substitute for pharmacist or physician review. See the disclaimer surfaced in the
API response.

BRAND_TO_GENERIC lets common brand names (e.g. "Tylenol") resolve to the generic name
the interaction table is keyed on (e.g. "acetaminophen"), so real-world input matches.
"""
from typing import List, Dict

# ---------------------------------------------------------------------------
# Brand name -> generic name. Lets users type what's on the label.
# ---------------------------------------------------------------------------
BRAND_TO_GENERIC = {
    "tylenol": "acetaminophen", "panadol": "acetaminophen",
    "advil": "ibuprofen", "motrin": "ibuprofen", "nurofen": "ibuprofen",
    "aleve": "naproxen", "naprosyn": "naproxen",
    "voltaren": "diclofenac",
    "celebrex": "celecoxib",
    "bayer": "aspirin", "ecotrin": "aspirin",
    "coumadin": "warfarin", "jantoven": "warfarin",
    "plavix": "clopidogrel",
    "eliquis": "apixaban",
    "xarelto": "rivaroxaban",
    "pradaxa": "dabigatran",
    "lipitor": "atorvastatin",
    "zocor": "simvastatin",
    "crestor": "rosuvastatin",
    "mevacor": "lovastatin",
    "lopid": "gemfibrozil",
    "prinivil": "lisinopril", "zestril": "lisinopril",
    "cozaar": "losartan",
    "diovan": "valsartan",
    "aldactone": "spironolactone",
    "glucophage": "metformin",
    "glucotrol": "glipizide",
    "amaryl": "glimepiride",
    "zoloft": "sertraline",
    "prozac": "fluoxetine",
    "lexapro": "escitalopram",
    "celexa": "citalopram",
    "paxil": "paroxetine",
    "effexor": "venlafaxine",
    "nardil": "phenelzine",
    "parnate": "tranylcypromine",
    "wellbutrin": "bupropion",
    "zyvox": "linezolid",
    "ultram": "tramadol",
    "imitrex": "sumatriptan",
    "viagra": "sildenafil", "revatio": "sildenafil",
    "cialis": "tadalafil",
    "nitrostat": "nitroglycerin",
    "xanax": "alprazolam",
    "valium": "diazepam",
    "ativan": "lorazepam",
    "klonopin": "clonazepam",
    "ambien": "zolpidem",
    "dolophine": "methadone",
    "demerol": "meperidine",
    "robitussin dm": "dextromethorphan", "delsym": "dextromethorphan",
    "synthroid": "levothyroxine", "levoxyl": "levothyroxine",
    "questran": "cholestyramine",
    "carafate": "sucralfate",
    "lanoxin": "digoxin",
    "cordarone": "amiodarone", "pacerone": "amiodarone",
    "betapace": "sotalol",
    "lasix": "furosemide",
    "microzide": "hydrochlorothiazide",
    "prilosec": "omeprazole",
    "nexium": "esomeprazole",
    "toprol": "metoprolol", "lopressor": "metoprolol",
    "inderal": "propranolol",
    "cardizem": "diltiazem", "tiazac": "diltiazem",
    "calan": "verapamil", "isoptin": "verapamil",
    "catapres": "clonidine",
    "flomax": "tamsulosin",
    "cardura": "doxazosin",
    "deltasone": "prednisone", "rayos": "prednisone",
    "benadryl": "diphenhydramine",
    "antabuse": "disulfiram",
    "sudafed": "pseudoephedrine",
    "vicodin": "hydrocodone", "norco": "hydrocodone",
    "oxycontin": "oxycodone", "percocet": "oxycodone", "roxicodone": "oxycodone",
    "neurontin": "gabapentin",
    "lamictal": "lamotrigine",
    "rheumatrex": "methotrexate", "trexall": "methotrexate", "otrexup": "methotrexate",
    "sandimmune": "cyclosporine", "neoral": "cyclosporine",
    "imuran": "azathioprine",
    "zyloprim": "allopurinol",
    "eskalith": "lithium", "lithobid": "lithium",
    "cipro": "ciprofloxacin",
    "levaquin": "levofloxacin",
    "flagyl": "metronidazole",
    "vibramycin": "doxycycline", "monodox": "doxycycline",
    "biaxin": "clarithromycin",
    "zithromax": "azithromycin",
    "bactrim": "trimethoprim-sulfamethoxazole", "septra": "trimethoprim-sulfamethoxazole",
    "rifadin": "rifampin",
    "diflucan": "fluconazole",
    "sporanox": "itraconazole",
    "theo-24": "theophylline", "elixophyllin": "theophylline",
    "garamycin": "gentamicin",
    "rifadin duo": "rifampin",
    "tegretol": "carbamazepine",
    "dilantin": "phenytoin",
    "depakote": "valproate", "depakene": "valproate",
    "yaz": "ethinyl estradiol", "yasmin": "ethinyl estradiol",
    "ortho-novum": "ethinyl estradiol", "loestrin": "ethinyl estradiol",
}


def _generic(name: str) -> str:
    n = name.strip().lower()
    return BRAND_TO_GENERIC.get(n, n)


INTERACTIONS = [
    # --- Anticoagulants / antiplatelets ---
    {"drugs": ("warfarin", "aspirin"), "description": "Combined use significantly increases bleeding risk.", "severity": "high"},
    {"drugs": ("warfarin", "ibuprofen"), "description": "NSAIDs like ibuprofen increase bleeding risk when combined with warfarin.", "severity": "high"},
    {"drugs": ("warfarin", "naproxen"), "description": "NSAIDs like naproxen increase bleeding risk when combined with warfarin.", "severity": "high"},
    {"drugs": ("warfarin", "ciprofloxacin"), "description": "This antibiotic can increase warfarin's blood-thinning effect.", "severity": "moderate"},
    {"drugs": ("warfarin", "metronidazole"), "description": "This antibiotic can significantly increase warfarin's blood-thinning effect.", "severity": "high"},
    {"drugs": ("warfarin", "fluconazole"), "description": "This antifungal can significantly raise warfarin levels and bleeding risk.", "severity": "high"},
    {"drugs": ("warfarin", "amiodarone"), "description": "Amiodarone can substantially increase warfarin's effect; INR should be monitored closely.", "severity": "high"},
    {"drugs": ("warfarin", "trimethoprim-sulfamethoxazole"), "description": "This antibiotic combination can significantly increase warfarin's blood-thinning effect.", "severity": "high"},
    {"drugs": ("warfarin", "vitamin k"), "description": "Vitamin K can reduce warfarin's blood-thinning effectiveness.", "severity": "moderate"},
    {"drugs": ("warfarin", "rifampin"), "description": "Rifampin can sharply reduce warfarin's effectiveness by speeding its breakdown.", "severity": "moderate"},
    {"drugs": ("warfarin", "phenytoin"), "description": "Warfarin and phenytoin can each raise the other's blood levels unpredictably.", "severity": "moderate"},
    {"drugs": ("warfarin", "carbamazepine"), "description": "Carbamazepine can reduce warfarin's effectiveness by speeding its breakdown.", "severity": "moderate"},
    {"drugs": ("warfarin", "st. john's wort"), "description": "St. John's Wort can significantly reduce warfarin's effectiveness.", "severity": "moderate"},
    {"drugs": ("warfarin", "acetaminophen"), "description": "Regular, higher-dose acetaminophen use can increase warfarin's blood-thinning effect.", "severity": "moderate"},
    {"drugs": ("warfarin", "clopidogrel"), "description": "Combining two blood thinners significantly raises bleeding risk.", "severity": "high"},
    {"drugs": ("warfarin", "prednisone"), "description": "Corticosteroids can increase warfarin's effect and raise bleeding/ulcer risk together.", "severity": "moderate"},
    {"drugs": ("warfarin", "ginkgo biloba"), "description": "Ginkgo has blood-thinning properties of its own and can add to warfarin's bleeding risk.", "severity": "moderate"},
    {"drugs": ("aspirin", "ibuprofen"), "description": "Ibuprofen can block aspirin's heart-protective effect if taken regularly together.", "severity": "moderate"},
    {"drugs": ("aspirin", "ginkgo biloba"), "description": "Ginkgo can add to aspirin's bleeding risk.", "severity": "low"},
    {"drugs": ("apixaban", "aspirin"), "description": "Combining an anticoagulant with aspirin increases bleeding risk.", "severity": "high"},
    {"drugs": ("rivaroxaban", "naproxen"), "description": "NSAIDs like naproxen increase bleeding risk when combined with this anticoagulant.", "severity": "high"},
    {"drugs": ("dabigatran", "aspirin"), "description": "Combining an anticoagulant with aspirin increases bleeding risk.", "severity": "high"},
    {"drugs": ("clopidogrel", "omeprazole"), "description": "This proton pump inhibitor may reduce how well clopidogrel prevents clotting.", "severity": "moderate"},
    {"drugs": ("clopidogrel", "esomeprazole"), "description": "This proton pump inhibitor may reduce how well clopidogrel prevents clotting.", "severity": "moderate"},
    {"drugs": ("clopidogrel", "ibuprofen"), "description": "NSAIDs may blunt clopidogrel's antiplatelet effect and add bleeding risk.", "severity": "moderate"},
    {"drugs": ("heparin", "aspirin"), "description": "Combining heparin with aspirin increases bleeding risk.", "severity": "high"},

    # --- NSAIDs with blood pressure / kidney drugs ---
    {"drugs": ("lisinopril", "potassium"), "description": "ACE inhibitors combined with potassium supplements can cause dangerously high potassium levels.", "severity": "moderate"},
    {"drugs": ("lisinopril", "ibuprofen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},
    {"drugs": ("lisinopril", "naproxen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},
    {"drugs": ("lisinopril", "losartan"), "description": "Combining two blood-pressure drug classes like this raises the risk of high potassium and kidney strain.", "severity": "moderate"},
    {"drugs": ("lisinopril", "spironolactone"), "description": "Combining an ACE inhibitor with a potassium-sparing diuretic raises the risk of dangerously high potassium.", "severity": "moderate"},
    {"drugs": ("losartan", "potassium"), "description": "ARBs combined with potassium supplements can cause dangerously high potassium levels.", "severity": "moderate"},
    {"drugs": ("losartan", "ibuprofen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},
    {"drugs": ("losartan", "spironolactone"), "description": "Combining an ARB with a potassium-sparing diuretic raises the risk of dangerously high potassium.", "severity": "moderate"},
    {"drugs": ("ibuprofen", "furosemide"), "description": "NSAIDs can blunt this diuretic's effect and add extra strain on the kidneys.", "severity": "moderate"},
    {"drugs": ("ibuprofen", "spironolactone"), "description": "NSAIDs combined with a potassium-sparing diuretic raise the risk of dangerously high potassium.", "severity": "moderate"},
    {"drugs": ("diclofenac", "lisinopril"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},

    # --- NSAIDs with other drugs (methotrexate, lithium, steroids) ---
    {"drugs": ("lithium", "ibuprofen"), "description": "NSAIDs can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "hydrochlorothiazide"), "description": "This diuretic can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "furosemide"), "description": "Loop diuretics can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "lisinopril"), "description": "ACE inhibitors can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "losartan"), "description": "ARBs can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("lithium", "metronidazole"), "description": "This antibiotic can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("methotrexate", "ibuprofen"), "description": "NSAIDs can increase methotrexate levels and toxicity risk.", "severity": "high"},
    {"drugs": ("methotrexate", "naproxen"), "description": "NSAIDs can increase methotrexate levels and toxicity risk.", "severity": "high"},
    {"drugs": ("methotrexate", "trimethoprim-sulfamethoxazole"), "description": "This combination can cause severe bone marrow suppression.", "severity": "high"},
    {"drugs": ("methotrexate", "omeprazole"), "description": "PPIs can delay clearance of higher-dose methotrexate, raising toxicity risk.", "severity": "moderate"},
    {"drugs": ("prednisone", "ibuprofen"), "description": "Combining steroids and NSAIDs raises the risk of stomach ulcers.", "severity": "moderate"},
    {"drugs": ("celecoxib", "lithium"), "description": "This NSAID can raise lithium levels, increasing the risk of toxicity.", "severity": "moderate"},

    # --- Statins ---
    {"drugs": ("atorvastatin", "grapefruit"), "description": "Grapefruit can raise statin levels in the blood, increasing side-effect risk.", "severity": "low"},
    {"drugs": ("simvastatin", "grapefruit"), "description": "Grapefruit can raise statin levels in the blood, increasing side-effect risk.", "severity": "moderate"},
    {"drugs": ("lovastatin", "grapefruit"), "description": "Grapefruit can raise statin levels in the blood, increasing side-effect risk.", "severity": "moderate"},
    {"drugs": ("simvastatin", "clarithromycin"), "description": "This antibiotic can raise simvastatin levels sharply, increasing the risk of muscle damage.", "severity": "high"},
    {"drugs": ("atorvastatin", "clarithromycin"), "description": "This antibiotic can raise statin levels, increasing the risk of muscle damage.", "severity": "moderate"},
    {"drugs": ("simvastatin", "amiodarone"), "description": "Amiodarone raises simvastatin levels and the risk of muscle damage; dose limits apply.", "severity": "high"},
    {"drugs": ("simvastatin", "verapamil"), "description": "Verapamil raises simvastatin levels and the risk of muscle damage.", "severity": "moderate"},
    {"drugs": ("simvastatin", "diltiazem"), "description": "Diltiazem raises simvastatin levels and the risk of muscle damage.", "severity": "moderate"},
    {"drugs": ("atorvastatin", "cyclosporine"), "description": "Cyclosporine substantially raises statin levels, increasing the risk of muscle damage.", "severity": "high"},
    {"drugs": ("simvastatin", "gemfibrozil"), "description": "This fibrate combined with a statin significantly raises the risk of serious muscle damage.", "severity": "high"},
    {"drugs": ("rosuvastatin", "gemfibrozil"), "description": "This fibrate combined with a statin raises the risk of serious muscle damage.", "severity": "high"},
    {"drugs": ("lovastatin", "itraconazole"), "description": "This antifungal can raise statin levels sharply, increasing the risk of muscle damage.", "severity": "high"},

    # --- Serotonergic drugs / psychiatric ---
    {"drugs": ("sertraline", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("fluoxetine", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("escitalopram", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("venlafaxine", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("phenelzine", "sertraline"), "description": "Combining an MAOI with an SSRI can cause life-threatening serotonin syndrome.", "severity": "high"},
    {"drugs": ("phenelzine", "fluoxetine"), "description": "Combining an MAOI with an SSRI can cause life-threatening serotonin syndrome.", "severity": "high"},
    {"drugs": ("tranylcypromine", "fluoxetine"), "description": "Combining an MAOI with an SSRI can cause life-threatening serotonin syndrome.", "severity": "high"},
    {"drugs": ("sertraline", "sumatriptan"), "description": "Combining an SSRI with a triptan raises the risk of serotonin syndrome.", "severity": "moderate"},
    {"drugs": ("sertraline", "linezolid"), "description": "Linezolid has MAOI-like activity; combining it with an SSRI risks serotonin syndrome.", "severity": "high"},
    {"drugs": ("sertraline", "st. john's wort"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "moderate"},
    {"drugs": ("bupropion", "phenelzine"), "description": "Combining an MAOI with bupropion raises the risk of seizures and hypertensive crisis.", "severity": "high"},
    {"drugs": ("meperidine", "phenelzine"), "description": "This combination can cause a severe, potentially fatal reaction (agitation, high fever, seizures).", "severity": "high"},
    {"drugs": ("dextromethorphan", "fluoxetine"), "description": "This common cough-medicine ingredient combined with an SSRI raises the risk of serotonin syndrome.", "severity": "moderate"},
    {"drugs": ("dextromethorphan", "phenelzine"), "description": "This combination can cause a severe, potentially fatal reaction.", "severity": "high"},
    {"drugs": ("phenelzine", "pseudoephedrine"), "description": "MAOIs combined with decongestants can trigger a dangerous spike in blood pressure.", "severity": "high"},
    {"drugs": ("valproate", "lamotrigine"), "description": "Valproate can roughly double lamotrigine levels, raising the risk of a serious rash; a slower dose titration is needed.", "severity": "moderate"},

    # --- CNS depressants / opioids / benzodiazepines ---
    {"drugs": ("alprazolam", "oxycodone"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("diazepam", "morphine"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("clonazepam", "oxycodone"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("lorazepam", "morphine"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("methadone", "diazepam"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("diphenhydramine", "alcohol"), "description": "Combining sedating antihistamines with alcohol increases drowsiness and impairment.", "severity": "moderate"},
    {"drugs": ("alprazolam", "alcohol"), "description": "Combining benzodiazepines with alcohol significantly increases sedation and respiratory depression risk.", "severity": "high"},
    {"drugs": ("zolpidem", "alcohol"), "description": "Combining this sleep aid with alcohol increases sedation and impairment risk.", "severity": "high"},
    {"drugs": ("oxycodone", "alcohol"), "description": "Combining opioids with alcohol increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("tramadol", "alcohol"), "description": "Combining this opioid with alcohol increases sedation and seizure risk.", "severity": "high"},
    {"drugs": ("gabapentin", "oxycodone"), "description": "Combining gabapentin with opioids adds to sedation and respiratory depression risk.", "severity": "moderate"},
    {"drugs": ("gabapentin", "alprazolam"), "description": "Combining gabapentin with benzodiazepines adds to sedation and respiratory depression risk.", "severity": "moderate"},
    {"drugs": ("morphine", "diphenhydramine"), "description": "Combining opioids with sedating antihistamines increases drowsiness and respiratory depression risk.", "severity": "moderate"},
    {"drugs": ("disulfiram", "alcohol"), "description": "This combination is designed to cause a severe reaction (flushing, nausea, palpitations) and should never be combined.", "severity": "high"},
    {"drugs": ("disulfiram", "metronidazole"), "description": "Combining these can cause a psychotic reaction; this pairing should be avoided.", "severity": "high"},
    {"drugs": ("metronidazole", "alcohol"), "description": "This antibiotic can cause a disulfiram-like reaction (flushing, nausea, vomiting) with alcohol.", "severity": "moderate"},

    # --- Thyroid ---
    {"drugs": ("levothyroxine", "calcium"), "description": "Calcium supplements can reduce absorption of thyroid medication if taken together.", "severity": "low"},
    {"drugs": ("levothyroxine", "iron"), "description": "Iron supplements can reduce absorption of thyroid medication if taken together.", "severity": "low"},
    {"drugs": ("levothyroxine", "omeprazole"), "description": "PPIs can reduce absorption of thyroid medication; levels should be monitored.", "severity": "low"},
    {"drugs": ("levothyroxine", "cholestyramine"), "description": "This cholesterol-binding resin can significantly reduce absorption of thyroid medication.", "severity": "moderate"},
    {"drugs": ("levothyroxine", "sucralfate"), "description": "Sucralfate can reduce absorption of thyroid medication if taken together.", "severity": "low"},

    # --- Cardiac ---
    {"drugs": ("digoxin", "furosemide"), "description": "Loop diuretics can lower potassium, increasing the risk of digoxin toxicity.", "severity": "moderate"},
    {"drugs": ("digoxin", "amiodarone"), "description": "Amiodarone can significantly raise digoxin levels, increasing toxicity risk.", "severity": "high"},
    {"drugs": ("digoxin", "verapamil"), "description": "Verapamil can raise digoxin levels and slow heart rate excessively.", "severity": "high"},
    {"drugs": ("digoxin", "spironolactone"), "description": "Spironolactone can raise digoxin levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("digoxin", "clarithromycin"), "description": "This antibiotic can raise digoxin levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("digoxin", "hydrochlorothiazide"), "description": "This diuretic can lower potassium, increasing the risk of digoxin toxicity.", "severity": "moderate"},
    {"drugs": ("metoprolol", "verapamil"), "description": "Combining these can cause dangerously slow heart rate.", "severity": "high"},
    {"drugs": ("metoprolol", "diltiazem"), "description": "Combining these can cause dangerously slow heart rate.", "severity": "high"},
    {"drugs": ("propranolol", "verapamil"), "description": "Combining these can cause dangerously slow heart rate and low blood pressure.", "severity": "high"},
    {"drugs": ("sotalol", "amiodarone"), "description": "Combining these antiarrhythmics raises the risk of dangerous heart rhythm changes (QT prolongation).", "severity": "high"},
    {"drugs": ("clonidine", "metoprolol"), "description": "Stopping clonidine while on a beta blocker can cause a dangerous rebound spike in blood pressure.", "severity": "moderate"},
    {"drugs": ("furosemide", "gentamicin"), "description": "Combining loop diuretics with this antibiotic increases the risk of hearing damage.", "severity": "moderate"},

    # --- Diabetes medications ---
    {"drugs": ("metformin", "contrast dye"), "description": "Contrast dye used in imaging can rarely cause lactic acidosis when combined with metformin; doctors often pause metformin around scans.", "severity": "moderate"},
    {"drugs": ("metformin", "alcohol"), "description": "Heavy alcohol use with metformin raises the risk of lactic acidosis.", "severity": "moderate"},
    {"drugs": ("glipizide", "fluconazole"), "description": "This antifungal can raise glipizide levels, increasing the risk of low blood sugar.", "severity": "moderate"},
    {"drugs": ("glipizide", "alcohol"), "description": "Alcohol can increase the blood-sugar-lowering effect and risk of hypoglycemia.", "severity": "moderate"},
    {"drugs": ("glimepiride", "alcohol"), "description": "Alcohol can increase the blood-sugar-lowering effect and risk of hypoglycemia.", "severity": "moderate"},
    {"drugs": ("insulin", "metoprolol"), "description": "Beta blockers can mask the warning signs of low blood sugar (rapid heartbeat, tremor).", "severity": "moderate"},

    # --- PDE5 inhibitors / nitrates / alpha blockers ---
    {"drugs": ("sildenafil", "nitroglycerin"), "description": "This combination can cause a dangerous drop in blood pressure.", "severity": "high"},
    {"drugs": ("tadalafil", "nitroglycerin"), "description": "This combination can cause a dangerous drop in blood pressure.", "severity": "high"},
    {"drugs": ("sildenafil", "tamsulosin"), "description": "Combining these can cause a significant drop in blood pressure.", "severity": "moderate"},
    {"drugs": ("tadalafil", "doxazosin"), "description": "Combining these can cause a significant drop in blood pressure.", "severity": "moderate"},

    # --- Oral contraceptives ---
    {"drugs": ("ethinyl estradiol", "rifampin"), "description": "Rifampin can significantly reduce the effectiveness of hormonal contraceptives.", "severity": "moderate"},
    {"drugs": ("ethinyl estradiol", "carbamazepine"), "description": "This anticonvulsant can reduce the effectiveness of hormonal contraceptives.", "severity": "moderate"},
    {"drugs": ("ethinyl estradiol", "st. john's wort"), "description": "St. John's Wort can reduce the effectiveness of hormonal contraceptives.", "severity": "moderate"},
    {"drugs": ("ethinyl estradiol", "phenytoin"), "description": "This anticonvulsant can reduce the effectiveness of hormonal contraceptives.", "severity": "moderate"},

    # --- Antibiotics / antifungals interacting with other drug classes ---
    {"drugs": ("theophylline", "ciprofloxacin"), "description": "This antibiotic can raise theophylline levels, risking toxicity.", "severity": "moderate"},
    {"drugs": ("theophylline", "clarithromycin"), "description": "This antibiotic can raise theophylline levels, risking toxicity.", "severity": "moderate"},
    {"drugs": ("doxycycline", "calcium"), "description": "Calcium-rich foods or supplements can reduce absorption of this antibiotic.", "severity": "low"},
    {"drugs": ("doxycycline", "iron"), "description": "Iron supplements can reduce absorption of this antibiotic.", "severity": "low"},
    {"drugs": ("ciprofloxacin", "iron"), "description": "Iron supplements can reduce absorption of this antibiotic.", "severity": "low"},
    {"drugs": ("azathioprine", "allopurinol"), "description": "Allopurinol can sharply raise azathioprine levels, risking severe bone marrow suppression; doses must be adjusted.", "severity": "high"},
    {"drugs": ("cyclosporine", "grapefruit"), "description": "Grapefruit can raise cyclosporine levels, increasing the risk of toxicity.", "severity": "moderate"},

    # --- Other well-established pairs ---
    {"drugs": ("acetaminophen", "alcohol"), "description": "Regularly combining these, especially in excess, raises the risk of liver damage.", "severity": "moderate"},
]

# Guard against an accidental duplicate/unordered-duplicate pair slipping into the
# table above, which would otherwise silently shadow one of the two descriptions.
_seen_pairs = set()
for _item in INTERACTIONS:
    _key = frozenset(_item["drugs"])
    assert _key not in _seen_pairs, f"Duplicate interaction pair: {_item['drugs']}"
    _seen_pairs.add(_key)


def normalize(name: str) -> str:
    return _generic(name)


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
