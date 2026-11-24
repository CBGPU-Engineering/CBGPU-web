# Run and review the preview

The independent Next.js app in `preview/` serves `/new` and `/new/*`.
Install dependencies at the repository root. To run the isolated production
build and the synthetic browser fixture from the repository root:

```sh
npm ci
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:14630/backend \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-fixture-public-key \
  NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1=1 \
  NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1=1 \
  node node_modules/next/dist/bin/next build preview
node preview/tests/visual.browser.mts
```

The browser fixture listens on loopback, creates public responses in memory
and intercepts sign-in and school requests with synthetic results. It writes screenshots
and a viewport report to `/tmp/cbgpu-v2-browser` by default. Set
`CBGPU_PREVIEW_OUTPUT` to retain another review set. It checks search,
pagination, retrieval failures, unknown detail routes, sign-in errors and return, password masking, public-field
allowlisting, school membership, date navigation, viewport overflow, keyboard
focus, index exclusion and axe accessibility checks.

For a private staging deployment, provide existing public-content feature
flags and the trusted public-content service URL. Build with the same
browser Supabase URL and public key used by the existing site. Run the preview
on a separate listener. Configure the same-origin ingress to route exactly
`/new` and `/new/*` to that listener, including `/new/_next/*`. Keep
`/backend/*`, `/api/*`, all host-specific portals and all other requests
pointing at their existing services. Confirm that multiple devices remain
anonymous until they authenticate, that installing the existing app still
works, and that rejected cross-tenant requests remain rejected. Disabling
the new ingress routes removes the preview.

The first preview covers public discovery, the home, the service directory, sign-in, school-scoped meals, timetable viewing and all 51 usage guides. The parity matrix records the permission and route boundaries
for the remaining authenticated features. Existing-product links use a full
document navigation and remain identified in the preview by an outbound
arrow or accompanying copy. The rollout should wait for the remaining
presentations, authenticated workflow checks and owner approval.

Set `CBGPU_PREVIEW_SHOWCASE=1` at runtime to open the component showcase at
`/new/design-system` in an isolated development environment. Keep it disabled
in any externally accessible preview.

To compare a saved baseline with a second run on the same Chromium version,
operating system and calendar date:

```sh
node preview/tests/compare-screenshots.mts /path/to/baseline /path/to/candidate
```

Review any flagged screenshot visually before updating the baseline. The
fixture also saves every requested viewport, including dark mobile screens.

The branch includes an opt-in apex ingress using `CBGPU_PREVIEW_ORIGIN`. Set
it to the origin of a separate loopback Next.js preview listener. The ingress
accepts only GET and HEAD for `/new` and its descendants. It excludes proxy
and portal credentials from the preview renderer. Leave the setting unset to
roll back the route. The APIs continue to be served through the existing app.

The integrated preview contains 56 page implementations. Registration, project,
competition, community, study, school management, compute, and other
workflows are listed in the [parity matrix](./feature-parity.csv). Some
sensitive or platform-specific workflows still use the established original
pages. The staging ingress was tested on loopback, including root health, asset
delivery, search-index exclusion, and protection of the platform admin API.
