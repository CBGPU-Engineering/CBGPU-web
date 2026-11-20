# TeacherStudio handoff — synthetic browser evidence

All images show the LOCAL DEMO with a synthetic account and an intercepted permission denial. They do not show a real project account or a production login. Screens cover 390px and 1440px light/dark mode, plus Android WebView at 390px dark mode. No overflow or page errors occurred.

`tests/studio-handoff.browser.mts` verifies that the existing login gate preserves the safe internal return path and 43-character challenge; ticket requests occur only after the confirmation button is clicked; 403 does not navigate; arbitrary query return URLs and a forged foreign response URL are rejected; and successful confirmation navigates only to the configured fixture origin with an opaque ticket. The destination is intercepted locally, so no real app request is sent.

For this local fixture, configure the isolated Next demo server with project `2541d072-1111-4111-8111-111111111111`, adapter `http://127.0.0.1:13862` (unused by browser interception), and public origin `https://studio-fixture.server.cbgpu.com`. Run with `CBGPU_CHROMIUM=/tmp/chromium CBGPU_STUDIO_TEST_ORIGIN=http://localhost:13860 node tests/studio-handoff.browser.mts` when using the container Chromium override. No production credentials are needed.

`tests/studio-handoff.test.mts` and `tests/studio-authority.test.mts` separately exercise the real handler/authority helpers with injected transports: no-auth/CSRF/malformed challenge denial, fixed project/origin, bearer-only forwarding, viewer/session/account/project/execution-grant revocation, read-only central CPU predicate, and temporary 429 handling. Adapter nonce binding, expiry, one-time redemption and opaque-session revocation are enforced by the separately reviewed native gateway.
