## Planning for implement FR-06

### Scope
- Feature: Google Sign-In and Phone Linking (`FR-06`)
- References:
  - `docs/10-product/PRD.md` (Identity Model MVP)
  - `docs/20-functional/functional-specs.md` (Section 7)
  - `docs/30-interface/api-contract.md` (Section 8)

### Phase 1 - Data model and migration
1. Add identity storage for `user_ref`, `google_sub`, `phone`, and link status.
2. Enforce constraints:
   - `google_sub` unique.
   - one active `phone` can map to only one `user_ref`.
3. Add indexes for lookup by `google_sub` and `phone`.
4. Add audit table (or extend existing) for events:
   - `google_sign_in`
   - `phone_linked`
   - `phone_unlinked`
   - `phone_link_conflict`

### Phase 2 - OIDC Google flow
1. Implement `GET /auth/google/start`:
   - Generate/store `state`.
   - Generate PKCE verifier/challenge.
   - Redirect to Google authorize endpoint.
2. Implement `GET /auth/google/callback`:
   - Validate `state`.
   - Exchange `code` for tokens.
   - Validate ID token (`iss`, `aud`, `exp`, and `nonce` if enabled).
3. Resolve identity by `google_sub`:
   - Existing `google_sub` -> reuse `user_ref`.
   - New `google_sub` -> create new `user_ref` (unlinked phone state).
4. Create app session token and redirect:
   - linked phone -> `S02`
   - unlinked phone -> `S01A`

### Phase 3 - Phone linking flow
1. Reuse OTP endpoints with `purpose=link_phone`:
   - `POST /auth/otp/send`
   - `POST /auth/otp/verify`
2. Implement `POST /identity/phone/link`:
   - Require authenticated Google session.
   - Validate `otp_verify_token` is for `purpose=link_phone`.
3. Conflict handling:
   - If phone belongs to another `user_ref` -> return `409`, do not auto-merge.
4. Write audit log for link success/failure/conflict.

### Phase 4 - Authorization guard for sensitive actions
1. Add policy/middleware to require linked/verified phone for:
   - ticket issue flow
   - ticket lookup flow
2. Standardize errors:
   - `401` for unauthorized/missing/expired auth context
   - `422` for OTP purpose mismatch
   - `409` for phone link conflict

### Phase 5 - UI implementation
1. Screen `S01`:
   - CTA `Sign in with Google`
   - Login states: `loading`, `cancelled`, `failed`
2. Screen `S01A`:
   - phone input
   - OTP send/verify actions
   - resend countdown
3. Redirect rules:
   - callback success + linked phone -> `S02`
   - callback success + unlinked phone -> `S01A`
   - link success -> `S02`
   - link conflict -> stay `S01A` with error message

### Phase 6 - Test and rollout
1. Unit tests:
   - OIDC token validation
   - identity resolution by `google_sub`
   - OTP purpose validation (`link_phone`)
   - phone conflict path
2. Integration tests:
   - `/auth/google/start` + `/auth/google/callback`
   - OTP send/verify for link flow
   - `/identity/phone/link`
3. End-to-end tests:
   - happy path: S01 -> Google -> S01A -> OTP -> S02
   - failure paths: invalid state/code/token, OTP expired/mismatch, phone conflict
4. Rollout:
   - release behind feature flag
   - internal pilot first
   - monitor auth errors/conflict rate/audit logs

### Definition of Done
1. All APIs in interface mapping 7.3 are implemented and match contract.
2. Sensitive operations are blocked when phone is not linked/verified.
3. Audit events are emitted for all required link/sign-in events.
4. Unit/integration/E2E test suite for FR-06 passes.
