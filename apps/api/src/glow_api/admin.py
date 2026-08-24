"""
Administration, operations, and feature flags (Phase 9).

Implements:
 - Role-based admin access control.
 - Feature flags and kill switches.
 - Provider health check interface.
 - Policy and model version records.
 - Incident record type.
 - Rollback metadata.
 - Crisis-resource registry ownership fields (edit access is role-gated).
 - Redacted observability interface.

Rules:
 - Raw therapy content must never be exposed through admin interfaces.
 - Safety event review is restricted to specific admin roles.
 - Crisis-resource registry changes require an authorized human reviewer.
 - All admin actions are audit-logged.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


# ---------------------------------------------------------------------------
# Admin roles
# ---------------------------------------------------------------------------


class AdminRole(StrEnum):
    """Role-based access control for admin operations."""

    SYSTEM_ADMIN = "system_admin"         # Full access
    SAFETY_REVIEWER = "safety_reviewer"   # Safety event review only
    CONTENT_CURATOR = "content_curator"   # Evidence and resource registry
    BILLING_ADMIN = "billing_admin"       # Billing and entitlement
    INCIDENT_MANAGER = "incident_manager" # Incident records and rollback
    READONLY = "readonly"                 # Read-only audit access


# Access control matrix: which roles can perform which operations.
ROLE_PERMISSIONS: dict[AdminRole, frozenset[str]] = {
    AdminRole.SYSTEM_ADMIN: frozenset({
        "read_safety_events", "write_feature_flags", "write_kill_switches",
        "write_crisis_resources", "read_incidents", "write_incidents",
        "trigger_rollback", "read_audit_log",
    }),
    AdminRole.SAFETY_REVIEWER: frozenset({
        "read_safety_events", "read_audit_log",
    }),
    AdminRole.CONTENT_CURATOR: frozenset({
        "write_crisis_resources", "write_evidence_registry",
    }),
    AdminRole.BILLING_ADMIN: frozenset({
        "read_billing", "write_billing_config",
    }),
    AdminRole.INCIDENT_MANAGER: frozenset({
        "read_incidents", "write_incidents", "trigger_rollback",
    }),
    AdminRole.READONLY: frozenset({
        "read_audit_log",
    }),
}


def has_permission(role: AdminRole, permission: str) -> bool:
    """Return True iff the given role has the named permission."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


# ---------------------------------------------------------------------------
# Feature flags and kill switches
# ---------------------------------------------------------------------------


@dataclass
class FeatureFlag:
    """A server-side feature flag.

    Fields:
        name:         Unique flag name.
        enabled:      Whether the feature is currently enabled.
        description:  What this flag controls.
        is_kill_switch: If True, disabling this flag disables a feature
                        immediately with no graceful degradation.
        last_changed_at: When this flag was last changed (UTC).
        changed_by:   Admin identifier who last changed it.
    """

    name: str
    enabled: bool
    description: str
    is_kill_switch: bool = False
    last_changed_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    changed_by: str = "system"


# Default feature flags for the current phase.
DEFAULT_FEATURE_FLAGS: dict[str, FeatureFlag] = {
    "voice_input": FeatureFlag(
        name="voice_input",
        enabled=False,
        description="Enable voice input (STT). Requires approved STT provider.",
        is_kill_switch=True,
    ),
    "voice_output": FeatureFlag(
        name="voice_output",
        enabled=False,
        description="Enable voice output (TTS). Requires approved TTS provider.",
        is_kill_switch=True,
    ),
    "avatar": FeatureFlag(
        name="avatar",
        enabled=False,
        description="Enable visual avatar. Requires approved avatar provider.",
        is_kill_switch=True,
    ),
    "paid_sessions": FeatureFlag(
        name="paid_sessions",
        enabled=False,
        description="Enable paid sessions. Requires approved billing provider.",
        is_kill_switch=True,
    ),
    "research_data_collection": FeatureFlag(
        name="research_data_collection",
        enabled=False,
        description=(
            "Enable research data collection. Requires explicit user consent "
            "AND approved data governance review AND separate research data store."
        ),
        is_kill_switch=True,
    ),
    "model_gateway": FeatureFlag(
        name="model_gateway",
        enabled=False,
        description="Enable real model gateway. Requires approved model provider.",
        is_kill_switch=True,
    ),
}


class FeatureFlagRegistry:
    """In-memory feature flag registry.

    In production, flags are persisted in the database (Phase 1+ DB).
    """

    def __init__(self) -> None:
        self._flags: dict[str, FeatureFlag] = dict(DEFAULT_FEATURE_FLAGS)

    def is_enabled(self, name: str) -> bool:
        flag = self._flags.get(name)
        return flag is not None and flag.enabled

    def set_flag(self, name: str, enabled: bool, *, changed_by: str) -> None:
        if name not in self._flags:
            raise KeyError(f"Unknown feature flag: {name!r}")
        self._flags[name] = FeatureFlag(
            name=name,
            enabled=enabled,
            description=self._flags[name].description,
            is_kill_switch=self._flags[name].is_kill_switch,
            last_changed_at=datetime.now(UTC),
            changed_by=changed_by,
        )

    def get_all(self) -> dict[str, FeatureFlag]:
        return dict(self._flags)


FEATURE_FLAGS: FeatureFlagRegistry = FeatureFlagRegistry()


# ---------------------------------------------------------------------------
# Policy and model version records
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PolicyVersion:
    """A recorded policy version snapshot.

    Fields:
        version_id:     Opaque version identifier.
        policy_type:    "consent", "safety", "privacy", "terms_of_service".
        version_string: Human-readable version string.
        effective_at:   When this version took effect (UTC).
        superseded_at:  When this version was superseded (None if current).
        changelog_url:  URL to the diff/changelog (internal).
        requires_re_consent: True if existing users must re-consent.
    """

    version_id: str
    policy_type: str
    version_string: str
    effective_at: datetime
    superseded_at: datetime | None
    changelog_url: str
    requires_re_consent: bool


@dataclass(frozen=True)
class ModelVersion:
    """A recorded model provider version snapshot.

    Fields:
        version_id:     Opaque version identifier.
        provider_name:  Name of the model provider.
        model_id:       Provider-specific model identifier.
        deployed_at:    When this model was deployed (UTC).
        safety_tested:  Whether safety red-teaming was completed.
        clinical_reviewed: Whether clinical review was completed.
        notes:          Free-text notes for human reviewers.
    """

    version_id: str
    provider_name: str
    model_id: str
    deployed_at: datetime
    safety_tested: bool
    clinical_reviewed: bool
    notes: str = ""


# ---------------------------------------------------------------------------
# Incident records
# ---------------------------------------------------------------------------


class IncidentSeverity(StrEnum):
    P0 = "p0"  # Critical; immediate response required
    P1 = "p1"  # High; response within 1 hour
    P2 = "p2"  # Medium; response within 24 hours
    P3 = "p3"  # Low; response within 1 week


@dataclass
class IncidentRecord:
    """An operational or safety incident record.

    Fields:
        incident_id:    Opaque identifier.
        severity:       Incident severity tier.
        title:          Short description (no PII or therapy content).
        detected_at:    When the incident was detected (UTC).
        resolved_at:    When resolved (None if ongoing).
        owner:          Admin role or identifier responsible.
        affected_users: Count of affected users (not identities).
        timeline:       List of (timestamp, action) tuples.
        postmortem_url: URL to the postmortem document (internal).
    """

    incident_id: str
    severity: IncidentSeverity
    title: str
    detected_at: datetime
    resolved_at: datetime | None
    owner: str
    affected_users: int
    timeline: list[tuple[datetime, str]] = field(default_factory=list)
    postmortem_url: str = ""


# ---------------------------------------------------------------------------
# Provider health check interface
# ---------------------------------------------------------------------------


class ProviderHealthStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    UNCONFIGURED = "unconfigured"


@dataclass(frozen=True)
class ProviderHealthCheck:
    """Result of a provider health check poll.

    Fields:
        provider_name:  Name of the provider being checked.
        status:         Current health status.
        checked_at:     When the check was performed (UTC).
        latency_ms:     Round-trip latency in milliseconds (None if check failed).
        error_message:  Safe-to-log error message (no credentials).
    """

    provider_name: str
    status: ProviderHealthStatus
    checked_at: datetime
    latency_ms: float | None = None
    error_message: str | None = None


# ---------------------------------------------------------------------------
# Rollback metadata
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RollbackRecord:
    """Metadata for a rollback action.

    Fields:
        rollback_id:     Opaque identifier.
        target:          What is being rolled back ("model", "consent_policy", etc.).
        from_version:    The version being rolled back from.
        to_version:      The version being rolled back to.
        initiated_at:    When rollback was initiated (UTC).
        initiated_by:    Admin identifier.
        completed_at:    When rollback completed (None if in progress).
        reason:          Safe-to-log reason.
    """

    rollback_id: str
    target: str
    from_version: str
    to_version: str
    initiated_at: datetime
    initiated_by: str
    completed_at: datetime | None
    reason: str
