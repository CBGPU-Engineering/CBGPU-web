# Frontend journey reliability audit — 2026-11-20

## Production observations

Read-only anonymous Chromium inspection of `https://app.cbgpu.com` covered `/`, `/auth/login`, `/schools`, `/study`, `/timetable`, and `/materials`. All non-GET/HEAD requests were blocked before sending; the 12 blocked requests were traffic/Cloudflare telemetry. No account, school preference, file, or study record was changed.

All six pages rendered without browser page errors or HTTP errors in their same-site GET responses. The directory showed 2,478 schools with 30 initially visible; study, timetable, and materials showed the expected anonymous login gate. Independent HTTPS requests to the public main and app home returned 200 in about 0.4 seconds. These checks do not establish authenticated service health or a system-wide latency percentile.

The browser observed four shared-session GETs on the home page and seven on subsequent full route loads. The parent investigation owns broker request coalescing; this change does not change session storage, cookie handling, or authentication semantics.

## Reproduced defects and fixes

1. The timetable's initial effect required a profile although profile data only suggests a grade/class. The auth provider resolves authentication before the separate profile query, and a profile failure leaves that value null. With a synthetic profile 503, the original screen issued zero timetable requests. The effect now waits for authentication, then loads the already-authorized school timetable without requiring that optional profile. A later available student number still selects the student's class through the existing initialization key.
2. The materials list had no total read deadline, account boundary, or cancellation. Slow reads could remain pending; previous requests could overwrite a newer account's state. The list now remounts by account identity, cancels superseded/unmounted reads, and has one 15-second deadline including SDK preparation. Failed reads show a retry action and do not claim that the server returned an empty list. This is a read-only retry; uploads, downloads, deletions, and school/study writes are unchanged.

## Verification and limits

`node --test tests/materials-list-read.test.mts` covers deadline/cancellation behavior. `node tests/frontend-journey-audit.browser.mts` covers degraded optional profile, materials 503 recovery, delayed old-account response rejection, light/dark mobile/desktop rendering, and Android WebView rendering with synthetic identities only. Screenshots and fixture details are in `docs/screenshots/frontend-reliability-synthetic-20261120/`.

Source inspection also found that the study proxy's four-slot queue admits up to 80 waiting reads before starting each read's 12-second upstream timeout. Queue waiting has no total deadline. This could cause long waits under sustained slow successful upstream responses; that scenario was not reproduced against production. It is reported to the backend investigation and is outside this frontend fix.
