"""YouTube integration using official, permitted methods only.

* Video ID parsing for watch / youtu.be / shorts / live / embed links.
* Metadata: YouTube oEmbed (official, free, no key) and, if YOUTUBE_API_KEY is set,
  the YouTube Data API v3 (duration, privacy, captions flag).
* Captions: YouTube Data API captions.list + captions.download, ONLY with an OAuth
  access token from the signed-in creator (scope youtube.force-ssl). YouTube only
  allows this for videos the account can edit, i.e. the creator's own videos.

Never used: downloading the video, scraping watch pages, or unofficial transcript
endpoints. The access token is used for this one request and never stored or logged.
"""

import logging
import re
from dataclasses import asdict, dataclass
from urllib.parse import parse_qs, urlparse

import httpx

from core.errors import AuthError, ValidationFailed
from core.video_config import get_video_settings
from services.video.transcript_parser import parse_srt

logger = logging.getLogger(__name__)

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
                 "youtube-nocookie.com", "www.youtube-nocookie.com"}
CAPTION_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"
_TIMEOUT = httpx.Timeout(15.0)


# ---------------------------------------------------------------------------
# URL -> video id
# ---------------------------------------------------------------------------


def is_youtube_url(url: str) -> bool:
    host = (urlparse(url.strip() if "://" in url else "https://" + url.strip()).hostname or "").lower()
    return host in YOUTUBE_HOSTS or host == "youtu.be" or host.endswith(".youtube.com")


def parse_video_id(url: str) -> str:
    """Return the 11-character video id, or raise ValidationFailed with a clear reason."""
    raw = url.strip()
    if not raw:
        raise ValidationFailed("Paste a YouTube link.")
    parsed = urlparse(raw if "://" in raw else "https://" + raw)
    host = (parsed.hostname or "").lower()
    parts = [p for p in parsed.path.split("/") if p]

    candidate = None
    if host == "youtu.be":
        candidate = parts[0] if parts else None
    elif host in YOUTUBE_HOSTS or host.endswith(".youtube.com"):
        if parts[:1] == ["watch"]:
            candidate = parse_qs(parsed.query).get("v", [None])[0]
        elif len(parts) >= 2 and parts[0] in ("shorts", "live", "embed", "v"):
            candidate = parts[1]
        elif parts[:1] in (["playlist"], ["channel"], ["c"], ["user"]) or (parts and parts[0].startswith("@")):
            raise ValidationFailed("That's a channel or playlist link. Paste the link of a single video.")
    else:
        raise ValidationFailed("That isn't a YouTube link. Use a youtube.com or youtu.be video link.")

    if not candidate or not VIDEO_ID.match(candidate):
        raise ValidationFailed(
            "Couldn't find a video ID in that link. Supported: youtube.com/watch?v=…, youtu.be/…, "
            "youtube.com/shorts/…, youtube.com/live/… and youtube.com/embed/…")
    return candidate


def watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------


@dataclass
class VideoInfo:
    video_id: str
    url: str
    title: str
    channel_title: str | None
    thumbnail_url: str | None
    duration_seconds: float | None
    embeddable: bool
    has_captions: bool | None  # only known with a Data API key
    metadata_source: str        # "oembed" or "data_api"

    def to_dict(self) -> dict:
        return asdict(self)


def parse_iso_duration(value: str) -> float | None:
    """'PT1H2M3S' -> 3723.0"""
    match = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value or "")
    if not match:
        return None
    days, hours, minutes, seconds = (int(g or 0) for g in match.groups())
    return float(((days * 24 + hours) * 60 + minutes) * 60 + seconds)


def _get(url: str, **kwargs) -> httpx.Response:
    try:
        return httpx.get(url, timeout=_TIMEOUT, **kwargs)
    except httpx.HTTPError as error:
        raise ValidationFailed("Couldn't reach YouTube. Check your internet connection and try again.") from error


def _data_api_info(video_id: str, key: str) -> VideoInfo:
    response = _get("https://www.googleapis.com/youtube/v3/videos",
                    params={"part": "snippet,contentDetails,status", "id": video_id, "key": key})
    if response.status_code in (400, 403):
        reason = (response.json().get("error", {}).get("errors") or [{}])[0].get("reason", "")
        if reason in ("quotaExceeded", "dailyLimitExceeded"):
            raise ValidationFailed("The YouTube Data API daily quota is used up. Try again tomorrow.")
        raise ValidationFailed("The YouTube Data API key was rejected. Check YOUTUBE_API_KEY in backend/.env.")
    if response.status_code != 200:
        raise ValidationFailed(f"YouTube returned an error ({response.status_code}). Try again.")
    items = response.json().get("items") or []
    if not items:
        raise ValidationFailed("This video is private, deleted or unavailable.")
    item = items[0]
    snippet, details, status = item["snippet"], item["contentDetails"], item["status"]
    if status.get("privacyStatus") == "private":
        raise ValidationFailed("This video is private. Make it public or unlisted, or upload the original file.")
    if status.get("uploadStatus") not in (None, "processed"):
        raise ValidationFailed("This video hasn't finished processing on YouTube yet.")
    thumbs = snippet.get("thumbnails", {})
    thumb = (thumbs.get("maxres") or thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
    return VideoInfo(
        video_id=video_id, url=watch_url(video_id), title=snippet.get("title", ""),
        channel_title=snippet.get("channelTitle"), thumbnail_url=thumb,
        duration_seconds=parse_iso_duration(details.get("duration", "")),
        embeddable=bool(status.get("embeddable", True)),
        has_captions=details.get("caption") == "true", metadata_source="data_api",
    )


def _oembed_info(video_id: str) -> VideoInfo:
    response = _get("https://www.youtube.com/oembed", params={"url": watch_url(video_id), "format": "json"})
    if response.status_code in (401, 403):
        raise ValidationFailed("This video is private or its owner has disabled embedding, so it can't be previewed.")
    if response.status_code == 404:
        raise ValidationFailed("This video doesn't exist or is no longer available.")
    if response.status_code == 400:
        raise ValidationFailed("YouTube didn't recognise this video link.")
    if response.status_code != 200:
        raise ValidationFailed(f"YouTube returned an error ({response.status_code}). Try again.")
    data = response.json()
    return VideoInfo(
        video_id=video_id, url=watch_url(video_id), title=data.get("title", ""),
        channel_title=data.get("author_name"), thumbnail_url=data.get("thumbnail_url"),
        duration_seconds=None, embeddable=True, has_captions=None, metadata_source="oembed",
    )


def fetch_video_info(url: str) -> VideoInfo:
    video_id = parse_video_id(url)
    key = get_video_settings().youtube_api_key
    return _data_api_info(video_id, key) if key else _oembed_info(video_id)


# ---------------------------------------------------------------------------
# Authorized captions (creator's own videos, OAuth access token)
# ---------------------------------------------------------------------------


def verify_access_token(access_token: str) -> None:
    """The token must be issued to OUR OAuth client and include the captions scope."""
    client_id = get_video_settings().google_oauth_client_id
    if not client_id:
        raise ValidationFailed("Google sign-in isn't configured (GOOGLE_OAUTH_CLIENT_ID is missing in backend/.env).")
    response = _get("https://oauth2.googleapis.com/tokeninfo", params={"access_token": access_token})
    if response.status_code != 200:
        raise AuthError("Your Google sign-in expired. Click 'Get captions from YouTube' again.")
    info = response.json()
    if info.get("aud") != client_id and info.get("azp") != client_id:
        raise AuthError("This Google sign-in wasn't issued to Creator Content OS.")
    if CAPTION_SCOPE not in (info.get("scope") or "").split():
        raise AuthError("YouTube caption permission wasn't granted. Sign in again and allow access.")


def _pick_track(tracks: list[dict], preferred_language: str | None) -> dict:
    def rank(track: dict) -> tuple:
        snippet = track.get("snippet", {})
        manual = snippet.get("trackKind", "").lower() != "asr"
        language_match = bool(preferred_language) and snippet.get("language", "").startswith(preferred_language)
        return (manual, language_match, not snippet.get("isDraft", False))

    return max(tracks, key=rank)


def fetch_captions(video_id: str, access_token: str, preferred_language: str | None = "en") -> tuple[list[dict], str | None]:
    """Return (segments, language) from the video's caption track."""
    verify_access_token(access_token)
    headers = {"Authorization": f"Bearer {access_token}"}

    listing = _get("https://www.googleapis.com/youtube/v3/captions",
                   params={"part": "snippet", "videoId": video_id}, headers=headers)
    if listing.status_code == 403:
        raise ValidationFailed(
            "YouTube only shares captions for videos on the channel you signed in with. "
            "Sign in with the channel that owns this video, or paste the transcript / upload the original file.")
    if listing.status_code == 404:
        raise ValidationFailed("YouTube couldn't find this video for your account.")
    if listing.status_code != 200:
        raise ValidationFailed(f"YouTube returned an error while listing captions ({listing.status_code}).")
    tracks = [t for t in listing.json().get("items", []) if t.get("snippet", {}).get("status") != "failed"]
    if not tracks:
        raise ValidationFailed(
            "This video has no captions yet (YouTube may still be generating automatic captions). "
            "Paste the transcript or upload the original file instead.")

    track = _pick_track(tracks, preferred_language)
    download = _get(f"https://www.googleapis.com/youtube/v3/captions/{track['id']}",
                    params={"tfmt": "srt"}, headers=headers)
    if download.status_code == 403:
        raise ValidationFailed(
            "YouTube refused the caption download: only accounts that can edit this video may download its captions.")
    if download.status_code != 200:
        raise ValidationFailed(f"YouTube returned an error while downloading captions ({download.status_code}).")

    segments = parse_srt(download.text)
    if not segments:
        raise ValidationFailed("The caption track was empty.")
    return segments, track.get("snippet", {}).get("language")
