"""Re-export the local model gateway so model_gateway.py can import it
without creating a circular dependency."""

from glow_api.local_model import LocalModelGateway

__all__ = ["LocalModelGateway"]
