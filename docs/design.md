# Technical Design - Front Desk Assistant Agent (MVP)

## 1. Purpose
Tài liệu này mô tả thiết kế kỹ thuật để triển khai scope MVP đã chốt trong PRD. Không lặp lại business goals/KPI.

## 2. Architecture Overview
- Frontend: Next.js (kiosk/web operator).
- Backend API: FastAPI (REST).
- Database: PostgreSQL (source of truth).
- Cache/Counter: Redis (queue counter, idempotency key ngắn hạn).
- External integration: Payment Gateway (hosted payment + webhook).
- Deploy: Docker Compose cho môi trường dev/UAT.

## 3. Project Structure (MVP)
- Monorepo mức ứng dụng:
  - `frontend/`: Next.js app, có `Dockerfile` riêng.
  - `backend/`: FastAPI app, có `Dockerfile` riêng.
  - `docker-compose.yml`: đặt ở root để orchestration toàn bộ services.
  - `docs/`: tài liệu thiết kế và vận hành.
- Nguyên tắc:
  - Mỗi service tự quản lý dependencies/build image trong folder của mình.
  - Compose ở root chịu trách nhiệm wiring network, env vars, volumes, startup order.

## 4. Service Boundaries
- Ticket Service:
  - Tạo ticket theo khoa.
  - Quản lý thứ tự queue theo ngày.
  - Tạo `order` mặc định khi ticket được tạo.
- Lookup Service:
  - Tra cứu POI.
  - Tra cứu thông tin dịch vụ.
- Payment Service:
  - Quản lý `order`, `order_items`, `payment_intent`.
  - Nhận webhook và cập nhật trạng thái thanh toán.
- Audit Service (module dùng chung):
  - Lưu hành động operator và thay đổi trạng thái payment.

## 5. Data Model (MVP)
### 5.1 Core tables
- `queues`
  - `id`, `code`, `name`, `is_active`
- `tickets`
  - `id`, `ticket_code`, `queue_id`, `queue_date`, `queue_number`
  - `request_id` (idempotency), `user_ref`, `created_at`
- `orders`
  - `id`, `ticket_id`, `status`, `currency`, `total_amount`, `paid_amount`, `created_at`, `updated_at`
- `order_items`
  - `id`, `order_id`, `service_code`, `service_name`, `qty`, `unit_price`, `line_total`, `created_at`
- `payment_intents`
  - `id`, `order_id`, `intent_code`, `amount`, `status`, `provider_ref`, `expires_at`, `created_at`, `updated_at`
- `payment_events`
  - `id`, `payment_intent_id`, `provider_event_id`, `event_type`, `payload_json`, `received_at`
- `audit_logs`
  - `id`, `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `metadata_json`, `created_at`

### 5.2 Constraints and indexes
- `tickets` unique: (`queue_id`, `queue_date`, `queue_number`).
- `tickets` unique: `request_id`.
- `orders` unique: `ticket_id` (MVP: 1 ticket -> 1 order).
- `payment_intents` unique: `intent_code`.
- `payment_events` unique: `provider_event_id`.
- Indexes:
  - `tickets(queue_id, queue_date)`
  - `orders(status)`
  - `payment_intents(order_id, status)`

## 6. State Machines
### 6.1 Order state
- `draft` -> `open`: có ít nhất 1 `order_item`.
- `open` -> `partially_paid`: có thanh toán thành công nhưng `paid_amount < total_amount`.
- `open|partially_paid` -> `paid`: `paid_amount >= total_amount`.
- `draft|open` -> `cancelled`: bị hủy trước khi hoàn tất.

### 6.2 Payment intent state
- `pending` -> `success`: gateway xác nhận thành công.
- `pending` -> `failed`: gateway trả thất bại.
- `pending` -> `expired`: quá hạn thanh toán.
- Trạng thái `success|failed|expired` là terminal, không chuyển tiếp.

## 7. API Design (Draft)
### 7.1 Ticket
- `POST /api/v1/tickets`
  - Input: `request_id`, `queue_code`, `user_info`, `operator_routing` (optional)
  - Output: `ticket_code`, `queue_position`, `order_id`
  - Rule: idempotent theo `request_id`.

### 7.2 Lookup
- `GET /api/v1/lookup/poi?q=...`
- `GET /api/v1/lookup/services?q=...`

### 7.3 Payment
- `POST /api/v1/orders/{order_id}/items`
  - Add service phát sinh, recalc `total_amount`.
- `POST /api/v1/orders/{order_id}/payment-intents`
  - Tạo `payment_intent` mới từ phần còn nợ.
- `GET /api/v1/orders/{order_id}`
  - Trả chi tiết order + payment summary.
- `POST /api/v1/payments/webhook`
  - Nhận event gateway, update `payment_intent`, ghi `payment_events`, recalc order.

## 8. Sequence Flows
### 8.1 Create ticket
1. Client gửi `POST /tickets` kèm `request_id`.
2. Backend check `request_id` đã tồn tại chưa.
3. Nếu chưa có: tăng queue counter theo `queue_id + date`, tạo ticket.
4. Backend tạo `order` trạng thái `draft` cho ticket.
5. Trả ticket + order về client.

### 8.2 Add service and pay
1. Operator/backend thêm `order_item` vào order.
2. Backend chuyển order `draft -> open` (nếu cần), tính lại tiền.
3. User bấm thanh toán, backend tạo `payment_intent (pending)`.
4. User thanh toán qua gateway.
5. Gateway gọi webhook -> backend validate chữ ký/event.
6. Backend upsert `payment_events` (idempotent), update intent.
7. Backend cập nhật `paid_amount` và trạng thái order.

## 9. Concurrency, Idempotency, Reliability
- Queue counter:
  - Dùng Redis atomic increment theo key `queue:{queue_id}:{yyyy-mm-dd}`.
  - Commit ticket vào Postgres với unique constraint để chặn race condition.
- Idempotency keys:
  - `tickets.request_id` cho tạo ticket.
  - `provider_event_id` cho webhook payment.
- Retry policy:
  - Webhook xử lý theo at-least-once; event trùng phải return 200.
- Consistency:
  - Cập nhật `payment_intent`, `payment_events`, `orders.paid_amount/status` trong cùng DB transaction.

## 10. Security and Audit
- AuthN/AuthZ theo role `user`/`operator`.
- Validate chữ ký webhook từ payment gateway.
- Không lưu dữ liệu thẻ thanh toán trong hệ thống nội bộ.
- Audit log bắt buộc cho:
  - Điều hướng khoa bởi operator.
  - Thay đổi trạng thái `payment_intent` và `order`.

## 11. Observability
- Metrics:
  - `ticket_create_latency_ms`
  - `ticket_create_error_total`
  - `payment_intent_created_total`
  - `payment_webhook_processed_total`
  - `payment_webhook_duplicate_total`
- Structured logging với `request_id`, `ticket_id`, `order_id`, `payment_intent_id`.

## 12. Deployment Notes (MVP)
- `docker-compose.yml` tối thiểu gồm: `frontend`, `backend`, `postgres`, `redis`.
- Migration DB chạy trước backend startup.
- Tách config qua env vars: DB URL, Redis URL, webhook secret, gateway keys.

## 13. Open Technical Decisions
- Chọn payment gateway cụ thể và format webhook.
- TTL cho `payment_intent` (ví dụ 15 phút hay 30 phút).
- Cơ chế đối soát cuối ngày (batch job hay dashboard realtime).

