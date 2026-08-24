"""
Redacted structured logging (Phase 5).
"""

import json
import logging
from datetime import datetime, UTC
from typing import Any

from glow_api.privacy import redact_log_line
from glow_api.settings import settings

class RedactedJSONFormatter(logging.Formatter):
    """
    JSON formatter that redacts PII and sensitive fields before emitting.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_log_line(record.getMessage(), redact_user_ids=True),
            "service": settings.service_name
        }

        if hasattr(record, "request_id"):
            log_obj["request_id"] = redact_log_line(record.request_id, redact_user_ids=True)

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)

def configure_logging() -> None:
    """
    Configures the root logger to use the redacted JSON formatter.
    """
    logger = logging.getLogger("glow_api")
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    handler = logging.StreamHandler()
    handler.setFormatter(RedactedJSONFormatter())
    logger.addHandler(handler)
    
    # Do not propagate to root logger if it has other handlers
    logger.propagate = False
