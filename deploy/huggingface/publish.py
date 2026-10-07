"""
Publish MedVerse to the Hugging Face Hub (run by .github/workflows/deploy.yml).

    python deploy/huggingface/publish.py space frontend/dist-browser
        The browser edition, as a free static Space.

    python deploy/huggingface/publish.py mirror
        The repository itself, mirrored into the model repo so the Hub copy
        always matches GitHub's main branch.

Needs HF_TOKEN (a write token) in the environment; the token is never printed.
"""
import argparse
import os
import shutil
import sys
import tempfile

from huggingface_hub import HfApi

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
SPACE_ID = os.environ.get("HF_SPACE_ID", "Elisha622/medverse-ai")
MODEL_REPO_ID = os.environ.get("HF_MODEL_REPO_ID", "Elisha622/medverse-ai")


def _api() -> HfApi:
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN is not set")
    return HfApi(token=token)


def _from_commit() -> str:
    sha = os.environ.get("GITHUB_SHA", "")[:7]
    return f" from GitHub {sha}" if sha else ""


def publish_space(build_dir: str) -> None:
    if not os.path.isfile(os.path.join(build_dir, "index.html")):
        sys.exit(f"{build_dir} has no index.html; run `npm run build:browser` in frontend/ first")
    api = _api()
    api.create_repo(SPACE_ID, repo_type="space", space_sdk="static", exist_ok=True)
    with tempfile.TemporaryDirectory() as stage:
        shutil.copytree(build_dir, stage, dirs_exist_ok=True)
        shutil.copyfile(os.path.join(HERE, "space_readme.md"), os.path.join(stage, "README.md"))
        api.upload_folder(
            repo_id=SPACE_ID,
            repo_type="space",
            folder_path=stage,
            commit_message=f"Deploy the browser edition{_from_commit()}",
            # Asset names carry a content hash and change with every build, so
            # clear out the previous build's files (.gitattributes is kept).
            delete_patterns="*",
        )
    print(f"Published https://huggingface.co/spaces/{SPACE_ID}")


def mirror_repo() -> None:
    api = _api()
    api.create_repo(MODEL_REPO_ID, repo_type="model", exist_ok=True)
    api.upload_folder(
        repo_id=MODEL_REPO_ID,
        repo_type="model",
        folder_path=REPO_ROOT,
        commit_message=f"Sync with GitHub main{_from_commit()}",
        # A CI checkout holds only tracked files; these guard local runs.
        ignore_patterns=["**/node_modules/**", "frontend/dist*/**", "backend/data/*.db", "**/__pycache__/**"],
        # Files deleted on GitHub are deleted here too.
        delete_patterns="*",
    )
    print(f"Mirrored to https://huggingface.co/{MODEL_REPO_ID}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="target", required=True)
    space = sub.add_parser("space", help="publish the browser edition as a static Space")
    space.add_argument("build_dir")
    sub.add_parser("mirror", help="mirror the repository into the model repo")
    args = parser.parse_args()
    if args.target == "space":
        publish_space(args.build_dir)
    else:
        mirror_repo()


if __name__ == "__main__":
    main()
