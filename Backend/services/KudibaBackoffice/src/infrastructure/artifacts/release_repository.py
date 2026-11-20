import asyncio
import hashlib
from pathlib import Path
from typing import Dict, List, Optional

from src.domain.entities import BridgeRelease
from src.domain.ports import IBridgeReleaseRepository


class FilesystemBridgeReleaseRepository(IBridgeReleaseRepository):
    _FILENAMES: Dict[str, str] = {
        "windows-x64": "kudiba-hardware-bridge-windows-x64.exe",
        "linux-x64": "kudiba-hardware-bridge-linux-x64",
    }

    def __init__(self, root: Path):
        self.root = root

    def _version(self) -> str:
        version_file = self.root / "VERSION"
        if version_file.is_file():
            value = version_file.read_text(encoding="utf-8").strip()
            if value:
                return value
        return "0.4.0"

    def _path(self, platform: str) -> Optional[Path]:
        filename = self._FILENAMES.get(platform)
        if not filename:
            return None
        candidate = self.root / filename
        return candidate if candidate.is_file() else None

    def _release(self, platform: str, path: Path, version: str) -> BridgeRelease:
        payload = path.read_bytes()
        return BridgeRelease(
            platform=platform,
            version=version,
            filename=path.name,
            size_bytes=len(payload),
            sha256=hashlib.sha256(payload).hexdigest(),
            path=str(path),
        )

    async def list_releases(self) -> List[BridgeRelease]:
        version = await asyncio.to_thread(self._version)
        releases: List[BridgeRelease] = []
        for platform, filename in self._FILENAMES.items():
            path = self.root / filename
            if not path.is_file():
                continue
            release = await asyncio.to_thread(self._release, platform, path, version)
            releases.append(release)
        return releases

    async def get_release(self, platform: str) -> Optional[BridgeRelease]:
        path = await asyncio.to_thread(self._path, platform)
        if path is None:
            return None
        version = await asyncio.to_thread(self._version)
        return await asyncio.to_thread(self._release, platform, path, version)

    async def read_release(self, platform: str) -> Optional[bytes]:
        path = await asyncio.to_thread(self._path, platform)
        if path is None:
            return None
        return await asyncio.to_thread(path.read_bytes)
