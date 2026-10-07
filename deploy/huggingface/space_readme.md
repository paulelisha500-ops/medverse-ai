---
title: MedVerse AI
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: static
pinned: true
license: mit
short_description: Clinical intelligence platform that runs in your browser
---

# MedVerse AI

A clinical intelligence platform: a grounded health assistant, medical report
understanding, disease-risk models and a medication interaction checker, behind
role-based dashboards for patients, doctors and admins.

**Open the app:** <https://elisha622-medverse-ai.static.hf.space>

Sign in with one click as a patient, doctor or admin from the sign-in screen,
or create your own patient account.

## How this edition runs

This Space is a static site with no server process. It is the same React
application as the self-hosted platform, with every API call answered in the
browser:

- **Assistant**: all-MiniLM-L6-v2 runs on your device through Transformers.js
  and ranks the same knowledge base the API indexes. Answers quote the passages
  they come from and list them as sources. The model (about 25 MB) downloads
  on first use and is cached.
- **Report analysis**: lab values come out with the API's own patterns;
  diagnoses, medications and the patient and clinical summaries are produced
  on the device against standard reference ranges.
- **Risk check**: the API's trained logistic-regression models, exported and
  evaluated in the browser, with identical scores.
- **Medication checker**: live lookups of official FDA drug labels (openFDA)
  and RxNorm, made directly from the browser, backed by 230 hand-reviewed
  interaction pairs.
- **Your data**: accounts, records, chats and reminders are kept in this
  browser's storage. The only outside requests are the model download and the
  drug-label lookups.

Source: [github.com/paulelisha500-ops/medverse-ai](https://github.com/paulelisha500-ops/medverse-ai).
This Space is deployed from the `main` branch by GitHub Actions.

For education only: MedVerse is not a medical device, and its risk scores,
report summaries and assistant answers are not diagnoses.
