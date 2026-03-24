from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Response
from redis import Redis
from sqlalchemy.orm import Session

from app.db.session import get_db, redis_client
from app.schemas.ticket import CreateTicketRequest, CreateTicketResponse
from app.services.ticket_service import create_ticket

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", response_model=CreateTicketResponse)
def create_ticket_endpoint(
    payload: CreateTicketRequest,
    response: Response,
    _x_request_id: str | None = Header(default=None, alias="X-Request-Id"),
    db: Session = Depends(get_db),
) -> CreateTicketResponse:
    result = create_ticket(db=db, redis_client=redis_client, req=payload)
    response.status_code = result.status_code
    return result.payload
