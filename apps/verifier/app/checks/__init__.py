from __future__ import annotations

from ..models import VerifyRequest, VerifyResponse
from .link import verify_link
from .screenshot import verify_screenshot
from .text import verify_text
from .transaction import verify_transaction


def dispatch(req: VerifyRequest) -> VerifyResponse:
    pt = req.proofType.upper()
    if pt == "SCREENSHOT":
        return verify_screenshot(req)
    if pt == "LINK":
        return verify_link(req)
    if pt == "TRANSACTION_HASH":
        return verify_transaction(req)
    return verify_text(req)
