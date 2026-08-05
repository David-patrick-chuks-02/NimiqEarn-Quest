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
    Tamper / edit likelihood from EXIF Software tags, size heuristics, and
    a lightweight JPEG re-encode residual (ELA-style).
    """
    if not Image:
        return 0.0
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif() if hasattr(img, "getexif") else None
        software = ""
        if exif:
            software = str(exif.get(305) or "").lower()
        score = 0.05 if software else 0.15
        if any(h in software for h in _EDITOR_HINTS):
            score = max(score, 0.9)
        w, h = img.size
        if w * h < 40_000:
            score = max(score, 0.4)

        # ELA-lite: large residual after re-encode suggests local edits / overlays.
        ela = compression_residual_score(img)
        score = max(score, ela)
        return max(0.0, min(1.0, score))
    except Exception:
        return 0.2


def compression_residual_score(img: "Image.Image") -> float:
    """
    Re-encode as JPEG q=90 and measure mean absolute pixel residual.
    Homogeneous camera JPEGs re-encode cleanly; patched regions leave larger deltas.
    """
    if not Image:
        return 0.0
    try:
        rgb = img.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        recompressed = Image.open(buf).convert("RGB")
        if rgb.size != recompressed.size:
            return 0.0
        # Sample pixels for speed.
        w, h = rgb.size
        step = max(1, int((w * h) / 20_000))
        total = 0.0
        count = 0
        px_a = rgb.load()
        px_b = recompressed.load()
        for y in range(0, h, step):
            for x in range(0, w, step):
                a = px_a[x, y]
                b = px_b[x, y]
                total += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
                count += 1
        if count == 0:
            return 0.0
        mean = total / (count * 3)
        # Typical clean residual ~1–4; edited patches often >> 8.
        if mean < 4:
            return 0.05
        if mean < 8:
            return 0.35
        if mean < 16:
            return 0.65
        return 0.85
    except Exception:
        return 0.0


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


def template_match_score(submission_bytes: bytes, sample_bytes: bytes) -> float:
    """
    Cheap UI template match: compare perceptual hashes of submission vs creator sample.
    1.0 = near-identical layout; used to boost confidence for screenshot quests.
    """
    a = phash(submission_bytes)
    b = phash(sample_bytes)
    if not a or not b:
        return 0.0
    dist = hamming(a, b)
    if dist is None:
        return 0.0
    return max(0.0, min(1.0, 1.0 - dist / 20.0))
