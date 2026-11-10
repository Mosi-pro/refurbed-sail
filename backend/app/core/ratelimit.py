"""Small in-memory sliding-window rate limiter (single-process deployments)."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from .config import get_settings

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_rate(key: str, limit: int, window_seconds: int) -> None:
    if not get_settings().rate_limit_enabled:
        return
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and q[0] <= now - window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(
                status_code=429,
                detail="Zu viele Anfragen. Bitte versuche es in Kürze erneut.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)


def rate_limit(scope: str, limit: int, window_seconds: int):
    def dep(request: Request):
        check_rate(f"{scope}:{client_ip(request)}", limit, window_seconds)

    return dep


def reset_all() -> None:
    with _lock:
        _hits.clear()
