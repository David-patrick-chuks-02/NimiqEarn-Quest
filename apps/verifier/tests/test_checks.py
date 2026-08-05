from __future__ import annotations

import base64
import io

from PIL import Image

from app.checks import dispatch
from app.checks.link import verify_link
from app.checks.text import verify_text
from app.checks.transaction import verify_transaction
from app.models import VerifyRequest


def _req(**kwargs) -> VerifyRequest:
    base = {
        "submissionId": "sub-1",
        "proofType": "TEXT",
        "proof": "hello",
        "proofInstructions": "",
    }
    base.update(kwargs)
    return VerifyRequest(**base)


def _png_data_url() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (24, 24), (10, 20, 30)).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def test_verify_text_rejects_spam():
    res = verify_text(_req(proof="xx", proofInstructions="Write detailed feedback"))
    assert res.recommendation == "reject"


def test_verify_text_approves_good_feedback():
    res = verify_text(
        _req(
            proof=(
                "I tested the wallet onboarding carefully and the recovery phrase "
                "backup flow felt clear and secure."
            ),
            proofInstructions="Write product feedback about wallet onboarding",
        )
    )
    assert res.recommendation in {"approve", "review"}
    assert res.confidence >= 0.45


def test_verify_link_https():
    res = verify_link(_req(proofType="LINK", proof="https://x.com/user/status/1"))
    assert res.recommendation == "approve"
    assert res.signals.get("knownHost") is True


def test_verify_link_suspicious_localhost():
    res = verify_link(_req(proofType="LINK", proof="http://localhost/proof"))
    assert res.signals.get("suspiciousHost") is True
    assert res.confidence < 0.5


def test_verify_transaction_ok():
    res = verify_transaction(_req(proofType="TRANSACTION_HASH", proof="abcdef0123456789"))
    assert res.recommendation == "approve"
    assert res.confidence == 0.75


def test_verify_transaction_bad():
    res = verify_transaction(_req(proofType="TRANSACTION_HASH", proof="zzz"))
    assert res.recommendation == "reject"


def test_dispatch_routes_screenshot():
    res = dispatch(_req(proofType="SCREENSHOT", proof=_png_data_url()))
    assert res.signals["proofType"] == "SCREENSHOT"
    assert res.recommendation in {"approve", "review", "reject"}
    assert 0.0 <= res.confidence <= 1.0


def test_dispatch_unknown_falls_back_to_text():
    res = dispatch(_req(proofType="REFERRAL_EVENT", proof="ref-code-12345"))
    assert "length" in res.signals
