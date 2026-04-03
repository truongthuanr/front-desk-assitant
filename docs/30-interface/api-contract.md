# API Contract v1

## 1. Conventions
- Base URL: `/api/v1`
- Content-Type: `application/json`
- Time: ISO-8601 UTC
- Currency: `VND`

## 2. Headers
- `X-Request-Id`: bắt buộc cho API ghi dữ liệu.
- `Authorization`: Bearer token (trừ webhook/public endpoint theo policy).
- `X-Idempotency-Key`: khuyến nghị cho payment intent.

## 3. Error Model
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## 4. OTP APIs
### 4.1 Request OTP
- `POST /auth/otp/send`

Request
```json
{
  "purpose": "issue_ticket",
  "phone": "0900000000"
}
```

Success `200`
```json
{
  "otp_request_id": "otp_req_01",
  "expires_in": 180,
  "retry_after_seconds": 60
}
```

Errors
- `422 INVALID_PHONE`
- `429 OTP_RATE_LIMITED`

### 4.2 Verify OTP
- `POST /auth/otp/verify`

Request
```json
{
  "purpose": "issue_ticket",
  "otp_request_id": "otp_req_01",
  "phone": "0900000000",
  "otp_code": "123456"
}
```

Success `200`
```json
{
  "otp_verify_token": "ovt_xxx",
  "expires_in": 600
}
```

Errors
- `401 OTP_INVALID`
- `401 OTP_EXPIRED`
- `422 OTP_PURPOSE_MISMATCH`
- `429 OTP_ATTEMPT_LIMITED`

## 5. Ticket APIs
### 5.1 Create ticket
- `POST /tickets`

Request
```json
{
  "request_id": "req_8d6b9c0e",
  "otp_verify_token": "ovt_xxx",
  "user_info": {
    "name": "Nguyen Van A",
    "phone": "0900000000"
  }
}
```

Success `201`
```json
{
  "ticket_id": "tkt_01",
  "ticket_code": "GEN-20260318-0042",
  "subject_ref": "usr_01",
  "general_queue": {
    "queue_code": "GENERAL",
    "queue_name": "General Intake Queue",
    "queue_number": 42,
    "queue_position": 42
  },
  "routing": {
    "status": "unrouted",
    "clinic_queue": null
  },
  "order": {
    "order_id": "ord_01",
    "status": "draft"
  }
}
```

Idempotent replay `200`
- Cùng `request_id` -> trả ticket đã tạo trước đó.

Errors
- `401 OTP_REQUIRED`
- `401 OTP_EXPIRED`
- `422 OTP_PURPOSE_MISMATCH`
- `403 FORBIDDEN_CHANNEL`
- `422 INVALID_REQUEST`
- `503 QUEUE_COUNTER_UNAVAILABLE`

### 5.2 Route ticket
- `PUT /tickets/{ticket_id}/routing`

Errors
- `404 TICKET_NOT_FOUND`
- `404 DEST_QUEUE_NOT_FOUND`
- `409 DEST_QUEUE_INACTIVE`
- `422 INVALID_ROUTING_REQUEST`

### 5.3 Ticket lookup detail (public)
- `GET /tickets/{ticket_code}`
- Auth: lookup token sau OTP purpose `ticket_lookup`

## 6. Lookup APIs
- `GET /lookup/poi?q={keyword}&page=1&page_size=20`
- `GET /lookup/services?q={keyword}&category={optional}`

## 7. Payment APIs
- `POST /orders/{order_id}/items`
- `POST /orders/{order_id}/payment-intents`
- `GET /orders/{order_id}`
- `POST /payments/webhook`

## 8. Status Enums
- `order.status`: `draft`, `open`, `partially_paid`, `paid`, `cancelled`
- `payment_intent.status`: `pending`, `success`, `failed`, `expired`
- `ticket.routing.status`: `unrouted`, `routed`

## 9. Idempotency Rules
- `POST /tickets`: idempotent theo `request_id`.
- `POST /tickets`: `otp_verify_token` bắt buộc hợp lệ cho `issue_ticket`.
- `PUT /tickets/{ticket_id}/routing`: khuyến nghị idempotent theo `X-Request-Id`.
- `POST /payments/webhook`: idempotent theo `provider_event_id`.
- `POST /orders/{order_id}/payment-intents`: idempotent mềm theo `X-Idempotency-Key`.
