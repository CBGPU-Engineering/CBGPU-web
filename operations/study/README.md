# School study lookup reliability

The shared proxy is approved-user/read-only: GET of allowlisted school resources,
and POST `/selfstudy/search` (a query). It cannot submit/cancel applications.
Personal writes remain in the separate student contract with ownership checks,
official opening policy, confirmation readback and durable duplicate leases.

## Failure boundaries

- Discriminate `selfstudy` from `outstay` before reading classroom fields.
- Validate source collections; unknown student details retain occupied seats with
  an explicit placeholder instead of dropping an application.
- A missing classroom/period in a real application fails closed. An unplaceable
  active seat disables the affected room's vacancy display; applicants remain
  visible. Missing layouts affect one room, not the complete room list.
- Match numeric/string IDs consistently and validate seat coordinates/duplicates.
- Limit layout and proxy work to four concurrent reads; coalesce identical pending
  requests even on manual refresh. After repeated transport failures, pause new
  upstream attempts for 20 seconds. Errors are not cached as successful data.
- Coalesce server auth checks, retain user-token RLS, cap auth cache by JWT expiry,
  and use the local backend rather than looping through the public tunnel.
- Refresh visible pages every 30 seconds; discard results from obsolete accounts,
  requests or dates. Existing results show their verification time and update error;
  map-based application shortcuts are disabled while stale/loading.
- Never persist historical seat occupancy as current availability. No automatic
  retry is added to apply/cancel operations.

## Operator probe

Install `check.mjs` in `~/.local/lib/cbgpu-study-monitor/` and the two user units in
`~/.config/systemd/user/`. Enable `cbgpu-study-health.timer` after the web release.
The probe discovers the current immutable web release from the frontend unit,
reads its private runtime environment, decrypts the existing shared read token
inside the process, and performs only school read operations. It uses the same
normalizer and room view builder as the application, checks every room with three
concurrent layout reads, and warns before the shared token expires (24 hours).
It never signs in as a user, borrows personal sessions, sends emails, submits or
cancels school applications, or logs tokens/student records.

The probe atomically writes aggregate status, counts and connection expiry to
`~/.local/share/cbgpu-study-monitor/status.json` with mode 600. The developer
portal's **Study lookup** health card reads this file; an overdue (>15 minutes),
missing, malformed or future-dated result cannot report healthy.

```bash
systemctl --user daemon-reload
systemctl --user enable --now cbgpu-study-health.timer
systemctl --user start cbgpu-study-health.service
journalctl --user -u cbgpu-study-health.service -n 10
```

Run synthetic transport, auth, room-projection and mixed-response tests via
`npm test`. The browser demo includes `outstay` records and a missing room layout;
no real school applications are used for testing.
