"""Behaviour checks for the in-process local fallback engine."""

from __future__ import annotations

from glow_api.local_model import _build_reply


def _history(*turns: tuple[str, str]) -> tuple[tuple[str, str], ...]:
    return turns


def test_plan_request_returns_a_small_plan():
    reply = _build_reply(
        "Can you give me a plan for tomorrow?",
        _history(
            ("user", "I feel like a failure because I can't keep up with my coursework."),
            ("assistant", "That sounds really draining."),
        ),
    )

    assert "tomorrow" in reply.lower()
    assert "coursework" in reply.lower() or "ten minutes" in reply.lower()
    assert "**" not in reply
    assert "- " not in reply


def test_fear_that_things_will_never_change_is_not_misread_as_trauma():
    reply = _build_reply(
        "I'm scared I'll never feel better.",
        _history(("user", "I've been feeling low for a while.")),
    )

    lowered = reply.lower()
    assert any(
        cue in lowered
        for cue in ("one day at a time", "next hour", "keeping you going", "hope feels far away")
    )
    assert "**" not in reply


def test_reply_is_plain_text_and_non_empty():
    reply = _build_reply("I keep procrastinating and then I feel guilty.", _history())

    assert reply.strip()
    assert "**" not in reply
    assert "##" not in reply
    assert "- " not in reply
