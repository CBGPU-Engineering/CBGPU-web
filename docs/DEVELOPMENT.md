# Local development

## Try the demo

Use Node.js 22.18 or newer and npm. No school account, Docker, database, GPU,
Firebase credentials or production environment file is required.

```bash
git clone https://github.com/CBGPU-Engineering/CBGPU-web.git
cd CBGPU-web
npm ci
npm run demo
```

Open **http://localhost:3100**, sign in with `student@example.invalid` or
`researcher@example.invalid`, password **`demo-only`**. These are synthetic local
accounts, not credentials accepted by the real website.

The demo uses the existing web UI and a loopback-only fixture API on port 54329.
The two ports must be free. The orange demo notice stays visible. The school clock
is fixed to November 3, 2026; application windows are open in the fixture.

Try signing in, opening the GPU reservation view, or opening self-study, connecting
the demo school identity, choosing a room/seat/teacher and applying or canceling.
Data lives only in memory and resets when the process restarts. Unsupported API
operations return 501, rather than forwarding to production.

Jupyter kernels, actual deployment builds, operator shells, email, push,
3D printing, laser cutting and Overleaf compilation are not started. The demo
is a contribution sandbox, not a replacement for integration tests or production
Supabase. Its known credentials and simulated responses must never be used as
production authentication. Demo builds reject non-loopback hostnames.

```bash
npm test
npm run build:demo
npm run start:demo
```

`build:demo` uses `.next-demo`, so it does not overwrite the normal production
build. The launcher injects placeholder-only environment values into child
processes; it never writes `.env.local`. It refuses checkouts containing real
`.env` files and does not inherit service credentials from the parent environment. Do not publish a demo build on a server.

The browser smoke test uses Playwright's Chromium installation:

```bash
npx playwright install chromium
# In another terminal, run npm run start:demo first.
node scripts/demo-smoke.mjs
```

For the complete Docker demo use [CBGPU-platform](https://github.com/CBGPU-Engineering/CBGPU-platform),
then `docker compose -f compose.demo.yml up --build`.

## Work on a real integration

Use your own isolated backend. Copy `.env.example` to `.env.local`, configure
keys for that backend and start `npm run dev`. Do not point a local experiment
at the school's live database. Backend setup and migration notes are in
[CBGPU-backend](https://github.com/CBGPU-Engineering/CBGPU-backend). GPU, operator, mail, deployment and
LaTeX services require their own setup and verification.

The frontend includes host-dependent routing. See [SELF_HOSTING.md](SELF_HOSTING.md)
for adapting domains and identity to another school. See [CONTRIBUTING.md](../CONTRIBUTING.md)
for checks and the review process.
