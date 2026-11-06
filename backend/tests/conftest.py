import sys
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api import deps  # noqa: E402
from core.config import get_settings  # noqa: E402
from main import app  # noqa: E402
from services.llm_service import LLMService  # noqa: E402
from services.usage_service import rate_limiter, usage_recorder  # noqa: E402
from tests.fakes import FakeDatabase, FakeRepository  # noqa: E402

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"

SOURCE_TEXT = (
    "Dynamic programming feels hard because most students start with tabulation. "
    "Start with recursion first so you understand the subproblems. "
    "Then add memoization to stop repeating work, which cuts the runtime dramatically. "
    "Only after that should you move to tabulation and space optimisation. "
    "In my batch, 40 students who followed this order solved twice as many DP problems! "
    "The biggest mistake is memorising solutions instead of identifying the state."
)

PROFILE = {
    "creator_name": "Asha",
    "niche": "Coding + career",
    "audience": "Indian engineering students",
    "language": "Hinglish",
    "tone": "Casual, educational",
    "style_description": "Short sentences, concrete examples",
    "things_to_avoid": "Corporate phrasing, too many emojis",
    "sample_posts": ["Sample one", "Sample two", "Sample three"],
    "target_platforms": ["instagram", "linkedin"],
    "platform_preferences": [{"platform": "linkedin", "preferred_length": "short", "cta_style": "Ask a question"}],
}


class World:
    """Test state: a shared fake DB, the active user and test settings."""

    def __init__(self):
        self.db = FakeDatabase()
        self.user_id = USER_A
        self.settings = replace(get_settings(), ai_provider="mock", daily_ai_call_limit=60,
                                ai_requests_per_minute=1000, source_min_chars=200)

    def repo(self):
        return FakeRepository(self.user_id, self.db)


@pytest.fixture
def world():
    return World()


@pytest.fixture
def client(world):
    rate_limiter._hits.clear()

    app.dependency_overrides[deps.get_current_user] = lambda: deps.CurrentUser(
        id=world.user_id, email="test@example.com", access_token="test")
    app.dependency_overrides[deps.get_repository] = world.repo
    app.dependency_overrides[deps.settings_dep] = lambda: world.settings

    def llm():
        repo = world.repo()
        return LLMService(settings=world.settings, on_usage=usage_recorder(repo))

    app.dependency_overrides[deps.get_llm] = llm
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def ready_project(client):
    """A project with profile, analysis and ideas - ready to generate."""
    assert client.put("/creator-profile", json=PROFILE).status_code == 200
    project = client.post("/projects", json={
        "title": "DP Roadmap", "source_type": "transcript", "source_text": SOURCE_TEXT}).json()
    assert client.post(f"/projects/{project['id']}/analyze").status_code == 200
    assert client.post(f"/projects/{project['id']}/ideas").status_code == 200
    return project["id"]
