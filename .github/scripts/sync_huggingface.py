"""Mirror this checkout to Hugging Face, then test the deployed Space.

Run by .github/workflows/sync-huggingface.yml after CI passes on main:

1. Model repo (HF_REPO_ID): upload the checkout and delete files that no
   longer exist on GitHub, so it can't keep serving stale code.
2. Space (HF_SPACE_ID): created on the first run as a private Docker Space
   with a random SECRET_KEY secret, so logins survive restarts. Then the same
   upload.
3. Wait for the Space to build and run the new commit, then smoke-test it over
   HTTPS: health, frontend routing, the path-traversal fix, login, report
   analysis and the assistant.

Needs HF_TOKEN with write access to the account's repos.
"""
import os
import secrets
import sys
import time

import requests
from huggingface_hub import HfApi
from huggingface_hub.errors import HfHubHTTPError

REPO_ID = os.environ.get("HF_REPO_ID", "Elisha622/medverse-ai")
SPACE_ID = os.environ.get("HF_SPACE_ID", "Elisha622/medverse-ai")
SYNC_SHA = os.environ.get("SYNC_SHA", "unknown")
FOLDER = os.environ.get("SYNC_FOLDER", ".")

# .git is skipped by upload_folder already; workflows mean nothing on the Hub.
IGNORE = [".github/*", ".git/*"]
# Mirror deletions too. upload_folder never deletes .gitattributes.
DELETE = ["*"]

BUILD_TIMEOUT_SECONDS = 30 * 60
POLL_SECONDS = 20
FAILED_STAGES = {"BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR", "NO_APP_FILE", "PAUSED", "STOPPED", "DELETING"}
BUILDING_STAGES = {"BUILDING", "RUNNING_BUILDING", "APP_STARTING", "RUNNING_APP_STARTING"}

SAMPLE_REPORT = "HbA1c: 6.7%. Assessment: prediabetes. Prescribed: Metformin 500mg twice daily."


def log(message: str) -> None:
    print(message, flush=True)


def summary(line: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def space_url(space_id: str) -> str:
    # Elisha622/medverse-ai -> https://elisha622-medverse-ai.hf.space
    return "https://" + space_id.replace("/", "-").replace("_", "-").replace(".", "-").lower() + ".hf.space"


def upload(api: HfApi, repo_id: str, repo_type: str) -> str:
    log(f"Uploading to {repo_type} {repo_id} ...")
    info = api.upload_folder(
        repo_id=repo_id,
        repo_type=repo_type,
        folder_path=FOLDER,
        commit_message=f"Sync from GitHub {SYNC_SHA[:7]}",
        commit_description=f"https://github.com/paulelisha500-ops/medverse-ai/commit/{SYNC_SHA}",
        ignore_patterns=IGNORE,
        delete_patterns=DELETE,
    )
    log(f"  done: {info.commit_url}")
    return info.oid


def ensure_space(api: HfApi) -> None:
    if api.repo_exists(SPACE_ID, repo_type="space"):
        log(f"Space {SPACE_ID} exists.")
        return
    log(f"Creating private Docker Space {SPACE_ID} with a SECRET_KEY secret ...")
    api.create_repo(
        SPACE_ID,
        repo_type="space",
        space_sdk="docker",
        private=True,
        space_secrets=[{"key": "SECRET_KEY", "value": secrets.token_hex(32)}],
    )


def wait_for_space(api: HfApi, commit_oid: str) -> None:
    """Returns once the Space runs commit_oid (or, when the runtime doesn't
    report its commit, once a build has finished)."""
    start = time.monotonic()
    saw_build = False
    last = None
    while time.monotonic() - start < BUILD_TIMEOUT_SECONDS:
        runtime = api.get_space_runtime(SPACE_ID)
        stage = str(runtime.stage)
        running_sha = (runtime.raw or {}).get("sha")
        if (stage, running_sha) != last:
            log(f"  stage={stage} running={running_sha or '?'}")
            last = (stage, running_sha)
        if stage in FAILED_STAGES:
            sys.exit(
                f"Space is {stage}. See the build/runtime logs at "
                f"https://huggingface.co/spaces/{SPACE_ID}?logs=build"
            )
        if stage in BUILDING_STAGES:
            saw_build = True
        if stage == "RUNNING":
            if running_sha and running_sha == commit_oid:
                return
            if not running_sha and saw_build:
                return
            # Nothing changed, so nothing rebuilt: the running app is current.
            if not running_sha and time.monotonic() - start > 180:
                return
        time.sleep(POLL_SECONDS)
    sys.exit(f"Timed out after {BUILD_TIMEOUT_SECONDS // 60} min waiting for the Space to run {commit_oid[:7]}.")


def connect(api: HfApi, token: str, base: str):
    """Waits for /api/health and returns (session, mode, health).

    A private Space sits behind Hugging Face's proxy, which needs the owner's
    token. The app needs its own JWT in the same Authorization header, so the
    proxy is passed with the signed cookie the Hub's own embed uses
    (?__sign=<space jwt>). If that doesn't work, a bearer-token session still
    reaches the public endpoints, and mode says the logged-in checks can't run.
    """
    private = bool(getattr(api.space_info(SPACE_ID), "private", True))
    bearer = {"Authorization": f"Bearer {token}"}
    last = "no response"
    # The app opens its port once startup (model load, seeding) completes.
    for _ in range(30):
        candidates = []
        if not private:
            candidates.append(("public", requests.Session()))
        else:
            signed = requests.Session()
            try:
                jwt = requests.get(
                    f"https://huggingface.co/api/spaces/{SPACE_ID}/jwt", headers=bearer, timeout=30
                ).json()["token"]
                signed.get(f"{base}/?__sign={jwt}", timeout=30)
                candidates.append(("cookie", signed))
            except (requests.RequestException, ValueError, KeyError) as exc:
                last = f"space jwt: {exc}"
            plain = requests.Session()
            plain.headers.update(bearer)
            candidates.append(("bearer", plain))
        for mode, session in candidates:
            try:
                res = session.get(f"{base}/api/health", timeout=30)
                if res.status_code == 200 and "application/json" in res.headers.get("content-type", ""):
                    return session, mode, res.json()
                last = f"{mode}: HTTP {res.status_code}"
            except requests.RequestException as exc:
                last = f"{mode}: {exc}"
        log(f"  waiting for /api/health ({last})")
        time.sleep(10)
    sys.exit(f"FAIL: {base}/api/health never answered ({last})")


def smoke_test(api: HfApi, token: str) -> None:
    base = os.environ.get("HF_SPACE_URL") or space_url(SPACE_ID)
    log(f"Smoke-testing {base}")

    def check(condition: bool, message: str) -> None:
        if not condition:
            sys.exit(f"FAIL: {message}")
        log(f"  ok: {message}")

    session, mode, health = connect(api, token, base)
    check(health.get("status") == "ok", f"/api/health responds via {mode} access ({health})")
    check(health.get("retrieval") == "semantic", "embedding model loaded (retrieval=semantic)")

    check('<div id="root">' in session.get(f"{base}/", timeout=30).text, "frontend served at /")
    check('<div id="root">' in session.get(f"{base}/dashboard", timeout=30).text, "client-side routes fall back to index.html")
    check(session.get(f"{base}/api/does-not-exist", timeout=30).status_code == 404, "unknown API route is a 404")

    for path in ("/..%2fdata%2fmedverse.db", "/%2e%2e/data/medverse.db", "/..%2f..%2fproc%2fself%2fenviron"):
        body = session.get(base + path, timeout=30).content
        check(b"SQLite format" not in body and b"SECRET_KEY" not in body, f"no file leak via {path}")

    if mode == "bearer":
        # The app's JWT would have to replace the HF token in the same header.
        log("::warning::Private Space reachable only with the HF token header, so the logged-in checks "
            "(login, report analysis, assistant) were skipped. They run in CI against the same image.")
        summary("- Logged-in checks skipped: private Space only reachable with the HF token header.")
        return

    res = session.post(
        f"{base}/api/auth/login", data={"username": "doctor@medverse.ai", "password": "Doctor@123"}, timeout=30
    )
    check(res.status_code == 200, "doctor login")
    auth = {"Authorization": f"Bearer {res.json()['access_token']}"}

    report = session.post(f"{base}/api/reports/analyze", json={"text": SAMPLE_REPORT}, headers=auth, timeout=60)
    check(report.status_code == 200, "report analysis responds")
    entities = report.json()["entities"]
    check(bool(entities["medications"]), f"medications extracted {entities['medications']}")
    check("Prediabetes" in entities["diagnoses"], f"diagnosis extracted {entities['diagnoses']}")

    chat = session.post(
        f"{base}/api/assistant/chat", json={"message": "What are the warning signs of a stroke?"}, headers=auth, timeout=60
    )
    check(chat.status_code == 200 and bool(chat.json()["sources"]), "assistant answers with sources")


def main() -> None:
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        sys.exit("HF_TOKEN is not set.")
    api = HfApi(token=token)

    try:
        user = api.whoami()["name"]
        log(f"Authenticated to Hugging Face as {user}")
        upload(api, REPO_ID, "model")
        ensure_space(api)
        commit_oid = upload(api, SPACE_ID, "space")
        log("Waiting for the Space to build ...")
        wait_for_space(api, commit_oid)
    except HfHubHTTPError as err:
        status = err.response.status_code if err.response is not None else "?"
        hint = {
            401: "HF_TOKEN is invalid or expired. Create a new token and update the GitHub secret.",
            403: "HF_TOKEN can't write. Use a 'Write' token, or for a fine-grained token tick "
                 "'Write access to contents/settings of all repos under your personal namespace'.",
        }.get(status, "")
        sys.exit(f"Hugging Face API error {status}: {err}\n{hint}")

    smoke_test(api, token)

    log("Hugging Face sync and live Space test passed.")
    summary(f"### Hugging Face sync: passed ({SYNC_SHA[:7]})")
    summary(f"- Model repo: https://huggingface.co/{REPO_ID}")
    summary(f"- Space: https://huggingface.co/spaces/{SPACE_ID} ({os.environ.get('HF_SPACE_URL') or space_url(SPACE_ID)})")


if __name__ == "__main__":
    main()
