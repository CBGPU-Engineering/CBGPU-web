# Frontend reliability audit — synthetic browser evidence

The LOCAL DEMO screenshots use synthetic accounts, intercepted profile/timetable/list responses, and no production records. Run `CBGPU_DEMO_PORT=13852 CBGPU_DEMO_API_PORT=13853 CBGPU_DEMO_BUILD_DIR=.next-frontend-audit node scripts/demo.mts`, then `node tests/frontend-journey-audit.browser.mts`.

Before the fix, a failed optional profile request left the timetable with zero timetable requests and no subjects after authentication finished. `timetable-before-profile-unavailable-mobile.png` captures that baseline. The same profile 503 fixture now loads a school timetable; `timetable-profile-unavailable-mobile.png` captures the result.

The materials browser test returns 503 for the first list read, verifies an explicit retry action without a false empty-list message, then returns one synthetic file on retry. It also holds a previous account's read, switches to a second synthetic account, resolves the new list, and verifies the delayed old reply cannot overwrite it. The list screenshots cover widths 320, 390, and 1440 in light/dark mode, plus a 390px Android WebView. No page overflow or browser page errors occurred.

The separate unit tests verify the 15-second production deadline using a short test deadline, a never-resolving SDK call, cancellation before work starts, and an old response arriving after cancellation. They do not sleep for 15 seconds or contact a file server.
