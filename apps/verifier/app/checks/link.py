from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from ..models import VerifyRequest, VerifyResponse

_KNOWN_HOST_FRAGMENTS = ("x.com", "twitter.com", "t.me", "github.com", "nimiq")


def verify_link(req: VerifyRequest) -> VerifyResponse:
    signals: dict[str, Any] = {"proofType": "LINK"}
    try:
        u = urlparse(req.proof.strip())
        host = (u.hostname or "").lower()
        signals["host"] = host
        ok_scheme = u.scheme in ("http", "https")
        suspicious = host in {"localhost", "127.0.0.1"} or host.endswith(".local")
        confidence = 0.7 if ok_scheme and host and not suspicious else 0.2
        if suspicious:
            signals["suspiciousHost"] = True
        rec = "approve" if confidence >= 0.7 else ("review" if ok_scheme else "reject")
        if any(h in host for h in _KNOWN_HOST_FRAGMENTS):
            confidence = min(1.0, confidence + 0.1)
            signals["knownHost"] = True
        return VerifyResponse(confidence=confidence, signals=signals, recommendation=rec)
    except Exception:
        return VerifyResponse(
            confidence=0.1,
            signals={**signals, "error": "parse_failed"},
            recommendation="reject",
        )
