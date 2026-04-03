# Functional Specs (Service + UI)

## 1. Shared Rules
- Timezone theo bệnh viện.
- API ghi dữ liệu bắt buộc có `request_id` hoặc idempotency key phù hợp.
- OTP phải tách purpose (`issue_ticket`, `ticket_lookup`) và không dùng chéo.

## 2. Feature: Issue Ticket
- Implements: `FR-01`

### 2.1 Service Spec
- Preconditions:
  - Kiosk credential hợp lệ.
  - Có `otp_verify_token` hợp lệ cho purpose `issue_ticket`.
- Main behavior:
  1. Validate input (`request_id`, `user_info`).
  2. Check idempotency theo `request_id`.
  3. Resolve `user_ref` theo phone đã verify.
  4. Tăng counter `queue:general:{yyyy-mm-dd}`.
  5. Tạo ticket với `subject_ref = user_ref`.
  6. Tạo order `draft` gắn ticket.
- Exceptions:
  - `request_id` đã tồn tại -> trả ticket cũ (`200`).
  - OTP token thiếu/hết hạn/sai purpose -> `401/422`.
  - Counter lỗi -> `503`.

### 2.2 UI Spec
- Screen: `S02 - Lấy số thứ tự`.
- Components:
  - Form user info (name, phone).
  - OTP block (`Gửi OTP`, `Xác thực OTP`, countdown resend).
  - CTA `Xác nhận lấy số`.
- CTA and redirect:
  - `Xác nhận lấy số` thành công -> `S03`.
  - Lỗi OTP -> giữ ở `S02`, hiển thị lỗi inline.
- UX states:
  - Loading/disabled khi gửi OTP và tạo ticket.
  - Chặn double-click CTA tạo ticket.

### 2.3 Interface Mapping
- `POST /auth/otp/send` (purpose `issue_ticket`)
- `POST /auth/otp/verify` (purpose `issue_ticket`)
- `POST /tickets`

## 3. Feature: Operator Routing
- Implements: `FR-02`

### 3.1 Service Spec
- Input: `ticket_id`, `to_queue_code`, `operator_id`, `note`.
- Behavior:
  - Lock theo `ticket_id`.
  - Validate queue đích active.
  - Cấp `clinic_queue_number` theo ngày/queue.
  - Cập nhật ticket + ghi `ticket_routings` + audit log.
- Exceptions: `404`, `409`, `422`.

### 3.2 UI Spec
- Screen: `S09 - Dashboard điều phối`.
- Components:
  - Ticket list/search.
  - Queue selector.
  - Action `Chỉnh khoa`/`Tạo ticket`.
- Redirect:
  - Route thành công -> refresh card chi tiết ticket.

### 3.3 Interface Mapping
- `PUT /tickets/{ticket_id}/routing`

## 4. Feature: Ticket Lookup (Guest)
- Implements: `FR-05`

### 4.1 Service Spec
- Input: `ticket_code`, `phone`.
- Behavior:
  1. Verify ticket tồn tại và phone khớp.
  2. Gửi OTP purpose `ticket_lookup`.
  3. Verify OTP, cấp lookup token ngắn hạn.
  4. Cho phép đọc ticket/order/payment summary bằng lookup token.
- Constraints:
  - OTP TTL <= 3 phút.
  - Max 5 lần sai / phiên.
  - Resend rate limit tối thiểu 3 lần/15 phút/ticket.

### 4.2 UI Spec
- Screens: `S04A -> S04`.
- Components:
  - Form `ticket_code + phone`.
  - OTP input + resend.
  - Ticket status card + payment summary.
- CTA and redirect:
  - Verify thành công -> `S04`.
  - Lookup token hết hạn -> quay về `S04A`.

### 4.3 Interface Mapping
- `POST /auth/otp/send` (purpose `ticket_lookup`)
- `POST /auth/otp/verify` (purpose `ticket_lookup`)
- `GET /tickets/{ticket_code}` (lookup token)

## 5. Feature: Information Lookup
- Implements: `FR-03`

### 5.1 Service Spec
- Search POI theo `q`.
- Search service theo `q` hoặc category.
- `q` rỗng và không filter -> `400`.

### 5.2 UI Spec
- Screens: `S05`, `S06`.
- Components:
  - Search bar, filter chip, result list.
  - Detail panel (description, floor, service hours, reference price).

### 5.3 Interface Mapping
- `GET /lookup/poi`
- `GET /lookup/services`

## 6. Feature: Payment
- Implements: `FR-04`

### 6.1 Service Spec
- Add order items -> recalc totals.
- Create payment intent theo outstanding.
- Process webhook idempotent theo `provider_event_id`.
- Update order status (`draft|open|partially_paid|paid|cancelled`).

### 6.2 UI Spec
- Screens: `S07`, `S08`, `S10`.
- Components:
  - Order summary, payment CTA, QR/link display.
  - Payment result status (`success|failed|expired`).
- CTA and redirect:
  - `Thanh toán toàn bộ` -> tạo intent.
  - `Thử lại` -> về S07 tạo intent mới.

### 6.3 Interface Mapping
- `POST /orders/{order_id}/items`
- `POST /orders/{order_id}/payment-intents`
- `GET /orders/{order_id}`
- `POST /payments/webhook`
