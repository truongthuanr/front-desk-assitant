# Overview

## Product
- Name: Front Desk Assistant Agent
- Scope MVP: Issue ticket, ticket lookup by OTP, information lookup, payment flow
- Identity model MVP: guest-only (`subject_ref = user_ref`)

## System Snapshot
- Frontend: Next.js
- Backend: FastAPI
- DB: PostgreSQL
- Cache/Counter/OTP rate-limit: Redis
- External: SMS OTP provider, Payment gateway

## Key Domain Terms
- `request_id`: idempotency key cho create ticket
- `user_ref`: guest identity reference ổn định theo phone đã verify
- `subject_ref`: khóa định danh xuyên module, bằng `user_ref` ở MVP
- `otp_request_id`: định danh một lần gửi OTP
- `otp_verify_token`: token ngắn hạn chứng minh OTP đã verify thành công

## Primary User Types
- Guest user: lấy số, tra cứu, thanh toán
- Operator: điều hướng queue, hỗ trợ xử lý tại quầy
- Kiosk channel: channel được phép tạo ticket

## Document Navigation
- Product requirements: [`../10-product/PRD.md`](../10-product/PRD.md)
- Functional specs: [`../20-functional/functional-specs.md`](../20-functional/functional-specs.md)
- API contracts: [`../30-interface/api-contract.md`](../30-interface/api-contract.md)
- Engineering design: [`../40-engineering/design.md`](../40-engineering/design.md)
- Traceability: [`../traceability-matrix.md`](../traceability-matrix.md)
