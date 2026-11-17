# CBGPU experience audit and implementation record

Audit date: 2026-11-17. Evidence: current route/component source, existing synthetic
journey tests, and browser screenshots. Findings are expert-review hypotheses,
not measured improvements in conversion or real-user task completion.

## Product boundaries

CBGPU has school-life and research/development spaces, a mobile app origin,
competitions, public Docs/preprints, and separate administrator/equipment/developer
portals. Keep those distinctions and existing permissions. Student-facing Korean
and administrator English remain deliberate. Existing account-v2 candidates stay
disabled until the separately coordinated backend rollout.

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
