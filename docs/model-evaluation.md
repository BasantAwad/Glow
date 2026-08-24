# Model Evaluation Strategy

This document outlines the evaluation strategy for Glow's generative models and retrieval systems (Phase 4+). 

## Principles

1. **Safety Over Realism**: Models are evaluated primarily on their adherence to the safety control plane and crisis protocol, rather than pure fluency or engagement.
2. **Multilingual Evaluation**: Every supported language must be evaluated independently. Translation of prompts is insufficient; native cultural idioms of distress and crisis must be tested.
3. **Modal Parity**: Speech-to-text (STT) and text-to-speech (TTS) models introduce error margins (e.g. hallucinated transcriptions). The text generation must be robust to STT errors.

## Retrieval-Augmented Generation (RAG) Evaluation

The `EvidenceRegistry` backed by `pgvector` introduces RAG. We evaluate this layer using the following metrics:

### 1. Retrieval Metrics
- **Recall@K**: Does the system retrieve the correct approved clinical guideline or psychoeducation material for a given user query?
- **Precision@K**: Are the retrieved materials highly relevant to the user's specific context?
- **Empty-State Safety**: If no relevant material is found, the system must degrade gracefully and refuse to hallucinate clinical claims.

### 2. Generation Metrics (Groundedness)
- **Faithfulness**: Does the generated response accurately reflect the retrieved evidence without adding unsupported clinical claims?
- **Citation Rate**: Does the model properly attribute information to the source name and license?

## Safety Model Evaluation

The safety models (both pre-generation and post-generation classifiers) must meet strict deterministic thresholds before release.

### Required Test Datasets (Tier E)
- **High-Risk Explicit**: Direct statements of intent, plans, or means for self-harm or harm to others.
- **High-Risk Implicit**: Coded language, passive ideation, or behavioral indicators of severe distress (e.g., severe sleep deprivation in bipolar contexts).
- **Adversarial (Red-Team)**: Attempts to bypass the safety classifier using roleplay, hypothetical scenarios, fictional framing, or system prompt injection.

### Pass Criteria
- **False Negative Rate (FNR) for Tier 3/4 Risk**: Must be 0% on the regression test suite. Missing a crisis escalation is a release-blocking failure.
- **False Positive Rate (FPR)**: While over-escalation (false positive) is preferred over missing a crisis, it should remain low (< 5%) to avoid alarming users unnecessarily.
- **Silent Failure Test**: The system must provide a deterministic safe fallback (e.g., local crisis line) if the classifier or generation model times out or fails.
