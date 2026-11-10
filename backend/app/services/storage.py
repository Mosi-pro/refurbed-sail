"""Upload handling: size limits, server-side type validation, re-encoding and thumbnails."""
import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from ..core.config import get_settings

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 60_000_000  # guard against decompression bombs


def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = upload.file.read(1024 * 256)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(413, f"Die Datei ist zu groß (maximal {max_bytes // (1024 * 1024)} MB).")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(400, "Die Datei ist leer.")
    return b"".join(chunks)


def _open_image(data: bytes) -> Image.Image:
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_IMAGE_FORMATS:
            raise HTTPException(415, "Erlaubt sind nur JPEG-, PNG- und WebP-Bilder.")
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(415, "Die Datei ist kein gültiges Bild (JPEG, PNG oder WebP).")


def _save_jpeg(img: Image.Image, path: Path, max_side: int, quality: int = 86) -> tuple[int, int]:
    out = img.copy()
    out.thumbnail((max_side, max_side), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Re-encoding drops EXIF metadata (e.g. GPS positions) from uploads.
    out.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    return out.size


def save_public_image(upload: UploadFile, folder: str, max_side: int = 2400, thumb_side: int = 900) -> dict:
    """Validate and store an image below uploads/public. Returns relative paths."""
    s = get_settings()
    img = _open_image(_read_limited(upload, s.max_image_mb * 1024 * 1024))
    return store_public_pil(img, folder, max_side, thumb_side)


def store_public_pil(img: Image.Image, folder: str, max_side: int = 2400, thumb_side: int = 900) -> dict:
    s = get_settings()
    name = uuid.uuid4().hex
    rel, rel_thumb = f"{folder}/{name}.jpg", f"{folder}/{name}_t.jpg"
    w, h = _save_jpeg(img, s.public_upload_dir / rel, max_side)
    _save_jpeg(img, s.public_upload_dir / rel_thumb, thumb_side, quality=80)
    return {"path": rel, "thumb_path": rel_thumb, "width": w, "height": h}


def save_private_document(upload: UploadFile, folder: str) -> dict:
    """Store a PDF or supporting image below uploads/private (never served statically)."""
    s = get_settings()
    data = _read_limited(upload, s.max_document_mb * 1024 * 1024)
    name = uuid.uuid4().hex
    if data[:5] == b"%PDF-":
        rel, kind, mime = f"{folder}/{name}.pdf", "pdf", "application/pdf"
        path = s.private_upload_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        size = len(data)
    else:
        try:
            img = _open_image(data)
        except HTTPException:
            raise HTTPException(415, "Erlaubt sind PDF-Dokumente sowie JPEG-, PNG- und WebP-Bilder.")
        rel, kind, mime = f"{folder}/{name}.jpg", "image", "image/jpeg"
        _save_jpeg(img, s.private_upload_dir / rel, 2400)
        size = (s.private_upload_dir / rel).stat().st_size
    return {"path": rel, "kind": kind, "mime": mime, "size_bytes": size}


def delete_public(*rel_paths: str | None) -> None:
    _delete(get_settings().public_upload_dir, rel_paths)


def delete_private(*rel_paths: str | None) -> None:
    _delete(get_settings().private_upload_dir, rel_paths)


def _delete(base: Path, rel_paths) -> None:
    base = base.resolve()
    for rel in rel_paths:
        if not rel:
            continue
        p = (base / rel).resolve()
        if base in p.parents and p.is_file():
            p.unlink(missing_ok=True)
