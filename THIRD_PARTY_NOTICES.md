# Third-party components

Original web code is Apache-2.0. npm dependencies retain their package licenses;
consult package-lock.json, installed LICENSE/NOTICE files and the web SBOM emitted
by CI. Bundled fonts, icons and arcade assets retain their upstream notices.
Overleaf code is maintained separately in CBGPU-latex under AGPL-3.0 and is not
relicensed by this repository.

## Fonts

- **Pretendard Variable** (`src/app/fonts/PretendardVariable.woff2`) — Copyright (c) 2021 Kil Hyung-jin,
  SIL Open Font License 1.1. License text: `src/app/fonts/PRETENDARD-OFL.txt`.

## Product interaction libraries

- Motion14.14.0 — MIT, https://github.com/motiondivision/motion.
- overlay-kit1.9.0 — MIT, https://github.com/toss/overlay-kit.
- @use-funnel/core0.1.0 — MIT, https://github.com/toss/use-funnel.
- Lucide (existing) — ISC, https://github.com/lucide-icons/lucide.

Original feedback/empty-state SVG scenes remain CBGPU Apache-2.0 code; they do
not reuse Toss/Apple illustrations or third-party animation marketplace assets.

## Optional browser automation

- @sparticuz/chromium149.0.0 wrapper — MIT, https://github.com/Sparticuz/chromium.
- Chromium and its bundled NSS/NSPR, Expat and graphics libraries retain their
  upstream licenses and source notices; they are not relicensed as CBGPU code.
  See https://chromium.googlesource.com/chromium/src/+/main/LICENSE and the
  Chromium third-party credits for the exact browser build.
- Bundled Open Sans — Copyright 2020 The Open Sans Project Authors
  (https://github.com/googlefonts/opensans), SIL Open Font License1.1 as recorded
  in the font's name table; see https://github.com/googlefonts/opensans/blob/main/OFL.txt.

The container includes a hashed browser asset manifest and the wrapper's LICENSE
in /opt/cbgpu-browser. Browser assets are extracted only from the integrity-locked
npm package during build; runtime extraction into executable upload/temp storage
is not required. Review upstream browser component advisories separately from
the OS/npm vulnerability report before distributing a production image.
