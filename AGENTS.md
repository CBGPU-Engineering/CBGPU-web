## Before any UI work: read `docs/UI-RULES.md`

Every screen, component, style or navigation change (web, the app WebView, admin portal) must follow
[docs/UI-RULES.md](docs/UI-RULES.md): one app chrome, the shared dropdown/dialog components instead of
browser defaults, short Korean labels in the app, readable sizes, and opening the screens you changed
before reporting done. `npm test` enforces the mechanical rules (`tests/ui-conventions.test.mts`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
