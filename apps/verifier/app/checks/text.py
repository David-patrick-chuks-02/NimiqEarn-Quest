from __future__ import annotations

from typing import Any

from ..models import VerifyRequest, VerifyResponse
from ..text_signals import keyword_overlap, spam_score


def verify_text(req: VerifyRequest) -> VerifyResponse:
    text = req.proof.strip()
    signals: dict[str, Any] = {"proofType": req.proofType, "length": len(text)}
    spam = spam_score(text)
    overlap = keyword_overlap(text, req.proofInstructions)
    signals["spamScore"] = spam
    signals["instructionOverlap"] = overlap

    confidence = 0.4 + 0.35 * (1.0 - spam) + 0.25 * overlap
    confidence = max(0.0, min(1.0, confidence))

    if spam >= 0.85 or len(text) < 5:
        rec = "reject"
    elif confidence >= 0.8 and spam < 0.35:
        rec = "approve"
    elif confidence >= 0.45:
        rec = "review"
    else:
        rec = "reject"

    return VerifyResponse(confidence=confidence, signals=signals, recommendation=rec)
