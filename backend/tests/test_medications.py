from tests.conftest import auth


def check(client, token, meds):
    res = client.post("/api/medications/check", json={"medications": meds}, headers=auth(token))
    assert res.status_code == 200, res.text
    return res.json()["interactions"]


def test_known_interaction_is_found(client, tokens):
    found = check(client, tokens["patient"], ["warfarin", "aspirin"])
    assert len(found) == 1
    assert found[0]["severity"] == "high"


def test_brand_names_resolve_to_generics(client, tokens):
    assert check(client, tokens["patient"], ["Coumadin", "aspirin"])


def test_near_miss_spellings_still_match(client, tokens):
    assert check(client, tokens["patient"], ["warfarn", "asprin"])


def test_blank_entries_do_not_shift_the_pairing(client, tokens):
    # Regression: blanks were filtered out of the normalized list but not out
    # of the originals it was indexed against, which paired the wrong names.
    found = check(client, tokens["patient"], ["warfarin", "", "aspirin"])
    assert len(found) == 1
    assert {found[0]["drug_a"], found[0]["drug_b"]} == {"warfarin", "aspirin"}


def test_pair_with_no_documented_interaction_reports_none(client, tokens):
    # Paracetamol + amiodarone has no pair in the curated set. Reporting zero is
    # the correct answer, not a gap to fill with an invented interaction.
    assert check(client, tokens["patient"], ["panadol", "pacerone"]) == []


def test_directory_tiers_are_consistent_with_the_curated_data(client, tokens):
    from app.nlp.medication_data import DRUG_INFO

    drugs = client.get("/api/medications/directory", headers=auth(tokens["patient"])).json()["drugs"]
    curated = [d for d in drugs if d["tier"] == "curated"]
    reference = [d for d in drugs if d["tier"] == "reference"]

    assert len(curated) == len(DRUG_INFO)
    assert len(curated) + len(reference) == len(drugs)
    assert len({d["name"] for d in drugs}) == len(drugs), "duplicate names in the directory"


def test_reference_tier_never_carries_an_invented_dosing_regimen(client, tokens):
    # Reference entries come from the FDA directory, which has no dosing. They
    # must point to product labeling rather than show a made-up regimen.
    drugs = client.get("/api/medications/directory", headers=auth(tokens["patient"])).json()["drugs"]
    for drug in drugs:
        if drug["tier"] == "reference":
            assert "refer to product labeling" in drug["dosage"], drug


def convert(client, token, family, from_drug, to_drug, dose):
    return client.post(
        "/api/medications/convert",
        json={"family": family, "from_drug": from_drug, "to_drug": to_drug, "dose_mg": dose},
        headers=auth(token),
    )


def test_opioid_conversion_uses_mme_factors(client, tokens):
    # 30 mg oral morphine = 30 MME; oxycodone's factor is 1.5, so 20 mg.
    res = convert(client, tokens["patient"], "opioid", "morphine", "oxycodone", 30)
    assert res.status_code == 200
    assert res.json()["converted_mg"] == 20.0


def test_steroid_conversion(client, tokens):
    # Prednisone 5 mg is equivalent to dexamethasone 0.75 mg, so 50 mg -> 7.5 mg.
    res = convert(client, tokens["patient"], "corticosteroid", "prednisone", "dexamethasone", 50)
    assert res.status_code == 200
    assert res.json()["converted_mg"] == 7.5


def test_fentanyl_conversion_is_refused_not_approximated(client, tokens):
    res = convert(client, tokens["patient"], "opioid", "fentanyl", "morphine", 25)
    assert res.status_code == 400


def test_conversion_rejects_negative_dose(client, tokens):
    res = convert(client, tokens["patient"], "opioid", "morphine", "oxycodone", -1)
    assert res.status_code == 422
