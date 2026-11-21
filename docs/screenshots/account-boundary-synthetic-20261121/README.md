# Account operation and contest refresh boundaries — synthetic evidence

These LOCAL DEMO images use injected fake identities and intercepted Auth/API calls only. No production account was read, changed, deleted, impersonated, or signed in.

Confirmed baseline defects on web main `50b89d5`:

- Profile deletion begun by synthetic A waited for a session read; after switching to synthetic B, the old callback sent B's bearer to the deletion route. The fixture blocked the request with 503, so no deletion occurred. `profile-before-wrong-account-operation.png` shows that fixture's resulting screen.
- With the same synthetic contest manager still signed in, a newer refresh correctly denied management after role revocation. An older manager read then returned and restored the management UI and synthetic private submission. `contest-before-stale-role.png` captures this out-of-order permission result. This is a same-account role-refresh bug, **not** a cross-account leak: the existing parent resource-session boundary already prevents the cross-account variant.

`tests/profile-contest-boundary.browser.mts` now verifies:

- Delayed deletion A → B produces zero deletion POSTs; confirmation/password fields do not survive the account boundary.
- A delayed isolated password verification cannot restore A after B becomes current and produces zero password PUTs.
- Password updates use the original main-session A bearer, never the temporary verification bearer. Cleanup targets the temporary session with local scope only. Network failure preserves all password fields.
- A latest management denial remains in place after the earlier manager reply finally arrives, even when the fixture ignores abort signals.
- Mobile/desktop light and dark screenshots, plus Android WebView, fit without page overflow or page errors.

Run against an isolated demo on loopback 13864, e.g. `CBGPU_DEMO_PORT=13864 CBGPU_DEMO_API_PORT=13865 CBGPU_DEMO_BUILD_DIR=.next-boundary-audit node scripts/demo.mts`, then `CBGPU_CHROMIUM=/tmp/chromium node tests/profile-contest-boundary.browser.mts`. The Chromium override is optional when Playwright's installed browser is available.

Server route unit tests additionally prove that expected-account mismatch, revoked sessions, and unavailable session authority call zero privileged mutation functions. An active matching caller remains compatible with legacy empty-body requests.
