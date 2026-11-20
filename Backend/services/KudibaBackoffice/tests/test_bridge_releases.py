import hashlib
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from src.application.queries import ListBridgeReleasesUseCase
from src.infrastructure.artifacts.release_repository import FilesystemBridgeReleaseRepository
from src.main import app
from src.presentation.http.deps import SecurityContext, get_security_context


@pytest.fixture
def release_dir(tmp_path):
    (tmp_path / "VERSION").write_text("1.2.3", encoding="utf-8")
    (tmp_path / "kudiba-hardware-bridge-windows-x64.exe").write_bytes(b"windows-binary")
    (tmp_path / "kudiba-hardware-bridge-linux-x64").write_bytes(b"linux-binary")

    previous_repo = app.state.app_state.bridge_release_repo
    previous_use_case = app.state.app_state.list_bridge_releases
    repo = FilesystemBridgeReleaseRepository(tmp_path)
    app.state.app_state.bridge_release_repo = repo
    app.state.app_state.list_bridge_releases = ListBridgeReleasesUseCase(repo)

    async def authenticated_context():
        return SecurityContext(user_id=uuid.uuid4(), claims={})

    app.dependency_overrides[get_security_context] = authenticated_context
    yield tmp_path
    app.dependency_overrides.clear()
    app.state.app_state.bridge_release_repo = previous_repo
    app.state.app_state.list_bridge_releases = previous_use_case


@pytest.mark.asyncio
async def test_bridge_releases_require_authentication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/bridge/releases")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_bridge_releases(release_dir):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/bridge/releases")

    assert response.status_code == 200
    data = response.json()
    assert {item["platform"] for item in data} == {"windows-x64", "linux-x64"}
    assert all(item["version"] == "1.2.3" for item in data)
    windows = next(item for item in data if item["platform"] == "windows-x64")
    assert windows["filename"] == "kudiba-hardware-bridge-windows-x64.exe"
    assert windows["size_bytes"] == len(b"windows-binary")
    assert windows["sha256"] == hashlib.sha256(b"windows-binary").hexdigest()
    assert windows["download_url"].endswith("/windows-x64/download")


@pytest.mark.asyncio
async def test_download_bridge_release(release_dir):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/bridge/releases/windows-x64/download")

    assert response.status_code == 200
    assert response.content == b"windows-binary"
    assert response.headers["content-type"] == "application/octet-stream"
    assert 'filename="kudiba-hardware-bridge-windows-x64.exe"' in response.headers[
        "content-disposition"
    ]
    assert response.headers["x-bridge-version"] == "1.2.3"
    assert response.headers["x-checksum-sha256"] == hashlib.sha256(b"windows-binary").hexdigest()


@pytest.mark.asyncio
async def test_download_unknown_bridge_platform_returns_404(release_dir):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/bridge/releases/macos-arm64/download")

    assert response.status_code == 404
