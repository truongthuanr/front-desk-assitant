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
- Cấu trúc đề xuất:
  ```text
  front-desk-assistant/
  ├─ frontend/                    # Next.js app (kiosk + operator UI)
  │  ├─ src/
  │  │  ├─ app/                   # App Router pages/layouts
  │  │  ├─ components/            # UI components dùng chung
  │  │  ├─ features/              # Module theo nghiệp vụ (ticket, lookup, payment)
  │  │  ├─ lib/                   # API client, utils, constants
  │  │  └─ styles/
  │  ├─ public/
  │  ├─ package.json
  │  ├─ Dockerfile
  │  └─ .env.example
  ├─ backend/                     # FastAPI app
  │  ├─ app/
  │  │  ├─ api/v1/                # Router endpoints
  │  │  ├─ core/                  # Config, security, settings
  │  │  ├─ models/                # SQLAlchemy models
  │  │  ├─ schemas/               # Pydantic schemas
  │  │  ├─ services/              # Business logic
  │  │  ├─ repositories/          # Data access layer
  │  │  ├─ db/                    # Session, base, migrations integration
  │  │  └─ main.py                # FastAPI entrypoint
  │  ├─ alembic/
  │  ├─ tests/
  │  ├─ requirements.txt
  │  ├─ Dockerfile
  │  └─ .env.example
  ├─ infra/
  │  ├─ postgres/
  │  │  └─ init.sql               # Optional bootstrap SQL cho local
  │  └─ redis/
  ├─ docs/
  │  ├─ prd.md
  │  └─ design.md
  ├─ docker-compose.yml           # Orchestration cho frontend/backend/postgres/redis
  ├─ .env.example                 # Shared env keys cho compose
  ├─ Makefile                     # Shortcut lệnh local (up, down, logs, migrate)
  └─ README.md
  ```
- Quy ước trách nhiệm:
  - `frontend/` và `backend/` tự quản lý dependency, build image, và test của từng service.
  - `docker-compose.yml` ở root chỉ làm nhiệm vụ orchestration: network, volume, env injection, startup order.
  - Biến môi trường tách 2 lớp:
    - Root `.env` cho compose-level (`POSTGRES_*`, `REDIS_*`, `BACKEND_PORT`, `FRONTEND_PORT`).
    - Service `.env` cho app-level (`DATABASE_URL`, `REDIS_URL`, `PAYMENT_WEBHOOK_SECRET`, `NEXT_PUBLIC_API_BASE_URL`).
  - Migration chạy từ backend container trước khi API serve traffic.

## 4. Service Boundaries
- Ticket Service:
  - Tạo ticket vào `general queue`.
  - Điều hướng ticket sang queue khoa/phòng đích.
  - Quản lý thứ tự queue theo ngày cho cả `general queue` và `clinic queue`.
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
  - `id`, `code`, `name`, `queue_type` (`general|clinic`), `is_active`
- `tickets`
  - `id`, `ticket_code`, `queue_date`
  - `general_queue_id`, `general_queue_number`
  - `clinic_queue_id` (nullable), `clinic_queue_number` (nullable)
  - `routing_status` (`unrouted|routed`), `routed_at` (nullable)
  - `request_id` (idempotency), `subject_ref`, `created_at`, `updated_at`
- `ticket_routings`
  - `id`, `ticket_id`, `from_queue_id`, `to_queue_id`, `operator_id`, `note`, `created_at`
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
- `tickets` unique: (`general_queue_id`, `queue_date`, `general_queue_number`).
- `tickets` unique (partial): (`clinic_queue_id`, `queue_date`, `clinic_queue_number`) khi `clinic_queue_id is not null`.
- `tickets` unique: `request_id`.
- `orders` unique: `ticket_id` (MVP: 1 ticket -> 1 order).
- `payment_intents` unique: `intent_code`.
- `payment_events` unique: `provider_event_id`.
- Indexes:
  - `tickets(general_queue_id, queue_date)`
  - `tickets(routing_status, clinic_queue_id, queue_date)`
  - `ticket_routings(ticket_id, created_at desc)`
  - `orders(status)`
  - `payment_intents(order_id, status)`

### 5.3 DB vs Cache responsibilities
- PostgreSQL (source of truth):
  - Toàn bộ trạng thái ticket/queue (`general_queue_number`, `clinic_queue_number`, routing status).
  - History route qua `ticket_routings` + audit logs.
  - Dữ liệu payment/order và idempotency cần bền vững.
- Redis (ephemeral/performance):
  - Counter cấp số theo ngày:
    - `queue:general:{yyyy-mm-dd}`
    - `queue:clinic:{queue_id}:{yyyy-mm-dd}`
  - Lock ngắn hạn chống race condition (`lock:ticket:create:{request_id}`, `lock:ticket:route:{ticket_id}`).
  - OTP/session/rate-limit và cache read-heavy (POI/services/active queues).
- Nguyên tắc:
  - Cache mất không làm mất trạng thái nghiệp vụ.
  - DB unique constraints là lớp chặn cuối cùng cho tính đúng đắn.

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
  - Input: `request_id`, `user_info`
  - Output: `ticket_code`, `general_queue_number`, `routing_status`, `order_id`
  - Rule: idempotent theo `request_id`.
- `PUT /api/v1/tickets/{ticket_id}/routing`
  - Input: `to_queue_code`, `operator_id`, `note` (optional)
  - Output: `clinic_queue_number`, `routing_status`, `routed_at`
  - Rule: mỗi lần route/re-route sang queue mới cấp số mới theo queue đích.

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
3. Nếu chưa có: tăng `general queue` counter theo ngày.
4. Backend tạo `order` trạng thái `draft` cho ticket.
5. Persist ticket vào Postgres với `routing_status = unrouted`.
6. Trả ticket + order về client.

### 8.2 Route ticket to clinic queue
1. Operator gửi `PUT /tickets/{ticket_id}/routing`.
2. Backend lock theo `ticket_id`, kiểm tra queue đích active.
3. Backend tăng counter queue đích theo ngày.
4. Cập nhật `clinic_queue_id`, `clinic_queue_number`, `routing_status = routed`, `routed_at`.
5. Ghi `ticket_routings` + `audit_logs`.
6. Trả thông tin queue đích đã route.

### 8.3 Add service and pay
1. Operator/backend thêm `order_item` vào order.
2. Backend chuyển order `draft -> open` (nếu cần), tính lại tiền.
3. User bấm thanh toán, backend tạo `payment_intent (pending)`.
4. User thanh toán qua gateway.
5. Gateway gọi webhook -> backend validate chữ ký/event.
6. Backend upsert `payment_events` (idempotent), update intent.
7. Backend cập nhật `paid_amount` và trạng thái order.

## 9. Concurrency, Idempotency, Reliability
- Queue counter:
  - Dùng Redis atomic increment theo key:
    - `queue:general:{yyyy-mm-dd}`
    - `queue:clinic:{queue_id}:{yyyy-mm-dd}`
  - Commit ticket/routing vào Postgres với unique constraints để chặn race condition.
- Idempotency keys:
  - `tickets.request_id` cho tạo ticket.
  - `X-Request-Id` (khuyến nghị) cho `PUT /tickets/{ticket_id}/routing`.
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
