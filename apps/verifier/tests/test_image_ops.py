from __future__ import annotations

import base64
import io

from PIL import Image

from app.image_ops import decode_data_url, duplicate_probability, hamming, phash


def _png_data_url(color: tuple[int, int, int] = (255, 0, 0)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def test_decode_data_url_ok():
    raw = decode_data_url(_png_data_url())
    assert raw is not None
    assert len(raw) > 20


def test_decode_data_url_invalid():
    assert decode_data_url("not-an-image") is None
    assert decode_data_url("data:text/plain;base64,YQ==") is None


def test_phash_stable_for_same_image():
    raw = decode_data_url(_png_data_url())
    assert raw is not None
    a = phash(raw)
    b = phash(raw)
    assert a is not None
    assert a == b


def test_hamming_identical():
    assert hamming("abcd", "abcd") == 0
    assert hamming("ab", "abc") is None


def test_duplicate_probability_near_match():
    raw = decode_data_url(_png_data_url())
    assert raw is not None
    h = phash(raw)
    assert h is not None
    dup, dist = duplicate_probability(h, [h])
    assert dist == 0
    assert dup >= 0.9
