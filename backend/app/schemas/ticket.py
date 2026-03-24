from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TicketUserInfo(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=8, max_length=20)


class CreateTicketRequest(BaseModel):
    request_id: str = Field(min_length=3, max_length=64)
    user_info: TicketUserInfo


class TicketOrderSnapshot(BaseModel):
    order_id: str
    status: str


class GeneralQueueSnapshot(BaseModel):
    queue_code: str
    queue_name: str
    queue_number: int
    queue_position: int


class RoutingSnapshot(BaseModel):
    status: str
    clinic_queue: dict | None = None


class CreateTicketResponse(BaseModel):
    ticket_id: str
    ticket_code: str
    subject_ref: str
    general_queue: GeneralQueueSnapshot
    routing: RoutingSnapshot
    created_at: datetime
    order: TicketOrderSnapshot


class CreateTicketResult(BaseModel):
    status_code: int
    payload: CreateTicketResponse
