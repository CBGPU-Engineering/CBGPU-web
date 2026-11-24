---
name: cbgpu-design-system
description: Implement and reuse CBGPU 2.0 components, tokens, and responsive structure in the isolated preview.
---

Read [DESIGN.md](../../../docs/redesign/DESIGN.md). Put shared styles in
`preview/app/preview.css` and reuse the components in `preview/components`.
Build with Next's /new base path and keep the existing app's global CSS,
asset graph, caches and service worker separate. Use the existing API
and account helpers for actual data. Treat role and school rules as
functional contracts and update the parity matrix with the verified scope.
