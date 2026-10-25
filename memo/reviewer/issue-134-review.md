# Review: #134 Markdown edition + #135 developer part (branch `feat/134-ai-docs`)

Reviewed 2026-10-25: df1c31c and the follow-up dfebd4e (CLAUDE.md, packages/ui/README.md
component list, demo stylesheets dropped from llms-full.txt via `stylesheetsAt`). Built in a
separate worktree; after dfebd4e: 9 converter tests pass, llms-full.txt 663 kB (was 713 kB), 0
titled CSS blocks left in it (49 stylesheet references), per-page `.md` keeps them, links still
436/0 broken.

## Verdict

**Acceptable with minor fixes.** Nothing blocking. The Markdown edition is faithful and clean,
packaging works end to end, publish cannot ship without docs.

## What I verified

- Content fidelity, all 34 pages, by script: every HTML text node of 25+ characters inside `<main>`
  (plus the streamed `S:0` segment), minus the stripped chrome, appears in the `.md`. One miss,
  which is a site bug, not the converter (finding 2). Code blocks: every `div.code-block` maps to a
  fence or a "same file as above" line (fences inside callouts are `> ````).
- Read end to end: llms.txt, index.md, getting-started.md, concepts/pending-and-optimistic.md;
  props/data attribute sections of dialog.md, headings and structure of combobox, select, field,
  progress. Props tables are GFM tables with `\|` in types, State/Owned facts as a list, callouts as
  `> **Title**` blockquotes, terms as `- **term**: definition`, inline code kept, headings shifted
  so the page title is the only `#`. No chrome ("Show code", sidebar, header, footer, live demo DOM)
  left.
- Links: 436 relative links in `dist/markdown`, 0 broken (file and anchor; own script, slug +
  `<a id>`). Absolute links in llms-full.txt point to `https://ui.funstack.work/<page>.md#frag`.
- `<link rel="alternate" type="text/markdown">` on every page; not on 404. `dist/markdown` holds
  exactly the same `.md` set as `dist/public`.
- llms.txt follows llmstxt.org (H1, blockquote summary, detail paragraph, H2 file lists,
  "Optional" for Resources).
- Converter tests: 8 pass, rendered from the real site components with `prerender`; streamed
  boundary and failure modes (no main, no heading, unresolved Suspense) covered. typecheck, lint,
  format:check pass.
- Packaging: `pack:check` OK (787 files, 34 docs). Real `pnpm pack`: tarball has
  `skills/funstack-ui-knowledge/SKILL.md`, `dist/bin/skill-installer.mjs` (hashbang), `dist/docs/*.md`,
  README; `bin` = `funstack-ui-skill-installer`, no `./bin/...` entry in `exports`.
  `npx -y -p <abs tgz> funstack-ui-skill-installer` with `SKILL_INSTALL_PATH=.claude/skills`
  installs `.claude/skills/funstack-ui-knowledge/SKILL.md`. `@funstack/skill-installer` has no
  dependencies (same as FUNSTACK Router).
- Publish ordering: publish.yml builds `--filter=docs` (which builds ui via `^build`), pack:check,
  then `pnpm publish`, whose `prepack` copies `docs/dist/markdown` and exits 1 if `index.md` is
  missing, so a publish without docs aborts. No package dependency cycle (ui reads the docs output
  by path only). tsdown rewrites `bin` into package.json on build; the committed file matches
  (worktree clean after build).
- Wrangler: no config needed; the developer checked `.md` -> `text/markdown; charset=utf-8`, `.txt`
  -> `text/plain` under `wrangler dev`. llms-full.txt (713 kB before the CSS drop) is far below the
  asset size limit.

## Findings (minor, by severity)

1. **Raw HTML in index descriptions.** `packages/docs/src/markdown/edition.ts:332-334` (`indexList`)
   writes the meta descriptions verbatim into llms.txt and index.md's "All pages":
   `<dialog>`, `<select>`, `<details>/<summary>`, `<input type=checkbox>`, `<fieldset>`,
   `<ViewTransition>`. An agent reading raw text is fine, but any Markdown renderer (GitHub, an IDE
   preview of `node_modules/@funstack/ui/dist/docs/index.md`, llms.txt viewers) treats them as HTML:
   `<select>`/`<dialog>` render as elements and swallow the rest of the line. The page bodies
   escape them (`\<ViewTransition>`). Fix: escape `<` in descriptions, or build the list as mdast and
   serialize with `toMarkdown`.
2. **Site bug, not this branch:** `packages/docs/src/pages/ToastPage.tsx:257` puts Markdown
   backticks in a `default` cell that is already rendered as code, so the site shows literal
   backticks and the `.md` gets `` `` Viewport `duration`; ... `` ``. Fix the page string.
3. **Streamed content: only `$RC` handled.** `htmlToMarkdown.ts:541-551`. A segment completed with
   `$RS` (placeholder `<template id="P:n">`) would be dropped silently; only `template[id^="B:"]`
   fails the conversion (`:692`). Today's pages lose nothing (checked), but the failure mode is
   silent. Also throw on a remaining `template[id^="P:"]` or a leftover `div[hidden][id^="S:"]`.
4. **edition.ts has no test** (llms.txt shape, "All pages" append, the empty-page and
   no-description throws). The throws are simple and run on every build, so low risk.
5. **Stylesheet drop keyed on `lang === "css"` + a title** (follow-up `shortenCodeBlocks`), not on
   being inside `.example-source`. Correct today (only `Example` titles its code blocks); a titled
   CSS block in prose would be dropped from llms-full.txt. Note: some example stylesheets carry
   real knowledge (anchor positioning for Tooltip/Popover); the replacement line links the page's
   `.md`, which is a reasonable trade.
6. `packages/docs` `test:jsdom` runs node-environment tests and, through turbo's
   `dependsOn: ["^build", "build"]`, now makes CI's test step build the whole docs site (cached for
   the Build step, so little net cost). Acceptable; documented in the follow-up CLAUDE.md.
7. `packages/ui/scripts/check-pack.mjs:27` finds the JSON by `indexOf("\n{")` after prepack's
   output. Fragile against pnpm output changes, but it fails loudly, never passes wrongly.
8. `dist/bin/skill-installer.d.mts` (+ maps) ship in the tarball. Harmless.
9. `packages/ui/README.md` (dfebd4e): "See the [component list](https://ui.funstack.work/components/button)"
   links the Button page, not a list. Link the home page's Components section or llms.txt.

## Not in this branch (scope check)

- SKILL.md is a placeholder (technical writer, #135).
- The "Using with AI agents" docs page (Guides) asked for in #135 is not here; confirm owner.
- The SKILL.md pointer to `node_modules/.../dist/docs/index.md` does not exist after an `npx -p`
  install without a local dependency; the writer should add the llms.txt URL as fallback (the
  developer flagged this too).
