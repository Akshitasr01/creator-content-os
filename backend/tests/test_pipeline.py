"""Integration: profile -> project -> analyze -> ideas -> generate -> edit -> rewrite -> feedback."""

from tests.conftest import PROFILE, SOURCE_TEXT


def test_profile_create_then_update(client):
    assert client.get("/creator-profile").json() is None  # not onboarded yet

    created = client.put("/creator-profile", json=PROFILE).json()
    assert created["language"] == "Hinglish"
    assert created["sample_posts"] == PROFILE["sample_posts"]
    assert created["platform_preferences"][0]["cta_style"] == "Ask a question"

    updated = client.put("/creator-profile", json={**PROFILE, "tone": "Formal"}).json()
    assert updated["id"] == created["id"]  # same row, not a duplicate
    assert updated["tone"] == "Formal"


def test_project_requires_profile_and_valid_length(client):
    body = {"title": "T", "source_type": "article", "source_text": SOURCE_TEXT}
    assert client.post("/projects", json=body).status_code == 404  # no profile yet

    client.put("/creator-profile", json=PROFILE)
    short = client.post("/projects", json={**body, "source_text": "too short"})
    assert short.status_code == 422
    assert "too short" in short.json()["detail"]

    bad_type = client.post("/projects", json={**body, "source_type": "youtube"})
    assert bad_type.status_code == 422

    created = client.post("/projects", json=body)
    assert created.status_code == 201
    assert created.json()["status"] == "draft"  # saved before any AI call


def test_full_pipeline(client, ready_project):
    project = client.get(f"/projects/{ready_project}").json()
    assert project["status"] == "analyzed"
    assert project["analysis"]["main_topic"]
    assert project["analysis"]["generated_by"]["provider"] == "mock"
    assert 8 <= len(project["content_ideas"]["ideas"]) <= 12

    response = client.post(f"/projects/{ready_project}/generate", json={"outputs": [
        {"type": "reel", "count": 3}, {"type": "linkedin", "count": 2}, {"type": "carousel", "count": 1}]})
    assert response.status_code == 200
    body = response.json()
    assert body["errors"] == []
    assert len(body["created"]) == 6

    reels = [c for c in body["created"] if c["content_type"] == "reel"]
    assert len({r["idea_index"] for r in reels}) == 3  # three distinct ideas
    assert all(c["provider"] == "mock" and c["status"] == "draft" for c in body["created"])
    carousel = next(c for c in body["created"] if c["content_type"] == "carousel")
    assert [s["number"] for s in carousel["content"]["slides"]] == list(range(1, len(carousel["content"]["slides"]) + 1))

    detail = client.get(f"/projects/{ready_project}").json()
    assert detail["status"] == "ready"
    assert len(detail["content"]) == 6

    listing = client.get("/projects").json()
    assert listing[0]["asset_count"] == 6


def test_edit_rewrite_and_feedback_keep_versions(client, ready_project):
    created = client.post(f"/projects/{ready_project}/generate",
                          json={"outputs": [{"type": "reel", "count": 1}]}).json()["created"][0]
    content_id = created["id"]

    edited = {**created["content"], "hook": "My own hook"}
    v2 = client.patch(f"/content/{content_id}", json={"content": edited}).json()
    assert v2["version"] == 2 and v2["content"]["hook"] == "My own hook"
    assert v2["previous_versions"][0]["replaced_by"] == "manual_edit"

    invalid = client.patch(f"/content/{content_id}", json={"content": {"hook": "only a hook"}})
    assert invalid.status_code == 422

    v3 = client.post(f"/content/{content_id}/rewrite", json={"instruction": "stronger_hook"}).json()
    assert v3["version"] == 3
    assert v3["previous_versions"][-1]["content"]["hook"] == "My own hook"

    assert client.post(f"/content/{content_id}/rewrite", json={"instruction": "write a poem"}).status_code == 422

    regenerated = client.post(f"/content/{content_id}/rewrite", json={"instruction": "regenerate"}).json()
    assert regenerated["version"] == 4

    feedback = client.post(f"/content/{content_id}/feedback",
                           json={"rating": "down", "reason": "weak_hook", "note": "Too generic"})
    assert feedback.status_code == 201
    assert feedback.json()["rating"] == -1
    assert client.get(f"/projects/{ready_project}").json()["content"][0]["status"] == "disliked"

    approved = client.patch(f"/content/{content_id}", json={"status": "approved"}).json()
    assert approved["status"] == "approved" and approved["version"] == 4


def test_more_ideas_are_appended_so_asset_links_stay_valid(client, ready_project):
    first = client.get(f"/projects/{ready_project}").json()["content_ideas"]["ideas"]
    more = client.post(f"/projects/{ready_project}/ideas").json()["content_ideas"]["ideas"]
    assert len(more) == 2 * len(first)
    assert more[: len(first)] == first


def test_user_can_correct_the_brief(client, ready_project):
    analysis = client.get(f"/projects/{ready_project}").json()["analysis"]
    analysis["main_topic"] = "Learning DP in the right order"
    saved = client.put(f"/projects/{ready_project}/analysis", json={"analysis": analysis}).json()
    assert saved["analysis"]["main_topic"] == "Learning DP in the right order"
    assert saved["analysis"]["edited_by_user"] is True


def test_generate_requires_analysis_and_ideas(client):
    client.put("/creator-profile", json=PROFILE)
    project = client.post("/projects", json={
        "title": "T", "source_type": "notes", "source_text": SOURCE_TEXT}).json()
    assert client.post(f"/projects/{project['id']}/ideas").status_code == 422
    response = client.post(f"/projects/{project['id']}/generate", json={"outputs": [{"type": "reel", "count": 1}]})
    assert response.status_code == 422


def test_too_many_assets_rejected(client, ready_project):
    response = client.post(f"/projects/{ready_project}/generate", json={"outputs": [
        {"type": "reel", "count": 5}, {"type": "linkedin", "count": 5}]})
    assert response.status_code == 422
