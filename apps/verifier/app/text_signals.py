"""Pure text-signal helpers (no I/O)."""

from __future__ import annotations

import re

_STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "your",
    "this",
    "that",
    "is",
    "are",
    "be",
    "as",
    "at",
    "by",
    "from",
    "it",
    "you",
}


def tokens(s: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]{3,}", s.lower()) if t not in _STOP}


def keyword_overlap(text: str, instructions: str) -> float:
    a, b = tokens(text), tokens(instructions)
    if not b:
        return 0.5
    if not a:
        return 0.1
    return len(a & b) / max(1, len(b))


def spam_score(text: str) -> float:
    """Higher = more spammy / low effort."""
    t = text.strip()
    if len(t) < 8:
        return 0.9
    words = re.findall(r"\w+", t.lower())
    if not words:
        return 0.9
    unique = len(set(words)) / len(words)
    repeated = 1.0 - unique
    if re.fullmatch(r"(.)\1{5,}", t):
        return 1.0
    return min(1.0, repeated * 1.5 + (0.4 if len(t) < 20 else 0.0))
