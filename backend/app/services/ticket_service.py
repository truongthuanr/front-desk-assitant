from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Order, Queue, Ticket
from app.schemas.ticket import (
    CreateTicketRequest,
    CreateTicketResponse,
    CreateTicketResult,
    GeneralQueueSnapshot,
    RoutingSnapshot,
    TicketOrderSnapshot,
)

MAX_TICKET_RETRY = 5


def _build_ticket_code(queue_number: int, now: datetime) -> str:
    return f"GEN-{now.strftime('%Y%m%d')}-{queue_number:04d}"


def _to_response(ticket: Ticket, general_queue: Queue, order: Order) -> CreateTicketResponse:
    return CreateTicketResponse(
        ticket_id=ticket.id,
        ticket_code=ticket.ticket_code,
        subject_ref=ticket.subject_ref,
        general_queue=GeneralQueueSnapshot(
            queue_code=general_queue.code,
            queue_name=general_queue.name,
            queue_number=ticket.general_queue_number,
            queue_position=ticket.general_queue_number,
        ),
        routing=RoutingSnapshot(status=ticket.routing_status, clinic_queue=None),
        created_at=ticket.created_at,
        order=TicketOrderSnapshot(order_id=order.id, status=order.status),
    )


def _get_or_create_general_queue(db: Session) -> Queue:
    queue = db.query(Queue).filter(Queue.code == settings.general_queue_code).first()
    if queue:
        return queue

    queue = Queue(
        code=settings.general_queue_code,
        name=settings.general_queue_name,
        queue_type="general",
        is_active=True,
    )
    db.add(queue)
    db.commit()
    db.refresh(queue)
    return queue


def create_ticket(db: Session, redis_client: Redis, req: CreateTicketRequest) -> CreateTicketResult:
    existing = db.query(Ticket).filter(Ticket.request_id == req.request_id).first()
    if existing:
        general_queue = db.query(Queue).filter(Queue.id == existing.general_queue_id).first()
        order = db.query(Order).filter(Order.ticket_id == existing.id).first()
        if general_queue is None or order is None:
            raise HTTPException(status_code=500, detail="INCONSISTENT_TICKET_DATA")
        return CreateTicketResult(
            status_code=200,
            payload=_to_response(existing, general_queue, order),
        )

    general_queue = _get_or_create_general_queue(db)
    if not general_queue.is_active:
        raise HTTPException(status_code=409, detail="GENERAL_QUEUE_INACTIVE")

    now = datetime.now(timezone.utc)
    key_date = now.strftime("%Y-%m-%d")
    redis_key = f"queue:general:{key_date}"

    for _ in range(MAX_TICKET_RETRY):
        try:
            queue_number = int(redis_client.incr(redis_key))
        except RedisError as exc:
            raise HTTPException(status_code=503, detail="QUEUE_COUNTER_UNAVAILABLE") from exc

        ticket = Ticket(
            id=str(uuid.uuid4()),
            ticket_code=_build_ticket_code(queue_number=queue_number, now=now),
            queue_date=now.date(),
            general_queue_id=general_queue.id,
            general_queue_number=queue_number,
            routing_status="unrouted",
            request_id=req.request_id,
            subject_ref=f"usr_{uuid.uuid4().hex[:12]}",
        )

        db.add(ticket)
        try:
            db.flush()
            order = Order(id=str(uuid.uuid4()), ticket_id=ticket.id, status="draft", currency="VND")
            db.add(order)
            db.commit()
            db.refresh(ticket)
            db.refresh(order)
            return CreateTicketResult(
                status_code=201,
                payload=_to_response(ticket, general_queue, order),
            )
        except IntegrityError:
            db.rollback()
            continue

    raise HTTPException(status_code=503, detail="QUEUE_COUNTER_UNAVAILABLE")
