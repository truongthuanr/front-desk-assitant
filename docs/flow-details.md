# Flow Details - Front Desk Assistant Agent (MVP)

## 1. Scope
- Issue Ticket
- Information Lookup
- Payment (Order + Payment Intent)

## 2. Shared Rules
- Thời gian hệ thống dùng timezone bệnh viện.
- Mọi API ghi dữ liệu phải log `request_id` để trace.
- Các thao tác tạo mới bắt buộc idempotent theo key tương ứng.

## 3. Issue Ticket Flow (FR-01, FR-02)
### 3.1 Main flow
1. Client gửi yêu cầu tạo ticket với `request_id`, `user_info`.
2. Backend kiểm tra `request_id` đã tồn tại trong `tickets` chưa.
3. Nếu chưa tồn tại:
   - Tăng counter Redis theo key `queue:general:{yyyy-mm-dd}`.
   - Ghi `tickets` với `general_queue_id`, `general_queue_number`, `routing_status = unrouted`.
   - Tạo `orders` trạng thái `draft` gắn `ticket_id`.
4. Backend trả về `ticket_code`, `general_queue_position`, `routing_status`, `order_id`.

### 3.2 Exception flow
- `request_id` đã tồn tại -> trả đúng ticket cũ (idempotent response, `200`).
- Redis tăng counter thành công nhưng insert DB conflict -> retry cấp số tối đa N lần.
- Quá N lần conflict -> trả `503`, không tạo ticket rỗng.
- Request không phải channel kiosk hợp lệ -> `403`.

### 3.3 Routing flow (Operator)
1. Operator gọi `PUT /tickets/{ticket_id}/routing` với `to_queue_code`, `operator_id`, `note` (optional).
2. Backend lock theo `ticket_id` để tránh race condition khi route đồng thời.
3. Backend kiểm tra queue đích tồn tại và active.
4. Backend tăng counter Redis theo key `queue:clinic:{queue_id}:{yyyy-mm-dd}`.
5. Backend cập nhật `tickets`:
   - `clinic_queue_id`, `clinic_queue_number`
   - `routing_status = routed`
   - `routed_at`
6. Backend ghi `ticket_routings` và `audit_logs` (from_queue, to_queue, operator_id, note).
7. Backend trả về thông tin queue đích và `clinic_queue_number`.

### 3.4 Routing exception flow
- `ticket_id` không tồn tại -> `404`.
- Queue đích không tồn tại/inactive -> `404/409`.
- Payload route không hợp lệ (thiếu `to_queue_code`) -> `422`.
- Route request gửi lặp từ UI -> xử lý idempotent theo `X-Request-Id` (khuyến nghị).

### 3.5 State transitions (Ticket)
- `unrouted` -> `routed`: đã điều hướng sang queue đích.
- `routed` -> `routed`: re-route sang queue khác (cập nhật queue đích và cấp `clinic_queue_number` mới).

## 4. Information Lookup Flow (FR-03)
### 4.1 POI lookup
1. Client gửi từ khóa `q`.
2. Backend normalize từ khóa, query theo tên/alias.
3. Trả danh sách POI có phân trang.

### 4.2 Service lookup
1. Client gửi từ khóa `q` hoặc filter danh mục.
2. Backend query service catalog đang active.
3. Trả thông tin cơ bản: tên, mô tả, thời gian phục vụ, giá tham khảo (nếu có).

### 4.3 Exception flow
- `q` rỗng và không có filter -> `400`.
- Không có dữ liệu khớp -> `200` với list rỗng.

## 5. Payment Flow (FR-04)
### 5.1 Entities
- `order`: hóa đơn tổng cho một ticket.
- `payment_intent`: mỗi lần user bấm thanh toán.

### 5.2 Main flow A: Add service to order
1. Operator/backend gọi add item vào `order`.
2. Backend validate order không ở terminal (`paid`/`cancelled`).
3. Backend thêm `order_item`, tính lại `total_amount`.
4. Nếu order đang `draft` và có item đầu tiên -> chuyển `open`.
5. Trả snapshot mới của order.

### 5.3 Main flow B: Create payment intent
1. Client gọi tạo `payment_intent` cho `order_id`.
2. Backend tính `outstanding = total_amount - paid_amount`.
3. Nếu `outstanding <= 0` -> trả `409` (order đã đủ tiền).
4. Tạo `payment_intent` (`pending`) với `amount` (mặc định = outstanding).
5. Tạo payment URL/QR từ gateway, trả về cho client.

### 5.4 Main flow C: Webhook update
1. Gateway gửi webhook có `provider_event_id`, `intent_ref`, `status`.
2. Backend xác thực chữ ký.
3. Backend upsert `payment_events` theo `provider_event_id` (idempotent).
4. Nếu event mới:
   - Update `payment_intent` sang `success`/`failed`/`expired`.
   - Nếu `success`: tăng `orders.paid_amount += intent.amount`.
   - Recompute trạng thái `order`: `open` -> `partially_paid` hoặc `paid`.
5. Trả `200` ngay cả khi event duplicate (sau khi verify hợp lệ).

### 5.5 Exception flow
- Webhook chữ ký sai -> `401`.
- `intent_ref` không map được local intent -> `404` và log cảnh báo.
- Event duplicate -> không mutate lần 2, trả `200`.
- Hai webhook đồng thời cho cùng intent -> dùng row lock, chỉ 1 transaction commit.

## 6. State Machines
### 6.1 Order transitions
- `draft -> open`: có item đầu tiên.
- `open -> partially_paid`: có payment success, còn nợ.
- `open|partially_paid -> paid`: đã trả đủ.
- `draft|open -> cancelled`: hủy trước khi hoàn tất.

### 6.2 Payment intent transitions
- `pending -> success`
- `pending -> failed`
- `pending -> expired`
- `success|failed|expired` là terminal.

## 7. Idempotency Matrix
- Create ticket: idempotent by `request_id`.
- Route ticket: khuyến nghị idempotent by `X-Request-Id`.
- Payment webhook: idempotent by `provider_event_id`.
- Optional (khuyến nghị): create payment intent idempotent by `client_intent_key` để chống double-click.

## 8. Timeouts And Retry
- Ticket create timeout: client retry với cùng `request_id`.
- Payment webhook: hỗ trợ retry từ gateway trong 24h.
- Internal retry khi DB deadlock: exponential backoff tối đa 3 lần.

## 9. Audit And Monitoring Points
- Audit bắt buộc:
  - Operator routing action.
  - Add/remove order item.
  - Payment status transitions.
- Metrics bắt buộc:
  - ticket create latency/error
  - payment webhook duplicate rate
  - payment success rate theo giờ

## 10. UI Action Mapping (MVP)
### 10.1 Issue Ticket
- Screen `S02` (Lấy số thứ tự):
  - Action `Xác nhận lấy số` -> gọi flow `3.1 Main flow` (create ticket idempotent theo `request_id`).
- Screen `S03` (Kết quả lấy số):
  - Action `Theo dõi hàng đợi` -> đọc ticket/order snapshot đã trả về.

### 10.2 Information Lookup
- Screen `S05` (Tra cứu thông tin):
  - Action `Tìm kiếm` -> gọi flow `4.1` (POI lookup) hoặc `4.2` (Service lookup).
  - Action `Xóa bộ lọc` -> reset query client-side và gọi lại lookup mặc định.
- Screen `S06` (Chi tiết thông tin):
  - Action `Lấy số ngay` -> điều hướng về flow issue ticket.

### 10.3 Payment
- Screen `S07` (Thanh toán dịch vụ):
  - Action `Thanh toán toàn bộ` -> gọi flow `5.3 Main flow B` với `amount = outstanding`.
  - Action `Nhập số tiền` -> gọi flow `5.3 Main flow B` với `amount` tùy chọn (nếu bật partial pay).
  - Action `Tôi đã thanh toán` -> poll trạng thái `payment_intent` và order.
- Screen `S08` (Kết quả thanh toán):
  - Action `Thử lại` -> tạo `payment_intent` mới (không tái sử dụng intent terminal).

### 10.4 Operator
- Screen `S09` (Dashboard điều phối):
  - Action `Chỉnh khoa` -> áp dụng trước create ticket và ghi audit log.
  - Action `Tạo ticket` -> gọi flow `3.1 Main flow`.
- Screen `S10` (Quản lý order tại quầy):
  - Action `Thêm dịch vụ` -> gọi flow `5.2 Main flow A`.
  - Action `Tạo phiên thanh toán` -> gọi flow `5.3 Main flow B`.
  - Action `Làm mới trạng thái` -> đồng bộ kết quả từ flow `5.4 Main flow C`.
