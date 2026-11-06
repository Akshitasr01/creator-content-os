"""Creator profile + platform preferences (PDF step 7)."""

from core.errors import NotFoundError
from db.repository import Repository
from schemas.profile import CreatorProfileIn

PROFILE_FIELDS = (
    "creator_name", "niche", "audience", "language", "tone",
    "style_description", "things_to_avoid", "sample_posts", "target_platforms",
)


def get_profile(repo: Repository) -> dict | None:
    profile = repo.get_profile()
    if profile is None:
        return None
    return {**profile, "platform_preferences": repo.list_platform_preferences()}


def require_profile(repo: Repository) -> dict:
    profile = get_profile(repo)
    if profile is None:
        raise NotFoundError("Complete your creator profile first.")
    return profile


def save_profile(repo: Repository, data: CreatorProfileIn) -> dict:
    """Create the profile on first save, update it afterwards (PUT semantics)."""
    values = data.model_dump(include=set(PROFILE_FIELDS))
    existing = repo.get_profile()
    if existing is None:
        repo.insert_profile(values)
    else:
        repo.update_profile(existing["id"], values)

    for preference in data.platform_preferences:
        repo.upsert_platform_preference(preference.model_dump())

    return require_profile(repo)


def preference_for(profile: dict, platform: str) -> dict | None:
    for preference in profile.get("platform_preferences") or []:
        if preference.get("platform") == platform:
            return preference
    return None
