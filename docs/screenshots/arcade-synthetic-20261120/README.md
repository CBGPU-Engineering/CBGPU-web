# Arcade browser evidence — synthetic local demo

These screenshots show synthetic accounts and intercepted arcade API responses, not production users or persisted production rankings. The visible LOCAL DEMO banner identifies the fixture. The browser renders the actual Next.js pages and game components.

Verified with `node tests/arcade-browser.mts` against an isolated local demo on port 13848:

- Seed 1, six-pair memory game completed in six attempts; 12 matched cards.
- First save returns fixture 503; manual retry sends the identical action payload and then shows saved status. Session requests carry the synthetic bearer.
- Switching across all six games clears ranked state and saved status without creating more ranked sessions.
- All six games checked for page overflow at widths 320, 390, and 1440.
- Memory board's last card fits inside the playfield at all three widths in light and dark mode.
- Separate 390px Android WebView user agent and `from=app` render checked in dark mode.
- No browser page errors.

The additional isolated non-demo Next.js server on port 13850 exercised the real BFF guard responses: missing bearer 401, foreign origin 403, and oversized JSON body 413. No request passed those guards to any backend. Set `CBGPU_ARCADE_BFF_TEST_ORIGIN=http://localhost:13850` to include those assertions. For the oversized-body fixture, the local proxy canonicalizes the public host without its port, so the supplied Origin matches that canonical local host.

The six width/theme images show the memory completion fixture. `390-webview-dark.png` shows a fresh practice board in the WebView frame. Chromium in this container substitutes some emoji glyphs; that does not affect card identity or the assertions.
