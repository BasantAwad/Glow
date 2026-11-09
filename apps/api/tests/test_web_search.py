"""Tests for the opt-in web search tool and the model-gateway tool loop."""

import pytest
from glow_api.model_gateway import GenerationRequest, OpenWeightsModelGateway
from glow_api.settings import settings
from glow_api.web_search import (
    BraveSearchGateway,
    SearchResult,
    TavilySearchGateway,
    WebSearchGateway,
    format_tool_result,
    sanitize_query,
)


def test_sanitize_query_truncates_and_strips_controls():
    assert sanitize_query("  calm breathing techniques  ") == "calm breathing techniques"
    assert sanitize_query("line\nbreak\x00here") == "line\nbreak here"
    assert len(sanitize_query("x" * 500)) == 200


def test_format_tool_result_empty_is_fail_soft():
    text = format_tool_result([])
    assert "no usable results" in text


def test_format_tool_result_lists_sources():
    text = format_tool_result(
        [SearchResult(title="NIMH", url="https://nimh.nih.gov", snippet="Example snippet")]
    )
    assert "NIMH" in text
    assert "untrusted" in text.lower()


class FakeSearchGateway(WebSearchGateway):
    def __init__(self, results):
        self._results = results
        self.calls: list[str] = []

    @property
    def is_configured(self) -> bool:
        return True

    async def search(self, query: str, max_results: int):
        self.calls.append(query)
        return self._results


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def raise_for_status(self):
        import httpx

        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Counts calls and returns scripted responses in order."""

    responses: list["_FakeResponse"] = []
    payloads: list[dict] = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        _FakeAsyncClient.payloads.append(json)
        assert _FakeAsyncClient.responses, "no scripted response left"
        return _FakeAsyncClient.responses.pop(0)


def _request(session_id: str = "sess_tools"):
    return GenerationRequest(
        session_id=session_id,
        user_id="user_1",
        system_prompt="You are Glow.",
        conversation_history=(),
        user_message="What are good sleep habits for adults?",
        locale="en",
        max_tokens=100,
        timeout_sec=5,
    )


@pytest.mark.asyncio
async def test_tool_loop_executes_search_then_answers(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.responses = [
        _FakeResponse(200, {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "web_search",
                            "arguments": '{"query": "sleep hygiene adults"}',
                        },
                    }],
                },
            }],
        }),
        _FakeResponse(200, {
            "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": "A regular schedule helps."}}],
        }),
    ]
    _FakeAsyncClient.payloads = []

    search = FakeSearchGateway(
        [SearchResult(title="Sleep Foundation", url="https://sleepfoundation.org", snippet="Keep a consistent wake time.")]
    )
    gateway = OpenWeightsModelGateway(
        api_base="https://example.test/v1", api_key="x", model_id="m", web_search=search
    )

    response = await gateway.generate(_request())

    assert response.text == "A regular schedule helps."
    assert search.calls == ["sleep hygiene adults"]
    assert _FakeAsyncClient.payloads[0].get("tools") is not None
    assert _FakeAsyncClient.payloads[1].get("tools") is None


@pytest.mark.asyncio
async def test_no_tools_when_search_unconfigured(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.responses = [
        _FakeResponse(200, {
            "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": "Hello."}}],
        }),
    ]
    _FakeAsyncClient.payloads = []

    gateway = OpenWeightsModelGateway(api_base="https://example.test/v1", api_key="x", model_id="m")
    response = await gateway.generate(_request())

    assert response.text == "Hello."
    assert "tools" not in _FakeAsyncClient.payloads[0]


@pytest.mark.asyncio
async def test_provider_rejecting_tools_retries_without_them(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.responses = [
        _FakeResponse(400, {"error": "tools not supported"}),
        _FakeResponse(200, {
            "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": "Plain answer."}}],
        }),
    ]
    _FakeAsyncClient.payloads = []

    search = FakeSearchGateway([])
    gateway = OpenWeightsModelGateway(
        api_base="https://example.test/v1", api_key="x", model_id="m", web_search=search
    )
    response = await gateway.generate(_request())

    assert response.text == "Plain answer."
    assert search.calls == []
    assert _FakeAsyncClient.payloads[1].get("tools") is None


@pytest.mark.asyncio
async def test_session_search_budget_is_enforced(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.responses = [
        _FakeResponse(200, {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "web_search",
                            "arguments": '{"query": "first query"}',
                        },
                    }, {
                        "id": "call_2",
                        "type": "function",
                        "function": {
                            "name": "web_search",
                            "arguments": '{"query": "second query"}',
                        },
                    }],
                },
            }],
        }),
        _FakeResponse(200, {
            "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": "Limited answers."}}],
        }),
    ]
    _FakeAsyncClient.payloads = []
    monkeypatch.setattr(settings, "search_max_per_session", 1)

    search = FakeSearchGateway([])
    gateway = OpenWeightsModelGateway(
        api_base="https://example.test/v1", api_key="x", model_id="m", web_search=search
    )
    response = await gateway.generate(_request(session_id="sess_budget"))

    assert response.text == "Limited answers."
    # First call executes; second exceeds the per-session budget of 1.
    assert search.calls == ["first query"]


@pytest.mark.asyncio
async def test_tavily_parses_results(monkeypatch):
    import httpx

    class _SearchClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, headers=None, json=None):
            assert json["api_key"] == "tvly-test"
            return _FakeResponse(200, {
                "results": [
                    {"title": "Example", "url": "https://example.org", "content": "Useful snippet."},
                    {"title": "Missing snippet", "url": "https://example.org/2", "content": ""},
                ],
            })

    monkeypatch.setattr(httpx, "AsyncClient", _SearchClient)
    gateway = TavilySearchGateway(api_key="tvly-test")
    results = await gateway.search("sleep hygiene", 5)

    assert len(results) == 1
    assert results[0].snippet == "Useful snippet."


@pytest.mark.asyncio
async def test_brave_parses_results(monkeypatch):
    import httpx

    class _SearchClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, headers=None, params=None):
            assert headers["X-Subscription-Token"] == "BSA-test"
            return _FakeResponse(200, {
                "web": {"results": [
                    {"title": "Example", "url": "https://example.org", "description": "Brave snippet."},
                ]},
            })

    monkeypatch.setattr(httpx, "AsyncClient", _SearchClient)
    gateway = BraveSearchGateway(api_key="BSA-test")
    results = await gateway.search("sleep hygiene", 3)

    assert len(results) == 1
    assert results[0].title == "Example"


@pytest.mark.asyncio
async def test_search_failure_returns_empty_not_exception():
    gateway = TavilySearchGateway(api_key=None)
    assert await gateway.search("anything", 3) == []
