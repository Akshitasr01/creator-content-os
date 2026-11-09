"""AI Video-to-Reels: URL rules, clip selection, subtitles, API flow, isolation, real FFmpeg render."""

import shutil
import subprocess

import pytest

from api import videos as videos_api
from core.errors import ValidationFailed
from core.video_config import get_video_settings
from main import app
from schemas.video import ClipSuggestion
from services.video import clip_selector, media_tools, pipeline, renderer, subtitles, transcriber, url_source
from tests.conftest import PROFILE, USER_A, USER_B
from tests.video_fakes import (
    SEGMENTS, FakeVideoRepository, SyncRunner, fake_probe, fake_render, fake_transcribe,
)

# ---------------------------------------------------------------------------
# Unit: permitted URL sources
# ---------------------------------------------------------------------------


def test_youtube_links_in_direct_url_field_point_to_youtube_option():
    for url in ("https://www.youtube.com/watch?v=abc", "https://youtu.be/abc"):
        with pytest.raises(ValidationFailed, match="YouTube video link"):
            url_source.validate_media_url(url, resolve_host=False)


@pytest.mark.parametrize("url, platform", [
    ("https://www.instagram.com/reel/xyz/", "Instagram"),
    ("https://vm.tiktok.com/abc", "TikTok"),
    ("https://vimeo.com/123.mp4", "Vimeo"),
])
def test_platform_links_are_refused_with_guidance(url, platform):
    with pytest.raises(ValidationFailed) as error:
        url_source.validate_media_url(url, resolve_host=False)
    assert platform in error.value.message and "Upload Video" in error.value.message


def test_only_https_direct_media_files_are_accepted():
    assert url_source.validate_media_url("https://cdn.example.com/talk.MP4", resolve_host=False) == "video"
    assert url_source.validate_media_url("https://cdn.example.com/ep1.mp3?sig=1", resolve_host=False) == "audio"
    for bad in ["http://cdn.example.com/a.mp4", "https://example.com/watch/123", "ftp://x/a.mp4"]:
        with pytest.raises(ValidationFailed):
            url_source.validate_media_url(bad, resolve_host=False)


def test_private_network_links_are_blocked():
    with pytest.raises(ValidationFailed, match="private or local"):
        url_source.validate_media_url("https://127.0.0.1/video.mp4")


# ---------------------------------------------------------------------------
# Unit: clip selection rules are enforced in code
# ---------------------------------------------------------------------------


def _suggestion(start, end, title="t"):
    return ClipSuggestion(title=title, start_seconds=start, end_seconds=end, hook="h", caption="c",
                          hashtags=["#DSA", "dsa", "Coding!"], cta="cta", reason="r")


def test_finalize_snaps_to_lines_limits_length_and_drops_overlap():
    clips = clip_selector.finalize_clips(
        [_suggestion(10.0, 25.0), _suggestion(12.0, 30.0), _suggestion(45.0, 200.0), _suggestion(0.5, 3.0)],
        SEGMENTS, duration=70.0, count=5, min_s=15, max_s=30)
    spans = [(c["start_seconds"], c["end_seconds"]) for c in clips]
    assert spans[0] == (9.5, 20.0) or spans[0][0] == 9.5   # snapped to the start of a whole line
    starts = {seg["start"] for seg in SEGMENTS}
    ends = {seg["end"] for seg in SEGMENTS}
    assert all(s in starts and e in ends for s, e in spans)  # never mid-sentence
    assert all(15 <= e - s <= 30 for s, e in spans)            # length limits enforced
    for i, a in enumerate(spans):                              # overlapping suggestion dropped
        for b in spans[i + 1:]:
            assert min(a[1], b[1]) - max(a[0], b[0]) <= 0.2 * min(a[1] - a[0], b[1] - b[0])
    assert clips[0]["hashtags"] == ["dsa", "coding"]
    assert clips[0]["transcript_excerpt"].startswith("First write the recursion")


def test_finalize_respects_requested_count():
    clips = clip_selector.finalize_clips([_suggestion(0, 20), _suggestion(31.5, 44), _suggestion(58.5, 70)],
                                         SEGMENTS, 70.0, count=2, min_s=10, max_s=30)
    assert len(clips) == 2


def test_demo_selector_is_labelled():
    result = clip_selector.demo_suggestions(SEGMENTS, 3, 15, 40)
    assert all(c.title.startswith("[Demo]") and "not AI" in c.reason for c in result.clips)


# ---------------------------------------------------------------------------
# Unit: subtitles
# ---------------------------------------------------------------------------


def test_subtitles_are_short_relative_and_continuous():
    chunks = subtitles.build_chunks(SEGMENTS, 0.0, 9.0)
    assert chunks[0][0] == 0.0
    assert all(len(text.split()) <= 4 for _, _, text in chunks)
    # Short pauses are bridged so captions don't flicker.
    assert all(b[0] - a[1] == 0 or b[0] - a[1] > subtitles.MAX_HOLD_GAP_SECONDS for a, b in zip(chunks, chunks[1:]))
    ass = subtitles.build_ass(SEGMENTS, 0.0, 9.0, 720, 1280)
    assert "PlayResX: 720" in ass and "Dialogue: 0,0:00:00.00" in ass


def test_continuation_tokens_join_without_space():
    segments = [{"start": 0, "end": 2, "text": "two-dimensional array",
                 "words": [[0, 0.4, " two"], [0.4, 0.9, "-dimensional"], [0.9, 1.5, " array"]]}]
    assert subtitles.build_chunks(segments, 0, 2)[0][2] == "two-dimensional array"


# ---------------------------------------------------------------------------
# API flow (fake repo, fake media tools, sync job runner)
# ---------------------------------------------------------------------------


@pytest.fixture
def video_env(client, world, monkeypatch, tmp_path):
    monkeypatch.setenv("VIDEO_MEDIA_DIR", str(tmp_path))
    get_video_settings.cache_clear()
    tables: dict = {}
    app.dependency_overrides[videos_api.get_video_repository] = lambda: FakeVideoRepository(world.user_id, tables)
    monkeypatch.setattr(pipeline, "runner", SyncRunner())
    monkeypatch.setattr(media_tools, "ffmpeg_available", lambda: True)
    monkeypatch.setattr(media_tools, "probe", fake_probe())
    monkeypatch.setattr(transcriber, "transcription_available", lambda: True)
    monkeypatch.setattr(transcriber, "transcribe", fake_transcribe)
    monkeypatch.setattr(renderer, "render_clip", fake_render)
    client.put("/creator-profile", json=PROFILE)
    yield tables
    get_video_settings.cache_clear()


def _upload(client, kind="video", name="talk.mp4", clips=3):
    return client.post("/videos/upload", data={"title": "DP talk", "clip_count": str(clips), "kind": kind},
                       files={"file": (name, b"not-really-a-video", "application/octet-stream")})


def test_upload_to_rendered_clips(client, video_env):
    response = _upload(client)
    assert response.status_code == 202
    detail = client.get(f"/videos/{response.json()['id']}").json()

    assert detail["status"] == "completed" and detail["progress"] == 100
    assert detail["transcript"][0]["text"].startswith("Most students")
    assert 1 <= len(detail["clips"]) <= 3
    for clip in detail["clips"]:
        assert clip["render_status"] == "rendered"
        assert clip["preview_url"].startswith("https://storage.test/")
        assert "download=" in clip["download_url"]
        assert clip["duration_seconds"] == pytest.approx(clip["end_seconds"] - clip["start_seconds"])
        assert clip["provider"] == "mock"
    assert all(path.startswith(f"{USER_A}/{detail['id']}/") for path in video_env["storage"])
    assert len(video_env["storage"]) == len(detail["clips"])

    listing = client.get("/videos").json()
    assert listing[0]["clip_count"] == len(detail["clips"]) and listing[0]["rendered_count"] == len(detail["clips"])


def test_audio_upload_gives_suggestions_only(client, video_env, monkeypatch):
    monkeypatch.setattr(media_tools, "probe", fake_probe(has_video=False))
    source = _upload(client, kind="audio", name="episode.mp3").json()
    detail = client.get(f"/videos/{source['id']}").json()
    assert detail["media_type"] == "audio" and detail["status"] == "completed"
    assert all(c["render_status"] == "unavailable" and c["preview_url"] is None for c in detail["clips"])
    assert video_env["storage"] == {}


def test_bad_uploads_create_nothing(client, video_env):
    assert _upload(client, name="notes.txt").status_code == 422
    assert _upload(client, clips=11).status_code == 422
    assert client.get("/videos").json() == []


def test_platform_url_rejected_by_api(client, video_env):
    response = client.post("/videos/from-url", json={"title": "x", "url": "https://youtube.com/watch?v=1", "clip_count": 3})
    assert response.status_code == 422 and "YouTube video link" in response.json()["detail"]


def test_editing_timestamps_invalidates_render_then_rerender(client, video_env):
    source = _upload(client).json()
    clip = client.get(f"/videos/{source['id']}").json()["clips"][0]

    caption_only = client.patch(f"/video-clips/{clip['id']}", json={"caption": "New caption", "hashtags": ["#a", "b"]}).json()
    assert caption_only["render_status"] == "rendered" and caption_only["hashtags"] == ["a", "b"]

    moved = client.patch(f"/video-clips/{clip['id']}", json={"start_seconds": 0, "end_seconds": 20}).json()
    assert moved["render_status"] == "not_rendered" and moved["preview_url"] is None
    assert moved["duration_seconds"] == 20 and moved["transcript_excerpt"].startswith("Most students")
    assert client.patch(f"/video-clips/{clip['id']}", json={"start_seconds": 30, "end_seconds": 10}).status_code == 422
    assert client.patch(f"/video-clips/{clip['id']}", json={"end_seconds": 500}).status_code == 422

    assert client.post(f"/video-clips/{clip['id']}/render").status_code == 202
    after = next(c for c in client.get(f"/videos/{source['id']}").json()["clips"] if c["id"] == clip["id"])
    assert after["render_status"] == "rendered" and after["preview_url"]


def test_failure_then_retry_resumes(client, video_env, monkeypatch):
    def broken(path, on_progress=None):
        raise ValidationFailed("No speech was found in this file.")

    monkeypatch.setattr(transcriber, "transcribe", broken)
    source = _upload(client).json()
    failed = client.get(f"/videos/{source['id']}").json()
    assert failed["status"] == "failed" and "No speech" in failed["error_message"]

    monkeypatch.setattr(transcriber, "transcribe", fake_transcribe)
    assert client.post(f"/videos/{source['id']}/retry").status_code == 200
    assert client.get(f"/videos/{source['id']}").json()["status"] == "completed"


def test_transcript_can_feed_the_text_pipeline(client, video_env):
    source = _upload(client).json()
    result = client.post(f"/videos/{source['id']}/text-project").json()
    project = client.get(f"/projects/{result['project_id']}").json()
    assert project["source_type"] == "transcript" and project["source_text"].startswith("Most students")
    # Idempotent: a second click returns the same project.
    assert client.post(f"/videos/{source['id']}/text-project").json()["project_id"] == result["project_id"]


def test_other_users_cannot_see_videos_or_clips(client, world, video_env):
    source = _upload(client).json()
    clip = client.get(f"/videos/{source['id']}").json()["clips"][0]
    world.user_id = USER_B
    assert client.get("/videos").json() == []
    assert client.get(f"/videos/{source['id']}").status_code == 404
    assert client.patch(f"/video-clips/{clip['id']}", json={"caption": "x"}).status_code == 404
    assert client.post(f"/video-clips/{clip['id']}/render").status_code == 404
    assert client.post(f"/videos/{source['id']}/retry").status_code == 404


def test_video_routes_require_login():
    from fastapi.testclient import TestClient

    anonymous = TestClient(app)
    assert anonymous.get("/videos").status_code == 401
    assert anonymous.post("/videos/upload").status_code in (401, 422)


# ---------------------------------------------------------------------------
# Real FFmpeg render (skipped when FFmpeg isn't installed)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not (get_video_settings().ffmpeg_path and get_video_settings().ffprobe_path),
                    reason="FFmpeg not installed")
def test_real_render_produces_vertical_mp4_with_audio(tmp_path):
    ffmpeg = get_video_settings().ffmpeg_path
    source = tmp_path / "source.mp4"
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=12",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-c:v", "libx264", "-c:a", "aac",
                    "-shortest", str(source)], check=True)
    output = renderer.render_clip(source, SEGMENTS, 0.0, 9.0, tmp_path / "render")
    info = media_tools.probe(output)
    assert (info.width, info.height) == (720, 1280)
    assert info.has_audio and 8.5 <= info.duration_seconds <= 9.5
    shutil.rmtree(tmp_path / "render", ignore_errors=True)
