from __future__ import annotations

from typing import Any

from ..models import VerifyRequest, VerifyResponse
from ..text_signals import (
    ai_generated_likelihood,
    keyword_overlap,
    semantic_relevance,
    spam_score,
    text_clone_probability,
)


def verify_text(req: VerifyRequest) -> VerifyResponse:
    text = req.proof.strip()
    signals: dict[str, Any] = {"proofType": req.proofType, "length": len(text)}
    spam = spam_score(text)
    overlap = keyword_overlap(text, req.proofInstructions)
    semantic = semantic_relevance(text, req.proofInstructions, req.title or "")
    clone = text_clone_probability(text, req.recentTextProofs)
    ai_like = ai_generated_likelihood(text)
    signals["spamScore"] = spam
    signals["instructionOverlap"] = overlap
    signals["semanticRelevance"] = semantic
    signals["textCloneProbability"] = clone
    signals["aiGeneratedLikelihood"] = ai_like
    if req.behavioralRisk is not None:
        signals["behavioralRisk"] = req.behavioralRisk

    confidence = 0.35 + 0.25 * (1.0 - spam) + 0.2 * overlap + 0.25 * semantic
    confidence -= 0.4 * clone
    confidence -= 0.2 * ai_like
    if req.behavioralRisk:
        confidence -= 0.15 * req.behavioralRisk
    confidence = max(0.0, min(1.0, confidence))

    if spam >= 0.85 or len(text) < 5 or clone >= 0.95:
        rec = "reject"
    elif confidence >= 0.8 and spam < 0.35 and clone < 0.7:
        rec = "approve"
    elif confidence >= 0.45:
        rec = "review"
    else:
        rec = "reject"

    return VerifyResponse(confidence=confidence, signals=signals, recommendation=rec)
