# Evidence Provenance and Licensing

**Date:** 2026-08-25
**Status:** Approved for Phase 6+ Implementation

Glow strictly controls the information ingested into its Evidence Registry and RAG pipeline. We prioritize safety, legality, and clinical validity.

## 1. Core Knowledge Resources for RAG
The following are candidate sources, but exact licenses must be verified before copying, indexing, or serving their text commercially.

*   **WHO mhGAP guideline:** A strong candidate for mental-health, neurological, and substance-use guidance. WHO describes it as evidence-based guidance for strengthening mental-health care. The specific publication is marked `CC BY-NC-SA 3.0 IGO`, which includes a **non-commercial restriction**.
    *   *Important:* Because Glow plans to charge for sessions, do not automatically assume this license permits commercial use. Request permission or use only material whose licensing terms clearly permit intended use.
*   **WHO mental-health resources:** Useful for high-level psychoeducation, human-rights principles, recovery-oriented care, and public-health context. Use official pages as links or ingest content only where reuse is permitted.
*   **Egyptian Ministry of Health and Population resources:** Potentially useful for Egypt-specific healthcare navigation and public information. Verify that each document is official, current, authentic, and reusable before adding it.
*   **NIMH public information:** Useful for general educational material about mental-health topics and finding help. NIMH requests attribution and provides a copyright policy, so review that policy before commercial reuse.
*   **Official public-health and university medical-center resources:** Use only pages with clear reuse terms or written permission. Store the original URL, authoring organization, date, license, and retrieval date.
*   **Peer-reviewed research papers:** Use them for evidence review and clinician-authored summaries. Do not automatically copy full papers into the product. Many papers are copyrighted even when their abstracts are publicly viewable. Prefer open-access papers with a license compatible with commercial use.
*   **Clinical guidelines (NICE, APA, VA/DoD, WHO):** Professional guideline bodies provide valuable evidence, but documents may have restrictions. Use them only after license review and clinical interpretation by qualified professionals.

## 2. Therapy Conversation Datasets
High-quality, legally reusable therapy-conversation datasets are rare. You **must not** download random "mental-health chat" datasets and train Glow on them.

Possible research candidates (require explicit evaluation):
*   **DAIC-WOZ:** Controlled-access research dataset. Treat it as unavailable unless explicit permission and a data-use agreement are obtained for commercial product training.
*   **CLPsych shared-task datasets:** Often research-specific. Do not use commercially without written permission.
*   **Empathetic dialogue datasets:** May teach empathy but are not equivalent to professional therapy data. Verify the exact source, consent, license, and whether commercial fine-tuning is allowed.
*   **Recent mental-health dialogue benchmarks:** Treat as evaluation/research candidates only until their paper, dataset card, source provenance, consent process, and license have been audited.
