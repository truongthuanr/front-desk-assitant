# Product Requirements Document (PRD)

## 1. Document Info
- Product: Front Desk Assistant Agent
- Version: v0.2 (MVP Guest-Only Draft)
- Date: 2026-03-20
- Owner: TBD
- Stakeholders: Product, Engineering, Operations, Finance

## 2. Problem Statement
Quy trình tiếp nhận tại quầy hiện tốn thời gian, dễ ùn tắc, khó điều phối bệnh nhân đúng khoa và thiếu minh bạch trạng thái xử lý dịch vụ. Hệ thống cần hỗ trợ lấy số thứ tự, tra cứu thông tin, và thanh toán online cho các dịch vụ cơ bản.

## 3. Goals And Success Metrics
### 3.1 Goals
- Giảm thời gian chờ lấy số thứ tự tại quầy.
- Chuẩn hóa điều hướng bệnh nhân theo khoa/điểm tiếp nhận.
- Cho phép tra cứu nhanh thông tin vị trí và dịch vụ.
- Hỗ trợ thanh toán online có trạng thái rõ ràng.

### 3.2 Success Metrics (MVP)
- 95% request lấy số thành công trong <= 3 giây.
- 0 ticket trùng do gửi lặp request.
- 99% giao dịch thanh toán có trạng thái cuối cùng (`success`/`failed`/`expired`).
- >= 80% người dùng nội bộ hoàn thành tác vụ tra cứu thông tin trong <= 2 bước tại UAT (n >= 30).

## 4. Scope
### 4.1 In Scope (MVP)
- Issue ticket theo khoa/điểm tiếp nhận (kiosk-only).
- Operator điều hướng user sang khoa phù hợp.
- Information lookup cho POI và thông tin dịch vụ cơ bản.
- Ticket lookup public qua `ticket_code` + `phone` + OTP cho guest.
- Payment online qua cổng thanh toán tích hợp.
- Identity model MVP: guest-only (`subject_ref = user_ref`).

### 4.2 Out Of Scope (MVP)
- Schedule/đặt lịch khám.
- Tối ưu AI recommendation nâng cao.
- Tích hợp đa bệnh viện/multi-tenant.
- Registered user account flow và CRM integration.

## 5. Users And Roles
- User (bệnh nhân/người nhà, guest): lấy số, tra cứu thông tin, tra cứu ticket, thanh toán dịch vụ.
- Operator (lễ tân/điều phối): điều hướng user theo khoa, theo dõi trạng thái queue.
- Admin (giai đoạn sau): cấu hình danh mục khoa, POI, dịch vụ.

### 5.1 Identity Model (MVP)
- Guest/instant user:
  - Không cần đăng ký, hệ thống sinh `user_ref`.
  - `subject_ref` chính là `user_ref`.
- Quy ước chung:
  - `subject_ref` là khóa định danh xuyên suốt cho `ticket`, `order`, `payment_intent`.
  - MVP lưu tối thiểu thông tin nhận diện cho guest theo chính sách retention của hệ thống.
  - Post-MVP có thể mở rộng thêm `subject_ref -> user_id` cho registered user mà không thay đổi schema lõi.

## 6. User Flows (MVP)
### 6.1 Issue Ticket
1. User thao tác trên kiosk, nhập thông tin cơ bản và chọn nhu cầu.
2. Hệ thống xác định khoa/điểm tiếp nhận phù hợp.
3. Hệ thống sinh `user_ref`, gán `subject_ref = user_ref`.
4. Hệ thống tạo ticket theo queue của khoa trong ngày, gắn với `subject_ref`.
5. User nhận mã ticket và vị trí hiện tại trong hàng đợi.

### 6.2 Information Lookup
1. User nhập từ khóa hoặc chọn danh mục.
2. Hệ thống trả về POI hoặc thông tin dịch vụ liên quan.
3. User xem chi tiết vị trí/mô tả/thời gian phục vụ.

### 6.3 Payment
1. Khi tạo ticket, hệ thống tạo `order_id` ở trạng thái `draft` và gắn `subject_ref`.
2. Khi phát sinh dịch vụ, hệ thống thêm line-item vào order và mở order (`open`).
3. Với mỗi lần user thanh toán, hệ thống tạo `payment_intent_id` ở trạng thái `pending`.
4. User thanh toán qua cổng tích hợp (QR/deeplink/payment link).
5. Hệ thống nhận callback/webhook và cập nhật `payment_intent` (`success`/`failed`/`expired`).
6. Hệ thống cập nhật trạng thái order (`partially_paid`/`paid`) theo tổng tiền đã thanh toán.

### 6.4 Ticket Lookup (Public, Guest)
1. User mở trang public trên thiết bị cá nhân, nhập `ticket_code` và `phone`.
2. Hệ thống xác thực ticket tồn tại và phone khớp dữ liệu tối thiểu đã lưu.
3. Hệ thống gửi OTP (6 chữ số) cho phone của ticket.
4. User nhập OTP để xác thực phiên tra cứu.
5. Hệ thống trả thông tin ticket, trạng thái queue, order summary, payment intents gần nhất.

## 7. Functional Requirements
### FR-01 Issue Ticket
- Hệ thống phải cấp số thứ tự theo từng khoa/queue riêng.
- Số thứ tự tăng tuần tự theo ngày.
- Cùng một `request_id` chỉ được tạo tối đa một ticket (idempotency).
- Ticket phải lưu `subject_ref` để liên kết user xuyên suốt các module.
- Trả về mã ticket, queue name, vị trí trong hàng đợi, thời điểm tạo.
- API tạo ticket chỉ cho phép từ channel kiosk với kiosk credential hợp lệ; channel khác trả `403`.

### FR-02 Operator Routing
- Operator có thể chọn/chỉnh khoa đích cho user trước khi tạo ticket.
- Lưu audit log cho thao tác điều hướng.

### FR-03 Information Lookup
- Tìm kiếm POI theo tên/từ khóa.
- Tra cứu dịch vụ theo tên/danh mục.
- Trả về thông tin cơ bản: mô tả, vị trí, thời gian phục vụ.

### FR-04 Payment
- Khi tạo ticket, hệ thống phải tạo `order_id` duy nhất cho phiên phục vụ.
- Order và payment intent phải kế thừa cùng `subject_ref` từ ticket.
- Hỗ trợ cập nhật order khi phát sinh dịch vụ (thêm line-item, tính lại tổng tiền).
- Mỗi lần user chủ động thanh toán phải tạo `payment_intent_id` duy nhất, gắn với một order.
- API tạo `payment_intent` phải idempotent theo `client_intent_key` để chống double-click/retry.
- Trạng thái `order`: `draft`, `open`, `partially_paid`, `paid`, `cancelled`.
- Trạng thái `payment_intent`: `pending`, `success`, `failed`, `expired`.
- Callback/webhook từ cổng thanh toán phải xử lý idempotent theo `provider_event_id`/`idempotency_key`.
- Lưu lịch sử trạng thái order và payment intent để đối soát.

### FR-05 Ticket Lookup (Guest)
- Hệ thống cho phép tra cứu ticket public bằng `ticket_code` + `phone` + OTP.
- OTP gồm 6 chữ số, hết hạn tối đa 3 phút.
- Mỗi phiên tra cứu giới hạn tối đa 5 lần nhập OTP sai.
- Rate limit gửi OTP tối thiểu: 3 lần/15 phút/ticket.
- Sau khi verify OTP thành công, cấp lookup token ngắn hạn (5-10 phút) để đọc ticket/order/payment.
- Toàn bộ thao tác request OTP/verify OTP phải được audit log.

## 8. Non-Functional Requirements
- Performance: API lấy số thứ tự p95 <= 3 giây.
- Performance: API tra cứu ticket p95 <= 2 giây (không tính thời gian nhận OTP từ nhà mạng).
- Performance: API tạo payment intent p95 <= 2 giây (không tính thời gian redirect/pay trên gateway).
- Availability: 99.5% uptime cho môi trường production.
- Security: xác thực người dùng phù hợp vai trò; dữ liệu nhạy cảm được mã hóa khi truyền.
- Data governance: thông tin guest lưu tối thiểu và có retention policy rõ ràng.
- Observability: log, metrics, trace cho các luồng chính.
- Audit: lưu vết thao tác operator và thay đổi trạng thái thanh toán.

## 9. Data And Integration (High Level)
- Backend: FastAPI.
- Frontend: Next.js.
- Database: PostgreSQL.
- Cache: Redis.
- Deployment: Docker, Docker Compose.
- External: Payment Gateway (TBD).

## 10. Acceptance Criteria (MVP Exit)
- Có thể cấp ticket thành công theo khoa và không trùng ticket do request lặp.
- Mọi ticket đều có `subject_ref = user_ref` để trace xuyên suốt.
- API tạo ticket chỉ hoạt động với kiosk credential hợp lệ; request ngoài kiosk bị từ chối `403`.
- Operator điều hướng được user và có audit log.
- User tra cứu được POI và thông tin dịch vụ cơ bản.
- User tra cứu được ticket từ public page bằng `ticket_code` + `phone` + OTP.
- Tạo được `order_id` ngay khi user lấy số thứ tự.
- `order` và `payment_intent` liên kết đúng cùng `subject_ref` của ticket.
- Mỗi dịch vụ phát sinh có thể được thanh toán chủ động qua `payment_intent` và chống tạo trùng do double-click/retry.
- Trạng thái `order` và `payment_intent` cập nhật chính xác sau callback/webhook và có lịch sử đối soát.
- Tài liệu API cơ bản sẵn sàng cho frontend tích hợp.

## 11. Risks And Mitigations
- Rủi ro nghẽn queue giờ cao điểm: dùng Redis cho counter/lock và retry có kiểm soát.
- Rủi ro callback payment lặp: bắt buộc idempotency key và unique constraint.
- Rủi ro sai điều hướng khoa: định nghĩa rule rõ + quyền chỉnh tay của operator.

## 12. Open Questions
- Chọn payment gateway nào cho giai đoạn MVP?
- Retention period cho guest (`user_ref`) là bao lâu?
- SLA chính thức cho từng API (ticket, lookup, payment) là bao nhiêu?
- Phạm vi dữ liệu POI ban đầu gồm những khu vực nào?

## 13. Milestones
- M1: Chốt PRD + API contract bản nháp.
- M2: Hoàn thành Issue Ticket + Operator Routing.
- M3: Hoàn thành Information Lookup + Ticket Lookup (Guest OTP).
- M4: Hoàn thành Payment + đối soát cơ bản.
- M5: UAT nội bộ và phát hành MVP guest-only.
- M6 (post-MVP): Registered user + CRM integration.

## 14. UI Design (MVP)
### 14.1 Design Principles
- Ưu tiên thao tác nhanh tại quầy: tối đa 2-3 bước cho tác vụ chính.
- CTA chính luôn nổi bật và thống nhất theo ngữ cảnh màn hình.
- Hiển thị trạng thái rõ ràng cho ticket, order, payment intent.
- Mọi thao tác quan trọng (điều hướng khoa, thanh toán) đều có phản hồi thành công/thất bại ngay trên UI.

### 14.2 Navigation Structure
- Kiosk app (on-site):
  - Trang chủ -> Lấy số thứ tự.
- Public user app (web/mobile):
  - Trang chủ -> Tra cứu ticket.
  - Trang chủ -> Tra cứu thông tin.
  - Chi tiết ticket -> Thanh toán dịch vụ.
- Operator app:
  - Dashboard quầy -> Điều hướng khoa + tạo ticket.
  - Dashboard quầy -> Quản lý order/service + khởi tạo thanh toán.

### 14.3 Screen Specs
#### S01 - Trang chủ (Home, Channel-Aware)
- Mục tiêu:
  - Cung cấp điểm vào thống nhất cho kiosk và public app.
- Chức năng chính:
  - Luôn có: điều hướng tra cứu ticket, tra cứu thông tin, thanh toán dịch vụ (khi có lookup session hợp lệ).
  - Chỉ ở kiosk: hiển thị CTA `Lấy số thứ tự`.
  - Chỉ ở public: ẩn/disable CTA `Lấy số thứ tự`.
- Nút/Action:
  - `Lấy số thứ tự` -> mở S02 (chỉ kiosk).
  - `Tra cứu ticket` -> mở S04A.
  - `Tra cứu thông tin` -> mở S05.
  - `Thanh toán dịch vụ` -> mở S07 (chỉ khi đã tra cứu ticket thành công).

#### S02 - Lấy số thứ tự (User)
- Mục tiêu:
  - Thu thập thông tin tối thiểu và tạo ticket tại kiosk.
- Chức năng chính:
  - Nhập thông tin user cơ bản (tên, SĐT hoặc mã định danh tùy chính sách).
  - Chọn nhu cầu/queue hoặc khoa gợi ý.
  - Gửi request tạo ticket idempotent theo `request_id`.
  - Chỉ chạy trên kiosk đã đăng ký credential.
- Nút/Action:
  - `Tiếp tục` -> validate form và sang bước xác nhận.
  - `Xác nhận lấy số` -> gọi API tạo ticket, tạo order `draft`.
  - `Quay lại` -> về S01.

#### S03 - Kết quả lấy số (User)
- Mục tiêu:
  - Hiển thị ticket vừa cấp và hướng dẫn bước tiếp theo.
- Chức năng chính:
  - Hiển thị `ticket_code`, `queue_name`, `queue_position`, thời gian tạo.
  - Hiển thị trạng thái order ban đầu (`draft`/`open`).
  - Hiển thị hướng dẫn tra cứu ticket trên trang public bằng `ticket_code`.
- Nút/Action:
  - `Theo dõi hàng đợi` -> mở S04A (public lookup flow).
  - `Thanh toán dịch vụ` -> mở S07 (chỉ hiển thị khi `outstanding > 0`).
  - `Về trang chủ` -> về S01.

#### S04A - Tra cứu ticket (Public, Guest)
- Mục tiêu:
  - Xác thực guest trước khi xem thông tin ticket.
- Chức năng chính:
  - Nhập `ticket_code` và `phone`.
  - Gửi OTP xác thực.
  - Verify OTP và tạo lookup session token ngắn hạn.
- Nút/Action:
  - `Gửi OTP` -> gọi API request OTP.
  - `Xác thực OTP` -> gọi API verify OTP.
  - `Gửi lại OTP` -> request OTP mới theo rate limit.

#### S04 - Theo dõi ticket (User)
- Mục tiêu:
  - Cho user xem trạng thái ticket và tiến trình phục vụ.
- Chức năng chính:
  - Hiển thị thông tin ticket sau khi đã tra cứu thành công.
  - Hiển thị trạng thái thanh toán order (`draft/open/partially_paid/paid`).
  - Làm mới dữ liệu ticket/order.
- Nút/Action:
  - `Làm mới` -> reload trạng thái ticket/order.
  - `Thanh toán ngay` -> mở S07 khi order còn nợ.
  - `Tra cứu thông tin` -> mở S05.

#### S05 - Tra cứu thông tin (User)
- Mục tiêu:
  - Tìm POI hoặc dịch vụ nhanh.
- Chức năng chính:
  - Search theo từ khóa `q`.
  - Lọc theo danh mục dịch vụ.
  - Hiển thị danh sách kết quả phân trang.
- Nút/Action:
  - `Tìm kiếm` -> gọi API lookup POI/service.
  - `Bộ lọc danh mục` -> áp dụng filter.
  - `Xem chi tiết` -> mở S06.
  - `Xóa bộ lọc` -> reset keyword/filter.

#### S06 - Chi tiết thông tin (User)
- Mục tiêu:
  - Cung cấp thông tin đầy đủ của POI/dịch vụ.
- Chức năng chính:
  - Hiển thị mô tả, vị trí, thời gian phục vụ, giá tham khảo (nếu có).
  - Hiển thị hướng dẫn di chuyển cơ bản trong bệnh viện.
- Nút/Action:
  - `Quay lại kết quả` -> S05.
  - `Lấy số ngay` -> hiển thị hướng dẫn đến kiosk gần nhất.

#### S07 - Thanh toán dịch vụ (User)
- Mục tiêu:
  - Khởi tạo và hoàn tất một lần thanh toán.
- Chức năng chính:
  - Hiển thị order summary: line-items, tổng tiền, đã thanh toán, còn nợ.
  - Tạo `payment_intent` mới khi user chủ động thanh toán.
  - Hiển thị QR/deeplink/payment link từ gateway.
- Nút/Action:
  - `Thanh toán toàn bộ` -> tạo intent với `amount = outstanding`.
  - `Nhập số tiền` -> tạo intent với amount tùy chọn (nếu cho phép partial pay).
  - `Tôi đã thanh toán` -> trigger refresh trạng thái payment intent.
  - `Hủy phiên thanh toán` -> đóng popup QR/link, không đổi order.

#### S08 - Kết quả thanh toán (User)
- Mục tiêu:
  - Trả kết quả cuối của payment intent và trạng thái order.
- Chức năng chính:
  - Hiển thị `success`/`failed`/`expired`.
  - Hiển thị số tiền đã ghi nhận và số dư còn lại (nếu có).
  - Cho phép retry nhanh nếu thất bại/hết hạn.
- Nút/Action:
  - `Hoàn tất` -> quay về S04 hoặc S01.
  - `Thử lại` -> quay lại S07 tạo intent mới.
  - `Xem hóa đơn tạm` -> mở chi tiết order hiện tại.

#### S09 - Dashboard điều phối (Operator)
- Mục tiêu:
  - Điều hướng user đúng khoa và tạo ticket tại quầy.
- Chức năng chính:
  - Tìm user theo thông tin cơ bản hoặc tạo guest nhanh.
  - Chọn/chỉnh khoa đích trước khi tạo ticket.
  - Xem nhanh queue load theo khoa.
- Nút/Action:
  - `Tạo ticket` -> gọi create ticket + tạo order `draft`.
  - `Chỉnh khoa` -> cập nhật queue đích trước khi xác nhận.
  - `Xem chi tiết queue` -> mở danh sách queue theo khoa.
  - `Ghi nhận lý do điều hướng` -> lưu audit note (nếu có).

#### S10 - Quản lý order tại quầy (Operator)
- Mục tiêu:
  - Cập nhật dịch vụ phát sinh và hỗ trợ user thanh toán.
- Chức năng chính:
  - Thêm/xóa line-item trong order.
  - Theo dõi `paid_amount`, `outstanding`, trạng thái order.
  - Khởi tạo payment intent khi user yêu cầu thanh toán.
- Nút/Action:
  - `Thêm dịch vụ` -> add item vào order, chuyển `draft -> open` nếu item đầu tiên.
  - `Xóa dịch vụ` -> remove item hợp lệ và tính lại tổng.
  - `Tạo phiên thanh toán` -> tạo `payment_intent`.
  - `Làm mới trạng thái` -> đồng bộ webhook result mới nhất.
  - `Đánh dấu hủy order` -> chuyển `cancelled` theo quyền.

### 14.4 MVP UI States And Feedback
- Loading:
  - CTA chính đổi sang trạng thái loading, disable double-click.
- Empty state:
  - Lookup không có kết quả hiển thị hướng dẫn đổi từ khóa.
- Error state:
  - Hiển thị thông báo rõ lý do (`queue inactive`, `payment failed`, `timeout`).
- Success state:
  - Hiển thị mã tham chiếu (`ticket_code`, `order_id`, `payment_intent_id`) để tra soát.

### 14.5 Access And Permissions
- User:
  - Truy cập public app: S01, S04A, S04, S05, S06, S07, S08.
- Operator:
  - Truy cập S09-S10 và xem thông tin user/order liên quan ca xử lý.
- Kiosk:
  - Chỉ kiosk credential hợp lệ mới truy cập S02-S03 và gọi API create ticket.
- Audit:
  - Các action `Chỉnh khoa`, `Thêm/Xóa dịch vụ`, `Tạo phiên thanh toán`, `Request OTP`, `Verify OTP` bắt buộc ghi log.
