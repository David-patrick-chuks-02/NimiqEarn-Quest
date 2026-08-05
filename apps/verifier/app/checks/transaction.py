from __future__ import annotations

import re

from ..models import VerifyRequest, VerifyResponse


def verify_transaction(req: VerifyRequest) -> VerifyResponse:
    proof = req.proof.strip()
    hex_ok = bool(re.fullmatch(r"[a-fA-F0-9]{8,200}", proof))
    signals = {"proofType": "TRANSACTION_HASH", "hexOk": hex_ok, "length": len(proof)}
    # Format-only in slice 1 — on-chain RPC check stays in Node later.
    confidence = 0.75 if hex_ok else 0.1
    rec = "approve" if hex_ok else "reject"
    return VerifyResponse(confidence=confidence, signals=signals, recommendation=rec)
