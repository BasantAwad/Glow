"""Credential auth, profile (incl. optional diagnosis disclosure), and
wellness endpoints (private journal + mood tracking).

Security posture:
- Strict per-IP rate limits on register/login; generic error messages.
- Argon2id password hashing; account lockout on repeated failures.
- All queries via SQLAlchemy ORM (parameterized) — no SQL injection surface.
- Journal content and diagnosis notes are envelope-encrypted at rest.
- Every journal/mood/profile read/write is scoped to the authenticated user.
- Responses never echo passwords or internal ids beyond the session token.
"""

from __future__ import annotations

import datetime
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from glow_api.auth_service import (
    RateLimiter,
    authenticate_user,
    register_user,
)
from glow_api.crypto import EnvelopeEncryption
from glow_api.database import get_db_session
from glow_api.dependencies import get_auth_provider, get_current_user
from glow_api.errors import ProviderNotConfiguredError
from glow_api.kms import kms_service
from glow_api.models import AuthTokenModel, JournalEntryModel, MoodEntryModel, UserAccountModel
from glow_api.settings import get_settings
from glow_api.user import UserAccount

router = APIRouter(tags=["auth", "profile", "wellness"])


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    if not settings.auth_cookie_enabled:
        return
    secure = settings.auth_cookie_secure
    if secure is None:
        secure = settings.environment == "production"
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=bool(secure),
        samesite=settings.auth_cookie_samesite,
        path="/",
        max_age=3600,  # matches JWT lifetime
    )

_register_limiter = RateLimiter()
_login_limiter = RateLimiter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    display_name: str | None = Field(default=None, max_length=60)
    is_adult_confirmed: bool = False
    # UI language at signup ("EN"|"AR"|"ES"|"FR") → drives AI reply language.
    locale: str = Field(default="EN", pattern="^(EN|AR|ES|FR)$")
    # Optional diagnosis disclosure — explicit, granular, revocable consent.
    diagnosis_disclosed: bool = False
    diagnosis_note: str | None = Field(default=None, max_length=2000)
    # Intake: age gates the adults-only product (validated 18+).
    age: int = Field(ge=18, le=110)
    # Intake: gender (user-declared, "prefer_not_to_say" available).
    gender: str = Field(pattern="^(female|male|non_binary|prefer_not_to_say)$")
    # Optional medication disclosure — encrypted, revocable, like diagnosis.
    medications: str | None = Field(default=None, max_length=1000)


class RegisterResponse(BaseModel):
    token: str
    user_id: str
    display_name: str | None


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    token: str
    user_id: str
    display_name: str | None


class ProfileResponse(BaseModel):
    user_id: str
    display_name: str | None
    created_at: datetime.datetime
    diagnosis_disclosed: bool
    diagnosis_note: str | None  # decrypted only for the owning user
    age: int | None
    gender: str | None
    medications_disclosed: bool
    medications: str | None  # decrypted only for the owning user
    free_sessions_remaining: int


class DiagnosisUpdateRequest(BaseModel):
    diagnosis_disclosed: bool
    diagnosis_note: str | None = Field(default=None, max_length=2000)


class MedicationsUpdateRequest(BaseModel):
    medications: str | None = Field(default=None, max_length=1000)


class EmailRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class JournalCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    # Large limit so hand-drawn pages and device photo stickers can be stored
    # as compact data URLs inside the encrypted journal entry.
    content: str = Field(min_length=1, max_length=5_000_000)
    mood_at_write: int | None = Field(default=None, ge=1, le=7)


class JournalEntryResponse(BaseModel):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime | None
    title: str | None
    content: str
    mood_at_write: int | None


class MoodSetRequest(BaseModel):
    mood: int = Field(ge=1, le=7)
    # One check-in can hold several emotions (e.g. calm + tired + hopeful).
    emotions: list[str] = Field(default_factory=list, max_length=8)
    note: str | None = Field(default=None, max_length=280)


class MoodEntryResponse(BaseModel):
    id: int
    day_utc: str
    mood: int
    emotions: list[str] = Field(default_factory=list)
    note: str | None
    created_at: datetime.datetime


def _auth_link_url(kind: str, raw_token: str) -> str:
    from glow_api.settings import get_settings

    base = (get_settings().web_base_url or "http://localhost:3000").rstrip("/")
    path = "/verify-email" if kind == "verify_email" else "/reset-password"
    return f"{base}{path}?token={raw_token}"


async def _issue_auth_link(
    db: AsyncSession, user: UserAccountModel, kind: str, subject: str
) -> None:
    """Create a single-use token and 'send' its link (Resend or dev-log)."""
    from glow_api.auth_tokens import expiry, new_token, token_hash
    from glow_api.email_sender import send_auth_link
    from glow_api.models import AuthTokenModel

    raw = new_token()
    db.add(
        AuthTokenModel(
            user_account_id=user.id,
            kind=kind,
            token_hash=token_hash(raw),
            expires_at=expiry(),
            created_at=datetime.datetime.now(datetime.UTC),
        )
    )
    await db.commit()
    send_auth_link(user.email or "", subject, _auth_link_url(kind, raw))


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _issue(user: UserAccountModel) -> tuple[str, str]:

    provider = get_auth_provider()
    try:
        token = provider.issue_token(
            user.user_id, device_id="web", is_adult_confirmed=True
        )
    except ProviderNotConfiguredError as e:
        raise HTTPException(status_code=503, detail="auth_not_configured") from e
    return token, user.user_id


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@router.post("/auth/register", response_model=RegisterResponse)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> RegisterResponse:
    ip = _client_ip(request)
    if not _register_limiter.check("register", ip, limit=5, window_sec=3600):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    try:
        user = await register_user(
            db,
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
            is_adult_confirmed=payload.is_adult_confirmed,
            diagnosis_disclosed=payload.diagnosis_disclosed,
            diagnosis_note=payload.diagnosis_note,
            locale=payload.locale,
            age=payload.age,
            gender=payload.gender,
            medications=payload.medications,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    token, user_id = _issue(user)
    _set_auth_cookie(response, token)
    try:
        await _issue_auth_link(db, user, "verify_email", "Confirm your Glow email")
    except Exception:
        # Never let email delivery break registration.
        pass
    return RegisterResponse(token=token, user_id=user_id, display_name=user.display_name)


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> LoginResponse:
    ip = _client_ip(request)
    if not _login_limiter.check("login-ip", ip, limit=20, window_sec=900):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    if not _login_limiter.check("login-email", payload.email.lower(), limit=10, window_sec=900):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user, reason = await authenticate_user(
        db, email=payload.email, password=payload.password
    )
    if user is None:
        if reason == "locked":
            raise HTTPException(
                status_code=423,
                detail="Account temporarily locked after repeated failed logins. Try again soon.",
            )
        # Generic message: never reveal whether the email exists.
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if get_settings().require_email_verification and not user.email_verified_at:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in. Check your inbox for a confirmation link.",
        )

    token, user_id = _issue(user)
    _set_auth_cookie(response, token)
    return LoginResponse(token=token, user_id=user_id, display_name=user.display_name)


@router.post("/auth/logout")
async def logout(response: Response) -> dict[str, bool]:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        samesite=settings.auth_cookie_samesite,
    )
    return {"ok": True}


@router.post("/auth/request-password-reset")
async def request_password_reset(
    payload: EmailRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    """Request a reset link. Always returns success (no account enumeration)."""
    ip = _client_ip(request)
    if not _login_limiter.check("reset-ip", ip, limit=5, window_sec=3600):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    user = (
        await db.execute(
            select(UserAccountModel).where(
                UserAccountModel.email == payload.email.strip().lower()
            )
        )
    ).scalar_one_or_none()
    if user is not None:
        try:
            await _issue_auth_link(db, user, "password_reset", "Reset your Glow password")
            await db.commit()
        except Exception:
            await db.rollback()
    return {"ok": True}


@router.post("/auth/verify-email")
async def verify_email(
    payload: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    from glow_api.auth_tokens import is_valid, token_hash, verify_email as kind

    row = (
        await db.execute(
            select(AuthTokenModel).where(
                AuthTokenModel.token_hash == token_hash(payload.token)
            )
        )
    ).scalar_one_or_none()
    if row is None or row.kind != kind or not is_valid(row, payload.token):
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    row.used_at = datetime.datetime.now(datetime.UTC)
    user = (
        await db.execute(select(UserAccountModel).where(UserAccountModel.id == row.user_account_id))
    ).scalar_one()
    user.email_verified_at = datetime.datetime.now(datetime.UTC)
    await db.commit()
    return {"ok": True}


@router.post("/auth/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    from glow_api.auth_tokens import is_valid, password_reset as kind, token_hash
    from glow_api.auth_service import hash_password, validate_password

    try:
        validate_password(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    row = (
        await db.execute(
            select(AuthTokenModel).where(AuthTokenModel.token_hash == token_hash(payload.token))
        )
    ).scalar_one_or_none()
    if row is None or row.kind != kind or not is_valid(row, payload.token):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    row.used_at = datetime.datetime.now(datetime.UTC)
    user = (
        await db.execute(select(UserAccountModel).where(UserAccountModel.id == row.user_account_id))
    ).scalar_one()
    user.password_hash = hash_password(payload.new_password)
    user.failed_login_count = 0
    user.locked_until = None
    # Invalidate any other outstanding tokens for this user.
    others = (
        await db.execute(
            select(AuthTokenModel).where(
                AuthTokenModel.user_account_id == user.id,
                AuthTokenModel.used_at.is_(None),
            )
        )
    ).scalars().all()
    now = datetime.datetime.now(datetime.UTC)
    for other in others:
        if other.id != row.id:
            other.used_at = now
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile (incl. optional diagnosis disclosure)
# ---------------------------------------------------------------------------


def _decrypt_note(user_row: UserAccountModel) -> str | None:
    if not user_row.diagnosis_note_encrypted or not user_row.diagnosis_key_id:
        return None
    key = kms_service.get_master_key(user_row.diagnosis_key_id)
    blob = user_row.diagnosis_note_encrypted
    return EnvelopeEncryption.decrypt(key, blob[:12], blob[12:]).decode("utf-8")


def _decrypt_medications(user_row: UserAccountModel) -> str | None:
    if not user_row.medications_encrypted or not user_row.medications_key_id:
        return None
    key = kms_service.get_master_key(user_row.medications_key_id)
    blob = user_row.medications_encrypted
    return EnvelopeEncryption.decrypt(key, blob[:12], blob[12:]).decode("utf-8")


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProfileResponse:
    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    created = row.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=datetime.UTC)
    return ProfileResponse(
        user_id=row.user_id,
        display_name=row.display_name,
        created_at=created,
        diagnosis_disclosed=bool(row.diagnosis_disclosed),
        diagnosis_note=_decrypt_note(row) if row.diagnosis_disclosed else None,
        age=row.age,
        gender=row.gender,
        medications_disclosed=row.medications_encrypted is not None,
        medications=_decrypt_medications(row),
        free_sessions_remaining=row.free_sessions_remaining,
    )


@router.put("/profile/diagnosis")
async def update_diagnosis_disclosure(
    payload: DiagnosisUpdateRequest,
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    """Set or withdraw the optional diagnosis disclosure. Fully revocable."""
    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()

    row.diagnosis_disclosed = payload.diagnosis_disclosed
    if payload.diagnosis_disclosed and payload.diagnosis_note and payload.diagnosis_note.strip():
        key_id = kms_service.active_key_id
        key = kms_service.get_master_key(key_id)
        nonce, ciphertext = EnvelopeEncryption.encrypt(
            key, payload.diagnosis_note.strip().encode("utf-8")
        )
        row.diagnosis_note_encrypted = nonce + ciphertext
        row.diagnosis_key_id = key_id
    else:
        # Withdrawal wipes the note entirely.
        row.diagnosis_note_encrypted = None
        row.diagnosis_key_id = None
        row.diagnosis_disclosed = False
    await db.commit()
    return {"diagnosis_disclosed": bool(row.diagnosis_disclosed)}


@router.put("/profile/medications")
async def update_medications(
    payload: MedicationsUpdateRequest,
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    """Set or fully withdraw the optional medication disclosure."""
    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()

    if payload.medications and payload.medications.strip():
        key_id = kms_service.active_key_id
        key = kms_service.get_master_key(key_id)
        nonce, ciphertext = EnvelopeEncryption.encrypt(
            key, payload.medications.strip().encode("utf-8")
        )
        row.medications_encrypted = nonce + ciphertext
        row.medications_key_id = key_id
    else:
        # Withdrawal wipes the data entirely.
        row.medications_encrypted = None
        row.medications_key_id = None
    await db.commit()
    return {"medications_disclosed": row.medications_encrypted is not None}


# ---------------------------------------------------------------------------
# Wellness: private journal
# ---------------------------------------------------------------------------


@router.get("/journal", response_model=list[JournalEntryResponse])
async def list_journal(
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[JournalEntryResponse]:
    pk = (
        await db.execute(
            select(UserAccountModel.id).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(JournalEntryModel)
            .where(JournalEntryModel.user_account_id == pk)
            .order_by(JournalEntryModel.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    out: list[JournalEntryResponse] = []
    for r in rows:
        key = kms_service.get_master_key(r.key_id)
        blob = r.encrypted_content
        content = EnvelopeEncryption.decrypt(key, blob[:12], blob[12:]).decode("utf-8")
        out.append(
            JournalEntryResponse(
                id=r.id,
                created_at=r.created_at,
                updated_at=r.updated_at,
                title=r.title,
                content=content,
                mood_at_write=r.mood_at_write,
            )
        )
    return out


@router.post("/journal", response_model=JournalEntryResponse)
async def create_journal_entry(
    payload: JournalCreateRequest,
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> JournalEntryResponse:
    pk = (
        await db.execute(
            select(UserAccountModel.id).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    key_id = kms_service.active_key_id
    key = kms_service.get_master_key(key_id)
    nonce, ciphertext = EnvelopeEncryption.encrypt(
        key, payload.content.encode("utf-8")
    )
    encrypted = nonce + ciphertext
    now = datetime.datetime.now(datetime.UTC)
    entry = JournalEntryModel(
        user_account_id=pk,
        created_at=now,
        title=(payload.title or "").strip() or None,
        encrypted_content=encrypted,
        key_id=key_id,
        mood_at_write=payload.mood_at_write,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return JournalEntryResponse(
        id=entry.id,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        title=entry.title,
        content=payload.content,
        mood_at_write=entry.mood_at_write,
    )


# ---------------------------------------------------------------------------
# Wellness: daily mood check-in
# ---------------------------------------------------------------------------


@router.post("/mood", response_model=MoodEntryResponse)
async def set_mood(
    payload: MoodSetRequest,
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> MoodEntryResponse:
    """Record one mood moment.

    Multiple check-ins per day are intentional: feelings change across the day
    and each check-in can carry more than one emotion label.
    """
    pk = (
        await db.execute(
            select(UserAccountModel.id).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    now = datetime.datetime.now(datetime.UTC)
    day = now.strftime("%Y-%m-%d")
    emotions = [e.strip()[:40] for e in payload.emotions if e and e.strip()][:8]

    entry = MoodEntryModel(
        user_account_id=pk,
        day_utc=day,
        mood=payload.mood,
        emotions_json=json.dumps(emotions) if emotions else None,
        note=payload.note,
        created_at=now,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return MoodEntryResponse(
        id=entry.id,
        day_utc=day,
        mood=entry.mood,
        emotions=emotions,
        note=entry.note,
        created_at=entry.created_at,
    )


def _mood_emotions(row: MoodEntryModel) -> list[str]:
    if not row.emotions_json:
        return []
    try:
        parsed = json.loads(row.emotions_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item)[:40] for item in parsed][:8]


@router.get("/mood", response_model=list[MoodEntryResponse])
async def list_moods(
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[MoodEntryResponse]:
    pk = (
        await db.execute(
            select(UserAccountModel.id).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(MoodEntryModel)
            .where(MoodEntryModel.user_account_id == pk)
            .order_by(MoodEntryModel.created_at.asc())
            .limit(2000)
        )
    ).scalars().all()
    return [
        MoodEntryResponse(
            id=r.id,
            day_utc=r.day_utc,
            mood=r.mood,
            emotions=_mood_emotions(r),
            note=r.note,
            created_at=r.created_at,
        )
        for r in rows
    ]


class LocaleUpdateRequest(BaseModel):
    locale: str = Field(pattern="^(EN|AR|ES|FR)$")


@router.put("/profile/locale")
async def update_locale(
    payload: LocaleUpdateRequest,
    principal_user: Annotated[UserAccount, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, str]:
    """Switch the session language — changes which language Glow replies in."""
    from glow_api.models import UserPreferencesModel

    row = (
        await db.execute(
            select(UserAccountModel).where(UserAccountModel.user_id == principal_user.user_id)
        )
    ).scalar_one()
    prefs = (
        await db.execute(
            select(UserPreferencesModel).where(
                UserPreferencesModel.user_account_id == row.id
            )
        )
    ).scalar_one()
    from glow_api.user import UserLocale
    prefs.locale = getattr(UserLocale, payload.locale.upper())
    await db.commit()
    return {"locale": payload.locale.upper()}
