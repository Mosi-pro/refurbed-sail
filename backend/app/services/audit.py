import json

from fastapi import Request
from sqlalchemy.orm import Session

from ..core.ratelimit import client_ip
from ..models import AuditLog, User


def log_action(db: Session, admin: User | None, action: str, target_type: str, target_id: int | None,
               details: dict | None = None, request: Request | None = None) -> None:
    db.add(AuditLog(
        admin_id=admin.id if admin else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=json.dumps(details, ensure_ascii=False) if details else None,
        ip=client_ip(request) if request else None,
    ))
