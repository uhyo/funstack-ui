# Review: wave16/docs-example (#103, refactor #100)

Reviewed 3b314df against merge-base bb141f5. Date: 2026-10-24.
Verdict: merge after minor fixes (none blocking; M1 strongly recommended).

## Verification done (scratch worktrees, removed afterwards)
- Branch: pnpm build, typecheck, lint, format:check all pass.
- Built docs on base and branch. Normalised HTML diff (asset hashes, RSC payload hashes, useId,
  D3 class, D4 cells) over all 35 pages: zero differences. sitemap.xml identical. File list identical.
- D4: exactly 6 `<td><code>–</code></td>` on base (checkbox-group x2, checkbox, dialog,
  radio-group, switch), none on branch. D3: class present in sidebar.
- Client assets (public/assets): same file set, same sizes after hash normalisation except
  rsc-*.css (46754 -> 43589, D2) and rsc-*.js (+27 bytes = `className:"docs-nav-group"`; that is
  the only diff in the entry chunk). So: no example source in client JS, no new client chunks,
  the 8 "No use client" examples are still Server Components (no client chunk appeared for them).
- Example sources live only in dist/rsc/assets/Example-*.js (server). Per-page RSC chunks still
  exist (AccordionPage-*.js ... 35 pages): pages are still lazily split.
- D2: none of the removed selectors' class tokens occurs in base HTML or client JS.
- `import "server-only"` in sources.ts: build passes; adding a "use client" importer makes the
  build fail with plugin-rsc's validate-imports error. tsc then needs a declaration (TS2882).
- checkLinks: shiki escapes quotes and splits attribute names into spans; React escapes `"` in
  text; so code samples cannot create false href/id matches.

## Findings
M1 (minor, recommended) server-only is a comment, not a guard. Example.tsx also exports Callout,
  a generic prose component imported by ~25 pages; a future client component importing Callout
  (or Example) would ship every example source. Add `import "server-only";` to sources.ts
  (plugin-rsc resolves it natively; verified it fails the build on a client importer) plus a
  `declare module "server-only";` in a .d.ts or the `server-only` devDependency for tsc.
  Optionally move Callout out of Example.tsx.
m2 checkLinks.ts:365 `decodeURIComponent` throws URIError on a malformed `%` in a fragment,
  aborting with a stack trace instead of a broken-link message. Hrefs with `?query` are reported as
  missing pages. Neither occurs today. Not tested by a unit test (manual check only).
m3 App.tsx page(): a name typo throws at App module evaluation (whole site/dev server fails, build
  fails: fine); missing export throws in lazy (render error -> build fails: fine). Lost compile-time
  check accepted per audit D5. No action.
n4 Playground visual changes (intended, in commit body): 10 demos now article.demo, so their
  inner sections gain 1.5rem margin-block. Console/error text of button demo changes to
  `[button] saving "Save"` / `the server rejected "Reject"` (label passed as value). Fine.
n5 select-demo.tsx still renders `<span className="sel-spinner" aria-hidden />` inline while
  dialog/tabs use `<Spinner className=...>`. Cosmetic inconsistency.
n6 sources.ts glob covers DemoErrorBoundary.tsx and demo.css (never shown) and excludes .ts
  (fake-api.ts cannot be shown; a clear error if anyone tries). Fine.

## Not issues
- Example files in src/examples untouched (diff limited to sources.ts): reader-visible code unchanged.
- toolbar-demo now imports menu-demo.css/tooltip-demo.css; they were already loaded earlier by
  App import order, so CSS cascade order unchanged.
- Shared demo.css imported in main.tsx before App: no other stylesheet redefines .spinner,
  .error-box, .readout, .inline-error, so cascade unchanged.
- sl- -> sel- rename removes the select/slider prefix collision.
