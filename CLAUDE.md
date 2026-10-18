# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FUNSTACK UI (`@funstack/ui`) is a headless UI component library for React and the first UI library that is Async React-native: Suspense-native, transition-by-default, action props instead of event handlers, `<ViewTransition>` built in, and greedy adoption of modern HTML/CSS. It is part of the FUNSTACK family alongside [FUNSTACK Router](https://github.com/uhyo/funstack-router) and [FUNSTACK Static](https://github.com/uhyo/funstack-static). **`docs/vision.md` is the source of truth for principles, browser support policy, and scope**; read it before designing or implementing anything.

The project is experimental.

## Monorepo Structure

This is a pnpm monorepo managed with Turbo:

- `packages/ui` - The main `@funstack/ui` package
- `packages/example` - Vite + React playground that consumes `@funstack/ui` via `workspace:*`
- `packages/docs` - The documentation site (package name `docs`), built with FUNSTACK Static
- `docs/` - Vision, design documents, and research notes (markdown)
- `memo/<role>/` - Working notes kept by each agent role (see Conventions)

## Commands

- `pnpm build` - Build all packages
- `pnpm dev` - Build all packages in watch mode
- `pnpm test` - Run tests in watch mode
- `pnpm test:run` - Run all tests once (jsdom and browser projects)
- `pnpm test:jsdom` - Run only the jsdom tests
- `pnpm test:browser` - Run only the browser tests (headless Chromium, Firefox and WebKit via Playwright; see Browser tests)
- `pnpm typecheck` - Type check all packages
- `pnpm lint` - Lint code with oxlint
- `pnpm format` - Format code with oxfmt
- `pnpm format:check` - Check formatting

All of `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, and `pnpm build` must pass before committing. CI runs the same commands (with `test:run` split into `test:jsdom` and `test:browser`).

### Package-specific commands

- `pnpm --filter @funstack/ui build` - Build the ui package
- `pnpm --filter @funstack/ui test` - Test the ui package
- `pnpm --filter @funstack/ui test:browser:dev` - Browser tests in watch mode with a visible Chromium window
- `pnpm --filter @funstack/ui exec playwright install chromium firefox webkit` - One-time download of the engine builds the browser tests use (add `--with-deps` to install their system libraries; WebKit needs it on most Linux machines)
- `pnpm --filter funstack-ui-example dev` - Run the playground dev server

### Docs site

`packages/docs` is the public documentation site, following the FUNSTACK family pattern (same structure as the FUNSTACK Router docs): built with `@funstack/static` (React Server Components, pre-rendered to static HTML with `ssr: true`), client navigation with `@funstack/router`, code highlighted at build time with shiki. Pages are Server Components in `src/pages/`; routes and the sidebar live in `src/App.tsx` and `src/navigation.ts`.

- `pnpm --filter docs dev` - Dev server (build `@funstack/ui` first, or run `pnpm dev` from the root, which also watches the library)
- `pnpm --filter docs build` - Static build into `packages/docs/dist/public` (root `pnpm build` includes it)
- Live examples are files in `src/examples/` that render the real `@funstack/ui` (`workspace:*`) with fake async actions; pages show their source through Vite `?raw` imports, so the code shown is the code running. Examples without `"use client"` (the JS-free Accordion, the Tooltip toolbar) are deliberately Server Components.
- Props tables are written by hand from the TypeScript declarations in `packages/ui`: update the component page whenever a public prop, state field, data attribute or default changes.
- Deployed to Cloudflare Workers, following the other FUNSTACK repositories:
  - Production: worker `funstack-ui` (`packages/docs/wrangler.toml`) at https://ui.funstack.work, deployed by `.github/workflows/deploy-docs.yml` when a GitHub release is created (or by manual `workflow_dispatch`). It runs `pnpm turbo run build --filter=docs`, then `pnpm wrangler deploy` in `packages/docs`, using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.
  - Dev: worker `funstack-ui-dev` (`packages/docs/wrangler-dev.toml`), deployed on every push by Cloudflare's own Git integration (Workers Builds), configured on the Cloudflare side. Build command (from the repository root): `pnpm install --frozen-lockfile && pnpm turbo run build --filter=docs`; deploy command: `cd packages/docs && npx wrangler deploy -c wrangler-dev.toml`.
  - CI on push only builds the site.

### Browser tests

`packages/ui/vitest.config.ts` defines two vitest projects. `*.test.tsx` files run in the `jsdom` project; `*.browser.test.tsx` files run in the `browser` project, which uses `@vitest/browser-playwright` with one instance per engine (Chromium, Firefox, WebKit). Both share `src/__tests__/vitest.setup.ts` and Testing Library. Use a browser test only for behaviour jsdom cannot observe (Popover API and `:popover-open`, CSS anchor positioning, `interestfor`, ViewTransition); keep everything else in jsdom, which is much faster.

Engine selection: `FUNSTACK_BROWSERS=chromium,firefox,webkit` (any subset) picks engines explicitly and fails if one is missing; with it unset, CI (`CI` set) runs all three and a local run uses Chromium plus every other engine whose Playwright build is installed and passed Playwright's host-dependency check. CI runs one job per engine. Browser tests must pass on all three: where engines legitimately differ (`interestfor` is Chromium-only, Safari 27.0 lacks `popover="hint"`), branch on the feature checks in `src/__tests__/engine.ts` and assert the documented degraded behaviour rather than skipping; `server.browser` from `vitest/browser` names the engine when no feature check fits. Firefox runs its browser test files serially (`fileParallelism: false` on that instance) because headless Firefox shares one mouse and pointer-capture state between pages, so another file's Playwright pointer input would land in a running drag or click (#62). Findings are in `memo/developer/cross-engine.md`.

## Release

Releases are made with the `release-funstack` skill (`.claude/skills/release-funstack/SKILL.md`): bump `version` in `packages/ui/package.json`, commit `chore: bump version to x.y.z`, then create a GitHub release with tag `x.y.z` (no `v` prefix). Creating the release triggers two workflows:

- `.github/workflows/publish.yml` builds and publishes `@funstack/ui` to npm. Versions containing `-` (for example `0.1.0-alpha.0`) are published under the prerelease name as the dist-tag; others under `latest`.
- `.github/workflows/deploy-docs.yml` deploys the docs site to the production worker (see Docs site).

Never publish or deploy from a local machine. One-time setup outside the repo:

- npm trusted publishing must be configured on npmjs.com for `@funstack/ui`, pointing at the GitHub repository `uhyo/funstack-ui` and workflow `publish.yml`. The workflow authenticates through OIDC (`id-token: write`) and needs no npm token.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets for `deploy-docs.yml` (production worker `funstack-ui`, custom domain `ui.funstack.work`).
- Cloudflare Workers Builds connected to this repository for the `funstack-ui-dev` worker, with the deploy command `npx wrangler deploy -c wrangler-dev.toml` (see Docs site).

## Tooling

- TypeScript (strict, `verbatimModuleSyntax`), built with tsdown to ESM only
- vitest with jsdom and Testing Library, plus vitest browser mode (Playwright: Chromium, Firefox, WebKit) for `*.browser.test.tsx`; `@testing-library/jest-dom` matchers are set up in `packages/ui/src/__tests__/vitest.setup.ts`
- oxlint for linting, oxfmt for formatting (`docs/`, `memo/`, and `.claude/agents/` are excluded from formatting)
- React `>=19.3` is a peer dependency; the library relies on React 19.3 features such as `<ViewTransition>`

## Conventions

### Code

- TypeScript strict mode with `verbatimModuleSyntax`: use explicit `import type` for types.
- Relative imports inside `packages/ui` use explicit `.js` extensions (`moduleResolution: nodenext`).
- Tests are colocated with the code they test (`foo.tsx` next to `foo.test.tsx`).
- Follow the principles in `docs/vision.md`: action props (`fooAction`) rather than `onFoo` handlers, transitions by default, pending state exposed, accessibility per WAI-ARIA Authoring Practices.

### Commit Messages

- Use conventional commits format: `type(scope): description`.
- Scopes: `ui` for the core package (may also be left unscoped), `example` for the playground, `docs` for documentation.
  - `feat(ui): add Toggle component`
  - `fix(example): update dependencies`
  - `docs: clarify transition principle`
- Commit directly to `master`; this repo does not use pull requests.
- Stage only the files you changed with `git add <paths>`. Never use `git add -A` or `git add .`, because other agents may be working in the same checkout concurrently.
- The git index is shared as well: don't leave staged changes behind (avoid `git mv`/`git rm` unless you commit right away), and commit with `git commit <paths>` so another agent's staged change is not swept into your commit.

### Agent memos

Agents keep personal working notes in `memo/<role>/` (for example `memo/developer/`, `memo/product-owner/`). Create the directory if it does not exist. Do not edit another role's memos.
