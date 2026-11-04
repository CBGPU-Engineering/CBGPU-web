# Local site URLs

Run `npm run dev:sites` from this repository. The launcher runs one Next.js
process and maps local ports to the actual production Host headers. Application
routes, components and production domain checks are unchanged. Paths and queries
are preserved; the gateway also maps HTTP Location redirects between these sites.

| Production host | Local origin |
| --- | --- |
| cbgpu.com (student.cbgpu.com alias) | http://localhost:3000 |
| researcher.cbgpu.com | http://localhost:3001 |
| admin.cbgpu.com | http://localhost:3002 |
| app.cbgpu.com | http://localhost:3003 |
| docs.cbgpu.com | http://localhost:3004 |
| arxiv.cbgpu.com | http://localhost:3005 |
| manufacturing.cbgpu.com | http://localhost:3006 |
| print.cbgpu.com | http://localhost:3007 |
| laser.cbgpu.com | http://localhost:3008 |
| developers.cbgpu.com | http://localhost:3009 |

For example, `admin.cbgpu.com/admin/gpu` is `localhost:3002/admin/gpu`;
`docs.cbgpu.com/getting-started` is `localhost:3004/getting-started`.
There is no path-based override that turns the main site into the admin site.

The developer console is a separate Node service in CBGPU-backend, not a web
application route. Its local origin is http://localhost:3009; the gateway forwards it to the separate loopback service on port 3400. The currently
running console uses isolated temporary settings and has no production operators
or database/terminal access. Its service source is unchanged.

The launcher binds only to loopback. Port 3099 is the private Next.js origin;
open the site ports above instead. Real integration credentials belong in the
ignored local environment file, never in this launcher or Git. The launcher supplies NEXT_PUBLIC_CBGPU_SITE_ORIGINS to the shared siteHref
resolver. Workspace and publication links resolve to local origins during
development. Production links remain canonical when the setting is absent or
NODE_ENV is production. The gateway maps server HTTP redirects as well.
