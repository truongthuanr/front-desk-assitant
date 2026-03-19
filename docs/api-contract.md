# API Contract v1 - Front Desk Assistant Agent (MVP)

## 1. Conventions
- Base URL: `/api/v1`
- Content-Type: `application/json`
- Time format: ISO-8601 UTC (`2026-03-18T16:20:00Z`)
- Currency: `VND` (MVP default)

## 2. Headers
- `X-Request-Id`: bắt buộc cho API ghi dữ liệu.
- `Authorization`: Bearer token (trừ webhook).
- `X-Idempotency-Key`: khuyến nghị cho tạo payment intent.

## 3. Error Model
```json
{
  "error": {
    "code": "ORDER_ALREADY_PAID",
    "message": "Order has no outstanding amount",
    "details": {}
  }
}
```

## 4. Ticket APIs
### 4.1 Create ticket
- `POST /tickets`

Request
```json
{
  "request_id": "req_8d6b9c0e",
  "queue_code": "KHAM_NOI",
  "user_info": {
    "name": "Nguyen Van A",
    "phone": "0900000000"
  },
  "operator_routing": {
    "operator_id": "op_001",
    "note": "Routing by symptoms"
  }
}
```

Success `201`
```json
{
  "ticket_id": "tkt_01",
  "ticket_code": "KHAM_NOI-20260318-0042",
  "queue_name": "Kham Noi",
  "queue_position": 42,
  "created_at": "2026-03-18T09:00:00Z",
  "order": {
    "order_id": "ord_01",
    "status": "draft"
  }
}
```

Idempotent replay `200`
- Khi `request_id` đã tồn tại, trả lại đúng payload ticket đã tạo trước đó.

Errors
- `404 QUEUE_NOT_FOUND`
- `409 QUEUE_INACTIVE`
- `422 INVALID_REQUEST`
- `503 QUEUE_COUNTER_UNAVAILABLE`

## 5. Lookup APIs
### 5.1 Search POI
- `GET /lookup/poi?q={keyword}&page=1&page_size=20`

Success `200`
```json
{
  "items": [
    {
      "poi_id": "poi_01",
      "name": "Quay Tiep Nhan A",
      "building": "Khu A",
      "floor": "1"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### 5.2 Search services
- `GET /lookup/services?q={keyword}&category={optional}`

Success `200`
```json
{
  "items": [
    {
      "service_code": "DV_XN_MAU",
      "service_name": "Xet nghiem mau",
      "description": "Lay mau va phan tich",
      "service_hours": "07:00-16:30",
      "reference_price": 120000
    }
  ]
}
```

Errors
- `400 INVALID_QUERY`

## 6. Payment APIs
### 6.1 Add item to order
- `POST /orders/{order_id}/items`

Request
```json
{
  "service_code": "DV_XN_MAU",
  "service_name": "Xet nghiem mau",
  "qty": 1,
  "unit_price": 120000
}
```

Success `200`
```json
{
  "order_id": "ord_01",
  "status": "open",
  "currency": "VND",
  "total_amount": 120000,
  "paid_amount": 0,
  "outstanding_amount": 120000,
  "updated_at": "2026-03-18T09:05:00Z"
}
```

Errors
- `404 ORDER_NOT_FOUND`
- `409 ORDER_FINALIZED`
- `422 INVALID_ITEM`

### 6.2 Create payment intent
- `POST /orders/{order_id}/payment-intents`

Request
```json
{
  "amount": 120000,
  "return_url": "https://app.example.com/payments/return"
}
```

Success `201`
```json
{
  "payment_intent_id": "pi_01",
  "intent_code": "PI-20260318-0001",
  "order_id": "ord_01",
  "status": "pending",
  "amount": 120000,
  "expires_at": "2026-03-18T09:20:00Z",
  "payment_url": "https://gateway.example/checkout/abc",
  "qr_code": "000201..."
}
```

Errors
- `404 ORDER_NOT_FOUND`
- `409 ORDER_ALREADY_PAID`
- `409 OUTSTANDING_MISMATCH`
- `422 INVALID_AMOUNT`

### 6.3 Get order detail
- `GET /orders/{order_id}`

Success `200`
```json
{
  "order_id": "ord_01",
  "ticket_id": "tkt_01",
  "status": "partially_paid",
  "currency": "VND",
  "total_amount": 300000,
  "paid_amount": 120000,
  "outstanding_amount": 180000,
  "items": [
    {
      "item_id": "itm_01",
      "service_code": "DV_XN_MAU",
      "qty": 1,
      "unit_price": 120000,
      "line_total": 120000
    }
  ],
  "payment_intents": [
    {
      "payment_intent_id": "pi_01",
      "status": "success",
      "amount": 120000,
      "created_at": "2026-03-18T09:06:00Z"
    }
  ]
}
```

Errors
- `404 ORDER_NOT_FOUND`

## 7. Webhook API
### 7.1 Payment gateway callback
- `POST /payments/webhook`
- Headers:
  - `X-Gateway-Signature`: bắt buộc

Request (example)
```json
{
  "provider_event_id": "ev_001",
  "event_type": "payment.succeeded",
  "intent_ref": "PI-20260318-0001",
  "status": "success",
  "amount": 120000,
  "occurred_at": "2026-03-18T09:08:00Z",
  "raw": {}
}
```

Success `200`
```json
{
  "received": true,
  "duplicate": false
}
```

Duplicate event `200`
```json
{
  "received": true,
  "duplicate": true
}
```

Errors
- `401 INVALID_SIGNATURE`
- `404 INTENT_NOT_FOUND`
- `422 INVALID_EVENT_PAYLOAD`

## 8. Status Enums
- `order.status`: `draft`, `open`, `partially_paid`, `paid`, `cancelled`
- `payment_intent.status`: `pending`, `success`, `failed`, `expired`

## 9. Idempotency Rules
- `POST /tickets`: idempotent bởi `request_id` trong body.
- `POST /payments/webhook`: idempotent bởi `provider_event_id`.
- `POST /orders/{order_id}/payment-intents`: idempotent mềm qua `X-Idempotency-Key` (khuyến nghị).

## 10. Non-Functional Contract Notes
- API timeout mục tiêu: <= 3s cho `POST /tickets` (p95).
- Mọi response lỗi phải theo `Error Model`.
- Không trả dữ liệu nhạy cảm payment method/card details.
