from fastapi.testclient import TestClient

from glow_api.main import create_app
from glow_api.settings import Settings


def test_health_check_returns_non_sensitive_process_status() -> None:
    client = TestClient(create_app(Settings(environment="test", service_name="glow-api-test")))

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "glow-api-test",
        "environment": "test",
    }

