"""
Enrich the existing DRUG_INFO table with authoritative data from openFDA's
NDC directory (US FDA, public domain, no API key required).

Pulls, per drug:
  - FDA Established Pharmacologic Class (the authoritative "type" of the drug)
  - Real marketed brand names (to expand the brand->generic alias table)

Writes a JSON report to the scratchpad for review before anything is merged
into the app's source.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)
from app.nlp.medication_data import DRUG_INFO, BRAND_TO_GENERIC  # noqa: E402

OUT = os.path.join(_BACKEND, "scripts", "openfda_enrichment_raw.json")

# Multi-word / non-drug entries openFDA won't meaningfully resolve.
SKIP = {"grapefruit", "alcohol", "contrast dye", "st. john's wort", "ginkgo biloba",
        "silymarin", "vitamin k", "calcium", "iron", "potassium", "magnesium"}


def fetch(generic: str):
    q = urllib.parse.quote(f'generic_name:"{generic}"')
    url = f"https://api.fda.gov/drug/ndc.json?search={q}&limit=25"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"_error": str(e)}


def main():
    results = {}
    names = [n for n in sorted(DRUG_INFO) if n not in SKIP]
    print(f"querying openFDA for {len(names)} drugs...")

    for i, generic in enumerate(names, 1):
        data = fetch(generic)
        if "_error" in data or "results" not in data:
            results[generic] = {"found": False, "error": data.get("_error", "no results")}
        else:
            classes, brands, forms = set(), set(), set()
            combo_skipped = 0
            for r in data["results"]:
                # Combination products (e.g. Caduet = amlodipine + atorvastatin) would
                # otherwise contribute the OTHER ingredient's pharm class and a brand
                # name that isn't this drug alone. Both are wrong for our table, so
                # only single-ingredient products are used.
                if len(r.get("active_ingredients", []) or []) != 1:
                    combo_skipped += 1
                    continue
                for pc in r.get("pharm_class", []) or []:
                    if pc.endswith("[EPC]"):
                        classes.add(pc.replace(" [EPC]", ""))
                bn = (r.get("brand_name") or "").strip()
                gn = (r.get("generic_name") or "").strip().lower()
                # Only keep brands that are a real trade name, not a restatement
                # of the generic (openFDA lists generics-as-brand for many products).
                if bn and bn.lower() != gn and generic not in bn.lower():
                    brands.add(bn)
                if r.get("dosage_form"):
                    forms.add(r["dosage_form"])
            results[generic] = {
                "found": True,
                "total_products": data["meta"]["results"]["total"],
                "combo_products_skipped": combo_skipped,
                "fda_classes": sorted(classes),
                "brand_names": sorted(brands)[:12],
                "dosage_forms": sorted(forms)[:6],
            }
        if i % 20 == 0:
            print(f"  {i}/{len(names)}")
        time.sleep(0.28)  # stay well under openFDA's unauthenticated rate limit

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    found = sum(1 for v in results.values() if v.get("found"))
    with_class = sum(1 for v in results.values() if v.get("fda_classes"))
    new_brands = 0
    for generic, v in results.items():
        for b in v.get("brand_names", []):
            if b.lower() not in BRAND_TO_GENERIC:
                new_brands += 1
    print(f"\ndone. matched {found}/{len(names)}, {with_class} with an FDA class, "
          f"{new_brands} candidate new brand aliases")
    print("written to", OUT)


if __name__ == "__main__":
    main()
