"""
Evidence and retrieval interface (Phase 5).

Implements a provenance-aware evidence registry for clinical/research content
that Glow may reference in responses.

DATA POLICY:
 - This registry is EMPTY by default and will remain empty until a human
   curator supplies real public-domain or properly licensed sources.
 - No synthetic clinical material, no fabricated research summaries,
   no invented references are permitted.
 - Every entry must carry full provenance: license, source URL, date
   retrieved, jurisdiction applicability, and language.
 - Retrieval queries return only verified, licensed entries.
 - If no approved sources are available, the retrieval returns an empty
   result with a clear BLOCKED status.

This module defines the schema, ingestion interface, validation rules, and
empty-state behavior.  Population is blocked pending human review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

# ---------------------------------------------------------------------------
# Evidence source types
# ---------------------------------------------------------------------------


class EvidenceLicense(StrEnum):
    """License type of the evidence source."""

    PUBLIC_DOMAIN = "public_domain"
    CC0 = "cc0"
    CC_BY = "cc_by"
    CC_BY_SA = "cc_by_sa"
    OPEN_GOVERNMENT = "open_government"
    COMMERCIALLY_LICENSED = "commercially_licensed"  # Requires license file
    UNKNOWN = "unknown"  # May NOT be used in production


class EvidenceType(StrEnum):
    """Type of evidence content."""

    PSYCHOEDUCATION = "psychoeducation"
    COPING_STRATEGY = "coping_strategy"
    SELF_HELP_EXERCISE = "self_help_exercise"
    REFERRAL_INFORMATION = "referral_information"
    SAFE_MESSAGING_GUIDELINE = "safe_messaging_guideline"
    RESEARCH_SUMMARY = "research_summary"  # Must be licensed


# ---------------------------------------------------------------------------
# Evidence entry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EvidenceEntry:
    """A single piece of evidence content in the registry.

    ALL fields are required.  Entries with unknown licenses or missing
    provenance must not be added.

    Fields:
        entry_id:          Opaque server-assigned identifier.
        title:             Display title.
        content_text:      The actual content text.
        evidence_type:     Type of content.
        locale:            BCP 47 locale of the content.
        jurisdiction:      Applicable jurisdiction(s) as ISO 3166-1 codes.
        license:           License type.
        license_url:       URL to the license text.
        source_url:        URL to the original source.
        source_name:       Human-readable source name (e.g. "WHO, 2023").
        retrieved_at:      When this was retrieved/ingested (UTC).
        retrieved_by:      Name/identifier of the human who added it.
        is_approved:       Must be True before retrieval can return this entry.
        approved_by:       Human reviewer who approved it for use.
        approved_at:       When approved (UTC).
        permitted_uses:    Set of ConsentPurpose values this content may serve.
        clinical_notes:    Any notes for clinical reviewers (not surfaced to users).
    """

    entry_id: str
    title: str
    content_text: str
    evidence_type: EvidenceType
    locale: str
    jurisdiction: tuple[str, ...]
    license: EvidenceLicense
    license_url: str
    source_url: str
    source_name: str
    retrieved_at: datetime
    retrieved_by: str
    is_approved: bool
    approved_by: str | None
    approved_at: datetime | None
    permitted_uses: frozenset[str]
    clinical_notes: str = ""


# ---------------------------------------------------------------------------
# Evidence registry
# ---------------------------------------------------------------------------

EVIDENCE_REGISTRY_BLOCKED: str = (
    "BLOCKED: No evidence content has been approved for this registry. "
    "Populating the registry requires real public-domain or properly licensed "
    "clinical/psychoeducational content, reviewed by a qualified clinician, "
    "with full provenance recorded. "
    "No synthetic, fabricated, or unlicensed content is permitted."
)


class EvidenceRegistry:
    """Provenance-aware registry of approved evidence content.

    Empty by default.  Population is blocked until human curators supply
    verified content with full provenance.
    """

    def __init__(self) -> None:
        self._entries: dict[str, EvidenceEntry] = {}

    def add_entry(self, entry: EvidenceEntry) -> None:
        """Add an evidence entry.

        Raises:
            ValueError: If the entry is not approved or has an unknown license.
        """
        if entry.license == EvidenceLicense.UNKNOWN:
            raise ValueError(
                f"Entry '{entry.entry_id}' has license=UNKNOWN and cannot be added. "
                "Determine and record the actual license first."
            )
        if not entry.is_approved:
            raise ValueError(
                f"Entry '{entry.entry_id}' is not approved. "
                "Have a qualified clinician review and approve it first."
            )
        self._entries[entry.entry_id] = entry

    def retrieve(
        self,
        *,
        locale: str,
        evidence_type: EvidenceType | None = None,
        jurisdiction: str | None = None,
        query: str | None = None,
        limit: int = 5,
    ) -> list[EvidenceEntry]:
        """Retrieve approved evidence entries matching the given criteria.

        Returns an empty list if no approved entries match.
        Keyword-based retrieval only (vector search is Phase 5+; provider
        selection deferred).

        Args:
            locale:         BCP 47 locale to filter by.
            evidence_type:  Optional type filter.
            jurisdiction:   Optional ISO 3166-1 code filter.
            query:          Optional keyword query (simple substring match).
            limit:          Maximum number of entries to return.

        Returns:
            List of approved EvidenceEntry objects.
        """
        results = [
            e for e in self._entries.values()
            if e.is_approved
            and e.locale == locale
            and (evidence_type is None or e.evidence_type == evidence_type)
            and (jurisdiction is None or jurisdiction in e.jurisdiction)
            and (query is None or query.lower() in e.content_text.lower() or query.lower() in e.title.lower())
        ]
        return results[:limit]

    @property
    def is_empty(self) -> bool:
        return len(self._entries) == 0

    @property
    def registry_status(self) -> str:
        if self.is_empty:
            return EVIDENCE_REGISTRY_BLOCKED
        approved = sum(1 for e in self._entries.values() if e.is_approved)
        return f"{approved} approved evidence entries across {len(self._entries)} total."


# Global evidence registry — empty pending human curation.
EVIDENCE_REGISTRY: EvidenceRegistry = EvidenceRegistry()
