"""In-memory stand-ins for the Video-to-Reels feature (no network, no FFmpeg, no AI)."""

import uuid
from copy import deepcopy
from pathlib import Path

from services.video.media_tools import MediaInfo
from services.video.transcriber import Transcript
from tests.fakes import _now

SEGMENTS = [
    {"start": 0.0, "end": 4.0, "text": "Most students learn dynamic programming in the wrong order.",
     "words": [[0.0, 0.5, " Most"], [0.5, 1.2, " students"], [1.2, 1.8, " learn"], [1.8, 2.6, " dynamic"],
               [2.6, 3.4, " programming"], [3.4, 4.0, " wrong order."]]},
    {"start": 4.5, "end": 9.0, "text": "That is the biggest mistake you can make."},
    {"start": 9.5, "end": 20.0, "text": "First write the recursion, then add memoization to stop repeating work."},
    {"start": 20.5, "end": 31.0, "text": "Why does this work? Because you derive the table instead of memorising it."},
    {"start": 31.5, "end": 44.0, "text": "In my batch 40 students followed this order and solved twice as many problems!"},
    {"start": 44.5, "end": 58.0, "text": "So do ten classic problems deeply instead of two hundred random ones."},
    {"start": 58.5, "end": 70.0, "text": "Climbing stairs, house robber, coin change and knapsack. Master those."},
]


class FakeVideoRepository:
    def __init__(self, user_id: str, tables: dict):
        self.user_id = user_id
        self.tables = tables
        tables.setdefault("video_sources", [])
        tables.setdefault("video_clips", [])
        tables.setdefault("storage", {})

    def _rows(self, table, **filters):
        return [r for r in self.tables[table]
                if r["user_id"] == self.user_id and all(r.get(k) == v for k, v in filters.items())]

    def _insert(self, table, values):
        row = {"id": str(uuid.uuid4()), "created_at": _now(), "updated_at": _now(), "progress": 0,
               "transcript": None, "linked_project_id": None, "source_url": None,
               **deepcopy(values), "user_id": self.user_id}
        self.tables[table].append(row)
        return deepcopy(row)

    def _update(self, table, row_id, values):
        rows = self._rows(table, id=row_id)
        if not rows:
            return None
        rows[0].update(deepcopy(values))
        return deepcopy(rows[0])

    def create_source(self, values):
        return self._insert("video_sources", values)

    def get_source(self, source_id):
        rows = self._rows("video_sources", id=source_id)
        return deepcopy(rows[0]) if rows else None

    def list_sources(self):
        return deepcopy(self._rows("video_sources"))

    def update_source(self, source_id, values):
        return self._update("video_sources", source_id, values)

    def count_active_sources(self):
        active = {"queued", "downloading", "transcribing", "selecting", "rendering"}
        return sum(r["status"] in active for r in self._rows("video_sources"))

    def insert_clip(self, values):
        return self._insert("video_clips", values)

    def list_clips(self, source_id):
        return sorted(deepcopy(self._rows("video_clips", video_source_id=source_id)), key=lambda c: c["clip_index"])

    def clip_counts(self):
        counts = {}
        for row in self._rows("video_clips"):
            entry = counts.setdefault(row["video_source_id"], {"clips": 0, "rendered": 0})
            entry["clips"] += 1
            entry["rendered"] += row["render_status"] == "rendered"
        return counts

    def get_clip(self, clip_id):
        rows = self._rows("video_clips", id=clip_id)
        return deepcopy(rows[0]) if rows else None

    def update_clip(self, clip_id, values):
        return self._update("video_clips", clip_id, values)

    def upload_clip_file(self, bucket, object_path, file_path: Path):
        assert object_path.startswith(self.user_id + "/")  # mirrors the storage RLS folder rule
        self.tables["storage"][object_path] = file_path.read_bytes()

    def signed_url(self, bucket, object_path, expires_in=3600):
        return f"https://storage.test/{bucket}/{object_path}?token=signed"


class SyncRunner:
    """Runs jobs immediately so tests can assert on the final state."""

    def submit(self, key, fn, *args):
        fn(*args)

    def is_active(self, key):
        return False


def fake_probe(has_video=True, duration=70.0):
    return lambda path: MediaInfo(duration_seconds=duration, has_video=has_video, has_audio=True,
                                  width=1280 if has_video else None, height=720 if has_video else None)


def fake_transcribe(path, on_progress=None):
    return Transcript(segments=deepcopy(SEGMENTS), language="en", text=" ".join(s["text"] for s in SEGMENTS))


def fake_render(source, segments, start, end, work_dir: Path):
    work_dir.mkdir(parents=True, exist_ok=True)
    output = work_dir / "clip.mp4"
    output.write_bytes(b"fake-mp4-" + f"{start}-{end}".encode())
    return output
