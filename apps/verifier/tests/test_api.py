from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import create_app


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("VERIFIER_SHARED_SECRET", raising=False)
    return TestClient(create_app())


@pytest.fixture()
def authed_client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("VERIFIER_SHARED_SECRET", "test-secret")
    # Re-create app so config is read; shared_secret() reads env each call.
    return TestClient(create_app())


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_verify_without_secret_when_unset(client: TestClient):
    res = client.post(
        "/verify",
        json={
            "submissionId": "s1",
            "proofType": "LINK",
            "proof": "https://github.com/nimiq",
            "proofInstructions": "Share a link",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "confidence" in body
    assert body["recommendation"] in {"approve", "review", "reject"}


def test_verify_requires_secret_when_set(authed_client: TestClient):
    res = authed_client.post(
        "/verify",
        json={
            "submissionId": "s1",
            "proofType": "TEXT",
            "proof": "short",
            "proofInstructions": "feedback",
        },
    )
    assert res.status_code == 401

    res = authed_client.post(
        "/verify",
        headers={"x-verifier-key": "test-secret"},
        json={
            "submissionId": "s1",
            "proofType": "TEXT",
            "proof": "A thoughtful product feedback response about onboarding.",
            "proofInstructions": "Write product feedback about onboarding",
        },
    )
    assert res.status_code == 200
