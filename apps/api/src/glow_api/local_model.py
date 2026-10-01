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
        ["anxious", "anxiety", "nervous", "worry", "worried", "panic", "stressed", "stress", "overwhelm", "overwhelmed", "dread"],
        [
            "It sounds like {topic} has been really present for you lately. That can feel so exhausting — like your mind won't give you a break. I'm wondering, when that anxious feeling shows up, is there a particular thought or situation that seems to come with it?",
            "I hear you. Anxiety can be so heavy, and it makes complete sense that you'd want to understand it better. You don't have to have it all figured out. What's it been like for you — has this been building for a while, or did something specific happen?",
            "That sounds really tough. Anxiety has a way of making everything feel bigger and more uncertain than it already is. I'm curious — when you notice that feeling, where do you feel it in your body? Sometimes our bodies hold on to things before our minds catch up.",
        ],
    ),
    # depression / low mood / sadness
    (
        ["depressed", "depression", "sad", "sadness", "down", "low", "hopeless", "hopelessness", "empty", "numb", "tears", "crying", "cry", "grief", "lost", "lonely", "alone", "isolated"],
        [
            "Thank you for trusting me with that. Feeling this low can be so isolating, and it takes real courage to name it out loud. I'm here with you. I'm wondering — has this been a recent thing, or has it been sitting with you for longer than that?",
            "I can hear how much pain you're carrying. That sounds incredibly heavy. You don't have to hold it all by yourself — not in this conversation anyway. What's the hardest part of this for you right now?",
            "It sounds like you've been carrying so much. Sadness like that can be exhausting. I want you to know I'm listening, and there's no rush to have the right words. What feels like the most important thing to say right now?",
        ],
    ),
    # work / job / career stress
    (
        ["work", "job", "boss", "colleague", "coworker", "colleagues", "team", "career", "promotion", "interview", "layoff", "fired", "quota", "deadline", "performance", "criticism", "criticize", "criticized", "micromanage", "burnout", "overtime", "meeting", "colleagues"],
        [
            "Work can take up so much of our mental space, and it's completely understandable that it would weigh on you — especially when it touches things like your sense of worth or your daily stress levels. I'm curious, what's been the hardest part of this work situation for you?",
            "It sounds like work has been really wearing you down. That's so common, and it's also so hard — because it's not just the workload, it's how it makes you feel about yourself. What's been going on that feels most difficult?",
            "I hear you. When work starts to feel like it's draining more than just your time — when it starts touching your sense of who you are — that's a sign it's worth paying attention to. Has this been building over time, or did something specific shift?",
        ],
    ),
    # relationships / family / friends / breakup / loneliness
    (
        ["relationship", "partner", "boyfriend", "girlfriend", "husband", "wife", "spouse", "breakup", "divorce", "separation", "family", "mother", "father", "mom", "dad", "parent", "parents", "sibling", "brother", "sister", "friend", "friends", "friendship", "lonely", "alone", "argue", "argument", "fight", "fighting", "conflict", "trust", "cheat", "cheating", "affair"],
        [
            "Relationships can be some of the most meaningful — and some of the hardest — parts of our lives. It sounds like this is weighing on you. I'm wondering, what feels like the core of it for you right now?",
            "Thank you for sharing that. When relationships start to feel uncertain or painful, it can shake a lot more than just the relationship itself. I'm here. What's been the hardest moment in all of this?",
            "That sounds really hard. Relationships ask a lot of us, and when they're not feeling safe or connected, it can bring up so much. There's no 'right' way to feel about it. What's been the most difficult part for you?",
        ],
    ),
    # sleep / insomnia / fatigue / energy
    (
        ["sleep", "insomnia", "can't sleep", "cannot sleep", "awake", "wake", "waking", "tired", "fatigue", "exhausted", "exhaustion", "energy", "no energy", "rest", "nightmare", "nightmares", "dream"],
        [
            "Sleep and energy are so tied to everything else — mood, focus, how we feel about ourselves. When they go off, it can make everything else feel harder. I'm curious, how long has this been going on, and what does a typical night look like for you?",
            "I hear you. When you can't get the rest you need, it affects everything — and it's frustratingly hard to just 'fix'. There's no quick answer, but I'm here to listen. What's been going on at night — is it trouble falling asleep, staying asleep, or waking up too early?",
            "That sounds really draining. Not getting enough rest can make everything else feel heavier. I wonder — has this been going on for a while, and is there anything that seems to make it better or worse, even a little?",
        ],
    ),
    # self-worth / confidence / identity
    (
        ["worth", "worthless", "not good enough", "not enough", "enough", "confidence", "confident", "self-esteem", "self worth", "imposter", "imposter syndrome", "fail", "failure", "failing", "can't do", "can't handle", "can't cope", "can\'t cope", "weak", "weakness"],
        [
            "It takes real honesty to name those feelings — the sense that you're not enough, or that you can't handle things. I want you to know that I hear you, and I'm not here to tell you what to think about yourself. I'm just here to listen. Would you be willing to tell me a little more about where that feeling comes up for you?",
            "That sounds incredibly painful — feeling like you're not enough, or like you're failing, is one of the heaviest things a person can carry. You don't have to prove anything to me. I'm just listening. What's been going on that's brought this up for you?",
            "I hear how much pain there is in that feeling of not being enough. So many people carry that, even when it looks like they're doing fine from the outside. You're not alone in that. Would you say this is more about a specific situation, or has it been a longer-standing thing?",
        ],
    ),
    # trauma / past / abuse / haunting
    (
        ["trauma", "traumatic", "abuse", "abusive", "assault", "raped", "rape", "molest", "molested", "past", "haunting", "flashback", "flashbacks", "trigger", "triggered", "ptsd", "post-traumatic", "harassment", "harassed", "unsafe", "unsafe", "fear", "scared", "terrified", "helpless", "hopeless"],
        [
            "Thank you for trusting me with something so personal. What you went through sounds incredibly hard, and I want you to know I'm here to listen — without any pressure to explain more than you want to. You don't have to carry this alone in this conversation. What feels like the most important thing to say right now?",
            "I can hear how much this still affects you. When something that painful happened, it doesn't just stay in the past — it can echo into everything. I'm here with you, and there's no rush. What's been coming up most for you lately?",
            "That sounds so heavy, and I'm really glad you told me. Trauma has a way of making the present feel like the past sometimes. I want you to know that however you're feeling right now makes sense. Would you like to tell me a bit more about what's been hardest recently?",
        ],
    ),
    # physical health / pain / symptoms
    (
        ["pain", "headache", "migraine", "stomach", "nausea", "sick", "illness", "disease", "chronic", "symptom", "symptoms", "diagnosis", "diagnosed", "doctor", "hospital", "surgery", "medication", "medicine", "pill", "appetite", "weight", "gain", "lose weight", "loss"],
        [
            "I'm sorry you're dealing with this. Physical symptoms can take such a toll — not just on the body, but on everything else too. I want to be upfront that I'm not a doctor and can't give medical advice, but I am here to listen and help you think through what this has been like for you. Would you like to tell me more about what's been going on?",
            "It sounds like this has been really hard on you — physically and probably emotionally too. I'm not able to give medical advice, but I can listen and help you sort through what this has meant for your day-to-day life. How has this been affecting you beyond just the physical symptoms?",
            "That sounds exhausting. Dealing with physical symptoms on top of everything else is a lot. I want to be honest — I can't diagnose or prescribe, but I can sit with you in this and help you think it through. What's been the hardest part of this for you?",
        ],
    ),
    # eating / body image
    (
        ["eating", "eat", "food", "binge", "bingeing", "over eat", "overeat", "starve", "restrict", "diet", "body", "body image", "weight", "fat", "thin", "skinny", "bulimia", "anorexia", "body dysmorphia", "mirror", "appearance", "look"],
        [
            "Thank you for opening up about this. Our relationship with food and our bodies can be so complicated, and it can feel incredibly personal and hard to talk about. I'm here to listen without judgment. What's been going on for you around this?",
            "I hear you. This can be such a difficult thing to carry, especially when it feels like it's wrapped up with how you see yourself. I want to be honest — I'm not here to give advice about eating or weight, but I am here to listen and understand what this has been like for you. Would you be willing to share a bit more?",
            "It sounds like this is really painful for you. Our relationship with food and our bodies can touch so much of how we feel about ourselves. You don't have to figure this out right now. What feels like the most important thing to say?",
        ],
    ),
    # general / open-ended / "I don't know"
    (
        ["don't know", "dont know", "not sure", "unsure", "confused", "confusing", "overwhelm", "overwhelmed", "stuck", "lost", "empty", "nothing", "everything", "all", "just", "tired", "help", "need help", "what do i do", "what should i do", "advice", "how do i", "how can i", "i need"],
        [
            "It's okay not to have it all figured out — honestly, most of the time none of us do. I'm here to listen and help you untangle things at your own pace. What feels like the most pressing thing on your mind right now?",
            "That's a completely fair place to be — feeling unsure or stuck is its own kind of heavy. You don't need to know exactly what's wrong before you reach out. I'm here. What's been feeling the most difficult lately?",
            "I appreciate you saying that. Sometimes the hardest part is just not knowing where to start. We don't have to start anywhere in particular. What's something — anything — that's been feeling heavy or hard lately? Even something small counts.",
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


def _extract_topics(message: str, history: tuple[tuple[str, str], ...]) -> list[str]:
    """
    Extract topic keywords from the current message and recent history.

    Looks at the last 4 user turns (including the current one) and
    returns the union of keyword hits, ordered by frequency then by
    template priority.
    """
    # Gather text from current message + last 4 user turns in history
    texts: list[str] = []
    # Current message first
    texts.append(_normalise(message))
    # Walk history backwards, take last 4 user messages
    user_turns: list[str] = []
    for role, text in reversed(history):
        if role == "user":
            user_turns.append(_normalise(text))
        if len(user_turns) >= 4:
            break
    texts.extend(user_turns)

    # Count keyword hits per topic cluster
    from collections import Counter
    hits: Counter = Counter()
    for text in texts:
        for keywords, _ in _CONTEXT_RESPONSES:
            for kw in keywords:
                if kw in text:
                    hits[kw] += 1

    # Order: highest frequency first, then by order of appearance in templates
    ordered: list[str] = sorted(hits.keys(), key=lambda k: (-hits[k], k))
    return ordered


def _resolve_topic(keywords: list[str]) -> tuple[list[str], list[str]] | None:
    """
    Given extracted keywords, find the best-matching context template.

    Returns the (keywords, responses) pair for the best match, or None
    if nothing matches.
    """
    if not keywords:
        return None

    # Score each template by how many of its keywords appear in the
    # extracted keyword set.
    best: tuple[int, int, list[str], list[str]] = (-1, 0, [], [])  # score, -priority, keywords, responses
    for idx, (template_keywords, responses) in enumerate(_CONTEXT_RESPONSES):
        score = sum(1 for kw in template_keywords if kw in keywords)
        if score > best[0] or (score == best[0] and idx < best[1]):
            best = (score, idx, template_keywords, responses)

    if best[0] <= 0:
        return None
    return (best[2], best[3])


def _build_reply(
    message: str,
    history: tuple[tuple[str, str], ...],
) -> str:
    """
    Build a context-aware reply for the given message and conversation
    history.  Always returns a non-empty string.
    """
    keywords = _extract_topics(message, history)
    resolved = _resolve_topic(keywords)

    if resolved is None:
        # No topic match — use a generic empathic opener that still
        # reflects the presence of conversation history.
        recent_user_messages = [
            t for r, t in history if r == "user"
        ][-3:]
        if recent_user_messages:
            last = recent_user_messages[-1]
            # Pick the longest recent user message fragment (at least 12 chars)
            fragment = last[:80]
            if len(fragment) < 12:
                fragment = last
            return (
                f"I'm hearing you, and I want to give this the attention it deserves. "
                f"You mentioned \"{fragment}\" — and I'm curious, what's been the hardest part "
                f"of that for you lately? There's no rush to have it all figured out."
            )
        else:
            return _pick_fallback()

    topic_keywords, responses = resolved

    # Choose a topic word for the {topic} placeholder.  Prefer the
    # keyword that appeared most frequently in the extracted set.
    from collections import Counter
    counts = Counter(keywords)
    topic_word = counts.most_common(1)[0][0] if counts else topic_keywords[0]

    # Pick a response by hashing the session + turn count so we vary
    # responses across turns but stay deterministic within a turn.
    turn_count = len([1 for r, _ in history if r == "user"])
    seed = f"{topic_word}-{turn_count}"
    idx = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(responses)
    reply = responses[idx]

    # Fill {topic} placeholder with a human-friendly form of the topic word.
    # Capitalize the first letter for readability.
    topic_display = topic_word.strip()
    if topic_display:
        topic_display = topic_display[0].upper() + topic_display[1:]
    reply = reply.replace("{topic}", topic_display)

    # Also replace {feeling} if present — use the strongest emotion word
    # from the message if we can find one.
    feeling = ""
    for emotion_hint in ["anxious", "scared", "sad", "lonely", "tired", "hopeless", "numb", "angry", "frustrated", "overwhelmed", "drained", "pain", "ashamed", "guilty"]:
        if emotion_hint in _normalise(message):
            feeling = emotion_hint
            break
    if feeling:
        feeling_display = feeling[0].upper() + feeling[1:]
        reply = reply.replace("{feeling}", feeling_display)

    # Safety scrub
    reply = _scrub(reply)

    # Ensure minimum length; fall back if too short
    if len(reply.strip()) < 15:
        reply = _pick_fallback()

    # Hard cap length
    if len(reply) > 600:
        reply = reply[:597].rstrip() + "..."

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
