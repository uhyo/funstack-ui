# #134 Markdown edition + #135 (developer part): skill installer and bundled docs

Branch `feat/134-ai-docs` (worktree), not merged; the PO merges after review. SKILL.md content is
the technical writer's (#135); this branch has a placeholder with valid frontmatter.

## What exists

- `packages/docs/src/markdown/htmlToMarkdown.ts`: rendered page HTML to Markdown with hast/mdast
  (`hast-util-from-html`, `hast-util-select`, `hast-util-to-mdast`, `mdast-util-to-markdown`,
  `mdast-util-gfm`, all docs devDependencies). Steps: put React's streamed Suspense content back
  (`$RC("B:0","S:0")`: the deferred page is NOT inside `<main>` in the HTML, it is a hidden
  `<div id="S:0">` at the end of body), take `<main>`, strip chrome (`.docs-sidebar`,
  `.example-preview`, `summary`, `.behaviour-index`, hero image/buttons, comments), shift headings
  so the page title is `#`, map links, add `<a id>` anchors for linked ids, convert with custom
  handlers: `div.code-block` -> fenced code with `title="File.tsx"` meta (language from the new
  `data-language` on CodeBlock), `aside.callout` -> blockquote led by `**Title**`, `dl` ->
  "- **term**: definition". Repeated titled code blocks on a page (shared demo CSS) become
  "`dialog.css`: the same file as above."
- `packages/docs/src/markdown/edition.ts`: called from build.ts after `build()`, before the link
  check. Writes `<page>.md` next to each html, `llms.txt`, `llms-full.txt` (navigation order,
  `URL:` line under each title, absolute links), and the same `.md` set to `dist/markdown`
  (stable intermediate for the npm package). Home page `index.md` gets an "All pages" index
  appended, so it is the entry point for both the site and `dist/docs/index.md`. Throws on a page
  with no content after its title or no description.
- `paths.ts`: `markdownFileOf`, `linkResolver` (relative `.md` links in pages, absolute in
  llms*). Kept free of node imports because pageMeta.tsx imports it.
- `pageMeta.tsx`: `<link rel="alternate" type="text/markdown" href="/x.md">` (checkLinks verifies it).
- Tests: `packages/docs/src/markdown/htmlToMarkdown.test.tsx` renders the real site components with
  `react-dom/static` `prerender` and converts them. `packages/docs/vitest.config.ts` (separate from
  vite.config.ts; `css: true` so `?raw` CSS imports return text; a tiny plugin makes
  `server-only` empty). docs got `test`, `test:run` and `test:jsdom` scripts (test:jsdom only so
  CI's `pnpm run test:jsdom` runs them; the env is node).
- ui: `src/bin/skill-installer.ts` (tsdown entry), `skills/funstack-ui-knowledge/SKILL.md`
  placeholder, `scripts/copy-docs.mjs` (prepack: docs/dist/markdown -> dist/docs, fails if
  missing), `scripts/check-pack.mjs` (`pnpm --filter @funstack/ui pack:check`, in CI and
  publish.yml), dependency `@funstack/skill-installer` ^1.1.0, `files` + skills.
- publish.yml builds `--filter=docs` (pulls in ui), then pack:check, then publish (prepack copies).

## Gotchas

- tsdown 0.23 `exports` auto-generates `bin` from a hashbang entry and names it after the package
  without scope ("ui"). Fixed with `exports.bin: { "funstack-ui-skill-installer": ... }` and
  `exports.exclude: ["bin/skill-installer"]`. check-pack asserts the bin name.
- hast-util-select `select()` returns `undefined`, not `null`; `matches()` rejects combinators.
- vitest skips CSS by default, so `?raw` of a .css is "" unless `test.css: true`.
- Cloudflare assets (wrangler dev, local): `.md` -> `text/markdown; charset=utf-8`, `.txt` ->
  `text/plain; charset=utf-8` with no config change.
- Verified the tarball end to end: `npx -p <tgz> funstack-ui-skill-installer` with
  `SKILL_INSTALL_PATH` installs `.claude/skills/funstack-ui-knowledge/SKILL.md`.
- All 436 relative links between the generated .md files resolve (file and anchor), checked with a
  throwaway script; not a build check.

## Sizes (2026-10-25)

llms.txt 8.7 kB, llms-full.txt 713 kB, dialog.md 43.5 kB (most of it demo source + CSS),
getting-started.md 5.8 kB, 34 pages.

## Excerpts

llms.txt:

    # FUNSTACK UI

    > FUNSTACK UI is a headless React component library and the first UI library that is Async React-native: ...

    Install with `npm install @funstack/ui@alpha`; React 19.3 or later is a peer dependency. ...

    ## Introduction

    - [Overview](https://ui.funstack.work/index.md): FUNSTACK UI is a headless React component library ...
    - [Getting started](https://ui.funstack.work/getting-started.md): Install @funstack/ui, import a component ...

    ## Concepts
    ...
    ## Optional

    - [Roadmap & changelog](https://ui.funstack.work/roadmap.md): Where FUNSTACK UI is heading, ...

components/dialog.md (props):

    ### `Dialog.Root`

    | Prop | Type | Default | Description |
    | - | - | - | - |
    | `open` | `boolean` | – | Controlled open state. undefined means uncontrolled. Selects library mode. |
    | `modal` | `boolean` | `true` | `showModal()` (top layer, backdrop, inert page, Escape) or `show()`. ... |

    - **State**: `DialogRootState` is `{ open, pending, modal }`; `open` is optimistic, ...
    - **Owned**: nothing rendered: the Root has no element (no `ref`, `className` or `style`).

getting-started.md:

    # Getting started

    Install the package, import a component from its subpath, and style it with CSS. ...

    ## Install

    ```bash
    npm install @funstack/ui@alpha
    ```

    > **Alpha**
    >
    > `@funstack/ui` is published as alpha releases under the `alpha` dist-tag; ...

## Follow-up (PO decisions, same day)

- llms-full.txt drops titled CSS blocks (example stylesheets) via `stylesheetsAt`, with a line
  linking the page's .md; untitled CSS snippets in prose stay. Saved only 713 -> 663 kB: the
  bulk is the TSX demo sources, not the CSS (my "halve it" estimate was wrong).
- CLAUDE.md updated (Markdown edition, docs tests, pack:check, publish building docs).
- packages/ui/README.md: stale component list replaced by a link to the docs.

## Open (initial report)

- CLAUDE.md not updated (docs tests, Markdown edition, pack:check): left for the PO.
- packages/ui/README.md still lists only 4 components ("Components: Toggle, Tabs, ...") - stale, not
  touched.
- SKILL.md points to node_modules/.../dist/docs/index.md; with `npx -p` and no local install that
  path does not exist; the writer may want the site URL (llms.txt) as fallback.
