# CBGPU experience audit and implementation record

Audit date: 2026-11-17; full-route refinement and reliability review: 2026-11-24. Evidence: current route/component source, existing synthetic
journey tests, and browser screenshots. Findings are expert-review hypotheses,
not measured improvements in conversion or real-user task completion.

## Product boundaries

CBGPU has school-life and research/development spaces, a mobile app origin,
competitions, public Docs/preprints, and separate administrator/equipment/developer
portals. Keep those distinctions and existing permissions. Student and school-management screens, including app administration, are Korean.
Desktop platform/developer administration remains English. Preserve existing feature
flags and authentication boundaries; disabled or unavailable dynamic routes are
recorded honestly rather than opened for a screenshot.

## Prioritized journeys

| Journey / users | Observed friction | Severity / confidence | Implementation direction |
| --- | --- | --- | --- |
| Sign in / all users | Raw provider errors, isolated card, no stable inline recovery; mixed status feedback | High / high | Shared auth frame, actionable inline messages, preserved fields, immediate pending state |
| Sign up / new school users | English/Korean mixed labels; missing explicit label associations; password requirements not stated | High / high | Korean action copy, labels/autocomplete, contextual student/password help, actual confirmation state |
| Recover password / all users | Technical errors; wording could overstate mail delivery | High / high | Same frame, explicit next step, privacy-preserving requested-link confirmation |
| Discover a feature / student/researcher | Large feature surface; legacy favorites can obscure navigation | High / medium | Preserve visible full directory, goal-oriented labels and search, role-scoped shortcuts; inspect search/no-results |
| Discover competitions / participants | Static cards and underdeveloped missing-banner/empty states | High / high | Preserve organizer banners; original fallback art; actual-state filters and spatial card/detail continuity |
| Enter/join team / participants | Questions and team choices compete; no clear step hierarchy | High / medium | Use-funnel for genuine stages, retain answers when going back; no answers in URL |
| Submit project / participants | Completion can read like ordinary text; risk of premature success | High / medium | Celebrate only persisted server result, show next action; preserve uploads/rules |
| GPU reservation / researchers | Dense grid/status changes can be hard to track | Medium / medium | Clear selection, readable statuses, meaningful spatial transitions, no fake allocations |
| Front/server deployments / builders | Asynchronous stages and failure recovery need stable context | High / high | Animate actual state changes, preserve logs/history and previous production; no invented percentages |
| Timetable / students | Date and result changes need context, compact mobile controls | Medium / medium | Predictable selection and directional result transition with stable loading |
| Study application / students | Complex seat diagram and viewport-bound dialogs | High / high | Preserve existing seat scale; inspect container bounds and always reachable close/action controls |
| Notes/materials/LaTeX / researchers | Several visual languages and sparse empty states | Medium / medium | Shared semantic typography/feedback, purpose-specific illustration and clear create/upload actions |
| Admin/equipment / staff | Dense data and dangerous actions must remain fast and explicit | High / high | Restrained status motion, keyboard/focus-safe confirmations; no celebration density of student screens |
| Cross-domain/app navigation / signed-in users | Origin/session and app shell must remain coherent | Critical / high | Existing authenticated boundaries retained; new UI never broadens authorization |

## Common system

Reuse existing CBGPU colors, Pretendard, theme tokens, Radix primitives and Lucide.
One global MotionConfig honors user motion preferences. Physical press feedback,
short state transitions, shared spatial relationships and finite completion SVGs
serve different purposes; no artificial operation delay. Confirmation dialogs use
overlay-kit with existing Radix focus management. Small-screen controls favor44px
primary touch targets; inline text links retain normal text semantics.

Dependency decisions, verified against published packages and upstream repositories:

| Technology | Decision and concrete use | License |
| --- | --- | --- |
| Motion14.14.0 | Product springs, layout/presence, SVG success, notifications and competition transitions | MIT |
| overlay-kit1.9.0 | Real asynchronous confirmation lifecycle, existing focus-safe dialogs | MIT |
| @use-funnel/core0.1.0 | Modal-local typed stage history; values stay in React state | MIT |
| @use-funnel/next0.0.23 | Not retained: installed source uses next/router, incompatible with this App Router integration | MIT |
| Lucide (existing) | Single icon family, visible text accompanies meaning | ISC |
| Slash/@toss/scroll-animation | Not installed: upstream Slash is archived; use current Motion scroll APIs | MIT upstream |
| Lottie/Rive | Not added: no selected/licensed asset justifies another runtime; original animated SVG provides completion feedback | Asset-specific evaluation required |

Reference sources: [W3C form feedback](https://www.w3.org/WAI/tutorials/forms/notifications/),
[W3C target sizes](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[Motion](https://motion.dev/docs/react), [overlay-kit](https://github.com/toss/overlay-kit),
[use-funnel](https://github.com/toss/use-funnel), [archived Slash](https://github.com/toss/slash).

## Verification plan and limits

Compare before/after synthetic mobile and desktop screenshots; exercise keyboard,
reduced motion, validation failures, repeated submit protection, genuine mocked
success and failed-network recovery without sending real mail or enrolling users.
Run TypeScript, existing regressions and production/demo builds. Report automated
accessibility findings as findings, never claim full WCAG certification. Real-user
completion/abandonment, physical Android behavior and field Core Web Vitals require
separate measurements; do not invent percentages from synthetic tests.

## Audited route surface

The inventory below is generated from the current route files. API handlers and
permission checks are audited separately; this redesign does not replace them.
- `/admin`
- `/admin/accounts`
- `/admin/careers`
- `/admin/gpu`
- `/admin/m`
- `/admin/manufacture`
- `/admin/manufacturing`
- `/admin/manufacturing/laser/[id]`
- `/admin/manufacturing/print/[id]`
- `/admin/materials`
- `/admin/polls`
- `/admin/server`
- `/admin/study`
- `/admin/timetable`
- `/admin/wakeup`
- `/ai`
- `/ai/chat`
- `/ai/cli`
- `/arxiv`
- `/arxiv/[id]`
- `/arxiv/submit`
- `/auth/callback`
- `/auth/forgot-password`
- `/auth/login`
- `/auth/reset-password`
- `/auth/signup`
- `/auth/transfer`
- `/contact`
- `/contests`
- `/contests/[id]`
- `/contests/api`
- `/contests/new`
- `/dashboard`
- `/dashboard/ssh-guide`
- `/demo`
- `/deploy`
- `/deploy/[id]`
- `/deploy/new`
- `/docs`
- `/docs/[slug]`
- `/download`
- `/feed`
- `/games`
- `/latex`
- `/manage/manufacturing`
- `/manage/manufacturing/filament`
- `/manage/manufacturing/laser/[id]`
- `/manage/manufacturing/materials`
- `/manage/manufacturing/print/[id]`
- `/manage/manufacturing/queues`
- `/manage/manufacturing/requests`
- `/manufacturing`
- `/manufacturing/laser`
- `/manufacturing/laser/[id]`
- `/manufacturing/laser/new`
- `/manufacturing/print`
- `/manufacturing/print/[id]`
- `/manufacturing/print/new`
- `/match`
- `/materials`
- `/materials/[id]`
- `/materials/new`
- `/meal`
- `/notes`
- `/`
- `/polls`
- `/privacy`
- `/profile`
- `/schedule`
- `/server`
- `/server/[id]`
- `/server/new`
- `/services`
- `/study`
- `/study/contribute`
- `/study/link`
- `/timetable`
- `/tools`
- `/wakeup`
- `/workspace`

## Verified integration — 17 November 2026

The combined authentication, contest, GPU, timetable and deployment UI passed an optimized Next build and TypeScript checks. Local Chromium verified authentication at 320, 390, 768 and 1440 pixels, input preservation after failure, password visibility, real demo-confirmed success notifications and reduced motion. Axe found no violations in the tested authentication panel in light and dark themes; this is not a whole-site WCAG certification. Contest tests verified one registration mutation, answers preserved when returning a step, measured card-to-detail continuity, mobile overflow and reduced motion. Resource tests checked keyboard GPU selection, timetable details/focus return and actual deployment phase transitions. All data was synthetic; no production registration, email, deployment or reservation was created by these tests.

Shared dialogs now keep Radix focus management while Motion handles entry/exit; overlay-kit promises resolve on the real user decision and cleanup follows exit completion. Original SVG feedback has no third-party asset attribution requirement. The existing contest lint baseline still contains eight pre-existing effect-state errors; these have not been represented as passing. Physical Android behavior, representative user task timing and whole-site accessibility remain unverified.

## Scoped-access regression review — 17 November 2026

Further rendered checks use synthetic accounts and intercepted provider APIs:

- **High, temporary collaborators:** the old profile approval boolean hid valid
  resource access. A separate resource context now identifies an approved guest
  without representing them as a student. Fresh per-action checks prevent stale
  menus from authorizing writes; history and owned projects remain accessible.
- **High, study recovery:** a CBGPU session error could erase the independently
  valid EduSet connection. Errors now distinguish the two identities. The mobile
  study fixture verifies that session expiry preserves the connection and that
  resource revocation clears stale room data without submitting anything.
- **High, asynchronous actions:** an AI request could continue after leaving its
  tool. Owner, mounted-component and selected-job checks discard stale intents.
  A production browser fixture holds a permission response, navigates away and
  releases a late approval; no job is created. Existing errors are not used as
  evidence that a new action settled; the test waits for its actual response.
- **Medium, note discoverability and keyboard access:** clickable containers did
  not expose a keyboard action, while delete required hover. Notes now have a
  named native button, named return action and a visible 44px touch delete target.
  A real 320px browser test opens a note with Enter, returns without a write and
  checks target size and horizontal overflow. Destructive confirmation remains.
- **High, material upload recovery:** scoped upload failures retain the form and
  retry the same upload identity. The mobile fixture verifies no direct unscoped
  metadata write or file transfer after an authorization failure.

These changes apply recognition over recall, accessible target sizing and error
recovery. Their effect on real student task time remains a hypothesis until
measured with users. Browser coverage is specific to the fixtures above; it does
not certify every route, every screen reader or physical devices.


## Full-route oil-ui refinement — 2026-11-24

The installed oil-ui and ux-writing-kr skills were applied to the existing product,
without replacing its brand, navigation spaces or business APIs. All 114 current
Next page sources were assigned and audited. The per-route source, wrapper,
verification evidence and limitations are recorded in
[page-coverage.json](./ux/oil-ui-20261124/page-coverage.json). Separate developer and
recruitment assets are maintained in CBGPU-backend; their public-runtime differences
were checked before release. Source coverage does not imply that every dynamic
record or permission combination was opened with live user data.

| Observed issue | Implemented response | UX/HCI basis |
| --- | --- | --- |
| Laptop navigation labels wrapped vertically | A bounded menu retains all destinations until the full rail fits; keyboard close restores focus | Predictability and recognition |
| Small, low-contrast form controls | Shared reachable controls, readable helper text, input boundaries, app time selectors and stable selected-tab contrast | Fitts's law and accessibility |
| Phone printing forms and action tables were cramped | Stack task choices and field groups; keep row actions visible in phone request cards | Grouping and responsive task hierarchy |
| Platform/app interface languages diverged | Authored interface copy is English on desktop platform management and Korean in the app; dynamic user content and API values are preserved | Comprehension and consistency |
| Failed research reads looked like empty collections | Domain-specific retry states retain same-account content and search; account-keyed caches discard late responses after switching users | Error recovery and privacy |
| Contact and study operations could lose context or claim success without an affected row | Preserve changed drafts, reject duplicate pending actions, check actual row acknowledgements and recover rejected promises | Accurate feedback and error prevention |
| An uncertain upload could enter destructive cleanup | Retain the same upload identity/file and use explicit read-only reconciliation before a same-identity resume; no ambiguous cleanup | User data preservation |
| Poll editing replaced questions and cascaded through answers | Atomic invoker RPC, revision checks and question/option identity guards; preserve drafts on rejection | Trust and recoverability |
| Poll response header/answer writes could partially succeed | Atomic current-question validation, explicit receipt inspection, safe owned-empty reuse and confirmed row acknowledgements | Accurate completion feedback |
| Hidden poll results relied on interface behavior | Server-side restrictive result/participation visibility and live-session policies, plus matching UI gates | Permissions are server responsibilities |
| Developer status errors could remain loading or expose raw exceptions | Distinguish missing/malformed sections from empty data and provide a Refresh recovery path | Clear system status |

Verification used actual components and an isolated production demo build with
synthetic transports, never real private writes. The final integrated build,
TypeScript, 653 standard tests (651 passed, two intentional skips) and study contracts
passed. Real Next/Supabase-JS synthetic sign-in, school filters, search, role denial,
portal-session mismatch, app error language and document language were exercised.
Shared controls were checked at phone/desktop sizes, navigation at nine widths in
both themes, and important failure paths in WebView contexts. Backend poll integrity
uses three real network-isolated PostgreSQL suites, including rollback, concurrent
writers, legacy races, result privacy and unchanged data after repeated policies.

Before/after screenshots for shared chrome are in
`docs/screenshots/oil-ui-foundation-20261124/`; app feedback evidence is in
`docs/screenshots/app-management-feedback-20261124/`. Domain fixture evidence and
explicit source-only/feature-flag limitations are linked by the route inventory.
Motion stays purpose-specific and respects reduced-motion settings. No conversion,
revenue, task-time improvement percentage or universal accessibility certification
is claimed. Live role-sensitive mutations, real GPU jobs and third-party provider
failures remain separate operational checks.

## Final refinement and live verification — 24 November 2026

The full-route source inventory remains 114 page files. This is source coverage,
not a claim that every role, feature flag and dynamic production record was opened.
The shared-foundation and platform-flow releases were deployed without replacing
existing accounts or projects. Normal anonymous browsers confirmed the running
release at both the web and app origins; Studio runtime settings survived the
release. Developer/careers public assets were updated separately, retaining the
running controller processes and their private configuration.

Follow-up findings from actual rendering and synthetic races:

- **Recognition / mobile navigation:** an old descendant-image rule squeezed the
  horizontal brand artwork to 26px. Restrict it to legacy direct-child images;
  verify the current brand image fills its wrapper at nine viewport widths in
  both themes. Authentication steps now have distinct rendered document titles
  and retain inherited `noindex, nofollow`. Korean authentication headings prefer
  complete words, with safe wrapping for long content.
- **Contrast / predictable controls:** separate filled-action blue from the bright
  dark-theme link accent. Real Button and Link-shaped controls in administrator
  and publication scopes pass 4.5:1 in 72 normal, hover and keyboard-focus cases;
  the measured minimum is 6.39:1. Explicit destructive styling remains intact.
  The developer portal's canonical action and skip-link colors use the same pair.
  The CSS synchronization tool's missing development parser dependency is now
  explicitly pinned. Regeneration still requires reviewing the diff: React
  selector, typography and touch-target adaptations must be preserved.
- **Accurate feedback / survey scales:** empty answers are not zero scores. Keep
  valid zeroes; exclude invalid values; share the same aggregate with AI summaries.
  Invalid legacy ranges produce recovery guidance instead of a render exception.
  Large ranges use integer input and observed-value distributions, without
  allocating one control for every possible number. Real component tests cover
  71 phone/desktop/theme/WebView cases, including range repair and submission.
- **Error recovery / news:** HTML challenge pages, incomplete feeds, redirects,
  oversized bodies and stalled responses are failures, not successful empty
  results. Bound requests and preserve normal RSS fields and the existing upstream cache option. A single
  credential-free read using the revised handler also received valid XML/HTTP 200
  from the real public RSS provider; provider availability is not guaranteed.
  Category/source/generation checks prevent late headlines and AI summaries from
  replacing the currently selected view. Thirty real-component synthetic race
  cases verify stale successes/errors, source switches and concurrent refreshes;
  same-scope failures preserve confirmed content and timestamps.

Anonymous live Axe checks found no automated WCAG-tag violations in the tested
signup, app login, school directory, services, web home and app home views.
Services initially had six contrast checks requiring manual review. Manual
inspection found translucent counter text and the selected mobile navigation
label below 4.5:1. Three CSS declarations now use opaque existing semantic pairs.
Thirty-two interaction states and six Axe checks verify counters at 6.38:1 or
better and selected navigation at 11.73:1 or better; 184 sampled glyph/background
regions match the rendered CSS colors. One mobile pseudo-background check remains
automatically incomplete and passes manual verification. This is not an AA
certification. Two equipment sign-in contrast failures led to the action-color
fix above. Further read-only checks covered 16 public documentation/recruitment
paths and six additional rendered mobile/tablet views: links, document search,
TOC targets, skip-to-content and application entry/back navigation worked.

Internal poll changes are additive and versioned in the backend repository.
Full private database backups were restored in a network-isolated PostgreSQL
container before guarded application. Poll row fingerprints, prior policies and
ACLs were preserved. Synthetic PostgreSQL tests exercise editor conflicts,
atomic submission, hidden results, expired identities and an explicit anonymous
row-policy boundary with live-shaped table grants. No real account was
impersonated or used to create a production response during this verification.
Physical Android devices, real email delivery, external invitation acceptance,
real GPU jobs and real-user performance/abandonment remain outside this run.

Further synthetic school-switch checks exercised three existing management
screens in 30 late-success/late-failure cases. Prior-school responses did not
replace the current school heading, history or draft; no source fix was needed.
This tests local component transitions, not real router/server authorization.
A separate read-only mobile school-directory check returned one result each for
Chungbuk Science, Danjae and Gyeongbuk Drone schools while preserving search focus.
Observed search-to-display times were about 0.8s in that single laboratory run,
including debounce; these are not field performance measurements.

## Final selector regression review — 24 November 2026

A real form reproduction found a hidden native Radix select emitting a raw empty
change after a teacher-only school changed to a school offering all member types.
That event replaced the parent-selected `STUDENT` value with an invalid empty
kind, leaving the account-type trigger blank and hiding the student/teacher fields.
The shared Dropdown now forwards only current enabled options, while preserving
explicit empty options through their existing encoded value and preserving
keyboard selection. The signup model independently accepts only the three known
types allowed by the selected school. Its existing school/student/teacher/external
metadata and approval policies are unchanged.

The actual signup component, SchoolSelector and Dropdown passed 23 synthetic
payload/validation cases on desktop and mobile, including school and path changes.
No hidden previous-type field was found leaking into the current signup payload.
The shared-control fixture passed five phone/desktop/theme/WebView variants for
phantom, removed, disabled and legitimate empty-option events. Twelve integrated
control configurations cover normal and reduced motion, time conversion, errors
with retained input, keyboard tabs, viewport-bound dialogs and focus restoration.
Normal selection rows now meet the existing 44px target rule; reduced-motion
menus disable CSS entrance/exit animations. No deduplication, form-reset or
uncontrolled-state behavior was rewritten.

Unit checks report 661 tests: 658 pass, no failures, and three intentional skips.
One skip is the new opt-in signup browser test, which also ran explicitly and
passed; the other two predate this review. TypeScript and tooling checks pass.
Targeted signup lint still has the same two effect-state errors and one hook
warning as its audited baseline; these are not represented as a clean whole-site
lint run. No accounts, emails, memberships or approvals were created in production.

A production deployment guard also correctly stopped a release when root-disk
space fell below its existing 15GiB reserve. Completed review-only generated
builds and reinstallable dependencies were removed, preserving source, evidence,
backups and operational rollback releases. Available space recovered to about
20GiB, and deployment resumed. The final review build uses the secondary SSD;
ongoing root capacity still needs monitoring. No deployment guard was lowered.

Long-label tests also found fixed portal menus extending beyond a 320px or
390px viewport without increasing document.scrollWidth. The common Select now
limits its painted width and wraps option text without removing the full label.
Eighteen real-component cases cover 80/150-character URLs and long Korean labels
across Dropdown, popper and item-aligned positioning, including selection and
reopening. Menu bounds and every painted text line are checked independently of
document overflow. Styling is inherited from the option wrapper because the
installed Radix ItemText intentionally omits className/style props.
