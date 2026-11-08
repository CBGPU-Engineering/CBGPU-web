# Timetable availability

The public Comcigan viewer rotates its request format, token, transport encoding,
field identifiers and school-code position. The adapter reads current literals
from the official viewer, including nested encoding and reordered key fragments,
without evaluating remote JavaScript. Authenticated payloads are verified before
use; invalid data never replaces a valid snapshot.

The server coalesces concurrent requests, caches successful data for five minutes,
reloads current provider metadata once on failure, and backs off for one minute
when unavailable. Even forced refreshes share the in-flight request/backoff.

Successful school-wide data is written atomically with mode 600 to
`~/.local/share/cbgpu-timetable/latest.json`. This path survives immutable web
releases and service restarts. A failed refresh may serve a last-good snapshot
only up to 48 hours old and only for the current Korean calendar week (or the
upcoming week on Saturday/Sunday). Old-week, future-timestamped and malformed
snapshots are rejected. No timetable is invented when no usable snapshot exists.

The API returns `stale`, `fetchedAt` and `weekStart`. The student/admin UI identifies
fallback data and warns that substitutions may be missing, and checks again every
minute while visible. The home AI summary excludes stale timetable data. A stale
response retains the original verification time; serving it never extends age.

Install `refresh.py` in `~/.local/lib/cbgpu-timetable/` and the two units in
`~/.config/systemd/user/`, then enable `cbgpu-timetable-refresh.timer`. It checks
one class every five minutes, 06:00–22:59 KST, daily. A single successful fetch
preserves every class in the school snapshot. A stale or failed response marks
the refresh service failed for monitoring, without stopping the website.

```bash
systemctl --user daemon-reload
systemctl --user enable --now cbgpu-timetable-refresh.timer
journalctl --user -u cbgpu-timetable-refresh.service -n 10
```

Regression tests cover old and nested enc5 transport, token/key rotation,
request coalescing, restart/outage recovery, week/age limits, and atomic storage.
