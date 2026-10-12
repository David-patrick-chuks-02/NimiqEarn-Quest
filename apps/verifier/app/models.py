from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class VerifyRequest(BaseModel):
    submissionId: str
    proofType: str
    proof: str
    proofInstructions: str = ""
    title: str | None = None
    recentImageHashes: list[str] = Field(default_factory=list)
    recentTextProofs: list[str] = Field(default_factory=list)
    behavioralRisk: float | None = None
    sampleEvidence: str | None = None
    # Extra creator sample images (up to 2 more). The screenshot check scores all of them and
    # keeps the best match, so several accepted examples are supported.
    sampleEvidenceExtras: list[str] = Field(default_factory=list)
    livePostText: str | None = None


class VerifyResponse(BaseModel):
    confidence: float
    signals: dict[str, Any]
    recommendation: str  # approve | review | reject
    imageHash: str | None = None
