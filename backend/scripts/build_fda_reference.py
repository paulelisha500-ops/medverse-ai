"""
Build app/nlp/fda_reference.json from the raw openFDA output.

Run enrich_openfda.py first to produce openfda_enrichment_raw.json, then this.

The filtering here is the point of the script. openFDA's brand_name field is a
product-listing field, not a curated trade-name list, so it carries a lot that
must not become a drug alias:

  * Combination products, already dropped upstream by enrich_openfda.py, would
    otherwise attach one ingredient's class to the other (Caduet made
    atorvastatin look like a calcium channel blocker).
  * Shelf descriptors ("allergy relief", "acid reducer") map to several
    different generics, so accepting them makes the checker silently resolve a
    generic phrase to whichever drug happened to win.
  * Store brands ("careone ...", "dg health ...") are retailer packaging.
  * Antidotes are listed under the drug they treat. DigiFab is digoxin immune
    Fab, which REVERSES digoxin toxicity — aliasing it to digoxin would invert
    a clinical relationship, so it is blocklisted by name.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

RAW = os.path.join(HERE, "openfda_enrichment_raw.json")
OUT = os.path.join(BACKEND, "app", "nlp", "fda_reference.json")

# OTC shelf-descriptor vocabulary — a brand containing any of these is a
# category label rather than a trade name.
DESCRIPTOR = re.compile(
    r"\b(relief|treatment|reducer|reliever|wash|cream|gel|scrub|cleanser|"
    r"pain|allergy|acid|antacid|anti|diarrheal|itch|wart|corn|remover|"
    r"childrens|children|kids|adult|strength|maximum|max|health|care|value|"
    r"original|flavor|daily|day|night|hour|hr|overnight|nasal|spray|patch|"
    r"patches|foot|body|face|acne|blackhead|heartburn|prevention|sinus|"
    r"cough|cold)\b"
)

STORE = re.compile(
    r"^(careone|dg |cvs|walgreens|equate|kirkland|rite aid|good sense|goodsense|"
    r"signature|member|up and up|sunmark|basic care|amazon|premier|leader|"
    r"topcare|berkley)"
)

# Antidotes that openFDA files under the drug they REVERSE. Aliasing these
# would invert a clinical relationship: DigiFab is digoxin immune Fab, listed
# under "digoxin", but giving it is how you treat digoxin toxicity.
# (Praxbind is deliberately NOT here — openFDA lists it under idarucizumab,
# which is simply its own generic, so that mapping is correct.)
BLOCKLIST = {"digifab", "digibind", "adrenalinum"}

# openFDA carries a misspelling of zolmitriptan in a product listing. The
# fuzzy matcher already resolves it, so it does not need to become an alias.
BLOCKLIST |= {"zolmiptriptan"}

# Every insulin product resolves to the generic "insulin" bucket, because that
# is the key the interaction table uses. Without this, Semglee would normalize
# to "insulin glargine" and miss the insulin interaction pairs entirely.
INSULIN_BUCKET = "insulin"


def main():
    from app.nlp.medication_data import DRUG_INFO  # noqa: E402

    with open(RAW, encoding="utf-8") as f:
        raw = json.load(f)

    # A brand claimed by more than one generic is ambiguous and gets dropped.
    owner, ambiguous = {}, set()
    for generic, v in raw.items():
        for b in v.get("brand_names", []):
            key = " ".join(b.strip().lower().split())
            if key in owner and owner[key] != generic:
                ambiguous.add(key)
            owner.setdefault(key, generic)

    brands, rejected = {}, {"ambiguous": 0, "descriptor": 0, "store": 0,
                            "blocklist": 0, "too_long": 0}
    for key, generic in owner.items():
        if not key:
            continue
        if key in ambiguous:
            rejected["ambiguous"] += 1
            continue
        if key in BLOCKLIST:
            rejected["blocklist"] += 1
            continue
        if STORE.match(key):
            rejected["store"] += 1
            continue
        if DESCRIPTOR.search(key):
            rejected["descriptor"] += 1
            continue
        if len(key) > 22 or len(key.split()) > 2:
            rejected["too_long"] += 1
            continue
        brands[key] = INSULIN_BUCKET if generic == "insulin glargine" else generic

    # Only the first (primary) established pharmacologic class, and only for
    # drugs the app actually knows about.
    classes = {
        generic: v["fda_classes"][0]
        for generic, v in raw.items()
        if v.get("fda_classes") and generic in DRUG_INFO
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"fda_class": classes, "brand_aliases": brands},
                  f, indent=2, sort_keys=True)

    print(f"fda_class:     {len(classes)}")
    print(f"brand_aliases: {len(brands)}")
    print(f"rejected:      {rejected}")
    print("written to", OUT)


if __name__ == "__main__":
    main()
