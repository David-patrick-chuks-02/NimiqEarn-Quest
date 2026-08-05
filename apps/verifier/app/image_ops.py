"""Image decode / perceptual hash / OCR helpers."""

from __future__ import annotations

import base64
import io
import re

try:
    import imagehash
    from PIL import Image
except ImportError:  # pragma: no cover
    imagehash = None  # type: ignore
    Image = None  # type: ignore

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None  # type: ignore

_EDITOR_HINTS = (
    "photoshop",
    "gimp",
    "snapseed",
    "picsart",
    "lightroom",
    "pixelmator",
    "affinity",
)


def decode_data_url(proof: str) -> bytes | None:
    m = re.match(r"^data:image/[^;]+;base64,(.+)$", proof, re.I | re.S)
    if not m:
        return None
    try:
        return base64.b64decode(m.group(1), validate=False)
    except Exception:
        return None


def phash(image_bytes: bytes) -> str | None:
    if not imagehash or not Image:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes))
        return str(imagehash.phash(img))
    except Exception:
        return None


def hamming(a: str, b: str) -> int | None:
    if len(a) != len(b):
        return None
    try:
        return sum(ch1 != ch2 for ch1, ch2 in zip(a, b))
    except Exception:
        return None


def ocr_text(image_bytes: bytes) -> str:
    if not pytesseract or not Image:
        return ""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        return (pytesseract.image_to_string(img) or "").strip()
    except Exception:
        return ""


def edit_likelihood(image_bytes: bytes) -> float:
    """
    Heuristic tamper / edit likelihood from EXIF Software tags and odd metadata.
    Not forensic-grade — used to escalate suspicious screenshots.
    """
    if not Image:
        return 0.0
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif() if hasattr(img, "getexif") else None
        software = ""
        if exif:
            # 305 = Software
            software = str(exif.get(305) or "").lower()
        if any(h in software for h in _EDITOR_HINTS):
            return 0.9
        # Very small images claiming to be UI screenshots are suspicious.
        w, h = img.size
        if w * h < 40_000:
            return 0.4
        return 0.05 if software else 0.15
    except Exception:
        return 0.2


def duplicate_probability(ph: str | None, recent: list[str]) -> tuple[float, int | None]:
    """Return (duplicateProbability, nearestHashDistance)."""
    if not ph or not recent:
        return 0.0, None
    dists = [d for h in recent if (d := hamming(ph, h)) is not None]
    if not dists:
        return 0.0, None
    best = min(dists)
    dup = max(0.0, min(1.0, 1.0 - best / 20.0)) if best <= 20 else 0.0
    if best <= 5:
        dup = max(dup, 0.9)
    return dup, best
