"""The single-container build serves the React app from STATIC_DIR.

Regression: the catch-all joined the URL-decoded path straight onto STATIC_DIR,
so "/..%2fdata%2fmedverse.db" downloaded the whole database and
"/proc/self/environ" (SECRET_KEY, API keys) was one more "../" away.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_spa, resolve_static_file


@pytest.fixture
def layout(tmp_path):
    # Mirrors the Space image: /app/static next to /app/data.
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>spa</html>")
    (static / "assets" / "app.js").write_text("console.log('app')")
    data = tmp_path / "data"
    data.mkdir()
    (data / "medverse.db").write_text("SECRET DATABASE")
    return static


@pytest.fixture
def spa_client(layout):
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_spa(app, str(layout))
    return TestClient(app)


def test_serves_built_assets(spa_client):
    res = spa_client.get("/assets/app.js")
    assert res.status_code == 200
    assert "console.log" in res.text


@pytest.mark.parametrize("path", ["/", "/dashboard", "/patients/3"])
def test_client_side_routes_fall_back_to_index(spa_client, path):
    res = spa_client.get(path)
    assert res.status_code == 200
    assert res.text == "<html>spa</html>"


@pytest.mark.parametrize(
    "path",
    [
        "/..%2fdata%2fmedverse.db",
        "/%2e%2e/data/medverse.db",
        "/assets/..%2f..%2fdata%2fmedverse.db",
        "/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    ],
)
def test_encoded_traversal_cannot_escape_static_dir(spa_client, path):
    res = spa_client.get(path)
    assert "SECRET DATABASE" not in res.text
    assert "root:" not in res.text
    assert res.text == "<html>spa</html>"


def test_absolute_path_cannot_escape_static_dir(layout):
    assert resolve_static_file(str(layout), "/etc/passwd") is None
    assert resolve_static_file(str(layout), "../data/medverse.db") is None
    assert resolve_static_file(str(layout), "assets/app.js").endswith("app.js")


def test_symlink_out_of_static_dir_is_not_followed(layout):
    (layout / "leak").symlink_to(layout.parent / "data" / "medverse.db")
    assert resolve_static_file(str(layout), "leak") is None


def test_unknown_api_route_is_a_json_404_not_the_spa(spa_client):
    assert spa_client.get("/api/health").json() == {"status": "ok"}
    res = spa_client.get("/api/does-not-exist")
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
