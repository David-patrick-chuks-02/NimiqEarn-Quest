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


class VerifyResponse(BaseModel):
    confidence: float
    signals: dict[str, Any]
    recommendation: str  # approve | review | reject
    imageHash: str | None = None
