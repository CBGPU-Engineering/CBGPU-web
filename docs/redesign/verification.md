# CBGPU 2.0 preview review

The preview starts from the deployed PR 52 release `5222f46`. Its separate
Next application owns the document, stylesheet and asset graph for `/new`.
The only changes to existing tooling are the generated output exclusion in
ESLint and the separate TypeScript project boundary. Source checks and the
legacy test suite pass with 667 tests passed and three intentional skips.

| Review question | Evidence |
| --- | --- |
| Is the home easy to enter? | Daily tasks precede discovery at phone widths. The desktop school discovery photo moves beside the masthead so contests and projects come into view sooner. |
| Does the identity stay consistent? | Original CBGPU wordmark and Pretendard, a cool masthead, white or ink work surfaces, a restricted role-based palette and four task illustrations. |
| Does motion convey a state change? | The active destination travels inside the same navigation group. The search overlay sends focus to the field and Escape restores the trigger. |
| Can students find today's information? | Phone timetables use a day selector with distinct selection. Desktop displays the week as a labelled table. Meals use date controls and show empty and retry states. |
| Can readers find their place? | Documentation search keeps the selected category. Related links and the contents navigation stay under the preview when supported. The phone contents control starts collapsed. |
| Does the existing site retain its presentation? | The live health endpoint still reports PR 52. Fourteen read-only public smoke views passed. Anonymous home screenshots at desktop and app widths matched their prior files byte for byte. |

The browser fixture passed 98 route and viewport combinations and 102
guide checks on each of two runs. It covers all seven requested dimensions,
reduced motion and a dark mobile run. The two runs matched across all 10
comparison screenshots. It checks public field filtering, rejected and
successful synthetic login, forbidden school reads, opaque route
scoping, dates, search, focus and document links. The screenshots and
the optional pixel comparison use the same Chromium and local test data.
Loopback paint metrics and layout shift are recorded in the browser report.
Home LCP samples on the first final loopback run ranged from 220 to 260 ms.
These figures describe local rendering only.

The partial preview includes public discovery and detail screens,
personalized home, the services directory, login, school meal and
timetable reading, and all usage guides. The [route matrix](feature-parity.csv)
tracks the rest of the existing product. Authoring and moderation,
contest registration and submissions, GPU and AI workflows, projects
and team collaboration, notification settings, equipment and admin
portals still need redesign and parity review. Preview links to those
workflows explicitly open the existing site. There are no live ad
requests in this preview.

The full 95-point visual bar, real-account cross-zone behavior, native
Android WebView, browser compatibility beyond Chromium, production
Core Web Vitals and tenant enforcement on a deployed preview remain
unverified. A production preview deployment is a separate step.
