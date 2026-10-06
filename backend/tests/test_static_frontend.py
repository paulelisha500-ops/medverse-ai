"""The single-container image serves the built frontend from the API process.

Every request path that isn't an API route is mapped onto STATIC_DIR, so the
mapping is the security boundary between "the public frontend" and "anything
else on the server's disk": the SQLite database, the environment (SECRET_KEY,
API keys), system files. These tests mount the real route on a throwaway app
over a temp directory laid out like the image (static/ beside data/).
"""
import os
from urllib.parse import quote

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_frontend, resolve_static_file

INDEX = "<!doctype html><title>MedVerse AI</title>"
APP_JS = "console.log('app')"
SECRET = "SECRET_KEY=do-not-serve-me"
DB_BYTES = b"SQLite format 3\x00password hashes live here"


@pytest.fixture
def layout(tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text(INDEX)
    (static / "assets" / "app.js").write_text(APP_JS)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "medverse.db").write_bytes(DB_BYTES)
    (tmp_path / "secret.env").write_text(SECRET)
    return tmp_path


@pytest.fixture
def frontend(layout):
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_frontend(app, str(layout / "static"))
    return TestClient(app)


def _absolute_url(path):
    # "/" + the fully percent-encoded absolute path: after decoding the route
    # sees "/etc/..." (POSIX) or "C:/..." (Windows) — an absolute path, which
    # os.path.join would use in place of STATIC_DIR.
    return "/" + quote(str(path).replace("\\", "/"), safe="")


# ---- the route --------------------------------------------------------------

def test_serves_built_assets(frontend):
    res = frontend.get("/assets/app.js")
    assert res.status_code == 200
    assert res.text == APP_JS


@pytest.mark.parametrize("path", ["/", "/dashboard", "/patients/3", "/assets/missing.js"])
def test_client_routes_get_the_app_shell(frontend, path):
    res = frontend.get(path)
    assert res.status_code == 200
    assert res.text == INDEX


@pytest.mark.parametrize(
    "path",
    [
        "/..%2fsecret.env",
        "/..%2F..%2fstatic%2f..%2fsecret.env",
        "/assets%2f..%2f..%2fsecret.env",
        "/..%5csecret.env",  # backslash separator (Windows)
    ],
)
def test_traversal_never_leaves_the_static_dir(frontend, path):
    res = frontend.get(path)
    assert SECRET not in res.text
    assert res.text == INDEX


def test_database_is_not_downloadable(frontend):
    res = frontend.get("/..%2fdata%2fmedverse.db")
    assert b"password hashes" not in res.content
    assert res.text == INDEX


def test_absolute_paths_are_not_served(frontend, layout):
    res = frontend.get(_absolute_url(layout / "secret.env"))
    assert SECRET not in res.text


def test_unknown_api_paths_are_json_404s(frontend):
    for path in ("/api", "/api/does-not-exist", "/api/patients/abc/xyz"):
        res = frontend.get(path)
        assert res.status_code == 404, path
        assert res.json() == {"detail": "Not Found"}


def test_real_api_routes_still_win(frontend):
    assert frontend.get("/api/health").json() == {"status": "ok"}


# ---- the resolver -----------------------------------------------------------

def test_resolver_accepts_files_inside(layout):
    static = str(layout / "static")
    assert resolve_static_file(static, "assets/app.js") == os.path.realpath(layout / "static" / "assets" / "app.js")


@pytest.mark.parametrize("request_path", ["", ".", "assets", "nope.js", "a\x00b"])
def test_resolver_rejects_non_files(layout, request_path):
    assert resolve_static_file(str(layout / "static"), request_path) is None


def test_resolver_rejects_escapes(layout):
    static = str(layout / "static")
    for request_path in ("../secret.env", "../data/medverse.db", "assets/../../secret.env",
                         str(layout / "secret.env")):
        assert resolve_static_file(static, request_path) is None, request_path


def test_resolver_rejects_symlinks_pointing_outside(layout):
    link = layout / "static" / "innocent.txt"
    try:
        os.symlink(layout / "secret.env", link)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks need extra privileges on this platform")
    assert resolve_static_file(str(layout / "static"), "innocent.txt") is None
