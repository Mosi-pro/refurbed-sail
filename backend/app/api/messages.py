from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.deps import current_user
from ..core.ratelimit import check_rate
from ..models import Boat, Conversation, Message, User, utcnow
from ..schemas.inputs import ConversationStartIn, MessageIn
from ..services.serializers import conversation_out, message_out

router = APIRouter(prefix="/api/conversations", tags=["messages"])


def _mine(user: User):
    return (Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id)


def _get(conv_id: int, user: User, db: Session) -> Conversation:
    conv = db.get(Conversation, conv_id)
    if conv is None or user.id not in (conv.buyer_id, conv.seller_id):
        raise HTTPException(404, "Diese Unterhaltung wurde nicht gefunden.")
    return conv


def _limit(user: User):
    check_rate(f"msg:{user.id}", 30, 300)
    check_rate(f"msg-day:{user.id}", 300, 86400)


@router.get("")
def list_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    convs = db.scalars(select(Conversation).where(_mine(user)).order_by(Conversation.last_message_at.desc())).unique().all()
    ids = [c.id for c in convs]
    unread = dict(db.execute(
        select(Message.conversation_id, func.count()).where(
            Message.conversation_id.in_(ids), Message.sender_id != user.id, Message.read_at.is_(None))
        .group_by(Message.conversation_id)).all()) if ids else {}
    last_ids = db.scalars(select(func.max(Message.id)).where(Message.conversation_id.in_(ids))
                          .group_by(Message.conversation_id)).all() if ids else []
    last = {m.conversation_id: m for m in db.scalars(select(Message).where(Message.id.in_(last_ids)))} if last_ids else {}
    return {"items": [conversation_out(c, user.id, unread.get(c.id, 0), last.get(c.id)) for c in convs]}


@router.get("/unread-count")
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.scalar(select(func.count()).select_from(Message).join(Conversation)
                  .where(_mine(user), Message.sender_id != user.id, Message.read_at.is_(None)))
    return {"unread": n}


@router.post("", status_code=201)
def start_conversation(data: ConversationStartIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _limit(user)
    boat = db.get(Boat, data.boat_id)
    if boat is None or boat.status != "active":
        raise HTTPException(404, "Dieses Inserat ist nicht mehr verfügbar.")
    if boat.seller_id == user.id:
        raise HTTPException(409, "Du kannst dir zu deinem eigenen Inserat keine Nachricht senden.")
    conv = db.scalar(select(Conversation).where(Conversation.boat_id == boat.id, Conversation.buyer_id == user.id))
    if conv is None:
        conv = Conversation(boat_id=boat.id, buyer_id=user.id, seller_id=boat.seller_id)
        db.add(conv)
        db.flush()
    db.add(Message(conversation_id=conv.id, sender_id=user.id, kind=data.kind, body=data.body))
    conv.last_message_at = utcnow()
    db.commit()
    return {"id": conv.id}


@router.get("/{conv_id}")
def get_conversation(conv_id: int, after_id: int = 0, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conv = _get(conv_id, user, db)
    db.execute(update(Message).where(Message.conversation_id == conv.id, Message.sender_id != user.id,
                                     Message.read_at.is_(None)).values(read_at=utcnow()))
    db.commit()
    msgs = db.scalars(select(Message).where(Message.conversation_id == conv.id, Message.id > after_id)
                      .order_by(Message.id)).all()
    return conversation_out(conv, user.id) | {"messages": [message_out(m, user.id) for m in msgs]}


@router.post("/{conv_id}/messages", status_code=201)
def send_message(conv_id: int, data: MessageIn, request: Request, user: User = Depends(current_user),
                 db: Session = Depends(get_db)):
    _limit(user)
    conv = _get(conv_id, user, db)
    other = conv.seller if user.id == conv.buyer_id else conv.buyer
    if not other.is_active:
        raise HTTPException(409, "Dieses Konto ist nicht mehr erreichbar.")
    msg = Message(conversation_id=conv.id, sender_id=user.id, body=data.body)
    db.add(msg)
    conv.last_message_at = utcnow()
    db.commit()
    return message_out(msg, user.id)
