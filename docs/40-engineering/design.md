# Engineering Design (MVP)

## 1. Architecture
- Frontend: Next.js
- Backend: FastAPI
- DB: PostgreSQL (source of truth)
- Redis: queue counter, OTP/session/rate limit, short lock
- External: SMS OTP provider, payment gateway

## 2. Service Boundaries
- Ticket service: create ticket, route queue, create default order.
- OTP/Identity service: OTP lifecycle, resolve/reuse `user_ref` by phone hash.
- Lookup service: POI/service search.
- Payment service: order items, payment intent, webhook processing.
- Audit service: lưu log cho action nhạy cảm.

## 3. Data Model (Core)
- `tickets`: queue data, `request_id`, `subject_ref`.
- `guest_identities`: mapping ổn định `phone_hash -> user_ref`.
- `otp_verifications`: OTP request/verify lifecycle theo purpose.
- `orders`, `order_items`, `payment_intents`, `payment_events`.
- `ticket_routings`, `audit_logs`.

## 4. Key Constraints
- `tickets.request_id` unique.
- `tickets(general_queue_id, queue_date, general_queue_number)` unique.
- `guest_identities.phone_hash` unique.
- `otp_verifications.otp_request_id` unique.
- `payment_events.provider_event_id` unique.

## 5. Sequence: Create Ticket
1. Client `POST /auth/otp/send` (`purpose=issue_ticket`).
2. Client `POST /auth/otp/verify` -> nhận `otp_verify_token`.
3. Client `POST /tickets` (`request_id`, `otp_verify_token`, `user_info`).
4. Backend check `request_id` idempotency.
5. Verify token và purpose, lấy `phone_hash`.
6. Resolve `user_ref` qua `guest_identities` (reuse/create).
7. Incr Redis counter `queue:general:{yyyy-mm-dd}`.
8. Persist ticket + order trong DB transaction.

## 6. Concurrency and Reliability
- Queue counter: Redis atomic increment + DB unique constraints chặn race.
- Retry create ticket khi conflict queue number (tối đa N lần).
- Webhook payment xử lý at-least-once, duplicate vẫn trả `200`.
- Không phụ thuộc Redis để giữ trạng thái nghiệp vụ lâu dài.

## 7. Security and Audit
- Tách OTP purpose (`issue_ticket`, `ticket_lookup`).
- OTP token TTL ngắn, single-purpose.
- Audit bắt buộc cho: request/verify OTP, routing, payment state changes.

## 8. Observability
- Metrics đề xuất:
  - `ticket_create_latency_ms`
  - `ticket_create_error_total`
  - `otp_send_total`, `otp_verify_total`, `otp_verify_fail_total`
  - `payment_webhook_processed_total`, `payment_webhook_duplicate_total`
- Structured logs with `request_id`, `ticket_id`, `order_id`, `payment_intent_id`.
