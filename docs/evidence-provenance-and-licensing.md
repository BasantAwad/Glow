# Evidence Provenance and Licensing

**Date:** 2026-08-25
**Status:** Approved for Phase 6+ Implementation

Glow strictly controls the information ingested into its Evidence Registry and RAG pipeline. We prioritize safety, legality, and clinical validity.

## 0. Retrieval implementation and source intake status (2026-11-09)

The session orchestrator now retrieves approved evidence from the existing `evidence_entries` database table using deterministic BM25-style lexical ranking. It filters by approval, complete provenance, locale, and jurisdiction; places bounded excerpts in an explicitly untrusted context block; and appends source links only after response safety validation. Retrieval runs locally and adds no embedding-service dependency. The existing embedding column is not used yet, and this is not semantic/vector search.

The database remains **empty by default**. The curator-only `store_approved_evidence()` path rejects missing license/provenance or missing qualified-review approval. It is intentionally not exposed as a public API route. Do not mark the knowledge-base feature content-complete until a qualified reviewer approves actual content and rights are verified for the intended commercial use.

### Candidate-source intake decisions

- **NIMH:** Candidate source for English educational content. NIMH says most information is public domain unless otherwise indicated; review each page for third-party content, preserve attribution, and have a qualified clinician approve any excerpt before ingestion. Start with [NIMH Mental Health Information](https://www.nimh.nih.gov/health) and its [citation guidance](https://www.nimh.nih.gov/site-info/citing-nimh-publications-and-webpages).
- **WHO:** Link-only pending written commercial permission or a content-specific license compatible with Glow. WHO's standard publication license is CC BY-NC-SA, and its policy says permission is required for commercial uses. See the [WHO copyright and licensing policy](https://www.who.int/about/policies/publishing/copyright).
- **NHS:** Link-only pending content-specific reuse permission/license review; the public self-help pages are copyrighted. See [NHS self-help](https://www.nhs.uk/mental-health/self-help/).
- **Centre for Clinical Interventions (CCI):** Link-only pending rights review/permission and qualified clinical review. CCI identifies its resources as Government of Western Australia copyright and says they are not a substitute for professional care. See [CCI self-help resources](https://www.cci.health.wa.gov.au/Resources/Looking-After-Yourself) and its [copyright/disclaimer](https://www.cci.health.wa.gov.au/Utilities/Copyright-and-Disclaimer).
- **Mental Health Foundation (UK):** Candidate for physical-health / mental-health psychoeducation. Article copyrighted by the Foundation; link-only until reuse permission is confirmed. Listed on the app's Learn page as an external reading link.
- **Verywell Mind:** Commercial health publisher; articles are copyrighted and medically reviewed. Link-only; never ingest or paraphrase clinical content into the registry.
- **Simply Psychology:** Commercial/education publisher; copyrighted. Link-only.
- **APA Global Psychology Alliance (Lesson 6 PDF):** APA copyright; link-only. Note from 2026-11-09 check: automated fetch returned a bot-protection page rather than the PDF — verify the link resolves in a normal browser before treating it as a stable reference.

These source links may be shown as external reading links, but their text must not be scraped, copied into the registry, embedded, or served as Glow content until the indicated rights and review gates are met. Do not represent any source as clinically approved for Glow merely because the publisher is reputable.

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
