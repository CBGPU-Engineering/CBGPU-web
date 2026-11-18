# CBGPU UI rules

Read this before you change or add any screen, in the web app, the Android app's WebView
(`; wv)` user agent / `?from=app`) or the admin portal. It is written for people and for
development agents. The owner's decisions below are not suggestions: if a feature seems to need
a different answer, say so in the PR instead of changing the rule silently.

Why this exists: new features kept arriving with their own look (browser-native dropdowns, long
English labels in the phone navigation, a different app chrome behind a feature flag) and the app
the owner and users rely on every day fell apart screen by screen. Automated checks for the
mechanical rules live in `tests/ui-conventions.test.mts`; the rest depends on you.

## 1. One app, one chrome

- The app (WebView) has **one frame**: a top bar with the space switcher
  (학교생활 / 연구·개발 / 관리 / 제작 / 기상송, only the spaces a role may use) and a bottom tab
  bar that scrolls horizontally when there are many tabs. Admin is **an entry of the top switcher**,
  not a bottom-left "back" pill and not a separate site-style layout.
- `AppSpaceFrame` / `AppAdminFrame` own that chrome. **A feature flag, role or new module must
  never decide whether the app uses it** (a flag once replaced the whole app admin with the desktop
  sidebar; CI now guards this). New admin sections add a tab to the frame, they do not replace it.
- Everyone who uses a space must be able to reach it from the app: manufacturing sees print/laser
  as the role allows (both if both), and an admin can leave the admin space back to the student
  space.
- Cross-cutting chrome (top bar, bottom bar, drawers, dialog layer) is shared infrastructure.
  Changing it needs its own PR with before/after screenshots at phone and desktop width.

## 2. Components, never browser defaults

- Dropdowns: `components/ui/dropdown` (`<Dropdown>`). **No native `<select>`** (CI-enforced).
- Confirmations and prompts: `useAlert().confirm / prompt / showAlert / showError`.
  **No `window.confirm / prompt / alert`** (CI-enforced). Destructive actions use the app confirm
  dialog with a specific title ("이 대화를 삭제할까요?") and an explicit action label ("삭제").
- Buttons, inputs, dialogs, tables: `components/ui/*`. Do not restyle them per screen; extend the
  shared component if one is missing.
- Focus: no raw blue browser outline on buttons or inputs. Search/text fields that sit in a
  container use `data-no-focus-ring` and let the **whole box** show the focus ring.
- Scrollbars use the shared custom style (page and inner table scrollers alike).
- Login and sign-up forms look the same on every site, including the admin and developer portals.
  Reuse the shared auth frame and field styles.

## 3. Language and wording

- Student/researcher UI and the **app, including the app admin frame, are Korean**. The desktop
  admin portal (admin.cbgpu.com in a browser) and developer portal stay English by decision.
  Do not mix the two inside one screen.
- App tab and menu labels are **short Korean**, at most 12 characters, so they fit the bottom bar
  without wrapping ("배포" not "프론트엔드 배포", "가입 승인" not "Membership reviews").
  CI checks the app admin labels.
- Say what the user can do, not what the system is. Errors tell the next step; no raw provider
  messages. Never claim success before the server result is persisted.

## 4. Layout and type

- Mobile first: design at 360-430px wide, then check desktop. No horizontal page scroll, no text
  clipped by the bottom bar, safe-area insets respected.
- Text is never tiny: body 14px or larger, controls and tap targets at least 44px high. Footers
  and helper text are readable, not decoration. Keep headings in the same scale across screens
  (a settings page must not look bigger than the home it opens from).
- Spacing comes from the shared page gutters; tables and list rows breathe (comfortable row
  padding). Do not hard-code one-off margins to fix a single screen.
- Colors, radius and shadows come from tokens (`--primary`, `--border`, `--cb-control-radius`,
  ...). Hard-coded hex values only for brand artwork. Dark mode must work: placeholders and helper
  text stay legible.
- Motion is light (e.g. a short expand animation) and respects `prefers-reduced-motion`.

## 5. Home and navigation order

- The student home shows the everyday features first: 자습 신청, 시간표, 급식, 기상송, 자료 공유 as a
  **compact two-column grid on phones** (never one wide card per row). The owner uses these most;
  the first screen must show as many of them as possible.
- Anything that is not an everyday feature goes **below** them: the AI question box and its
  suggested questions, community entries, and "docs / research" links.
- **Owner correction (2026-11-18):** restore the existing single home advertisement immediately
  after the greeting/hero, before the feature directory, on web and app. This explicitly supersedes
  the earlier instruction to put home advertising below the features. Keep the supplied sizes,
  visible advertisement label and existing privacy/eligibility guards; do not add duplicate units.
- The plain feature search stays where it was (right above the features). The AI question box is
  not the search field.
- No category filter chips on the home (they belong to `/services`).
- Space order in the switcher: 학교생활, 연구·개발, 관리, 제작, 기상송.
- Usage data (accounts, sign-ins, requests, DB row counts) says the heavily used features are 기상송,
  자습, GPU, 3D print/laser and server projects. Rarely used ones (polls, preprints, file share,
  community) must not take first-screen space from them.

## 6. Notifications and deep links

- A push notification opens **the screen it is about, inside the app**, not just the app. Admin
  alerts link to the matching admin tab (e.g. signups) with `from=app`.

## 7. Before you say "done"

1. `npm test` (includes the UI convention tests) and `npx tsc --noEmit`.
2. **Open the screens you changed** at phone width and desktop width, in light and dark, and in
   the app WebView mode (`; wv)` user agent). `npm run build:demo` gives a synthetic local app;
   when a screen cannot be reached there, say so in the PR instead of guessing.
3. Attach screenshots for any visible change to an existing screen. Describe in the PR which
   existing screens your change touches, even indirectly (shared CSS, shared components).
4. Do not delete or rewrite someone else's UI work while adding a feature. If you must replace a
   pattern, update this document in the same PR.

## What CI checks, and what it does not

Layout (what sits where, how many columns, what is above the fold) is **not** tested in CI. It is
verified during development: open the screens (section 7) before you push. CI only runs cheap static
rules that behave like lint:

| Rule | Test |
| --- | --- |
| No native `<select>` | `tests/ui-conventions.test.mts` |
| No `window.confirm/prompt/alert` | `tests/ui-conventions.test.mts` |
| Feature flags must not decide whether the app admin frame is used | `tests/ui-conventions.test.mts` |
| App admin labels are short Korean | `tests/ui-conventions.test.mts` |
