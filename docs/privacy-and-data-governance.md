# Privacy and Data Governance

*This document outlines the privacy controls and data lifecycle workflows for Glow, satisfying Phase 5 of the architectural roadmap and complying with the mandates set forth in `CLAUDE.md`.*

## 1. Encryption Schema

All highly sensitive data at rest must be encrypted. We employ **Envelope Encryption** for session transcripts:
- **Algorithm**: AES-256-GCM.
- **Key Management (KMS)**: The application utilizes a provider-neutral `KeyManagementService`. In development, `LocalDevKMS` derives the key from the environment. In production, an external HSM/KMS (e.g., AWS KMS or Azure Key Vault) must be wired in.
- **Model Storage**: Raw transcripts are never stored in plain text. The `SessionMessageModel` stores a tuple of `(nonce, ciphertext)` in the `encrypted_content` column, accompanied by a `key_id`.

## 2. Dataset Tiers

In accordance with `CLAUDE.md` §6, data is strictly isolated into operational and research boundaries. Any operational data (e.g., transcripts) requires explicit consent to be stored and is subject to the retention schedules below:

| Tier | Data | Permitted use | Controls |
|---|---|---|---|
| A | Public-domain / licensed evidence | RAG, knowledge base | License ledger, source hashing, versioning |
| B | Synthetic dialogues | Fine-tuning, evaluation | Clinical review, no real patient data |
| C | Consented de-identified therapy | Evaluation and limited research | Re-identification testing, withdrawal mechanism |
| D | Real user conversations | Service operation only | Strict retention, granular deletion |
| E | Safety adversarial examples | Regression testing | Red-team provenance, no unnecessary harmful detail |

**Important:** We *never* use raw user transcripts (Tier D) for training unless explicit, separate opt-in consent (Tier C) has been granted.

## 3. Data Deletion and Export Workflows

Glow respects data ownership. The `PrivacyService` implements cascading, granular deletion and comprehensive exports:
- **Deletion Scope**: 
  - `SESSION_TRANSCRIPTS`: Wipes only the user's transcript history across all sessions.
  - `ACCOUNT_AND_ALL_DATA`: A cascading deletion across user accounts, preferences, consent records, sessions, and messages.
- **Data Export**: Outputs a structured JSON representation of the user's preferences, consents, and decrypted session history (where retained).

## 4. Redacted Observability

To ensure no PII or sensitive session content leaks into application logs or error monitoring tools:
- **Redaction Patterns**: Standard `logging` passes through a custom `RedactedJSONFormatter` which strips emails, phone numbers, JWTs, and User UUIDs.
- **Payload Redaction**: A FastAPI middleware intercepts all HTTP traffic. Request and response bodies are deliberately omitted from general HTTP access logs, logging only method, path, status, and latency.

## 5. Security & Compliance Reminder

**No claim of HIPAA, GDPR, or equivalent compliance is made by default.** Launching in any jurisdiction requires formal audit and configuration of the infrastructure to match these software-level guarantees.
