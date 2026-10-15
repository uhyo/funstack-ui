# FUNSTACK family conventions (observed 2026-10-15)

Sibling repos: ~/repos/funstack-router, ~/repos/funstack-static, ~/repos/funstack-lp (landing page, Cloudflare).

- npm scope: `@funstack/*` (`@funstack/router`, `@funstack/static`). UI will likely be `@funstack/ui`.
- Layout: pnpm monorepo + Turbo. `packages/<core>`, `packages/docs` (built with @funstack/static, deployed via wrangler), `packages/example*`.
- Tooling: TypeScript strict + `verbatimModuleSyntax`, vitest (jsdom), oxlint, formatter = oxfmt (router, newer) / prettier (static). Playwright e2e in static.
- React 19.3+, Vite 8, TS 7.
- Commit messages: conventional commits; `docs`/`example` scopes for non-core packages, core left unscoped or scoped with package name.
- `.claude/`: settings.json, format hook (`.claude/hooks/format-files.sh`), skills: release-funstack (gh release, tag = `x.y.z`, no `v`), create-pr, docs-consistency, `<sibling>-knowledge` skills.
- Design docs live in `design/` (router) or `docs/` (static) as markdown.
- No PRs for this repo (per product-owner instructions): commit to master directly.
