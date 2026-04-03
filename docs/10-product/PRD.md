# Product Requirements Document (PRD)

## 1. Document Info
- Product: Front Desk Assistant Agent
- Version: v0.3
- Date: 2026-03-29
- Audience: Product, Engineering, Operations

## 2. Problem Statement
Quy trình tiếp nhận tại quầy hiện tốn thời gian, dễ ùn tắc, khó điều phối đúng khoa và thiếu minh bạch trạng thái ticket/payment.

## 3. Goals And Success Metrics
### 3.1 Goals
- Giảm thời gian chờ lấy số tại quầy.
- Chuẩn hóa điều hướng bệnh nhân theo queue/khoa.
- Cung cấp tra cứu thông tin nhanh, rõ ràng.
- Hỗ trợ thanh toán online có trạng thái đối soát được.

### 3.2 MVP Metrics
- 95% create ticket thành công trong <= 3 giây.
- 0 ticket trùng do retry/double-submit cùng `request_id`.
- 99% payment intent có trạng thái cuối (`success|failed|expired`).

## 4. Scope
### 4.1 In Scope
- Issue ticket tại kiosk.
- OTP verify theo phone trước khi create ticket.
- Identity guest theo `user_ref` (reuse theo phone đã verify).
- Ticket lookup public bằng `ticket_code + phone + OTP`.
- Information lookup cho POI/service.
- Payment flow (`order`, `payment_intent`, webhook).

### 4.2 Out Of Scope
- Schedule booking.
- Registered account flow.
- Multi-tenant/multi-hospital.

## 5. Identity Model (MVP)
- Guest không cần đăng ký account đầy đủ.
- User phải verify OTP phone cho các flow cần xác thực.
- `user_ref` resolve theo phone đã verify:
  - Phone đã tồn tại -> reuse `user_ref`.
  - Phone mới -> tạo `user_ref` mới.
- `subject_ref = user_ref` cho `ticket`, `order`, `payment_intent`.

## 6. Functional Requirements
### FR-01 Issue Ticket
- Tạo ticket vào `general queue`, cấp số thứ tự tăng theo ngày.
- `POST /tickets` idempotent theo `request_id`.
- Bắt buộc OTP verify hợp lệ cho purpose `issue_ticket` trước khi create ticket.
- Ticket lưu `subject_ref` để trace xuyên module.

### FR-02 Operator Routing
- Operator route/re-route ticket sang queue đích.
- Cấp `clinic_queue_number` theo ngày trong queue đích.
- Lưu audit log cho mọi thao tác route/re-route.

### FR-03 Information Lookup
- Search POI theo keyword.
- Search service theo keyword/category.

### FR-04 Payment
- Tạo `order` khi create ticket.
- Hỗ trợ add/remove item và tạo `payment_intent`.
- Webhook payment xử lý idempotent theo `provider_event_id`.

### FR-05 Ticket Lookup (Guest)
- Lookup bằng `ticket_code + phone + OTP`.
- OTP lookup tách purpose với OTP issue ticket.
- OTP 6 chữ số, TTL <= 3 phút, giới hạn sai và resend.

## 7. Non-Functional Requirements
- Availability: 99.5% (production target).
- Security: dữ liệu nhạy cảm bảo vệ khi truyền; audit đầy đủ cho action quan trọng.
- Observability: log/metrics/trace cho create ticket, OTP, payment.

## 8. Acceptance Criteria
- Tạo ticket ổn định, không trùng do retry.
- Cùng phone đã verify map về cùng `user_ref`.
- Flow OTP cho issue ticket và ticket lookup hoạt động độc lập theo purpose.
- Order/payment liên kết đúng `subject_ref` của ticket.
