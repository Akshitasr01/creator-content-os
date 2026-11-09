"""Video Link intake - permitted sources only.

Supported: direct HTTPS links to a media FILE the creator owns or has rights to
(e.g. a file in their own cloud storage / CDN ending in .mp4, .mov, .mp3 ...).

NOT supported, by design: YouTube, Instagram, TikTok, Facebook, X, Vimeo,
LinkedIn and similar platform pages. Their terms do not permit downloading by
third-party tools, so we never scrape them. Creators can download their own
video from the platform's creator dashboard and use "Upload Video" instead.
"""

import ipaddress
import socket
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlparse

import httpx

from core.errors import ValidationFailed
from core.video_config import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS

PLATFORM_HOSTS = {
    "youtube.com": "YouTube", "youtu.be": "YouTube", "instagram.com": "Instagram",
    "tiktok.com": "TikTok", "facebook.com": "Facebook", "fb.watch": "Facebook",
    "x.com": "X", "twitter.com": "X", "vimeo.com": "Vimeo", "linkedin.com": "LinkedIn",
    "twitch.tv": "Twitch", "dailymotion.com": "Dailymotion", "snapchat.com": "Snapchat",
    "drive.google.com": "Google Drive", "dropbox.com": "Dropbox",
}

PLATFORM_HELP = {
    "YouTube": "Use the 'YouTube video link' option instead: it previews the video and works from its transcript.",
    "Google Drive": "Download the file from Drive, then use Upload Video.",
    "Dropbox": "Download the file from Dropbox, then use Upload Video.",
}

MAX_REDIRECTS = 3


def _platform_for(host: str) -> str | None:
    host = host.lower().removeprefix("www.").removeprefix("m.")
    for domain, name in PLATFORM_HOSTS.items():
        if host == domain or host.endswith("." + domain):
            return name
    return None


def _check_public_host(host: str) -> None:
    """Block localhost / private network targets (server-side request forgery)."""
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as error:
        raise ValidationFailed("That link's website could not be found.") from error
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            raise ValidationFailed("Links to private or local network addresses are not allowed.")


def validate_media_url(url: str, resolve_host: bool = True) -> str:
    """Return the media kind ('video' | 'audio') or raise a clear ValidationFailed."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValidationFailed("Enter a full link starting with https://")

    platform = _platform_for(parsed.hostname)
    if platform:
        help_text = PLATFORM_HELP.get(platform, f"Download your own video from {platform}, then use Upload Video.")
        if platform == "YouTube":
            raise ValidationFailed(f"This is a YouTube page, not a video file. {help_text}")
        raise ValidationFailed(
            f"{platform} links can't be processed: {platform} does not permit downloading by third-party "
            f"tools. {help_text}"
        )

    extension = PurePosixPath(parsed.path).suffix.lower()
    if extension in VIDEO_EXTENSIONS:
        kind = "video"
    elif extension in AUDIO_EXTENSIONS:
        kind = "audio"
    else:
        raise ValidationFailed(
            "Only direct links to a media file are supported (ending in .mp4, .mov, .webm, .mp3, .m4a, .wav …). "
            "For anything else, use Upload Video."
        )

    if resolve_host:
        _check_public_host(parsed.hostname)
    return kind


def download_media(url: str, destination: Path, max_bytes: int, on_progress=None) -> None:
    """Stream a validated link to disk with a size cap. Redirects are re-validated."""
    current = url
    with httpx.Client(timeout=httpx.Timeout(30.0, read=120.0), follow_redirects=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            with client.stream("GET", current, headers={"User-Agent": "CreatorContentOS/1.0"}) as response:
                if response.is_redirect:
                    current = urljoin(current, response.headers.get("location", ""))
                    parsed = urlparse(current)
                    if parsed.scheme != "https" or not parsed.hostname or _platform_for(parsed.hostname):
                        raise ValidationFailed("The link redirected to an unsupported location.")
                    _check_public_host(parsed.hostname)
                    continue
                if response.status_code != 200:
                    raise ValidationFailed(f"The link could not be downloaded (HTTP {response.status_code}).")

                content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                if content_type and not content_type.startswith(("video/", "audio/", "application/octet-stream",
                                                                  "binary/octet-stream")):
                    raise ValidationFailed("The link does not point to a video or audio file.")
                declared = int(response.headers.get("content-length") or 0)
                if declared > max_bytes:
                    raise ValidationFailed(f"The file is larger than the {max_bytes // (1024 * 1024)} MB link limit.")

                written = 0
                with open(destination, "wb") as handle:
                    for chunk in response.iter_bytes(1024 * 1024):
                        written += len(chunk)
                        if written > max_bytes:
                            raise ValidationFailed(
                                f"The file is larger than the {max_bytes // (1024 * 1024)} MB link limit.")
                        handle.write(chunk)
                        if on_progress and declared:
                            on_progress(written / declared)
                return
    raise ValidationFailed("The link redirected too many times.")
