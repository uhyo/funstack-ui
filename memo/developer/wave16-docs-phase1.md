# Wave 16 docs/example refactor (#103): HTML diff summary

Branch `wave16/docs-example`. Baseline: docs built on master d256271 before any change; after: the
branch head. Items: audit `memo/reviewer/refactor-audit-docs-example.md` D1-D7, D10, D11, E1-E6
(D8, D9 left as recommended).

## Procedure

- `pnpm --filter @funstack/ui build && pnpm --filter docs build`, copy `dist/public` to scratch
  `before/`; same for `after/`.
- Normalise hashed asset names (`/assets/x-HASH.js`), RSC payload file names, and React `useId`
  values (`_R_..._`), split tags onto lines, diff every `*.html` and `sitemap.xml`; file lists
  compared too.
- Expected changes filtered and counted separately: `<li class="docs-nav-group">` (D3) and
  `<td><code>–</code></td>` -> `<td>–</td>` (D4).

## Result

- Same 35 HTML files, identical `sitemap.xml`.
- After the filters: zero differences in every page.
- D3: `<li class="docs-nav-group">` on the 5 component groups of the sidebar, on all 34 pages that
  show the sidebar. Computed style in Chromium: margin-left 12px, 1px solid left border (the rule
  in layout.css finally matches).
- D4: the 6 cells (checkbox-group x2, checkbox, dialog, radio-group, switch) now render a plain
  `–` like every other row without a default; no `<code>–</code>` left.
- `useId` values differ on pages with examples. Cause: before, the RSC output of every page that
  imported a `?raw` file was wrapped in `[["$undefined"], <page>]` (the RSC plugin's resource slot
  for the page module's imports), an extra array level that is part of the id path. D1 removed the
  `?raw` imports from pages, so the wrapper went away and the ids shifted. D7 (DocPage) and D5
  (flat routes) shift them again for the same reason. Server and client render the same payload,
  so hydration is unaffected (no console errors on /components/button in Chromium).
- RSC payloads differ structurally for the same reasons (wrapper, DocPage nesting, chunk refs);
  their rendered HTML is what was compared.
- Client CSS `rsc-*.css`: 46754 -> 43589 bytes (D2).
- Leak check: `grep -rl "A pretend backend" dist/public/assets` is empty (example sources stay
  server-only).

## D10

`src/checkLinks.ts`, run by `build.ts` after `build()`; ~0.4 s. Verified it fails the build on a
broken page link (`/concepts/server-componentz`) and reports missing anchors (scratch test).
