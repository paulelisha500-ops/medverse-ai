"""
Bulk-import a reference tier of drugs from the openFDA NDC directory.

This is deliberately a *second tier*, separate from the curated DRUG_INFO table:

  curated tier  - hand-written typical adult dosing, and the only tier the
                  interaction checker draws pairs from
  reference tier - name, FDA pharmacologic class, brands, dosage forms, taken
                  straight from openFDA. No dosing regimen is invented for
                  these; openFDA publishes per-product strengths ("20 mg/1"),
                  not how a clinician actually doses the drug.

Keeping them separate means broad autocomplete coverage without ever implying
a dose the data does not support, or an interaction nobody reviewed.

Paginates the product listing and aggregates client-side, which costs ~25
requests instead of one per drug.
"""
import json
import os
import re
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

OUT = os.path.join(BACKEND, "app", "nlp", "bulk_reference.json")

PAGE = 1000          # openFDA max per request
MAX_SKIP = 25000     # openFDA refuses skip beyond this
MIN_PRODUCTS = 2     # drop one-off listings

# Not therapeutic drugs in the sense this app means: sunscreens, sanitizers,
# bulk excipients and homeopathic dilutions all appear in the NDC directory.
EXCLUDE_EXACT = {
    "alcohol", "zinc oxide", "titanium dioxide", "octinoxate", "avobenzone",
    "octisalate", "homosalate", "oxybenzone", "benzalkonium chloride",
    "isopropyl alcohol", "ethyl alcohol", "water", "glycerin", "petrolatum",
    "dimethicone", "octocrylene", "menthol", "camphor", "sodium chloride",
    "oxygen", "nitrogen", "helium", "carbon dioxide", "sodium fluoride",
}
EXCLUDE_PATTERN = re.compile(
    r"(sunscreen|sanitiz|homeopath|\bspf\b|placebo|diluent|excipient|"
    r"\bkit\b|dextrose|sterile water)", re.I
)

# openFDA's generic_name is a product-listing field, so many values are really
# packaging descriptions: "4% lidocaine patches", "aspirin 81 mg delayed release
# tablets". A drug name carrying a strength or a dosage form is not a name.
PRODUCT_STRING = re.compile(
    r"(\d\s*%|\bmg\b|\bmcg\b|\bml\b|\biu\b|\bunits?\b|\busp\b|"
    r"\bpatch|\bcream\b|\bointment\b|\bsolution\b|\bgel\b|\btablet|\bcapsule|"
    r"\binjection|\bspray\b|\bsyrup\b|\blotion\b|\bshampoo\b|\bswab|\bwipe|"
    r"\bpad\b|\bpowder\b|\bdelayed release\b|\bextended release\b|^\d)", re.I
)

# Salt and hydrate forms describe the same drug as the base name. Keeping both
# would list "abiraterone" and "abiraterone acetate" as separate medications.
SALT_SUFFIX = re.compile(
    r"\s+(hydrochloride|hcl|hydrobromide|sodium|potassium|calcium|magnesium|"
    r"sulfate|sulphate|tartrate|bitartrate|maleate|mesylate|besylate|tosylate|"
    r"succinate|fumarate|citrate|acetate|phosphate|bromide|chloride|nitrate|"
    r"oxalate|malate|carbonate|gluconate|lactate|stearate|palmitate|valerate|"
    r"propionate|dipropionate|furoate|xinafoate|di?hydrate|monohydrate|"
    r"anhydrous|micronized)$", re.I
)


def base_name(name: str) -> str:
    """Strip a trailing salt/hydrate form, repeatedly (e.g. 'x sodium dihydrate')."""
    prev = None
    while prev != name:
        prev = name
        name = SALT_SUFFIX.sub("", name).strip()
    return name


def fetch(skip: int):
    url = f"https://api.fda.gov/drug/ndc.json?limit={PAGE}&skip={skip}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt == 2:
                print(f"  skip={skip} failed: {e}")
                return None
            time.sleep(2)
    return None


def main():
    from app.nlp.medication_data import DRUG_INFO

    agg = {}
    scanned = 0
    for skip in range(0, MAX_SKIP, PAGE):
        data = fetch(skip)
        if not data or "results" not in data:
            break
        for r in data["results"]:
            scanned += 1
            # Same rule as the curated enrichment: a combination product would
            # otherwise donate the other ingredient's class to this one.
            if len(r.get("active_ingredients", []) or []) != 1:
                continue
            generic = " ".join((r.get("generic_name") or "").strip().lower().split())
            if not generic:
                continue

            entry = agg.setdefault(generic, {
                "count": 0, "classes": set(), "brands": set(), "forms": set(),
            })
            entry["count"] += 1
            for pc in r.get("pharm_class", []) or []:
                if pc.endswith("[EPC]"):
                    entry["classes"].add(pc.replace(" [EPC]", ""))
            bn = (r.get("brand_name") or "").strip()
            if bn and bn.lower() != generic and generic not in bn.lower():
                entry["brands"].add(bn)
            if r.get("dosage_form"):
                entry["forms"].add(r["dosage_form"].title())
        print(f"  scanned {scanned}, distinct generics so far: {len(agg)}")
        time.sleep(0.3)

    out = {}
    skipped = {"curated": 0, "excluded": 0, "too_few": 0, "no_class": 0,
               "product_string": 0, "salt_form": 0, "allergenic": 0}
    # Longest names last, so a base name is imported before its salt variants
    # and the variants then collapse into it.
    for generic in sorted(agg, key=len):
        v = agg[generic]
        if generic in DRUG_INFO:
            skipped["curated"] += 1
            continue
        if generic in EXCLUDE_EXACT or EXCLUDE_PATTERN.search(generic):
            skipped["excluded"] += 1
            continue
        if PRODUCT_STRING.search(generic):
            skipped["product_string"] += 1
            continue
        base = base_name(generic)
        if base != generic and (base in DRUG_INFO or base in out):
            skipped["salt_form"] += 1
            continue
        if v["count"] < MIN_PRODUCTS:
            skipped["too_few"] += 1
            continue
        if not v["classes"]:
            skipped["no_class"] += 1
            continue
        # Allergenic extracts are listed by species (pollens, molds, foods) for
        # skin testing and immunotherapy. They are not medications anyone looks
        # up in a drug checker.
        if any("Allergenic" in c for c in v["classes"]):
            skipped["allergenic"] += 1
            continue
        if len(generic) > 60:
            continue
        out[generic] = {
            "fda_class": sorted(v["classes"])[0],
            "dosage_forms": sorted(v["forms"])[:4],
            "brands": sorted(v["brands"])[:6],
            "product_count": v["count"],
        }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, sort_keys=True)

    print(f"\nscanned {scanned} products, {len(agg)} distinct single-ingredient generics")
    print(f"imported {len(out)} into the reference tier")
    print(f"skipped: {skipped}")
    print("written to", OUT)


if __name__ == "__main__":
    main()
