from __future__ import annotations

from typing import Any

from ..image_ops import (
    decode_data_url,
    duplicate_probability,
    edit_likelihood,
    ocr_text,
    phash,
    template_match_score,
)
from ..models import VerifyRequest, VerifyResponse
from ..text_signals import keyword_overlap


def verify_screenshot(req: VerifyRequest) -> VerifyResponse:
    signals: dict[str, Any] = {"proofType": req.proofType}
    raw = decode_data_url(req.proof)
    if not raw:
        return VerifyResponse(
            confidence=0.05,
            signals={**signals, "error": "invalid_image"},
            recommendation="reject",
        )

    ph = phash(raw)
    signals["imageHash"] = ph
    dup, nearest = duplicate_probability(ph, req.recentImageHashes)
    if nearest is not None:
        signals["nearestHashDistance"] = nearest
    signals["duplicateProbability"] = dup

    tamper = edit_likelihood(raw)
    signals["editLikelihood"] = tamper

    ocr = ocr_text(raw)
    signals["ocrLength"] = len(ocr)
    signals["ocrPreview"] = ocr[:200]
    overlap = keyword_overlap(ocr, req.proofInstructions)
    title_overlap = keyword_overlap(ocr, req.title or "")
    signals["instructionOverlap"] = overlap
    signals["uiTitleOverlap"] = title_overlap

    sample_score = 0.0
    if req.sampleEvidence:
        sample_raw = decode_data_url(req.sampleEvidence)
        if sample_raw:
            sample_score = template_match_score(raw, sample_raw)
            signals["sampleTemplateMatch"] = sample_score

    live_overlap = 0.0
    if req.livePostText:
        live_overlap = keyword_overlap(ocr, req.livePostText)
        signals["livePostOverlap"] = live_overlap

    confidence = 0.55
    if ocr:
        confidence += 0.12 * min(1.0, len(ocr) / 40)
        confidence += 0.12 * overlap
        confidence += 0.08 * title_overlap
        confidence += 0.12 * live_overlap
    else:
        confidence -= 0.1
        signals["ocrUnavailable"] = True
    confidence += 0.15 * sample_score
    confidence -= 0.5 * dup
    confidence -= 0.25 * tamper
    if req.behavioralRisk:
        confidence -= 0.1 * req.behavioralRisk
        signals["behavioralRisk"] = req.behavioralRisk
    confidence = max(0.0, min(1.0, confidence))

    if dup >= 0.85 or tamper >= 0.9:
        rec = "reject" if dup >= 0.95 else "review"
    elif confidence >= 0.8:
        rec = "approve"
    elif confidence >= 0.45:
        rec = "review"
    else:
        rec = "reject"

    return VerifyResponse(
        confidence=confidence,
        signals=signals,
        recommendation=rec,
        imageHash=ph,
    )
