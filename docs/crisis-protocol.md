# Crisis Finite-State Machine Protocol

The Crisis Finite-State Machine (FSM) is an 8-step protocol designed to handle severe safety signals (suicidal ideation, imminent harm, abuse disclosure) safely and predictably.

## FSM States
The crisis FSM operates with the following states, progressing deterministically based on user input and safety evaluations:

1. **INACTIVE:** Normal session behavior. Hard limits on session time apply.
2. **DETECTED:** The safety control plane detects a high-severity signal. The normal model generation is blocked.
3. **ACKNOWLEDGED:** The system overrides the output and surfaces a predefined, safe acknowledgment template.
4. **RESOURCE_OFFERED:** Verified resources are retrieved from the `CrisisResourceRegistry` and offered to the user. *(Note: in Phase 2/3, the registry is intentionally left empty until human verification processes are in place).*
5. **PENDING_HANDOFF:** The system waits for the user to confirm they have reached out to a resource or are in a safe place.
6. **CLEARED:** The crisis state is resolved or handed off successfully. The session resumes normal operation (time limit constraints apply again).
7. **EMERGENCY_CLOSE:** If safety cannot be guaranteed or handoff fails repeatedly, the session is forcibly closed for safety reasons.

## Billing and Time Limit Override
When a session enters the `DETECTED` or `ACKNOWLEDGED` state, normal billing caps and time limits are **suspended**. The user will not be charged for time spent in the crisis protocol, and a session will not time out while waiting for a handoff confirmation.
