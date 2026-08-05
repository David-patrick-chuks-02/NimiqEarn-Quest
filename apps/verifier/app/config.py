from __future__ import annotations

import os


def shared_secret() -> str:
    return os.environ.get("VERIFIER_SHARED_SECRET", "").strip()
