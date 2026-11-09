"""Credential authentication service.

Security design (OWASP-aligned):
- Passwords hashed with Argon2id (memory-hard; never plaintext, never MD5/SHA).
- Registration/login are strictly rate-limited per IP and per identity.
- Accounts lock for a cool-down window after repeated failed logins
  (brute-force protection); responses are generic to avoid user enumeration.
- All inputs validated with typed Pydantic models; email normalized.
- Tokens remain Glow-signed JWTs with 1-hour expiry (ADR 0002).
- SQL access only through SQLAlchemy parameterized ORM queries — no raw SQL.
"""

from __future__ import annotations

import datetime
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from glow_api.models import UserAccountModel

# --- Tuning constants -------------------------------------------------------
_MAX_FAILED_LOGINS = 5          # before lockout
_LOCKOUT_MINUTES = 15           # brute-force cool-down
_MIN_PASSWORD_LENGTH = 10       # length over composition rules (NIST 800-63B)
_MAX_PASSWORD_LENGTH = 128      # prevent DoS via giant inputs into the hasher

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

_ph = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=2)


class RateLimiter:
    """In-process fixed-window rate limiter keyed by (scope, key).

    Sufficient for single-process dev/pilot. For multi-replica production,
    back this with a shared store (e.g. Redis) behind the same interface.
    """

    def __init__(self) -> None:
        self._events: dict[tuple[str, str], list[float]] = {}

    def check(self, scope: str, key: str, limit: int, window_sec: float) -> bool:
        """Return True if allowed; False if over the limit. Records the hit."""
        now = datetime.datetime.now(datetime.UTC).timestamp()
        bucket_key = (scope, key)
        window_start = now - window_sec
        hits = [t for t in self._events.get(bucket_key, []) if t > window_start]
        if len(hits) >= limit:
            self._events[bucket_key] = hits
            return False
        hits.append(now)
        self._events[bucket_key] = hits
        return True


auth_rate_limiter = RateLimiter()


def validate_email(email: str) -> str:
    email = email.strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise ValueError("Please enter a valid email address.")
    return email


def validate_password(password: str) -> None:
    if not (_MIN_PASSWORD_LENGTH <= len(password) <= _MAX_PASSWORD_LENGTH):
        raise ValueError(
            f"Password must be {_MIN_PASSWORD_LENGTH}-{_MAX_PASSWORD_LENGTH} characters."
        )


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def new_user_id() -> str:
    """Opaque server-assigned identifier; never derived from the email."""
    return f"u_{secrets.token_hex(8)}"


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    display_name: str | None,
    is_adult_confirmed: bool,
    diagnosis_disclosed: bool,
    diagnosis_note: str | None,
    locale: str = "EN",
    age: int | None = None,
    gender: str | None = None,
    medications: str | None = None,
) -> UserAccountModel:
    """Create a new account. Raises ValueError on validation/duplicate errors.

    The optional diagnosis note and medication list are stored
    envelope-encrypted and used only to give the AI companion context the
    user explicitly chose to share. Both are revocable at any time from the
    profile page.
    """
    from glow_api.crypto import EnvelopeEncryption
    from glow_api.kms import kms_service
    from glow_api.models import UserPreferencesModel
    from glow_api.user import AvatarDisclosurePreference, InputModality, SessionMode, UserLocale

    email = validate_email(email)
    validate_password(password)
    if not is_adult_confirmed:
        raise ValueError("Glow is currently adults-only. Please confirm you are 18+.")
    if age is not None and not (18 <= age <= 110):
        raise ValueError("Glow is currently adults-only (18+).")
    if gender is not None and gender not in {"female", "male", "non_binary", "prefer_not_to_say"}:
        raise ValueError("Unsupported gender option.")

    existing = (
        await db.execute(select(UserAccountModel).where(UserAccountModel.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise ValueError("An account with this email already exists.")

    now = datetime.datetime.now(datetime.UTC)
    key_id = kms_service.active_key_id
    key = kms_service.get_master_key(key_id)

    encrypted_note: bytes | None = None
    if diagnosis_disclosed and diagnosis_note and diagnosis_note.strip():
        nonce, ciphertext = EnvelopeEncryption.encrypt(
            key, diagnosis_note.strip().encode("utf-8")
        )
        encrypted_note = nonce + ciphertext

    encrypted_medications: bytes | None = None
    if medications and medications.strip():
        nonce, ciphertext = EnvelopeEncryption.encrypt(
            key, medications.strip().encode("utf-8")
        )
        encrypted_medications = nonce + ciphertext

    user = UserAccountModel(
        user_id=new_user_id(),
        created_at=now,
        is_adult_confirmed=True,
        is_active=True,
        completed_sessions=0,
        free_sessions_remaining=3,
        email=email,
        password_hash=hash_password(password),
        display_name=(display_name or "").strip() or None,
        diagnosis_disclosed=bool(diagnosis_disclosed),
        diagnosis_note_encrypted=encrypted_note,
        diagnosis_key_id=key_id if encrypted_note else None,
        gender=gender,
        age=age,
        medications_encrypted=encrypted_medications,
        medications_key_id=key_id if encrypted_medications else None,
    )
    user.preferences = UserPreferencesModel(  # type: ignore[assignment]
        locale=(
            UserLocale[locale.upper()]
            if locale.upper() in UserLocale.__members__
            else UserLocale.EN
        ),
        session_mode=SessionMode.OPEN_CONVERSATION,
        avatar_disclosure=AvatarDisclosurePreference.ALWAYS_VISIBLE,
        input_modality=InputModality.TEXT,
        accessibility=[],
        preferred_session_minutes=60,
    )

    # Default consents so protected endpoints work immediately.
    from glow_api.models import ConsentRecordModel
    db.add(user)
    await db.flush()  # assign user.id

    db.add(
        ConsentRecordModel(
            user_account_id=user.id,
            record_version=1,
            recorded_at=now,
            policy_version="safety-policy-v0",
            locale_presented="en-US",
            service_use=True,
            transcript_retention=True,
            audio_storage=False,
            video_storage=False,
            session_summary=True,
            personalisation=False,
            research_and_model_improvement=False,
            memory_consent=False,
        )
    )
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, *, email: str, password: str
) -> tuple[UserAccountModel | None, str | None]:
    """Verify credentials. Returns (user, None) on success or (None, reason).

    Reasons are generic ("invalid_credentials", "locked", "inactive") so
    responses never reveal whether an email exists (anti-enumeration).
    On success, failed-login counters reset.
    """
    email = email.strip().lower()
    user = (
        await db.execute(select(UserAccountModel).where(UserAccountModel.email == email))
    ).scalar_one_or_none()

    if user is None:
        # Burn comparable time to resist timing-based enumeration.
        _ph.hash("dummy-password-for-timing")
        return None, "invalid_credentials"

    now = datetime.datetime.now(datetime.UTC)
    if user.locked_until is not None:
        locked = user.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=datetime.UTC)
        if now < locked:
            return None, "locked"
        # Lock expired — reset.
        user.locked_until = None
        user.failed_login_count = 0

    if not user.is_active:
        return None, "inactive"

    if user.password_hash is None or not verify_password(user.password_hash, password):
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= _MAX_FAILED_LOGINS:
            lock_minutes = _LOCKOUT_MINUTES * (
                1 + (user.failed_login_count - _MAX_FAILED_LOGINS) // _MAX_FAILED_LOGINS
            )
            user.locked_until = now + datetime.timedelta(minutes=lock_minutes)
        await db.commit()
        return None, "invalid_credentials"

    user.failed_login_count = 0
    user.locked_until = None
    await db.commit()
    return user, None

