import base64
import hashlib
import io
import json
import os
import re
import shutil
import uuid
import zipfile
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.config import Settings


MAGIC = b"KDB1"
NONCE_SIZE = 12
TAG_SIZE = 16
CHUNK_SIZE = 1024 * 1024
ENCRYPTION_LABEL = "AES-256-GCM"


class BackupStorage:
    def __init__(self, config: Settings):
        self.config = config
        self.base_dir = os.path.abspath(config.backup_storage_dir)

    def ensure_dir(self) -> None:
        os.makedirs(self.base_dir, exist_ok=True)

    def _key(self) -> bytes:
        raw = (self.config.backup_encryption_key or "").strip()
        if raw:
            if len(raw) == 64:
                try:
                    return bytes.fromhex(raw)
                except ValueError:
                    pass
            try:
                decoded = base64.b64decode(raw, validate=True)
                if len(decoded) == 32:
                    return decoded
            except Exception:
                pass
            return hashlib.sha256(raw.encode("utf-8")).digest()
        seed = f"kudiba-tenant-backup:{self.config.jwt_secret}".encode("utf-8")
        return hashlib.sha256(seed).digest()

    def _resolve_tenant_dir(
        self, tenant_id: uuid.UUID, custom_folder: Optional[str] = None
    ) -> str:
        self.ensure_dir()
        if custom_folder and custom_folder.strip():
            raw = custom_folder.strip().replace("\\", "/")
            raw = re.sub(r"^[A-Za-z]:", "", raw)
            parts = [
                re.sub(r"[^A-Za-z0-9._-]", "_", part.strip())
                for part in raw.split("/")
                if part.strip() and part.strip() not in (".", "..")
            ]
            if parts:
                candidate = os.path.realpath(os.path.join(self.base_dir, *parts))
                base = os.path.realpath(self.base_dir)
                if candidate.startswith(base + os.sep):
                    os.makedirs(candidate, exist_ok=True)
                    return candidate
        tenant_dir = os.path.join(self.base_dir, str(tenant_id))
        os.makedirs(tenant_dir, exist_ok=True)
        return tenant_dir

    def store(
        self,
        source_zip: str,
        tenant_id: uuid.UUID,
        backup_id: uuid.UUID,
        custom_folder: Optional[str] = None,
    ) -> Dict[str, object]:
        tenant_dir = self._resolve_tenant_dir(tenant_id, custom_folder)
        file_name = f"{backup_id}.zip.enc"
        final_path = os.path.join(tenant_dir, file_name)
        temp_path = f"{final_path}.tmp"

        nonce = os.urandom(NONCE_SIZE)
        encryptor = Cipher(algorithms.AES(self._key()), modes.GCM(nonce)).encryptor()
        digest = hashlib.sha256()
        size_bytes = 0

        try:
            with open(source_zip, "rb") as source, open(temp_path, "wb") as target:
                header = MAGIC + nonce
                target.write(header)
                digest.update(header)
                size_bytes += len(header)

                for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
                    encrypted = encryptor.update(chunk)
                    target.write(encrypted)
                    digest.update(encrypted)
                    size_bytes += len(encrypted)

                tail = encryptor.finalize() + encryptor.tag
                target.write(tail)
                digest.update(tail)
                size_bytes += len(tail)

            os.replace(temp_path, final_path)
        except Exception:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise

        return {
            "file_name": file_name,
            "file_path": final_path,
            "size_bytes": size_bytes,
            "sha256": digest.hexdigest(),
            "encryption": ENCRYPTION_LABEL,
        }

    def resolve(self, file_path: str) -> str:
        base = os.path.realpath(self.base_dir)
        target = os.path.realpath(file_path)
        if target != base and not target.startswith(base + os.sep):
            raise ValueError("Caminho de backup invalido")
        if not os.path.isfile(target):
            raise FileNotFoundError("Ficheiro de backup nao encontrado")
        return target

    def delete(self, file_path: str) -> None:
        try:
            target = self.resolve(file_path)
        except (ValueError, FileNotFoundError):
            return
        try:
            os.unlink(target)
        except OSError:
            pass
        if target.endswith(".zip.enc"):
            plain_companion = target[:-4]
            if os.path.isfile(plain_companion):
                try:
                    os.unlink(plain_companion)
                except OSError:
                    pass

    def decrypt_bytes(self, raw: bytes) -> bytes:
        if raw.startswith(b"PK\x03\x04") or raw.startswith(b"PK\x05\x06"):
            return raw
        min_len = len(MAGIC) + NONCE_SIZE + TAG_SIZE
        if len(raw) < min_len or not raw.startswith(MAGIC):
            raise ValueError("Formato de ficheiro de backup inválido ou corrompido")
        nonce = raw[len(MAGIC) : len(MAGIC) + NONCE_SIZE]
        ciphertext_and_tag = raw[len(MAGIC) + NONCE_SIZE :]
        try:
            return AESGCM(self._key()).decrypt(nonce, ciphertext_and_tag, None)
        except Exception as exc:
            raise ValueError(
                "Falha ao decifrar o backup (chave de cifra inválida ou ficheiro adulterado)"
            ) from exc

    def decrypt_to_file(self, source_path: str, target_zip_path: str) -> str:
        with open(source_path, "rb") as src_Check:
            prefix = src_Check.read(4)
        if prefix in (b"PK\x03\x04", b"PK\x05\x06"):
            shutil.copyfile(source_path, target_zip_path)
            return target_zip_path
        if prefix != MAGIC:
            raise ValueError("Formato de ficheiro de backup inválido ou corrompido")

        file_size = os.path.getsize(source_path)
        header_size = len(MAGIC) + NONCE_SIZE
        if file_size < header_size + TAG_SIZE:
            raise ValueError("Ficheiro de backup truncado ou corrompido")

        with open(source_path, "rb") as source:
            source.seek(len(MAGIC))
            nonce = source.read(NONCE_SIZE)
            source.seek(file_size - TAG_SIZE)
            tag = source.read(TAG_SIZE)
            source.seek(header_size)

            remaining = file_size - header_size - TAG_SIZE
            decryptor = Cipher(
                algorithms.AES(self._key()), modes.GCM(nonce, tag)
            ).decryptor()

            temp_out = f"{target_zip_path}.tmp"
            try:
                with open(temp_out, "wb") as out:
                    while remaining > 0:
                        chunk = source.read(min(CHUNK_SIZE, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        out.write(decryptor.update(chunk))
                    out.write(decryptor.finalize())
                os.replace(temp_out, target_zip_path)
            except Exception as exc:
                if os.path.exists(temp_out):
                    os.unlink(temp_out)
                raise ValueError(
                    "Falha ao decifrar o backup (chave de cifra inválida ou ficheiro adulterado)"
                ) from exc

        return target_zip_path

    def read_manifest(self, file_path: str) -> Dict[str, Any]:
        resolved = self.resolve(file_path)
        with open(resolved, "rb") as handle:
            raw = handle.read()
        zip_bytes = self.decrypt_bytes(raw)
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as archive:
            manifest_bytes = archive.read("manifest.json")
        return json.loads(manifest_bytes.decode("utf-8"))

    def lock_path(self) -> str:
        self.ensure_dir()
        return os.path.join(self.base_dir, ".scheduler.lock")
