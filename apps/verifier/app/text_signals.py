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

_AI_PHRASES = (
    "as an ai",
    "language model",
    "in conclusion",
    "delve into",
    "it is important to note",
    "in today's digital",
    "leverage",
    "robust solution",
)


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


def jaccard_similarity(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(1, len(ta | tb))


def text_clone_probability(text: str, recent: list[str]) -> float:
    if not recent:
        return 0.0
    best = max(jaccard_similarity(text, r) for r in recent)
    return max(0.0, min(1.0, best))


def ai_generated_likelihood(text: str) -> float:
    """Cheap heuristic for generic / AI-flavored copy (not a classifier)."""
    lower = text.lower()
    hits = sum(1 for p in _AI_PHRASES if p in lower)
    words = re.findall(r"\w+", lower)
    if not words:
        return 0.8
    unique = len(set(words)) / len(words)
    score = min(1.0, hits * 0.25 + (0.35 if unique < 0.45 and len(words) > 40 else 0.0))
    return score
