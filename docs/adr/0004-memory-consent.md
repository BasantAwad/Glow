# ADR 0004 — Memory Consent, Provenance, and Embedding Governance

**Date:** 2026-08-25  
**Status:** Accepted  
**Deciders:** Glow engineering team

---

## Context

Glow includes a long-term memory feature that allows the AI system to retain relevant facts about a user across sessions (e.g. "user prefers morning sessions", "user mentioned family in Cairo"). This creates significant privacy, consent, and safety obligations:

1. **Consent:** Storing inferred personal facts requires separate, explicit consent beyond general service-use consent.
2. **Accuracy risk:** Automatically persisted inferences can be wrong. Persisting incorrect beliefs about a user in a mental-health context is harmful.
3. **Review and control:** Users must be able to see, edit, hide, and delete what the system believes about them.
4. **Export:** Memory items must be included in data exports.
5. **Embeddings as sensitive data:** Embedding vectors derived from therapy content are themselves sensitive. They must receive the same protection as the source content.
6. **Deletion propagation:** When a user deletes a memory item, all derived representations — embedding vectors, vector index entries, caches, and any derived summaries — must be deleted too.

---

## Decision

### Memory consent

A separate consent purpose `MEMORY_CONSENT` is introduced in `consent.py`. This purpose:
- Is `False` by default (opt-in, not opt-out)
- Cannot be implied by service-use consent or transcript-retention consent
- Must be explicitly presented to the user with a clear explanation of what is stored
- Must be individually revocable without affecting other consent purposes
- When revoked, triggers immediate deletion of all memory items and their embeddings

### No automatic persistence

**Memory items are never persisted automatically.** The flow is:

1. The AI system may identify a candidate memory item during a session
2. The candidate is surfaced to the user with a clear "Would you like me to remember this?" prompt
3. The user explicitly confirms (`CONFIRM`) or rejects (`REJECT`) each item
4. Only confirmed items are persisted

This applies to both explicit user statements and AI inferences. No inferred personal fact is stored without user confirmation.

### Memory item fields

Every memory item must carry:

| Field | Purpose |
|---|---|
| `entry_id` | Opaque unique identifier |
| `user_id` | Owner — used to enforce cross-user isolation |
| `session_id` | Source session |
| `category` | Classification (e.g. `preference`, `relationship`, `context`) |
| `encrypted_content` | Encrypted text of the memory item |
| `key_id`, `key_version` | Envelope encryption identifiers |
| `confirmation_status` | `PENDING` / `CONFIRMED` / `REJECTED` |
| `confidence` | AI confidence score (0.0–1.0) for the inference |
| `provenance_model_id` | Model that generated the candidate |
| `provenance_model_version` | Exact version of the generating model |
| `review_status` | `USER_VISIBLE` / `HIDDEN` / `DELETED` |
| `created_at` | When the item was created |
| `updated_at` | When the item was last edited |
| `deleted_at` | Soft-delete timestamp (hard-deleted after retention window) |

### User controls (mandatory)

Every user must be able to:
- **List** all their memory items
- **Read** the decrypted content of each item
- **Edit** any item (with provenance updated to reflect user edit)
- **Hide** an item (removed from AI context, kept for export/audit)
- **Delete** an item (triggers embedding deletion, index removal, cache invalidation)
- **Delete all** memory items at once
- **Export** all memory items in plaintext as part of a data export request

### Embedding governance

Embeddings (vector representations of memory item content) are **sensitive data** and must be:

1. **Isolated by user:** The vector store must enforce that queries against one user's embeddings cannot return results from another user's data.
2. **Versioned:** Each embedding record must store the embedding model ID and version used to generate it.
3. **Never logged:** Embedding vectors must never appear in any log line, structured or otherwise.
4. **Deletion-propagated:** Deleting a memory item must atomically delete the associated embedding record(s) and remove the vector from the index.
5. **Not used for other purposes:** Embeddings generated from therapy content may not be reused for model training, aggregate analytics, or any purpose other than per-user memory retrieval.

### SQLite restriction

Semantic memory (vector-based retrieval) is disabled in SQLite (local development) mode. The `MemoryService` must detect the database type and raise `ProviderNotConfiguredError` with a clear message when vector search is requested without PostgreSQL + pgvector.

### Production database requirement

Memory cannot be enabled for any pilot with real user data without:
- PostgreSQL 16+ with the `pgvector` extension enabled
- Approved schema and data model review
- Verified deletion cascade from vector index to backup

---

## Consequences

- Memory is a strictly opt-in feature with per-item confirmation
- Users have full read/edit/hide/delete control over all stored memory
- Embeddings are isolated, versioned, and deletion-propagated
- Semantic memory is blocked until PostgreSQL + pgvector is available
- Memory items are included in all data export requests

---

## Deferred decisions

| Decision | Gate |
|---|---|
| PostgreSQL + pgvector setup | Infrastructure provision |
| Embedding model selection and version pinning | Technical review |
| Vector index technology (pgvector vs. dedicated store) | Infrastructure review |
| Backup deletion propagation procedure | Operational review |
