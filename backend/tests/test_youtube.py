"""YouTube link integration: parsing, metadata, captions (OAuth), pasted transcripts,
attached originals, rendering rules, FFmpeg-unavailable behaviour and user isolation.

All Google/YouTube HTTP calls are replaced by a fake transport, so these tests are
offline and free. (A live oEmbed check is done separately - see README.)
"""

import httpx
import pytest

from core.errors import ValidationFailed
from core.video_config import get_video_settings
from services.video import media_tools, transcriber, youtube
from services.video.transcript_parser import parse_transcript
from tests.conftest import USER_B
from tests.test_video import video_env  # noqa: F401 - shared fixture
from tests.video_fakes import fake_probe

VIDEO_ID = "abcDEF12345"
CLIENT_ID = "test-client.apps.googleusercontent.com"

YT_TRANSCRIPT = """0:00
Most students learn dynamic programming in the wrong order.
0:05
That is the biggest mistake you can make.
0:10
First write the recursion, then add memoization to stop repeating work.
0:21
Why does this work? Because you derive the table instead of memorising it.
0:32
In my batch 40 students followed this order and solved twice as many problems!
0:45
So do ten classic problems deeply instead of two hundred random ones.
0:59
Climbing stairs, house robber, coin change and knapsack. Master those.
"""

SRT = """1
00:00:00,000 --> 00:00:04,000
Most students learn dynamic programming in the wrong order.

2
00:00:04,500 --> 00:00:20,000
First write the recursion, then add memoization.

3
00:00:20,500 --> 00:00:44,000
Why does this work? Because you derive the table.

4
00:00:44,500 --> 00:01:10,000
So do ten classic problems deeply. Master those.
"""


class FakeGoogle:
    """Answers the YouTube/Google endpoints we call, per test configuration."""

    def __init__(self):
        self.oembed_status = 200
        self.data_api_items = None  # None -> not used
        self.token_aud = CLIENT_ID
        self.token_scope = youtube.CAPTION_SCOPE
        self.captions_status = 200
        self.tracks = [{"id": "track1", "snippet": {"language": "en", "trackKind": "asr"}}]
        self.download_status = 200
        self.calls = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append((url, params, headers))
        request = httpx.Request("GET", url)
        if "oembed" in url:
            body = {"title": "DP roadmap", "author_name": "Asha Codes",
                    "thumbnail_url": f"https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg"}
            return httpx.Response(self.oembed_status, json=body if self.oembed_status == 200 else {}, request=request)
        if "youtube/v3/videos" in url:
            return httpx.Response(200, json={"items": self.data_api_items}, request=request)
        if "tokeninfo" in url:
            return httpx.Response(200, json={"aud": self.token_aud, "scope": self.token_scope}, request=request)
        if url.endswith("/captions"):
            return httpx.Response(self.captions_status, json={"items": self.tracks}, request=request)
        if "/captions/" in url:
            return httpx.Response(self.download_status, text=SRT, request=request)
        raise AssertionError(f"unexpected URL {url}")


@pytest.fixture
def google(monkeypatch):
    fake = FakeGoogle()
    monkeypatch.setattr(youtube.httpx, "get", fake.get)
    monkeypatch.setenv("YOUTUBE_API_KEY", "")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", CLIENT_ID)
    get_video_settings.cache_clear()
    yield fake
    get_video_settings.cache_clear()


# ---------------------------------------------------------------------------
# 1-4: URL formats and invalid links
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("url", [
    f"https://www.youtube.com/watch?v={VIDEO_ID}",          # 1. watch
    f"https://www.youtube.com/watch?feature=share&v={VIDEO_ID}&t=42s",
    f"https://youtu.be/{VIDEO_ID}?si=tracking",             # 2. shortened
    f"https://youtube.com/shorts/{VIDEO_ID}",               # 3. Shorts
    f"https://www.youtube.com/live/{VIDEO_ID}",
    f"https://www.youtube.com/embed/{VIDEO_ID}",
    f"m.youtube.com/watch?v={VIDEO_ID}",
])
def test_supported_url_formats(url):
    assert youtube.parse_video_id(url) == VIDEO_ID


@pytest.mark.parametrize("url, message", [
    ("https://www.youtube.com/watch?v=tooShort", "video ID"),
    ("https://www.youtube.com/playlist?list=PL123", "single video"),
    ("https://www.youtube.com/@creator", "single video"),
    ("https://vimeo.com/123456", "isn't a YouTube link"),
    ("", "Paste a YouTube link"),
])
def test_invalid_urls(url, message):
    with pytest.raises(ValidationFailed, match=message):
        youtube.parse_video_id(url)


# ---------------------------------------------------------------------------
# 5: private / unavailable videos, metadata
# ---------------------------------------------------------------------------


def test_oembed_metadata(client, google):
    info = client.post("/youtube/validate", json={"url": f"https://youtu.be/{VIDEO_ID}"}).json()
    assert info["title"] == "DP roadmap" and info["channel_title"] == "Asha Codes"
    assert info["duration_seconds"] is None and info["metadata_source"] == "oembed"


@pytest.mark.parametrize("status, message", [(401, "private"), (403, "private"), (404, "doesn't exist")])
def test_private_or_unavailable_video(client, google, status, message):
    google.oembed_status = status
    response = client.post("/youtube/validate", json={"url": f"https://youtu.be/{VIDEO_ID}"})
    assert response.status_code == 422 and message in response.json()["detail"]


def test_data_api_adds_duration_and_detects_private(client, google, monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "test-key")
    get_video_settings.cache_clear()
    google.data_api_items = [{
        "snippet": {"title": "DP roadmap", "channelTitle": "Asha Codes", "thumbnails": {"high": {"url": "t.jpg"}}},
        "contentDetails": {"duration": "PT1M10S", "caption": "true"},
        "status": {"privacyStatus": "public", "embeddable": True, "uploadStatus": "processed"},
    }]
    info = client.post("/youtube/validate", json={"url": VIDEO_ID and f"youtu.be/{VIDEO_ID}"}).json()
    assert info["duration_seconds"] == 70 and info["has_captions"] is True and info["metadata_source"] == "data_api"

    google.data_api_items = []
    response = client.post("/youtube/validate", json={"url": f"youtu.be/{VIDEO_ID}"})
    assert response.status_code == 422 and "private, deleted or unavailable" in response.json()["detail"]


def test_original_with_wrong_length_rejected_when_duration_known(client, google, video_env, monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "test-key")
    get_video_settings.cache_clear()
    google.data_api_items = [{
        "snippet": {"title": "DP roadmap", "channelTitle": "Asha", "thumbnails": {}},
        "contentDetails": {"duration": "PT1M10S"},
        "status": {"privacyStatus": "public", "embeddable": True, "uploadStatus": "processed"},
    }]
    source = _create(client)
    monkeypatch.setattr(media_tools, "probe", fake_probe(duration=300.0))
    response = client.post(f"/videos/{source['id']}/original-file", files={"file": ("x.mp4", b"x", "video/mp4")})
    assert response.status_code == 422 and "line up" in response.json()["detail"]
    assert client.get(f"/videos/{source['id']}").json()["source_file_available"] is False


def test_iso_duration():
    assert youtube.parse_iso_duration("PT1H2M3S") == 3723
    assert youtube.parse_iso_duration("PT45S") == 45
    assert youtube.parse_iso_duration("P1DT1S") == 86401


# ---------------------------------------------------------------------------
# Transcript parsing (pasted)
# ---------------------------------------------------------------------------


def test_parse_youtube_show_transcript_copy():
    segments = parse_transcript(YT_TRANSCRIPT, duration=70)
    assert len(segments) == 7
    assert segments[0] == {"start": 0.0, "end": 5.0, "text": "Most students learn dynamic programming in the wrong order."}
    assert segments[-1]["end"] <= 70


def test_parse_single_line_and_bracket_formats():
    text = "[00:00] Hello there everyone\n[00:04] Today we learn DP\n[00:09] Start with recursion\n0:15 then memoise"
    assert [s["start"] for s in parse_transcript(text)] == [0, 4, 9, 15]


def test_parse_srt_and_vtt():
    assert parse_transcript(SRT)[1]["start"] == 4.5
    vtt = "WEBVTT\n\n00:00.000 --> 00:03.000\n<c>Hello</c> world\n\n00:03.000 --> 00:06.000\nsecond line\n\n" \
          "00:06.000 --> 00:09.000\nthird line\n"
    assert [s["text"] for s in parse_transcript(vtt)] == ["Hello world", "second line", "third line"]


def test_plain_text_without_timestamps_is_rejected():
    with pytest.raises(ValidationFailed, match="needs timestamps"):
        parse_transcript("Just a paragraph of text without any timestamps at all. " * 5)


def test_transcript_longer_than_video_is_rejected():
    with pytest.raises(ValidationFailed, match="different video"):
        parse_transcript("10:00 a\n10:05 b\n10:09 c", duration=60)


# ---------------------------------------------------------------------------
# API flows
# ---------------------------------------------------------------------------


def _create(client, title=None):
    response = client.post("/videos/from-youtube", json={"url": f"https://youtu.be/{VIDEO_ID}", "clip_count": 3,
                                                           **({"title": title} if title else {})})
    assert response.status_code == 201, response.text
    return response.json()


def test_youtube_project_waits_for_transcript(client, google, video_env):
    source = _create(client)
    detail = client.get(f"/videos/{source['id']}").json()
    assert detail["source_kind"] == "youtube" and detail["status"] == "awaiting_transcript"
    assert detail["youtube_video_id"] == VIDEO_ID and detail["title"] == "DP roadmap"
    assert detail["clips"] == []
    # Nothing downloaded, no media file
    assert detail["source_file_available"] is False


def test_8_pasted_transcript_gives_suggestions_not_downloads(client, google, video_env, monkeypatch):
    def must_not_run(*_args, **_kwargs):
        raise AssertionError("local transcription must not run when a transcript was pasted")

    monkeypatch.setattr(transcriber, "transcribe", must_not_run)
    source = _create(client)
    response = client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT})
    assert response.status_code == 200, response.text
    detail = client.get(f"/videos/{source['id']}").json()
    assert detail["status"] == "completed" and detail["transcript_source"] == "manual"
    assert detail["clips"], "clips expected"
    for clip in detail["clips"]:
        assert clip["render_status"] == "not_rendered"
        assert clip["preview_url"] is None and clip["download_url"] is None  # never a fake download
        assert "original video file" in clip["render_error"]
    assert "timestamp suggestions" in detail["status_message"]
    assert video_env["storage"] == {}

    # Rendering is refused without the original file.
    response = client.post(f"/videos/{source['id']}/render", json={"clip_ids": [detail["clips"][0]["id"]]})
    assert response.status_code == 422 and "Attach the original" in response.json()["detail"]


def test_7_authorized_captions(client, google, video_env):
    source = _create(client)
    response = client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.test-token"})
    assert response.status_code == 200, response.text
    detail = client.get(f"/videos/{source['id']}").json()
    assert detail["status"] == "completed" and detail["transcript_source"] == "youtube_captions"
    assert detail["transcript"][0]["text"].startswith("Most students")
    # The token went only to Google and was not saved anywhere.
    assert all("ya29.test-token" not in str(row) for row in video_env["video_sources"])
    caption_calls = [c for c in google.calls if "captions" in c[0]]
    assert all(c[2]["Authorization"] == "Bearer ya29.test-token" for c in caption_calls)


def test_6_captions_not_accessible(client, google, video_env):
    source = _create(client)
    google.captions_status = 403  # not the owner
    response = client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.token"})
    assert response.status_code == 422 and "channel you signed in with" in response.json()["detail"]

    google.captions_status, google.tracks = 200, []  # owner, but no captions
    response = client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.token"})
    assert response.status_code == 422 and "no captions" in response.json()["detail"]
    assert client.get(f"/videos/{source['id']}").json()["status"] == "awaiting_transcript"


def test_tokens_for_other_apps_or_missing_scope_are_rejected(client, google, video_env):
    source = _create(client)
    google.token_aud = "someone-else.apps.googleusercontent.com"
    assert client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.other-test-token"}).status_code == 401
    google.token_aud, google.token_scope = CLIENT_ID, "openid email"
    assert client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.other-test-token"}).status_code == 401


def test_9_attach_original_then_render_selected(client, google, video_env, monkeypatch):
    source = _create(client)
    client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT})
    clips = client.get(f"/videos/{source['id']}").json()["clips"]

    # A file shorter than the transcript can't be the same video.
    monkeypatch.setattr(media_tools, "probe", fake_probe(duration=30.0))
    response = client.post(f"/videos/{source['id']}/original-file",
                           files={"file": ("other.mp4", b"x" * 10, "video/mp4")})
    assert response.status_code == 422
    assert "longer than this file" in response.json()["detail"]

    monkeypatch.setattr(media_tools, "probe", fake_probe(duration=70.0))
    response = client.post(f"/videos/{source['id']}/original-file",
                           files={"file": ("original.mp4", b"x" * 10, "video/mp4")})
    assert response.status_code == 200, response.text
    assert client.get(f"/videos/{source['id']}").json()["source_file_available"] is True

    chosen = [clips[0]["id"]]
    assert client.post(f"/videos/{source['id']}/render", json={"clip_ids": chosen}).status_code == 202
    after = {c["id"]: c for c in client.get(f"/videos/{source['id']}").json()["clips"]}
    assert after[chosen[0]]["render_status"] == "rendered" and after[chosen[0]]["download_url"]
    others = [c for cid, c in after.items() if cid not in chosen]
    assert all(c["render_status"] == "not_rendered" and c["download_url"] is None for c in others)


def test_original_file_before_transcript_runs_full_pipeline(client, google, video_env):
    source = _create(client)
    response = client.post(f"/videos/{source['id']}/original-file",
                           files={"file": ("original.mp4", b"x" * 10, "video/mp4")})
    assert response.status_code == 200, response.text
    detail = client.get(f"/videos/{source['id']}").json()
    assert detail["transcript_source"] == "whisper" and detail["status"] == "completed"
    assert all(c["render_status"] == "rendered" for c in detail["clips"])


def test_10_ffmpeg_unavailable(client, google, video_env, monkeypatch):
    unavailable = {"available": False, "version": None, "message": "FFmpeg is not installed or not found (ffmpeg missing)."}
    monkeypatch.setattr(media_tools, "ffmpeg_status", lambda: unavailable)
    monkeypatch.setattr(media_tools, "ffmpeg_available", lambda: False)

    caps = client.get("/videos/capabilities").json()
    assert caps["rendering"] is False and "not installed" in caps["ffmpeg_message"]

    # Transcript analysis still works without FFmpeg ...
    source = _create(client)
    assert client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT}).status_code == 200
    assert client.get(f"/videos/{source['id']}").json()["status"] == "completed"

    # ... but anything needing media processing says why, instead of silently skipping.
    upload = client.post("/videos/upload", data={"title": "x", "clip_count": "2", "kind": "video"},
                         files={"file": ("talk.mp4", b"x", "video/mp4")})
    assert upload.status_code == 422 and "not installed" in upload.json()["detail"]
    attach = client.post(f"/videos/{source['id']}/original-file", files={"file": ("o.mp4", b"x", "video/mp4")})
    assert attach.status_code == 503 and "not installed" in attach.json()["detail"]


def test_transcript_only_once_and_youtube_only(client, google, video_env):
    source = _create(client)
    client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT})
    again = client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT})
    assert again.status_code == 422 and "already" in again.json()["detail"]


def test_other_users_cannot_touch_youtube_projects(client, world, google, video_env):
    source = _create(client)
    world.user_id = USER_B
    assert client.get(f"/videos/{source['id']}").status_code == 404
    assert client.post(f"/videos/{source['id']}/transcript", json={"text": YT_TRANSCRIPT}).status_code == 404
    assert client.post(f"/videos/{source['id']}/youtube-captions", json={"access_token": "ya29.other-test-token"}).status_code == 404
    assert client.post(f"/videos/{source['id']}/original-file",
                       files={"file": ("o.mp4", b"x", "video/mp4")}).status_code == 404


def test_real_ffmpeg_detection_runs_the_binary():
    status = media_tools.ffmpeg_status()
    if not get_video_settings().ffmpeg_path:
        pytest.skip("FFmpeg not installed")
    assert status["available"] and status["version"].startswith("ffmpeg version")

