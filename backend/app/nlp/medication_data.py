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
import difflib
from typing import List, Dict

from app.core.config import settings
from app.nlp.sheet_sync import fetch_sheet_drug_info

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

    # International (INN) names and common brand names outside the US —
    # many countries use a different official generic name than the US does.
    "paracetamol": "acetaminophen", "calpol": "acetaminophen",
    "salbutamol": "albuterol", "ventolin": "albuterol", "proventil": "albuterol",
    "adrenaline": "epinephrine", "epipen": "epinephrine",
    "pethidine": "meperidine",
    "glyceryl trinitrate": "nitroglycerin", "gtn": "nitroglycerin",
    "frusemide": "furosemide",
    "diamorphine": "morphine",
    "acetylsalicylic acid": "aspirin", "asa": "aspirin", "disprin": "aspirin",
    "amoxil": "amoxicillin", "trimox": "amoxicillin",
    "augmentin": "amoxicillin-clavulanate",
    "keflex": "cephalexin",
    "zpack": "azithromycin",
    "panadol extra": "acetaminophen",
    "brufen": "ibuprofen",
    "losec": "omeprazole",
    "norvasc": "amlodipine",
    "vasotec": "enalapril",
    "altace": "ramipril",
    "tenormin": "atenolol",
    "coreg": "carvedilol",
    "zestoretic": "lisinopril",
    "pravachol": "pravastatin",
    "cymbalta": "duloxetine",
    "remeron": "mirtazapine",
    "desyrel": "trazodone",
    "buspar": "buspirone",
    "seroquel": "quetiapine",
    "risperdal": "risperidone",
    "abilify": "aripiprazole",
    "zyprexa": "olanzapine",
    "haldol": "haloperidol",
    "topamax": "topiramate",
    "lyrica": "pregabalin",
    "lioresal": "baclofen",
    "flexeril": "cyclobenzaprine",
    "zanaflex": "tizanidine",
    "maxalt": "rizatriptan",
    "zofran": "ondansetron",
    "reglan": "metoclopramide",
    "phenergan": "promethazine",
    "antivert": "meclizine",
    "imodium": "loperamide",
    "zyrtec": "cetirizine",
    "claritin": "loratadine",
    "allegra": "fexofenadine",
    "singulair": "montelukast",
    "flovent": "fluticasone",
    "pulmicort": "budesonide",
    "atrovent": "ipratropium",
    "plaquenil": "hydroxychloroquine",
    "narcan": "naloxone",
    "suboxone": "buprenorphine",
    "duragesic": "fentanyl",

    # Specific insulin products all normalize to the generic "insulin" bucket
    # for interaction-matching purposes, even though they're listed with their
    # own dosing in the drug directory.
    "lantus": "insulin", "basaglar": "insulin", "toujeo": "insulin",
    "humalog": "insulin", "novolog": "insulin", "tresiba": "insulin",
    "insulin glargine": "insulin",

    # GLP-1 / diabetes & weight management
    "ozempic": "semaglutide", "wegovy": "semaglutide", "rybelsus": "semaglutide",
    "mounjaro": "tirzepatide", "zepbound": "tirzepatide",
    "victoza": "liraglutide", "saxenda": "liraglutide",
    "trulicity": "dulaglutide",
    "januvia": "sitagliptin",
    "jardiance": "empagliflozin",
    "invokana": "canagliflozin",
    "farxiga": "dapagliflozin",
    "actos": "pioglitazone",

    # ADHD
    "ritalin": "methylphenidate", "concerta": "methylphenidate", "metadate": "methylphenidate",
    "adderall": "amphetamine-dextroamphetamine",
    "vyvanse": "lisdexamfetamine",
    "strattera": "atomoxetine",
    "intuniv": "guanfacine",

    # Seizure / neurology
    "keppra": "levetiracetam",
    "trileptal": "oxcarbazepine",
    "zonegran": "zonisamide",
    "sinemet": "levodopa-carbidopa",
    "mirapex": "pramipexole",
    "requip": "ropinirole",
    "aricept": "donepezil",
    "namenda": "memantine",
    "provigil": "modafinil",
    "lunesta": "eszopiclone",

    # Osteoporosis
    "fosamax": "alendronate",
    "actonel": "risedronate",
    "prolia": "denosumab",

    # Cholesterol
    "zetia": "ezetimibe",
    "repatha": "evolocumab",

    # Addiction medicine
    "chantix": "varenicline",
    "revia": "naltrexone", "vivitrol": "naltrexone",
    "campral": "acamprosate",

    # Ophthalmology
    "xalatan": "latanoprost",
    "alphagan": "brimonidine",

    # Antibiotics
    "veetids": "penicillin v",
    "principen": "ampicillin",
    "macrobid": "nitrofurantoin", "macrodantin": "nitrofurantoin",
    "erythrocin": "erythromycin",

    # Cardiac
    "procardia": "nifedipine", "adalat": "nifedipine",
    "apresoline": "hydralazine",
    "imdur": "isosorbide mononitrate",

    # GI
    "pepcid": "famotidine",
    "cytotec": "misoprostol",
    "bentyl": "dicyclomine",

    # Migraine
    "relpax": "eletriptan",
    "zomig": "zolmitriptan",
    "aimovig": "erenumab",

    # Antipsychotic
    "latuda": "lurasidone",
    "geodon": "ziprasidone",

    # Muscle relaxants
    "robaxin": "methocarbamol",
    "soma": "carisoprodol",

    # Reversal agents
    "praxbind": "idarucizumab",

    # Women's health
    "prometrium": "progesterone",
    "clomid": "clomiphene",
    "depo-provera": "medroxyprogesterone",

    # HIV
    "sustiva": "efavirenz",
    "tivicay": "dolutegravir",
    "truvada": "emtricitabine-tenofovir",

    # Antiparasitic
    "albenza": "albendazole",
    "stromectol": "ivermectin",

    # Cold/cough
    "mucinex": "guaifenesin",

    # Anesthetic
    "lidoderm": "lidocaine", "xylocaine": "lidocaine",
}


def _generic(name: str) -> str:
    n = name.strip().lower()
    if n in BRAND_TO_GENERIC:
        return BRAND_TO_GENERIC[n]
    if n in DRUG_INFO:
        return n
    # Typo tolerance: catch near-misses like "paracetomol" -> "paracetamol" without
    # a hand-written alias for every possible misspelling.
    candidates = list(BRAND_TO_GENERIC.keys()) + list(DRUG_INFO.keys())
    close = difflib.get_close_matches(n, candidates, n=1, cutoff=0.82)
    if close:
        match = close[0]
        return BRAND_TO_GENERIC.get(match, match)
    return n


# ---------------------------------------------------------------------------
# Generic name -> {dosage, category}, for the medication autocomplete.
# Dosage: general reference ranges only — actual dosing is individualized by
# weight, renal/hepatic function, indication, and clinician judgment.
# ---------------------------------------------------------------------------
def _d(dosage: str, category: str) -> Dict[str, str]:
    return {"dosage": dosage, "category": category}


DRUG_INFO = {
    "acetaminophen": _d("325–1000 mg every 4–6 hours as needed; max 3000–4000 mg/day", "Pain relief"),
    "albuterol": _d("2 inhalations (90 mcg each) every 4–6 hours as needed", "Asthma/COPD"),
    "allopurinol": _d("100–300 mg once daily, titrated to uric acid level", "Gout"),
    "alprazolam": _d("0.25–0.5 mg 2–3 times daily", "Anxiolytic"),
    "amiodarone": _d("400 mg 2–3 times daily loading, then 200 mg once daily maintenance", "Antiarrhythmic"),
    "amitriptyline": _d("25–150 mg once daily at bedtime", "Antidepressant"),
    "amlodipine": _d("5–10 mg once daily", "Blood pressure"),
    "amoxicillin": _d("250–500 mg every 8 hours (or 500–875 mg every 12 hours)", "Antibiotic"),
    "amoxicillin-clavulanate": _d("500/125 mg every 12 hours or 250/125 mg every 8 hours", "Antibiotic"),
    "apixaban": _d("5 mg twice daily (2.5 mg twice daily in select patients)", "Anticoagulant"),
    "aripiprazole": _d("10–15 mg once daily, titrated as needed", "Antipsychotic"),
    "aspirin": _d("81 mg once daily (cardioprotective) or 325–650 mg every 4–6 hours (pain/fever)", "Antiplatelet/Pain relief"),
    "atenolol": _d("25–100 mg once daily", "Beta blocker"),
    "atorvastatin": _d("10–80 mg once daily", "Statin"),
    "azathioprine": _d("1–2.5 mg/kg once daily", "Immunosuppressant"),
    "azithromycin": _d("500 mg on day 1, then 250 mg once daily for 4 more days", "Antibiotic"),
    "baclofen": _d("5 mg 3 times daily, titrated up to 20 mg 3 times daily", "Muscle relaxant"),
    "budesonide": _d("1–2 inhalations twice daily (inhaled formulation)", "Asthma/COPD"),
    "buprenorphine": _d("individualized; sublingual film/tablet per prescriber induction protocol", "Opioid/Addiction medicine"),
    "bupropion": _d("150 mg once daily, may increase to 150 mg twice daily", "Antidepressant"),
    "buspirone": _d("7.5–15 mg twice daily", "Anxiolytic"),
    "calcium": _d("500–1200 mg/day elemental calcium (as a supplement), in divided doses", "Supplement"),
    "carbamazepine": _d("200 mg twice daily, titrated to blood level and response", "Anticonvulsant"),
    "carvedilol": _d("3.125–25 mg twice daily", "Beta blocker"),
    "celecoxib": _d("100–200 mg once or twice daily", "NSAID"),
    "cephalexin": _d("250–500 mg every 6 hours", "Antibiotic"),
    "cetirizine": _d("10 mg once daily", "Antihistamine"),
    "cholestyramine": _d("4 g once or twice daily, mixed with liquid", "Lipid/Bile acid binder"),
    "ciprofloxacin": _d("250–750 mg every 12 hours", "Antibiotic"),
    "citalopram": _d("20–40 mg once daily", "Antidepressant (SSRI)"),
    "clarithromycin": _d("250–500 mg every 12 hours", "Antibiotic"),
    "clonazepam": _d("0.25–0.5 mg 2–3 times daily", "Anxiolytic/Anticonvulsant"),
    "clonidine": _d("0.1 mg twice daily, titrated as needed", "Blood pressure"),
    "clopidogrel": _d("75 mg once daily", "Antiplatelet"),
    "cyclobenzaprine": _d("5–10 mg 3 times daily", "Muscle relaxant"),
    "cyclosporine": _d("individualized by weight and trough level (transplant/autoimmune protocols)", "Immunosuppressant"),
    "dabigatran": _d("150 mg twice daily", "Anticoagulant"),
    "dextromethorphan": _d("10–20 mg every 4 hours as needed (OTC cough suppressant)", "Cold/Cough"),
    "diazepam": _d("2–10 mg 2–4 times daily", "Anxiolytic"),
    "diclofenac": _d("50 mg 2–3 times daily", "NSAID"),
    "digoxin": _d("0.125–0.25 mg once daily, individualized by level", "Cardiac"),
    "diltiazem": _d("120–360 mg once daily (extended-release)", "Calcium channel blocker"),
    "diphenhydramine": _d("25–50 mg every 4–6 hours as needed", "Antihistamine"),
    "disulfiram": _d("250–500 mg once daily", "Addiction medicine"),
    "doxazosin": _d("1–8 mg once daily", "Blood pressure/BPH"),
    "doxycycline": _d("100 mg once or twice daily", "Antibiotic"),
    "duloxetine": _d("30–60 mg once daily", "Antidepressant (SNRI)"),
    "enalapril": _d("5–20 mg once or twice daily", "ACE inhibitor"),
    "epinephrine": _d("0.3 mg intramuscular (auto-injector) for anaphylaxis, may repeat", "Emergency/Allergy"),
    "escitalopram": _d("10–20 mg once daily", "Antidepressant (SSRI)"),
    "esomeprazole": _d("20–40 mg once daily", "Acid reducer (PPI)"),
    "ethinyl estradiol": _d("per specific combined oral contraceptive product labeling", "Contraceptive"),
    "fentanyl": _d("individualized; transdermal patch or IV per prescriber protocol", "Opioid"),
    "fexofenadine": _d("60 mg twice daily or 180 mg once daily", "Antihistamine"),
    "fluconazole": _d("150 mg single dose (or 100–400 mg once daily, indication-dependent)", "Antifungal"),
    "fluoxetine": _d("20–60 mg once daily", "Antidepressant (SSRI)"),
    "fluticasone": _d("1–2 sprays per nostril once daily (nasal) or 1–2 inhalations twice daily", "Asthma/Allergy"),
    "furosemide": _d("20–80 mg once or twice daily", "Diuretic"),
    "gabapentin": _d("300–600 mg 3 times daily", "Nerve pain/Anticonvulsant"),
    "gemfibrozil": _d("600 mg twice daily", "Lipid"),
    "gentamicin": _d("individualized by weight and renal function (IV/IM, monitored levels)", "Antibiotic"),
    "ginkgo biloba": _d("120–240 mg/day (as a supplement), in divided doses", "Supplement"),
    "glimepiride": _d("1–4 mg once daily", "Diabetes"),
    "glipizide": _d("5–10 mg once or twice daily", "Diabetes"),
    "haloperidol": _d("0.5–5 mg 2–3 times daily, indication-dependent", "Antipsychotic"),
    "heparin": _d("individualized IV infusion or subcutaneous dosing, monitored by aPTT", "Anticoagulant"),
    "hydrochlorothiazide": _d("12.5–25 mg once daily", "Diuretic"),
    "hydrocodone": _d("5–10 mg every 4–6 hours as needed (combination products)", "Opioid"),
    "hydroxychloroquine": _d("200–400 mg once daily", "Immunosuppressant/Antimalarial"),
    "ibuprofen": _d("200–400 mg every 4–6 hours as needed; max 1200 mg/day OTC", "NSAID"),
    "insulin": _d("individualized by type, weight, and glucose targets", "Diabetes"),
    "ipratropium": _d("2 inhalations 4 times daily", "Asthma/COPD"),
    "iron": _d("65 mg elemental iron once daily (as a supplement), on an empty stomach if tolerated", "Supplement"),
    "itraconazole": _d("200 mg once or twice daily", "Antifungal"),
    "lamotrigine": _d("25–200 mg once or twice daily, slow titration required", "Anticonvulsant"),
    "levofloxacin": _d("500–750 mg once daily", "Antibiotic"),
    "levothyroxine": _d("25–200 mcg once daily on an empty stomach, individualized by TSH", "Thyroid"),
    "linezolid": _d("600 mg every 12 hours", "Antibiotic"),
    "lisinopril": _d("10–40 mg once daily", "ACE inhibitor"),
    "lithium": _d("300 mg 2–3 times daily, individualized by blood level", "Mood stabilizer"),
    "loperamide": _d("4 mg after first loose stool, then 2 mg after each subsequent; max 8 mg/day OTC", "GI"),
    "loratadine": _d("10 mg once daily", "Antihistamine"),
    "lorazepam": _d("0.5–2 mg 2–3 times daily", "Anxiolytic"),
    "losartan": _d("25–100 mg once daily", "ARB (blood pressure)"),
    "lovastatin": _d("20–80 mg once daily with evening meal", "Statin"),
    "meclizine": _d("25–50 mg once daily as needed", "Antiemetic/Vertigo"),
    "meperidine": _d("50–150 mg every 3–4 hours as needed (short-term use only)", "Opioid"),
    "metformin": _d("500 mg once or twice daily, titrated up to 2000 mg/day", "Diabetes"),
    "methadone": _d("individualized; opioid-tolerance and QT monitoring required", "Opioid/Addiction medicine"),
    "methotrexate": _d("7.5–25 mg once weekly (autoimmune dosing; differs sharply from cancer dosing)", "Immunosuppressant/Oncology"),
    "metoclopramide": _d("10 mg up to 4 times daily before meals and bedtime", "Antiemetic"),
    "metoprolol": _d("25–100 mg once or twice daily", "Beta blocker"),
    "metronidazole": _d("500 mg every 8 hours", "Antibiotic"),
    "mirtazapine": _d("15–45 mg once daily at bedtime", "Antidepressant"),
    "montelukast": _d("10 mg once daily in the evening", "Asthma/Allergy"),
    "morphine": _d("individualized; 15–30 mg every 4 hours as needed (immediate-release, opioid-naive caution)", "Opioid"),
    "naloxone": _d("0.4–2 mg IM/IV/intranasal, may repeat for opioid overdose reversal", "Emergency/Overdose reversal"),
    "naproxen": _d("220–500 mg twice daily; max 1000 mg/day OTC", "NSAID"),
    "nitroglycerin": _d("0.4 mg sublingual every 5 minutes as needed, max 3 doses", "Cardiac"),
    "olanzapine": _d("5–20 mg once daily", "Antipsychotic"),
    "omeprazole": _d("20–40 mg once daily before a meal", "Acid reducer (PPI)"),
    "ondansetron": _d("4–8 mg every 8 hours as needed", "Antiemetic"),
    "oxycodone": _d("5–15 mg every 4–6 hours as needed", "Opioid"),
    "phenelzine": _d("15 mg 2–3 times daily", "Antidepressant (MAOI)"),
    "phenytoin": _d("300–400 mg once daily (or divided), individualized by level", "Anticonvulsant"),
    "potassium": _d("10–20 mEq once or twice daily (as a supplement), individualized by level", "Supplement/Electrolyte"),
    "pravastatin": _d("10–80 mg once daily", "Statin"),
    "prednisone": _d("5–60 mg once daily, tapered per indication", "Corticosteroid"),
    "pregabalin": _d("75–150 mg twice daily", "Nerve pain/Anticonvulsant"),
    "promethazine": _d("12.5–25 mg every 4–6 hours as needed", "Antiemetic/Antihistamine"),
    "propranolol": _d("40–160 mg twice daily (or extended-release once daily; 20–40 mg twice daily for variceal bleeding prophylaxis)", "Beta blocker"),
    "pseudoephedrine": _d("60 mg every 4–6 hours; max 240 mg/day OTC", "Cold/Cough"),
    "quetiapine": _d("150–400 mg once or twice daily, indication-dependent", "Antipsychotic"),
    "ramipril": _d("2.5–10 mg once daily", "ACE inhibitor"),
    "risperidone": _d("1–4 mg once or twice daily", "Antipsychotic"),
    "rivaroxaban": _d("20 mg once daily with food (dose varies by indication)", "Anticoagulant"),
    "rosuvastatin": _d("5–40 mg once daily", "Statin"),
    "rifampin": _d("600 mg once daily", "Antibiotic"),
    "sertraline": _d("50–200 mg once daily", "Antidepressant (SSRI)"),
    "sildenafil": _d("50 mg about 1 hour before activity, as needed (max once/day)", "PDE5 inhibitor"),
    "simvastatin": _d("10–40 mg once daily in the evening", "Statin"),
    "sotalol": _d("80–160 mg twice daily, QT-monitored", "Antiarrhythmic"),
    "spironolactone": _d("25–100 mg once daily (up to 400 mg/day for ascites; 50–200 mg for off-label hormonal acne)", "Diuretic"),
    "st. john's wort": _d("300 mg 2–3 times daily (as a supplement)", "Supplement"),
    "sucralfate": _d("1 g 4 times daily on an empty stomach", "GI"),
    "sumatriptan": _d("50–100 mg at onset of migraine, may repeat once after 2 hours", "Migraine"),
    "tadalafil": _d("10 mg before activity, as needed, or 2.5–5 mg once daily", "PDE5 inhibitor"),
    "tamsulosin": _d("0.4 mg once daily, 30 minutes after the same meal each day", "BPH"),
    "theophylline": _d("individualized by level; typically 300–600 mg/day divided", "Asthma/COPD"),
    "tizanidine": _d("2–4 mg every 6–8 hours as needed; max 36 mg/day", "Muscle relaxant"),
    "topiramate": _d("25–200 mg twice daily, titrated gradually", "Anticonvulsant"),
    "tramadol": _d("50–100 mg every 4–6 hours as needed; max 400 mg/day", "Opioid"),
    "tranylcypromine": _d("10 mg 2–3 times daily", "Antidepressant (MAOI)"),
    "trazodone": _d("50–100 mg at bedtime, titrated as needed", "Antidepressant/Sleep aid"),
    "trimethoprim-sulfamethoxazole": _d("1 double-strength tablet every 12 hours", "Antibiotic"),
    "valproate": _d("500–1500 mg/day divided, individualized by level", "Anticonvulsant/Mood stabilizer"),
    "venlafaxine": _d("75–225 mg once daily (extended-release)", "Antidepressant (SNRI)"),
    "verapamil": _d("120–360 mg once daily (extended-release)", "Calcium channel blocker"),

    # --- Dermatology / acne / skin ---
    "tretinoin": _d("Apply a pea-sized amount once nightly to clean, dry skin", "Dermatology/Acne"),
    "adapalene": _d("Apply a thin layer once daily at bedtime", "Dermatology/Acne"),
    "isotretinoin": _d("0.5–1 mg/kg/day divided twice daily, course-based over ~15–20 weeks; requires pregnancy-prevention and lab monitoring", "Dermatology/Acne"),
    "benzoyl peroxide": _d("Apply 2.5–10% preparation once or twice daily", "Dermatology/Acne"),
    "clindamycin": _d("Apply a thin film to affected areas twice daily (topical); 150–450 mg every 6–8 hours (oral)", "Dermatology/Antibiotic"),
    "azelaic acid": _d("Apply 15–20% gel/cream twice daily", "Dermatology/Acne"),
    "salicylic acid": _d("Apply 0.5–2% preparation once or twice daily (OTC)", "Dermatology/Acne"),
    "minocycline": _d("50–100 mg once or twice daily", "Dermatology/Antibiotic"),
    "tazarotene": _d("Apply a thin film once daily in the evening", "Dermatology/Acne"),
    "clascoterone": _d("Apply cream twice daily to affected areas", "Dermatology/Acne"),
    "hydrocortisone": _d("Apply 0.5–1% preparation 1–2 times daily (OTC, topical)", "Dermatology"),
    "clobetasol": _d("Apply thin layer once or twice daily; limit to 2 consecutive weeks", "Dermatology"),
    "permethrin": _d("Apply 5% cream, leave 8–14 hours, single treatment (scabies)", "Dermatology"),
    "terbinafine": _d("250 mg once daily for 6–12 weeks (oral) or apply topically once daily", "Dermatology/Antifungal"),

    # --- Liver / hepatology ---
    "ursodiol": _d("13–15 mg/kg/day divided 2–3 times daily", "Hepatology"),
    "lactulose": _d("15–30 mL 1–4 times daily, titrated to 2–3 soft stools/day", "Hepatology"),
    "rifaximin": _d("550 mg twice daily (hepatic encephalopathy)", "Hepatology"),
    "entecavir": _d("0.5–1 mg once daily on an empty stomach", "Hepatology/Antiviral"),
    "tenofovir": _d("300 mg once daily", "Hepatology/Antiviral"),
    "sofosbuvir": _d("400 mg once daily, typically combined with another antiviral", "Hepatology/Antiviral"),
    "ledipasvir-sofosbuvir": _d("1 tablet once daily", "Hepatology/Antiviral"),
    "silymarin": _d("140 mg 2–3 times daily (as a supplement)", "Hepatology/Supplement"),

    # --- High-acuity / specialist / biologic ---
    "adalimumab": _d("40 mg subcutaneously every other week", "Biologic/Autoimmune"),
    "infliximab": _d("3–5 mg/kg IV infusion at weeks 0, 2, 6, then every 8 weeks", "Biologic/Autoimmune"),
    "etanercept": _d("50 mg subcutaneously once weekly", "Biologic/Autoimmune"),
    "rituximab": _d("375 mg/m² IV infusion, protocol-dependent", "Biologic/Oncology"),
    "ustekinumab": _d("45–90 mg subcutaneously at weeks 0, 4, then every 12 weeks", "Biologic/Autoimmune"),
    "imatinib": _d("400 mg once daily", "Oncology"),
    "vancomycin": _d("15–20 mg/kg IV every 8–12 hours, individualized by trough level", "Antibiotic (severe infection)"),
    "meropenem": _d("1 g IV every 8 hours", "Antibiotic (severe infection)"),
    "piperacillin-tazobactam": _d("3.375–4.5 g IV every 6–8 hours", "Antibiotic (severe infection)"),
    "insulin glargine": _d("individualized starting dose, once daily (long-acting basal insulin), titrated to fasting glucose", "Diabetes"),

    # --- GLP-1 / diabetes & weight management ---
    "semaglutide": _d("0.25 mg once weekly starting dose, titrated up to 1–2.4 mg once weekly (subcutaneous)", "Diabetes/Weight management"),
    "tirzepatide": _d("2.5 mg once weekly starting dose, titrated up to 15 mg once weekly (subcutaneous)", "Diabetes/Weight management"),
    "liraglutide": _d("0.6 mg once daily starting, titrated up to 1.8–3 mg once daily (subcutaneous)", "Diabetes/Weight management"),
    "dulaglutide": _d("0.75–4.5 mg once weekly (subcutaneous)", "Diabetes"),
    "sitagliptin": _d("100 mg once daily", "Diabetes"),
    "empagliflozin": _d("10–25 mg once daily", "Diabetes"),
    "canagliflozin": _d("100–300 mg once daily", "Diabetes"),
    "dapagliflozin": _d("5–10 mg once daily", "Diabetes"),
    "pioglitazone": _d("15–45 mg once daily", "Diabetes"),

    # --- ADHD ---
    "methylphenidate": _d("5–20 mg 2–3 times daily (immediate-release) or 18–72 mg once daily (extended-release)", "ADHD"),
    "amphetamine-dextroamphetamine": _d("5–30 mg once or twice daily", "ADHD"),
    "lisdexamfetamine": _d("30–70 mg once daily in the morning", "ADHD"),
    "atomoxetine": _d("40–100 mg once daily", "ADHD"),
    "guanfacine": _d("1–4 mg once daily (extended-release)", "ADHD"),

    # --- Seizure / neurology ---
    "levetiracetam": _d("500–1500 mg twice daily", "Anticonvulsant"),
    "oxcarbazepine": _d("300–600 mg twice daily", "Anticonvulsant"),
    "zonisamide": _d("100–400 mg once daily", "Anticonvulsant"),
    "levodopa-carbidopa": _d("1 tablet (25/100 or 25/250) 3–4 times daily, titrated", "Parkinson's"),
    "pramipexole": _d("0.125–1.5 mg 3 times daily", "Parkinson's/Restless legs"),
    "ropinirole": _d("0.25–4 mg 3 times daily", "Parkinson's/Restless legs"),
    "donepezil": _d("5–10 mg once daily at bedtime", "Alzheimer's"),
    "memantine": _d("5–10 mg twice daily", "Alzheimer's"),
    "modafinil": _d("100–200 mg once daily in the morning", "Narcolepsy/Wakefulness"),
    "eszopiclone": _d("1–3 mg at bedtime", "Sleep aid"),

    # --- Osteoporosis / bone ---
    "alendronate": _d("70 mg once weekly, on an empty stomach, stay upright 30 minutes after", "Osteoporosis"),
    "risedronate": _d("35 mg once weekly", "Osteoporosis"),
    "denosumab": _d("60 mg subcutaneously every 6 months", "Osteoporosis"),

    # --- Cholesterol (non-statin) ---
    "ezetimibe": _d("10 mg once daily", "Lipid"),
    "evolocumab": _d("140 mg subcutaneously every 2 weeks", "Lipid/Biologic"),

    # --- Addiction medicine / smoking cessation ---
    "varenicline": _d("0.5 mg once daily, titrated up to 1 mg twice daily", "Smoking cessation"),
    "naltrexone": _d("50 mg once daily (oral) or 380 mg IM once monthly", "Addiction medicine"),
    "acamprosate": _d("666 mg 3 times daily", "Addiction medicine"),

    # --- Ophthalmology (glaucoma) ---
    "latanoprost": _d("1 drop in affected eye(s) once daily in the evening", "Ophthalmology"),
    "brimonidine": _d("1 drop 3 times daily", "Ophthalmology"),

    # --- More antibiotics ---
    "penicillin v": _d("250–500 mg every 6 hours", "Antibiotic"),
    "ampicillin": _d("250–500 mg every 6 hours", "Antibiotic"),
    "nitrofurantoin": _d("100 mg twice daily", "Antibiotic"),
    "erythromycin": _d("250–500 mg every 6 hours", "Antibiotic"),

    # --- More cardiac ---
    "nifedipine": _d("30–90 mg once daily (extended-release)", "Calcium channel blocker"),
    "hydralazine": _d("10–50 mg 4 times daily", "Blood pressure"),
    "isosorbide mononitrate": _d("30–120 mg once daily", "Cardiac"),

    # --- More GI ---
    "famotidine": _d("20–40 mg once or twice daily", "Acid reducer"),
    "misoprostol": _d("200 mcg 4 times daily (GI protection); cycle-based dosing for other indications", "GI/Women's health"),
    "dicyclomine": _d("10–20 mg 4 times daily", "GI"),

    # --- More migraine ---
    "eletriptan": _d("20–40 mg at onset, may repeat once after 2 hours", "Migraine"),
    "zolmitriptan": _d("1.25–2.5 mg at onset, may repeat after 2 hours", "Migraine"),
    "erenumab": _d("70–140 mg subcutaneously once monthly", "Migraine/Biologic"),

    # --- More antipsychotic ---
    "lurasidone": _d("40–80 mg once daily with food", "Antipsychotic"),
    "ziprasidone": _d("20–80 mg twice daily with food", "Antipsychotic"),

    # --- More muscle relaxants ---
    "methocarbamol": _d("1500 mg 4 times daily initially", "Muscle relaxant"),
    "carisoprodol": _d("250–350 mg 3 times daily", "Muscle relaxant"),

    # --- Reversal agents ---
    "protamine": _d("1 mg IV per 100 units of heparin to be reversed", "Emergency/Reversal agent"),
    "idarucizumab": _d("5 g IV (two 2.5 g doses) for dabigatran reversal", "Emergency/Reversal agent"),

    # --- Women's health ---
    "progesterone": _d("200 mg once daily at bedtime (oral, cyclic use)", "Women's health"),
    "clomiphene": _d("50 mg once daily for 5 days, cycle-based", "Women's health/Fertility"),
    "medroxyprogesterone": _d("150 mg IM every 3 months", "Women's health/Contraceptive"),

    # --- HIV ---
    "efavirenz": _d("600 mg once daily at bedtime", "HIV/Antiviral"),
    "dolutegravir": _d("50 mg once daily", "HIV/Antiviral"),
    "emtricitabine-tenofovir": _d("1 tablet once daily", "HIV/Antiviral"),

    # --- Tuberculosis ---
    "isoniazid": _d("5 mg/kg once daily (typically 300 mg)", "Antibiotic (TB)"),
    "ethambutol": _d("15–25 mg/kg once daily", "Antibiotic (TB)"),
    "pyrazinamide": _d("20–25 mg/kg once daily", "Antibiotic (TB)"),

    # --- Antiparasitic ---
    "albendazole": _d("400 mg once, may repeat per indication", "Antiparasitic"),
    "ivermectin": _d("150–200 mcg/kg once, may repeat (oral); apply 0.5% lotion once for lice (topical)", "Antiparasitic"),

    # --- Cold / cough ---
    "guaifenesin": _d("200–400 mg every 4 hours; max 2400 mg/day", "Cold/Cough"),

    # --- Local anesthetic ---
    "lidocaine": _d("Apply to affected area per product labeling (topical); dosing varies widely by injectable use", "Anesthetic"),
    "magnesium": _d("240–420 mg/day elemental magnesium (as a supplement), in divided doses", "Supplement"),
    "vitamin k": _d("90–120 mcg/day (dietary reference intake); prescription doses vary by indication", "Supplement"),
    "warfarin": _d("individualized (commonly 2–10 mg once daily), dosed to target INR — a higher target applies for mechanical heart valves", "Anticoagulant"),
    "zolpidem": _d("5–10 mg at bedtime, immediately before sleep", "Sleep aid"),
}


def _reverse_brand_map() -> Dict[str, List[str]]:
    reverse: Dict[str, List[str]] = {}
    for brand, generic in BRAND_TO_GENERIC.items():
        reverse.setdefault(generic, []).append(brand.title())
    return reverse


def get_drug_directory() -> List[Dict]:
    """Full searchable drug list (generic name + known brand names + typical dosage
    + category) for the medication-checker autocomplete.

    Starts from the built-in DRUG_INFO and, if GOOGLE_SHEET_CSV_URL is configured,
    merges in a live sheet on top (sheet entries add new drugs or override the
    dosage/category of existing ones — nothing else). Any fetch failure just
    falls back to the built-in set silently."""
    merged = dict(DRUG_INFO)
    sheet_data = fetch_sheet_drug_info(settings.GOOGLE_SHEET_CSV_URL)
    if sheet_data:
        merged.update(sheet_data)

    reverse = _reverse_brand_map()
    return [
        {
            "name": generic,
            "brand_names": sorted(set(reverse.get(generic, []))),
            "dosage": info["dosage"],
            "category": info["category"],
        }
        for generic, info in sorted(merged.items())
    ]


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

    # --- New-drug coverage: ADHD, GLP-1, neuro, addiction medicine ---
    {"drugs": ("methylphenidate", "phenelzine"), "description": "Combining a stimulant with an MAOI can trigger a dangerous spike in blood pressure.", "severity": "high"},
    {"drugs": ("amphetamine-dextroamphetamine", "phenelzine"), "description": "Combining a stimulant with an MAOI can trigger a dangerous spike in blood pressure.", "severity": "high"},
    {"drugs": ("methylphenidate", "warfarin"), "description": "Methylphenidate can increase warfarin's blood-thinning effect.", "severity": "moderate"},
    {"drugs": ("semaglutide", "insulin"), "description": "Combining these increases the risk of low blood sugar.", "severity": "moderate"},
    {"drugs": ("semaglutide", "glipizide"), "description": "Combining these increases the risk of low blood sugar.", "severity": "moderate"},
    {"drugs": ("tirzepatide", "insulin"), "description": "Combining these increases the risk of low blood sugar.", "severity": "moderate"},
    {"drugs": ("levodopa-carbidopa", "phenelzine"), "description": "Combining these can cause a dangerous spike in blood pressure (hypertensive crisis).", "severity": "high"},
    {"drugs": ("varenicline", "alcohol"), "description": "Varenicline may reduce alcohol tolerance and increase the risk of unusual or aggressive behavior when combined with alcohol.", "severity": "moderate"},
    {"drugs": ("naltrexone", "oxycodone"), "description": "Naltrexone blocks opioid effects and can precipitate sudden, severe withdrawal in someone taking opioids.", "severity": "high"},
    {"drugs": ("naltrexone", "tramadol"), "description": "Naltrexone blocks opioid effects and can precipitate sudden, severe withdrawal.", "severity": "high"},
    {"drugs": ("donepezil", "metoprolol"), "description": "Combining these can cause an excessively slow heart rate.", "severity": "moderate"},
    {"drugs": ("alendronate", "ibuprofen"), "description": "NSAIDs combined with bisphosphonates raise the risk of stomach irritation and ulcers.", "severity": "moderate"},
    {"drugs": ("erythromycin", "simvastatin"), "description": "This antibiotic can raise simvastatin levels sharply, increasing the risk of muscle damage.", "severity": "high"},
    {"drugs": ("nitrofurantoin", "magnesium"), "description": "Magnesium-containing antacids can reduce absorption of this antibiotic.", "severity": "low"},
    {"drugs": ("isoniazid", "acetaminophen"), "description": "Combining these raises the risk of liver toxicity, especially with regular acetaminophen use.", "severity": "moderate"},
    {"drugs": ("levetiracetam", "alcohol"), "description": "Alcohol can increase drowsiness and dizziness with this anticonvulsant.", "severity": "moderate"},
    {"drugs": ("zolmitriptan", "sertraline"), "description": "Combining a triptan with an SSRI raises the risk of serotonin syndrome.", "severity": "moderate"},
    {"drugs": ("eletriptan", "itraconazole"), "description": "This antifungal can raise triptan levels, increasing side-effect risk.", "severity": "moderate"},

    # --- More serotonergic combinations ---
    {"drugs": ("citalopram", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("escitalopram", "linezolid"), "description": "Linezolid has MAOI-like activity; combining it with an SSRI risks serotonin syndrome.", "severity": "high"},
    {"drugs": ("duloxetine", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "high"},
    {"drugs": ("venlafaxine", "linezolid"), "description": "Linezolid has MAOI-like activity; combining it with an antidepressant risks serotonin syndrome.", "severity": "high"},
    {"drugs": ("trazodone", "tramadol"), "description": "Combining these raises the risk of serotonin syndrome.", "severity": "moderate"},
    {"drugs": ("sumatriptan", "citalopram"), "description": "Combining a triptan with an SSRI raises the risk of serotonin syndrome.", "severity": "moderate"},

    # --- QT-prolonging combinations ---
    {"drugs": ("ziprasidone", "sotalol"), "description": "Combining these raises the risk of dangerous heart rhythm changes (QT prolongation).", "severity": "high"},
    {"drugs": ("quetiapine", "sotalol"), "description": "Combining these raises the risk of dangerous heart rhythm changes (QT prolongation).", "severity": "high"},
    {"drugs": ("haloperidol", "methadone"), "description": "Combining these raises the risk of dangerous heart rhythm changes (QT prolongation).", "severity": "high"},
    {"drugs": ("methadone", "ciprofloxacin"), "description": "This antibiotic can raise the risk of dangerous heart rhythm changes (QT prolongation) with methadone.", "severity": "high"},

    # --- More statin combinations ---
    {"drugs": ("rosuvastatin", "cyclosporine"), "description": "Cyclosporine substantially raises statin levels, increasing the risk of muscle damage.", "severity": "high"},
    {"drugs": ("pravastatin", "gemfibrozil"), "description": "This fibrate combined with a statin raises the risk of muscle damage.", "severity": "moderate"},
    {"drugs": ("atorvastatin", "itraconazole"), "description": "This antifungal can raise statin levels, increasing the risk of muscle damage.", "severity": "moderate"},
    {"drugs": ("fluconazole", "simvastatin"), "description": "This antifungal can raise simvastatin levels, increasing the risk of muscle damage.", "severity": "moderate"},

    # --- More anticoagulant combinations ---
    {"drugs": ("apixaban", "fluconazole"), "description": "This antifungal can raise apixaban levels, increasing bleeding risk.", "severity": "moderate"},
    {"drugs": ("rivaroxaban", "itraconazole"), "description": "This antifungal can raise rivaroxaban levels, increasing bleeding risk.", "severity": "high"},
    {"drugs": ("dabigatran", "verapamil"), "description": "Verapamil can raise dabigatran levels, increasing bleeding risk.", "severity": "moderate"},
    {"drugs": ("warfarin", "azithromycin"), "description": "This antibiotic can modestly increase warfarin's blood-thinning effect.", "severity": "low"},
    {"drugs": ("warfarin", "levofloxacin"), "description": "This antibiotic can increase warfarin's blood-thinning effect.", "severity": "moderate"},
    {"drugs": ("warfarin", "glipizide"), "description": "Sulfonylureas can potentiate warfarin's blood-thinning effect.", "severity": "low"},

    # --- More ACE inhibitor / ARB combinations ---
    {"drugs": ("enalapril", "potassium"), "description": "ACE inhibitors combined with potassium supplements can cause dangerously high potassium levels.", "severity": "moderate"},
    {"drugs": ("enalapril", "ibuprofen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},
    {"drugs": ("ramipril", "potassium"), "description": "ACE inhibitors combined with potassium supplements can cause dangerously high potassium levels.", "severity": "moderate"},
    {"drugs": ("ramipril", "ibuprofen"), "description": "NSAIDs can reduce the blood-pressure-lowering effect and stress the kidneys.", "severity": "moderate"},

    # --- More diabetes combinations ---
    {"drugs": ("empagliflozin", "furosemide"), "description": "Combining these raises the risk of dehydration and low blood pressure.", "severity": "moderate"},
    {"drugs": ("canagliflozin", "lisinopril"), "description": "Combining these can affect kidney function, especially with volume depletion.", "severity": "moderate"},

    # --- More antibiotic combinations ---
    {"drugs": ("ciprofloxacin", "tizanidine"), "description": "This antibiotic can sharply raise tizanidine levels, causing dangerously low blood pressure and sedation.", "severity": "high"},
    {"drugs": ("ciprofloxacin", "ibuprofen"), "description": "Combining these can increase the risk of CNS stimulation and seizures.", "severity": "moderate"},
    {"drugs": ("rifampin", "metoprolol"), "description": "Rifampin can reduce this beta blocker's effectiveness by speeding its breakdown.", "severity": "moderate"},
    {"drugs": ("rifampin", "methadone"), "description": "Rifampin can sharply reduce methadone levels, risking withdrawal symptoms.", "severity": "moderate"},

    # --- More PPI combinations ---
    {"drugs": ("omeprazole", "citalopram"), "description": "Omeprazole can raise citalopram levels, increasing the risk of dangerous heart rhythm changes (QT prolongation).", "severity": "moderate"},

    # --- More opioid combinations ---
    {"drugs": ("fentanyl", "alprazolam"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("hydrocodone", "alprazolam"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("buprenorphine", "alprazolam"), "description": "Combining benzodiazepines with opioids increases the risk of severe respiratory depression.", "severity": "high"},
    {"drugs": ("naltrexone", "methadone"), "description": "Naltrexone blocks opioid effects and can precipitate sudden, severe withdrawal.", "severity": "high"},

    # --- More thyroid / TB / HIV / osteoporosis combinations ---
    {"drugs": ("levothyroxine", "rifampin"), "description": "Rifampin can reduce thyroid medication effectiveness by speeding its breakdown.", "severity": "moderate"},
    {"drugs": ("isoniazid", "phenytoin"), "description": "Isoniazid can raise phenytoin levels, increasing the risk of toxicity.", "severity": "moderate"},
    {"drugs": ("efavirenz", "warfarin"), "description": "Efavirenz can raise or lower warfarin's effect unpredictably; INR should be monitored closely.", "severity": "moderate"},
    {"drugs": ("dolutegravir", "calcium"), "description": "Calcium supplements can reduce absorption of this HIV medication if taken together.", "severity": "moderate"},
    {"drugs": ("alendronate", "calcium"), "description": "Calcium supplements can reduce absorption of this bisphosphonate if taken too close together.", "severity": "low"},
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
