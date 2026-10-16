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
