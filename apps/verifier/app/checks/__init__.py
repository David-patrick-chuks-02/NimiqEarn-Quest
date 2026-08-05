from __future__ import annotations

from ..models import VerifyRequest, VerifyResponse
from .link import verify_link
from .screenshot import verify_screenshot
from .text import verify_text
from .transaction import verify_transaction


def dispatch(req: VerifyRequest) -> VerifyResponse:
    pt = req.proofType.upper()
    if pt in {"SCREENSHOT", "UPLOADED_MEDIA"}:
        # Video data URLs skip image OCR path with a conservative review score.
        if pt == "UPLOADED_MEDIA" and req.proof.lower().startswith("data:video/"):
            return VerifyResponse(
                confidence=0.45,
                signals={"proofType": pt, "mediaKind": "video", "note": "video_needs_review"},
                recommendation="review",
            )
        return verify_screenshot(req)
    if pt == "LINK":
        return verify_link(req)
    if pt == "TRANSACTION_HASH":
        return verify_transaction(req)
    if pt == "WALLET_INTERACTION":
        return VerifyResponse(
            confidence=0.75,
            signals={"proofType": pt, "note": "signature_checked_in_rules"},
            recommendation="approve",
        )
    return verify_text(req)
