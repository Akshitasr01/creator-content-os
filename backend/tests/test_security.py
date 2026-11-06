"""Auth, data isolation, malformed payloads and usage limits (PDF steps 6, 26, 27)."""

import uuid
from dataclasses import replace

from fastapi.testclient import TestClient

from core.errors import AIServiceError
from main import app
from services import content_analyzer
from services.usage_service import rate_limiter
from tests.conftest import USER_B


def test_protected_routes_require_a_token():
    client = TestClient(app)  # no dependency overrides
    for method, path in [("get", "/projects"), ("get", "/creator-profile"),
                         ("post", f"/projects/{uuid.uuid4()}/analyze")]:
        response = getattr(client, method)(path)
        assert response.status_code == 401
        assert response.json()["code"] == "unauthorized"


def test_user_b_cannot_see_or_touch_user_a_data(client, world, ready_project):
    content = client.post(f"/projects/{ready_project}/generate",
                          json={"outputs": [{"type": "linkedin", "count": 1}]}).json()["created"][0]

    world.user_id = USER_B
    assert client.get("/projects").json() == []
    assert client.get(f"/projects/{ready_project}").status_code == 404
    assert client.post(f"/projects/{ready_project}/analyze").status_code == 404
    assert client.patch(f"/content/{content['id']}", json={"status": "approved"}).status_code == 404
    assert client.post(f"/content/{content['id']}/rewrite", json={"instruction": "shorter"}).status_code == 404
    assert client.post(f"/content/{content['id']}/feedback", json={"rating": "up"}).status_code == 404


def test_malformed_ids_and_payloads(client, ready_project):
    assert client.get("/projects/not-a-uuid").status_code == 422
    assert client.post(f"/projects/{ready_project}/generate", json={"outputs": []}).status_code == 422
    assert client.post(f"/projects/{ready_project}/generate",
                       json={"outputs": [{"type": "tiktok", "count": 1}]}).status_code == 422
    assert client.put("/creator-profile", json={"creator_name": ""}).status_code == 422
    assert client.put("/creator-profile", json={"creator_name": "A", "sample_posts": ["1", "2", "3", "4"]}).status_code == 422


def test_daily_limit_blocks_real_ai_calls(client, world, ready_project):
    # Pretend we're on the real provider with a nearly-used daily allowance.
    world.settings = replace(world.settings, ai_provider="openai", daily_ai_call_limit=2)
    repo = world.repo()
    for _ in range(2):
        repo.insert_usage({"operation": "analyze", "provider": "openai", "model": "x",
                           "input_tokens": 1, "output_tokens": 1, "estimated_cost_usd": 0})

    response = client.post(f"/projects/{ready_project}/analyze")
    assert response.status_code == 429
    assert "Daily free-beta limit" in response.json()["detail"]


def test_rate_limit_per_minute(client, world, ready_project):
    world.settings = replace(world.settings, ai_requests_per_minute=2)
    rate_limiter._hits.clear()  # forget the calls made while preparing the project
    codes = [client.post(f"/projects/{ready_project}/analyze").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_usage_is_logged_without_content(client, world, ready_project):
    events = world.db.tables["usage_events"]
    assert {e["operation"] for e in events} == {"analyze", "ideas"}
    assert all("source_text" not in e and "content" not in e for e in events)


def test_ai_failure_marks_project_failed(client, ready_project, monkeypatch):
    def boom(*_args, **_kwargs):
        raise AIServiceError("The AI provider timed out. Please try again.")

    monkeypatch.setattr(content_analyzer, "analyze", boom)
    response = client.post(f"/projects/{ready_project}/analyze")
    assert response.status_code == 502
    project = client.get(f"/projects/{ready_project}").json()
    assert project["status"] == "failed"
    assert "timed out" in project["error_message"]
