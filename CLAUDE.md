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
- `pnpm test:browser` - Run only the browser tests (headless Chromium via Playwright)
- `pnpm typecheck` - Type check all packages
- `pnpm lint` - Lint code with oxlint
- `pnpm format` - Format code with oxfmt
- `pnpm format:check` - Check formatting

All of `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, and `pnpm build` must pass before committing. CI runs the same commands (with `test:run` split into `test:jsdom` and `test:browser`).

### Package-specific commands

- `pnpm --filter @funstack/ui build` - Build the ui package
- `pnpm --filter @funstack/ui test` - Test the ui package
- `pnpm --filter @funstack/ui test:browser:dev` - Browser tests in watch mode with a visible Chromium window
- `pnpm --filter @funstack/ui exec playwright install chromium` - One-time download of the Chromium build the browser tests need (CI adds `--with-deps`)
- `pnpm --filter funstack-ui-example dev` - Run the playground dev server

### Docs site

`packages/docs` is the public documentation site, following the FUNSTACK family pattern (same structure as the FUNSTACK Router docs): built with `@funstack/static` (React Server Components, pre-rendered to static HTML with `ssr: true`), client navigation with `@funstack/router`, code highlighted at build time with shiki. Pages are Server Components in `src/pages/`; routes and the sidebar live in `src/App.tsx` and `src/navigation.ts`.

- `pnpm --filter docs dev` - Dev server (build `@funstack/ui` first, or run `pnpm dev` from the root, which also watches the library)
- `pnpm --filter docs build` - Static build into `packages/docs/dist/public` (root `pnpm build` includes it)
- Live examples are files in `src/examples/` that render the real `@funstack/ui` (`workspace:*`) with fake async actions; pages show their source through Vite `?raw` imports, so the code shown is the code running. Examples without `"use client"` (the JS-free Accordion, the Tooltip toolbar) are deliberately Server Components.
- Props tables are written by hand from the TypeScript declarations in `packages/ui`: update the component page whenever a public prop, state field, data attribute or default changes.
- Deployment is not configured yet (`wrangler.toml` has a placeholder name); CI only builds the site.

### Browser tests

`packages/ui/vitest.config.ts` defines two vitest projects. `*.test.tsx` files run in the `jsdom` project; `*.browser.test.tsx` files run in the `browser` project, which uses `@vitest/browser-playwright` in headless Chromium. Both share `src/__tests__/vitest.setup.ts` and Testing Library. Use a browser test only for behaviour jsdom cannot observe (Popover API and `:popover-open`, CSS anchor positioning, `interestfor`, ViewTransition); keep everything else in jsdom, which is much faster. Firefox and WebKit instances are configured but off by default: `BROWSERS=chromium,firefox,webkit pnpm --filter @funstack/ui test:browser` after `pnpm --filter @funstack/ui exec playwright install firefox webkit`.

## Tooling

- TypeScript (strict, `verbatimModuleSyntax`), built with tsdown to ESM only
- vitest with jsdom and Testing Library, plus vitest browser mode (Playwright, Chromium) for `*.browser.test.tsx`; `@testing-library/jest-dom` matchers are set up in `packages/ui/src/__tests__/vitest.setup.ts`
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

### Agent memos

Agents keep personal working notes in `memo/<role>/` (for example `memo/developer/`, `memo/product-owner/`). Create the directory if it does not exist. Do not edit another role's memos.
