"""
Context-aware local conversational fallback for Glow.

Replaces the slow BlenderBot/transformers-based model with a fast,
deterministic context-aware response engine.  Produces warm, empathetic,
non-diagnostic replies in well under 100 ms, using keyword extraction
and conversation-history awareness instead of a neural model.

Safety boundaries:
- Never claims to be human, a therapist, or to diagnose.
- Scrubs blocked phrases before surfacing a response.
- Falls back to a short empathetic reply on any internal error.
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, AsyncIterator

logger = logging.getLogger("glow_api.local_model")

# ---------------------------------------------------------------------------
# Local re-definitions of gateway types (self-contained, no import from
# model_gateway to avoid circular dependency).
# ---------------------------------------------------------------------------


class GenerationStopReason(StrEnum):
    STOP_TOKEN = "stop_token"
    MAX_TOKENS = "max_tokens"
    SAFETY_FILTER = "safety_filter"
    ERROR = "error"


@dataclass(frozen=True)
class GenerationRequest:
    session_id: str
    user_id: str
    system_prompt: str
    conversation_history: tuple[tuple[str, str], ...]
    user_message: str
    locale: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95
    timeout_sec: float = 30.0


@dataclass(frozen=True)
class GenerationResponse:
    text: str
    stop_reason: GenerationStopReason
    model_id: str
    latency_ms: float
    token_count: int


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCAL_MODEL_ID = "glow-local-context-engine-v1"

# Phrases the engine must never say (safety scrubbing).
_SAFETY_BLOCK_PHRASES = [
    "i am a human",
    "i am a therapist",
    "i diagnose",
    "you have depression",
    "you have anxiety disorder",
    "you have ptsd",
    "you have bipolar",
    "you have adhd",
    "you have autism",
    "you are diagnosed",
    "prescribe",
    "dosage",
    "your medication",
]

# Short empathic fallbacks used when the context engine produces
# something too short or the input is unparseable.
_FALLBACK_RESPONSES = [
    "I'm here with you. That sounds like it's been weighing on you — do you want to tell me a bit more about what's going on?",
    "Thanks for sharing that. I can hear this matters a lot to you. What feels like the hardest part of it right now?",
    "I appreciate you opening up. Take your time — there's no rush. What's on your mind as you sit with that?",
    "That takes courage to say out loud. I'm listening. How has this been affecting your days?",
    "I'm glad you told me that. You don't have to figure it all out at once — we can just sit with it for a minute. What's one thing that's been feeling heavy?",
]

# Context-aware response templates keyed by topic clusters.
# Each template can reference {topic} (the main topic word) and
# {feeling} (the strongest emotion word detected).
#
# These are deliberately warm, open-ended, non-diagnostic, and
# reflective — they ask a gentle follow-up question rather than
# dispensing advice.

_CONTEXT_RESPONSES: list[tuple[list[str], list[str]]] = [
    # anxiety / stress
    (
        ["anxious", "anxiety", "nervous", "worry", "worried", "panic", "stressed", "stress", "dread", "on edge", "afraid", "scared", "fear", "terrified", "fearful"],
        [
            "It sounds like {topic} has been really present for you lately. That can feel exhausting, like your mind won't give you a break. When it shows up, is there a particular thought or situation that comes with it?",
            "I hear how heavy that feels. Anxiety can make everything seem bigger and more uncertain. Has this been building for a while, or did something specific bring it up?",
            "That sounds tough. Sometimes it helps to notice where the feeling sits in your body or what thought arrives first. What has it been like for you today?",
        ],
    ),
    # low mood / sadness / loneliness
    (
        ["depressed", "depression", "sad", "sadness", "down", "low", "hopeless", "hopelessness", "empty", "numb", "tears", "crying", "cry", "grief", "lost", "lonely", "alone", "isolated", "disconnected"],
        [
            "Thank you for trusting me with that. {topic} can feel isolating, and it takes courage to name it. Has this been recent, or has it been with you for a while?",
            "I can hear how much you're carrying. You don't have to hold it all by yourself in this conversation. What feels hardest about it right now?",
            "It makes sense that this would feel heavy. When {topic} shows up, what moments or situations make it stand out most?",
        ],
    ),
    # hopelessness / fear that things will never change
    (
        ["never feel better", "nothing will change", "what's the point", "whats the point", "no hope", "give up", "can't see a future", "cant see a future", "will it ever get better", "nothing helps"],
        [
            "That fear makes sense when you've been carrying this for a while. Feeling like nothing will change is exhausting, and it doesn't mean you're doing anything wrong. What would it be like to take this one day at a time right now?",
            "I'm glad you said that out loud. When hope feels far away, it's hard to imagine things shifting. We don't have to solve the future today. What would make the next hour a little more bearable?",
            "That sounds frightening, and I'm here with you. You don't have to believe things will improve right now. What's keeping you going today, even a little?",
        ],
    ),
    # study / academic pressure / focus / procrastination / guilt
    (
        ["university", "college", "school", "class", "classes", "study", "studying", "exam", "exams", "assignment", "assignments", "homework", "deadline", "deadlines", "focus", "concentrate", "concentration", "procrastinate", "procrastinating", "procrastination", "guilt", "guilty", "behind", "grades", "grade", "lecture", "professor", "semester"],
        [
            "That sounds really draining. When {topic} piles up, it can make focus harder and guilt louder, even when you're trying your best. What's the one thing that feels most pressing right now?",
            "I hear you. University pressure and trouble focusing can feed into each other, especially when procrastination starts to feel heavy. What's been getting in the way most lately?",
            "It makes sense that you'd feel stuck with that. Instead of looking at everything at once, is there a small piece of it that feels even slightly doable today?",
        ],
    ),
    # work / career stress
    (
        ["work", "job", "boss", "colleague", "coworker", "coworkers", "team", "career", "promotion", "interview", "layoff", "fired", "burnout", "overtime", "meeting", "performance", "criticism", "criticize", "criticized", "micromanage"],
        [
            "Work can take up a lot of mental space, especially when it affects your confidence or stress. What's been the hardest part of this situation for you?",
            "That sounds wearing. It's not just the tasks — it's also how it makes you feel day to day. Has this been building over time, or did something specific happen?",
            "I hear how much this is weighing on you. When work feels difficult, it can follow you home in your thoughts. What part of it feels most important to talk through?",
        ],
    ),
    # relationships / family / friends
    (
        ["relationship", "partner", "boyfriend", "girlfriend", "husband", "wife", "spouse", "breakup", "divorce", "separation", "family", "mother", "father", "mom", "dad", "parent", "parents", "sibling", "brother", "sister", "friend", "friends", "friendship", "argue", "argument", "fight", "fighting", "conflict", "trust", "cheat", "cheating"],
        [
            "Relationships can be meaningful and really hard at the same time. It sounds like this is weighing on you. What feels like the core of it right now?",
            "Thank you for sharing that. When connection feels uncertain or painful, it can affect a lot. What's been the hardest moment in this for you?",
            "That sounds difficult. There's no single right way to feel about it. What do you wish the other person understood, or what do you need right now?",
        ],
    ),
    # sleep / fatigue / energy
    (
        ["sleep", "insomnia", "can't sleep", "cannot sleep", "awake", "wake", "waking", "tired", "fatigue", "exhausted", "exhaustion", "energy", "no energy", "rest", "nightmare", "nightmares"],
        [
            "Sleep and energy affect everything else. When rest is off, even small things can feel harder. How long has this been going on, and what do your nights look like?",
            "I hear you. Not getting the rest you need can be exhausting in every way. Is it more trouble falling asleep, staying asleep, or waking up tired?",
            "That sounds draining. Has anything made it a little better or worse, even briefly? Sometimes small patterns are worth noticing.",
        ],
    ),
    # self-worth / confidence / guilt
    (
        ["worth", "worthless", "not good enough", "not enough", "confidence", "confident", "self-esteem", "self worth", "imposter", "imposter syndrome", "fail", "failure", "failing", "can't do", "can't handle", "can't cope", "can't cope", "weak", "weakness", "ashamed", "shame"],
        [
            "It takes honesty to name that feeling. You don't have to prove anything here — I'm listening. Where does that feeling show up most for you?",
            "That sounds painful. Feeling not enough or like you're failing can be incredibly heavy. What's been happening that's brought this up?",
            "I hear how hard that is to carry. Would you say this is tied to a specific situation right now, or has it been around longer?",
        ],
    ),
    # trauma / fear / safety feelings (handled carefully; crisis routing is separate)
    (
        ["trauma", "traumatic", "abuse", "abusive", "assault", "harassment", "harassed", "past", "flashback", "flashbacks", "trigger", "triggered", "ptsd", "post-traumatic", "unsafe", "helpless"],
        [
            "Thank you for trusting me with something personal. I'm here to listen without pressure to explain more than you want. What feels most important to say right now?",
            "I can hear how much this affects you. Painful experiences can echo into the present. What's been coming up most lately?",
            "That sounds heavy. However you're feeling makes sense. Would you like to share a bit more about what's been hardest recently?",
        ],
    ),
    # physical health (non-medical)
    (
        ["pain", "headache", "migraine", "stomach", "nausea", "sick", "illness", "disease", "chronic", "symptom", "symptoms", "doctor", "hospital", "medication", "medicine", "appetite", "weight"],
        [
            "I'm sorry you're dealing with this. I'm not a doctor and can't give medical advice, but I can listen to how it's affecting you. What has this been like day to day?",
            "That sounds exhausting. Physical symptoms can affect mood and stress too. What feels hardest about it right now, beyond the symptoms themselves?",
            "I hear you. I can't diagnose or treat medical issues, but I can sit with you in this. Would talking through how it's impacting you help?",
        ],
    ),
    # starting / uncertainty (kept low-priority; avoid dominating)
    (
        ["don't know", "dont know", "not sure", "unsure", "confused", "confusing", "overwhelm", "overwhelmed", "stuck", "where to start", "no idea"],
        [
            "It's okay not to have it all figured out. We can take this slowly. What feels most present for you right now, even if it's hard to name?",
            "Feeling unsure or stuck is its own kind of heavy. You don't need the perfect words. What's been weighing on you most lately?",
            "We don't have to solve everything at once. Is there one part of this that feels a little easier to talk about first?",
        ],
    ),
]


def _scrub(text: str) -> str:
    """Remove blocked phrases from a candidate response."""
    lower = text.lower()
    for phrase in _SAFETY_BLOCK_PHRASES:
        if phrase in lower:
            return (
                "I want to be careful here — I'm not able to make claims like that. "
                "What I can do is listen and help you think through what you're experiencing. "
                "Want to tell me more about what's going on?"
            )
    return text


def _token_count(text: str) -> int:
    """Very rough token estimate (words * 1.3, capped)."""
    return max(1, min(len(text.split()) * 2, 512))


def _pick_fallback() -> str:
    """Return a short empathic fallback, varied by time-based hash."""
    idx = int(hashlib.md5(str(time.time()).encode()).hexdigest(), 16) % len(_FALLBACK_RESPONSES)
    return _FALLBACK_RESPONSES[idx]


def _normalise(text: str) -> str:
    """Lower-case, collapse whitespace, strip."""
    return re.sub(r"\s+", " ", text.lower().strip())


_GENERIC_TOPIC_WORDS = {
    "help", "need help", "what do i do", "what should i do", "advice",
    "how do i", "how can i", "i need", "just", "all", "everything", "nothing",
    "try", "trying", "today", "right now", "where to start", "no idea",
    "don't know", "dont know", "not sure", "unsure", "confused", "confusing",
    "overwhelm", "overwhelmed", "stuck",
}

# Keep the last template (starting/uncertainty) as a fallback, not a primary topic.
_FALLBACK_CLUSTER_INDEX = len(_CONTEXT_RESPONSES) - 1


def _extract_topics(message: str, history: tuple[tuple[str, str], ...]) -> tuple[list[str], list[str]]:
    """Extract topic keywords, returning (current_message_keywords, all_keywords).

    Current-message hits are weighted more heavily so replies follow what the
    user said now rather than repeating earlier vague context.
    """
    from collections import Counter

    current = _normalise(message)
    user_turns: list[str] = [current]
    for role, text in reversed(history):
        if role == "user":
            user_turns.append(_normalise(text))
        if len(user_turns) >= 4:
            break

    current_hits: Counter = Counter()
    all_hits: Counter = Counter()
    for idx, text in enumerate(user_turns):
        weight = 5 if idx == 0 else 1
        for keywords, _ in _CONTEXT_RESPONSES:
            for kw in keywords:
                if kw in text:
                    all_hits[kw] += weight
                    if idx == 0:
                        current_hits[kw] += 5

    def order(counter: Counter) -> list[str]:
        return sorted(
            counter.keys(),
            key=lambda k: (1 if k in _GENERIC_TOPIC_WORDS else 0, -counter[k], -len(k), k),
        )

    return order(current_hits), order(all_hits)


def _resolve_topic(current_keywords: list[str], all_keywords: list[str]) -> tuple[list[str], list[str]] | None:
    """Find the best-matching context template.

    Prefers specific matches from the current message. The generic uncertainty
    cluster is only used when no specific cluster matches.
    """
    if not current_keywords and not all_keywords:
        return None

    def score_cluster(keywords: list[str], template_keywords: list[str]) -> int:
        # Multi-word phrases ("never feel better") are more specific than single
        # words ("scared"), so weight them by length. Without this, a broad
        # emotion word can outrank the actual concern the person named.
        return sum(
            (2 if kw not in _GENERIC_TOPIC_WORDS else 1) * max(1, len(kw.split()))
            for kw in template_keywords
            if kw in keywords
        )

    best: tuple[int, int, int, list[str], list[str]] = (-1, 0, 0, [], [])
    for idx, (template_keywords, responses) in enumerate(_CONTEXT_RESPONSES):
        current_score = score_cluster(current_keywords, template_keywords)
        history_score = score_cluster(all_keywords, template_keywords)
        is_fallback = idx == _FALLBACK_CLUSTER_INDEX
        # Strongly prefer what the user is saying now; history is context only.
        if is_fallback:
            combined = current_score * 2 + min(history_score, 2)
            specificity = 0
        else:
            combined = current_score * 10 + min(history_score, 4)
            specificity = 1 if current_score > 0 else 0
        if combined <= 0:
            continue
        candidate = (combined, specificity, -idx, template_keywords, responses)
        if candidate > best:
            best = candidate

    if best[0] <= 0:
        return None
    # If nothing specific was in the current message but history has a strong
    # specific topic, allow that specific topic over the fallback cluster.
    if best[3] == _CONTEXT_RESPONSES[_FALLBACK_CLUSTER_INDEX][0]:
        for idx, (template_keywords, responses) in enumerate(_CONTEXT_RESPONSES[:_FALLBACK_CLUSTER_INDEX]):
            if score_cluster(all_keywords, template_keywords) >= 3:
                return (template_keywords, responses)
    return (best[3], best[4])


_TOPIC_LABELS = {
    "anxious": "anxiety", "anxiety": "anxiety", "nervous": "anxiety",
    "worry": "worry", "worried": "worry", "panic": "panic",
    "stressed": "stress", "stress": "stress", "overwhelm": "feeling overwhelmed",
    "overwhelmed": "feeling overwhelmed", "depressed": "low mood",
    "depression": "low mood", "sad": "sadness", "sadness": "sadness",
    "hopeless": "hopelessness", "hopelessness": "hopelessness",
    "lonely": "loneliness", "alone": "being alone", "isolated": "feeling isolated",
    "sleep": "sleep", "insomnia": "sleep", "can't sleep": "sleep",
    "cannot sleep": "sleep", "tired": "feeling tired", "exhausted": "exhaustion",
    "work": "work stress", "job": "work stress", "boss": "work stress",
    "meeting": "work stress", "university": "university pressure",
    "college": "college pressure", "study": "studying", "studying": "studying",
    "exam": "exams", "exams": "exams", "assignment": "assignments",
    "focus": "trouble focusing", "concentrate": "trouble concentrating",
    "procrastinate": "procrastination", "procrastinating": "procrastination",
    "procrastination": "procrastination", "guilt": "guilt", "guilty": "guilt",
    "relationship": "relationship stress", "family": "family stress", "pain": "pain",
}


def _wants_small_step(message: str) -> bool:
    text = _normalise(message)
    cues = [
        "one small thing", "small thing", "small step", "something manageable",
        "what can i try", "what could i try", "what should i try", "suggestion",
        "before the next", "in the moment", "practical", "tip",
        "plan", "schedule", "routine", "tomorrow", "next step",
    ]
    return any(cue in text for cue in cues)


def _wants_plan(message: str) -> bool:
    text = _normalise(message)
    return any(
        cue in text
        for cue in ["plan", "schedule", "routine", "tomorrow", "organise my day", "organize my day"]
    )


def _is_gratitude_close(message: str) -> bool:
    text = _normalise(message)
    return any(
        cue in text
        for cue in [
            "thanks for listening", "thank you for listening", "feel lighter",
            "feels lighter", "that helps", "thanks",
        ]
    )


def _choose_non_repeating(candidates: list[str], history: tuple[tuple[str, str], ...], seed: str) -> str:
    recent = [_normalise(t)[:180] for r, t in history if r == "assistant"][-4:]
    for i in range(len(candidates)):
        idx = (int(hashlib.md5(f"{seed}-{i}".encode()).hexdigest(), 16)) % len(candidates)
        text = candidates[idx]
        norm = _normalise(text)[:180]
        if norm and all(norm != r for r in recent):
            return text
    return candidates[int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(candidates)]


def _build_reply(message: str, history: tuple[tuple[str, str], ...]) -> str:
    """Build a context-aware reply. Always returns a non-empty, safe string."""
    msg_norm = _normalise(message)
    history_text = " ".join(_normalise(t) for r, t in history if r == "user")
    combined = f"{msg_norm} {history_text}"
    recent_assistant = [_normalise(t) for r, t in history if r == "assistant"][-3:]

    if _is_gratitude_close(message):
        return _scrub(
            "I'm really glad it felt a little lighter to say that out loud. "
            "You don't have to carry it all at once. If you want, we can keep going, "
            "or you can take a pause here and come back when you're ready."
        )

    if _wants_plan(message):
        if any(k in combined for k in ["university", "exam", "study", "assignment", "coursework", "procrastinat", "focus", "deadline"]):
            reply = (
                "Let's keep tomorrow light enough that it doesn't become another thing to fail at. "
                "Pick one piece of coursework you can start in ten minutes, put a short screen-free break after it, and leave the rest for later. "
                "One small start still counts as progress. Which piece feels most realistic to begin with?"
            )
        elif any(k in combined for k in ["work", "job", "boss", "meeting", "presentation"]):
            reply = (
                "For tomorrow, try choosing one task that actually matters, one short break you protect, and a clear stopping point. "
                "That's enough to give the day some shape without turning it into a test. What would make the morning feel less heavy?"
            )
        else:
            reply = (
                "Let's keep it small. Tomorrow could have one gentle thing for your body, like a glass of water or a short walk, one small task you can finish, and one moment of connection with someone safe. "
                "Nothing needs to be perfect. Which part would feel easiest to hold on to?"
            )
        return _scrub(reply)

    if _wants_small_step(message):
        if any(k in combined for k in ["meeting", "work", "boss", "criticiz", "presentation", "university", "exam", "study", "assignment", "procrastinat", "focus"]):
            reply = (
                "One small thing you could try is to pick a single next step that takes 5–10 minutes — for example, open the material and do just the first small part. "
                "You don't have to solve everything at once. What feels small enough to start with?"
            )
        elif any(k in combined for k in ["sleep", "awake", "night", "insomnia"]):
            reply = (
                "One small thing tonight could be a gentle wind-down: put your phone down for a few minutes and try a slow exhale longer than your inhale. "
                "If sleep doesn't come, resting without forcing it still counts. Would you want something even simpler?"
            )
        elif any(k in combined for k in ["anxious", "anxiety", "panic", "worry", "stressed", "overwhelm"]):
            reply = (
                "One small thing you could try is to name what you're feeling, take one slow breath, and choose just the next manageable step. "
                "Keeping it small is enough. What part feels most manageable right now?"
            )
        elif any(k in combined for k in ["lonely", "alone", "friend", "people"]):
            reply = (
                "One small thing could be a low-pressure connection: send a short message to someone you trust, or spend a few minutes somewhere that feels comfortable. "
                "It doesn't have to be a big conversation. What feels possible today?"
            )
        else:
            reply = (
                "One small thing could be the next manageable step, not the whole solution — a short pause, a glass of water, or writing one sentence about what's hardest. "
                "What feels small enough to try?"
            )
        return _scrub(reply)

    # Short greetings / check-ins
    if len(msg_norm.split()) <= 4 and any(g in msg_norm for g in ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"]):
        return _scrub("Hi — I'm here with you. What's been on your mind lately, or what would feel helpful to talk about?")

    current_keywords, all_keywords = _extract_topics(message, history)
    resolved = _resolve_topic(current_keywords, all_keywords)

    if resolved is None:
        fragment = message.strip()[:140]
        return _scrub(
            f"I'm here with you. What you shared sounds important, and it makes sense that it's taking up space. "
            f"Can you tell me a bit more about what feels hardest about it right now?"
        )

    _, responses = resolved
    # Pick topic from current message first.
    topic_word = "what you're carrying"
    for source in (current_keywords, all_keywords):
        for k in source:
            if k not in _GENERIC_TOPIC_WORDS:
                topic_word = k
                break
        if topic_word != "what you're carrying":
            break
    if topic_word == "what you're carrying" and current_keywords:
        topic_word = current_keywords[0]

    turn_count = len([1 for r, _ in history if r == "user"])
    seed = f"{topic_word}-{turn_count}-{msg_norm[:64]}-{len(''.join(recent_assistant))}"
    reply = _choose_non_repeating(responses, history, seed)

    topic_display = _TOPIC_LABELS.get(topic_word, topic_word).strip()
    if topic_display:
        topic_display = topic_display[0].lower() + topic_display[1:]
    reply = reply.replace("{topic}", topic_display)
    # Capitalize sentence starts introduced by topic insertion.
    reply = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), reply)

    feeling = ""
    for emotion_hint in [
        "anxious", "scared", "sad", "lonely", "tired", "hopeless", "numb",
        "angry", "frustrated", "overwhelmed", "drained", "ashamed", "guilty", "stressed", "worried",
    ]:
        if emotion_hint in msg_norm:
            feeling = emotion_hint
            break
    if "{feeling}" in reply:
        reply = reply.replace("{feeling}", feeling or "a lot")

    reply = _scrub(reply)
    if len(reply.strip()) < 15:
        reply = _pick_fallback()
    if len(reply) > 700:
        reply = reply[:697].rstrip() + "..."
    return reply


# ---------------------------------------------------------------------------
# LocalModelGateway — ModelGateway implementation (fast, sync-safe)
# ---------------------------------------------------------------------------


class LocalModelGateway:
    """
    A fast, context-aware local conversational fallback.

    Produces warm, empathetic, non-diagnostic responses using keyword
    extraction and conversation-history awareness — no neural model,
    no external dependencies, no blocking I/O.  Response latency is
    consistently well under 100 ms on CPU.

    Safety boundaries:
    - Never claims to be human, a therapist, or to diagnose.
    - Scrubs blocked phrases before surfacing a response.
    - Falls back to a short empathic reply on any internal error.
    """

    @property
    def is_configured(self) -> bool:
        # Always configured — this is a pure function, no model to load.
        return True

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        t0 = time.perf_counter()

        try:
            reply = _build_reply(request.user_message, request.conversation_history)
            latency_ms = (time.perf_counter() - t0) * 1000.0
            return GenerationResponse(
                text=reply,
                stop_reason=GenerationStopReason.STOP_TOKEN,
                model_id=LOCAL_MODEL_ID,
                latency_ms=latency_ms,
                token_count=_token_count(reply),
            )
        except Exception as exc:
            logger.warning("Local context engine failed: %s", exc, exc_info=True)
            latency_ms = (time.perf_counter() - t0) * 1000.0
            return GenerationResponse(
                text=_pick_fallback(),
                stop_reason=GenerationStopReason.ERROR,
                model_id=LOCAL_MODEL_ID + " (error — fallback)",
                latency_ms=latency_ms,
                token_count=_token_count(_pick_fallback()),
            )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        resp = await self.generate(request)
        if resp.text:
            yield resp.text


# ---------------------------------------------------------------------------
# Backward-compatible helpers (kept so existing imports don't break)
# ---------------------------------------------------------------------------

_load_model_once = None  # type: ignore[assignment]
_model = None  # type: ignore[assignment]
_tokenizer = None  # type: ignore[assignment]
_device = None  # type: ignore[assignment]
_load_error: str | None = None
