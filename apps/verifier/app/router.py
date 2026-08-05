from __future__ import annotations

from fastapi import APIRouter, Depends

from .auth import require_secret
from .checks import dispatch
from .models import VerifyRequest, VerifyResponse

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "verifier"}


@router.post("/verify", response_model=VerifyResponse, dependencies=[Depends(require_secret)])
def verify(req: VerifyRequest) -> VerifyResponse:
    return dispatch(req)
