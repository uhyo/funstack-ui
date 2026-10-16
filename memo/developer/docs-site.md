# Developer memo: docs site (#14), 2026-10-16

Branch `worktree-agent-afdf407a0e0018e46` (not pushed; the product owner merges). master (with
Tooltip) merged in before the docs commits.

## Shape

- `packages/docs` (package name `docs`), modelled on `~/repos/funstack-router/packages/docs`:
  `@funstack/static` 1.3.2 (`ssr: true`, `entries.tsx` / `build.ts` with sitemap), `@funstack/router`
  1.5.0 for client navigation (`ClientApp.tsx` copied), shiki `CodeBlock` as an async Server
  Component, same CSS modules (accent recoloured to the playground's orange) plus `styles/site.css`.
- Pages are TSX Server Components (no MDX, like the router docs). Routes in `App.tsx` via a small
  `page()` helper around `defer()`; nav in `navigation.ts`.
- Live examples: `src/examples/*.tsx` + `*.css`; pages import them and their source with `?raw`
  (`<Example source=… css=…>`), so the shown code is the running code. `AccordionFaq` and
  `TooltipToolbar` have no "use client" on purpose (Server Component demos).
- `Table` cells and string `PropsTable` descriptions go through `inline()` (backticks, `**bold**`,
  `[link](href)`). Reason: oxlint `react/jsx-key` flags JSX inside array literals.
- `.oxfmtrc.json`: `**/docs/**` also excluded `packages/docs`; changed to `docs/**` / `design/**`.
- No turbo.json / workspace changes needed: `packages/*` and the generic build/dev/typecheck
  tasks already cover it (`typecheck` depends on `^build`, so `@funstack/ui` dist exists).
- `wrangler.toml` with placeholder name `funstack-ui`, no account, no `wrangler` dependency.
  `SITE_URL` placeholder `https://ui.funstack.work` in `pageMeta.tsx`.

## Verification

- Playwright script (scratchpad, not committed) over a tiny static server mapping `/x` to
  `x.html`: every page loads with no console errors (no hydration mismatch); Toggle optimistic +
  `data-pending`; Tabs suspending panel keeps old panel then swaps; Tooltip hover opens,
  Escape closes; Accordion library mode pending then opens with content; sidebar client nav.
- `vite preview` cannot serve the pretty URLs (`/components/tabs` 404s; `.html` works but the
  Router then sees an unknown path). Cloudflare assets serve them. Dev server is fine.
- Tabs suspending demo: first panel needs no data, otherwise SSR would bake in data that the
  client cache does not have.

## Doc inconsistencies noticed (reported, not fixed)

- conventions 3.7 says Accordion reuses `keepMounted`; Accordion has none (design + code).
- conventions 4.1 lists `open` on the Accordion panel; Panel emits only `data-disabled`.
- tooltip.md still documents `Tooltip.Arrow` (held, conventions Q10) and `console.warn` dev
  warnings (code uses `console.error`); conventions Q11's "switch to name automatically" vs the
  explicit `provides` default.
- tabs.md section 6 says the List is a tab stop only while `value` is null; section 8 and the code
  also cover a value that matches no tab.

## Wave 2 pages (#32), 2026-10-16

Branch `worktree-agent-a8f5c68aadcab75ea` (not pushed). Written from the code at master 07f8cc9;
Dialog and RadioGroup reviews were still running, so props tables may need a touch-up after them.

- Pages: `DialogPage`, `SwitchPage`, `CheckboxPage`, `RadioGroupPage` (+ routes in `App.tsx`,
  nav in `navigation.ts`). Concepts updated: Action props (reason table incl. `"dismiss"`, form
  channel section, naming rows), Browser-owned state (Dialog per-direction table, native inputs =
  optimistic DOM as a correctness requirement, residual paths, consumer-owned mirrored
  `indeterminate`), Server Components (before-hydration rows, JS-free dialog example), plus the
  Transitions types table and the Experimental flags table (`experimental_closedBy`). Home and
  Roadmap (Deferred: #19/#20/#21; Next: #33, #35; Upstream: #16, #34).
- Examples: `DialogConfirm` (no "use client", JS-free), `DialogOrders`, `DialogProfile`,
  `SwitchSettings`, `SwitchForm`, `CheckboxSelectAll`, `CheckboxForm`, `RadioGroupTheme`,
  `RadioGroupRtl`, `RadioGroupForm`; CSS `dialog.css`, `switch.css`, `checkbox.css`,
  `radio-group.css`. Shared bits moved to `demo.css` (`.demo-button` is now inline-flex,
  `.demo-primary`, `.demo-danger`, `.demo-stack`, `.demo-field`).
- `Table` `head` cells are plain strings (no `inline()`): no backticks there.
- `.learn-content ul/p/h2` (0,1,1) beat a single example class; use `ul.demo-list` or rely on
  the examples' CSS being imported after `pages.css` for equal specificity.

### Verification notes

- Playwright scratch script (deleted): all 18 pages load with no console errors/warnings; Dialog
  JS-free confirm (open, Cancel, Delete returnValue), library mode (pending trigger while the
  content suspends, opens complete, initialFocus, Escape -> `reason="dismiss"`, focus return,
  cached re-open, backdrop light dismiss), Form (rejection inside the dialog keeps it open,
  success closes); Switch autosave/rollback/form submit + auto reset + Reset; Checkbox mixed
  parent (dash suspended while pending, rollback restores it), required/:user-invalid; RadioGroup
  pending on Root+Item, arrows, RTL ArrowLeft, required, reset log `"m" (platform, reset)`.
- **JS disabled does not show page content on this site**: `defer()` streams each page into
  `<div hidden id="S:0">` revealed by React's inline `$RC` script. JS-free demos therefore need
  JS enabled here (not the library's). Pre-hydration was tested by aborting `/assets/*.js`
  instead (inline scripts still run): JS-free Dialog and a native Switch work. Server Components
  page wording fixed accordingly.
- Async entanglement is visible in the docs: an RTL radio's controlled readout lags while another
  example's 800 ms save is pending (React commits entangled transitions together).
- Screens are in light and dark mode via `--color-*`; the dialog uses `var(--color-bg)`.
