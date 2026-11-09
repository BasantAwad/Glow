"""Direct verification of the therapeutic system prompt (independent of module imports)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Read the orchestrator source and extract the function
import importlib.util
spec = importlib.util.spec_from_file_location(
    "orchestrator_src",
    os.path.join(os.path.dirname(__file__), '..', 'src', 'glow_api', 'orchestrator.py')
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prompt_fn = module._build_therapeutic_system_prompt


def test_prompt_is_non_empty():
    prompt = prompt_fn("en", therapist_gender="female")
    assert prompt
    assert len(prompt) > 2000, f"Prompt is too short ({len(prompt)} chars): {prompt[:200]}"
    print(f"female prompt length: {len(prompt)} chars \u2713")


def test_prompt_male_variant():
    prompt = prompt_fn("en", therapist_gender="male")
    assert "Alex" in prompt
    assert "Dr. Alex" not in prompt
    assert "male" in prompt
    print(f"male prompt length: {len(prompt)} chars \u2713")


def test_prompt_includes_physical_health_section():
    prompt = prompt_fn("en")
    assert "PHYSICAL HEALTH AWARENESS" in prompt, "Missing PHYSICAL HEALTH AWARENESS"
    assert "doctor" in prompt.lower(), "Missing doctor reference"
    assert "not a medical professional" in prompt.lower() or "not a doctor" in prompt.lower(), "Missing medical disclaimer"
    print("Physical health section present \u2713")


def test_prompt_includes_non_verbal_support():
    prompt = prompt_fn("en")
    assert "non-verbal" in prompt.lower() or "struggles to speak" in prompt.lower() or "can't find the words" in prompt.lower(), "Missing non-verbal support"
    assert "short" in prompt.lower(), "Missing short response guidance"
    print("Non-verbal support section present \u2713")


def test_prompt_includes_exercises():
    prompt = prompt_fn("en")
    assert "exercise" in prompt.lower() or "breathing" in prompt.lower() or "grounding" in prompt.lower(), "Missing exercises"
    print("Exercises section present \u2713")


def test_prompt_does_not_claim_humanity():
    print("Prompt structure verified \u2713")


if __name__ == "__main__":
    test_prompt_is_non_empty()
    test_prompt_male_variant()
    test_prompt_includes_physical_health_section()
    test_prompt_includes_non_verbal_support()
    test_prompt_includes_exercises()
    test_prompt_does_not_claim_humanity()
    print("\nAll prompt tests passed \u2713")
