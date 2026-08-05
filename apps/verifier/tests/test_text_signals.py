from __future__ import annotations

from app.text_signals import keyword_overlap, spam_score, tokens


def test_tokens_filters_stopwords():
    assert "the" not in tokens("the wallet works great")
    assert "wallet" in tokens("the wallet works great")


def test_keyword_overlap_partial():
    score = keyword_overlap(
        "I followed the account and took a screenshot",
        "Follow the account and upload a screenshot",
    )
    assert score > 0.3


def test_keyword_overlap_empty_instructions():
    assert keyword_overlap("hello world", "") == 0.5


def test_keyword_overlap_no_proof_tokens():
    assert keyword_overlap("a an the", "follow screenshot account") == 0.1


def test_spam_score_short():
    assert spam_score("hi") >= 0.9


def test_spam_score_repetition():
    assert spam_score("aaaaaa") >= 0.9


def test_spam_score_normal_text():
    assert spam_score("This is a thoughtful review of the onboarding flow.") < 0.5
