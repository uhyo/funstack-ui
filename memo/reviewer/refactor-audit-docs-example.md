# Refactor audit: packages/docs and packages/example (issue #100)

Scope: code structure only (no prose). Auditor: reviewer. Date: 2026-10-24.
Baseline: master at 1208aa2. Built output inspected: packages/docs/dist/public (build of 2026-10-23).

Summary of what is already in good shape (no action):
- No dead files. Every file in docs/src/examples, docs/src/components and docs/src/pages is imported
  by something (grep of every basename).
- No unused classes in docs/src/examples/*.css (every selector class appears in an example or page).
- docs examples already share `examples/fake-api.ts` (sleep, fakeSave, fakeUpload; 43 importers) and
  `examples/DemoErrorBoundary.tsx` (10 importers). Nothing to consolidate there.
- Every `<Example source fileName css cssFileName>` pairing is consistent today (scripted check:
  fileName matches the `?raw` import path, cssFileName matches the css import, child component name
  matches the file). D1 removes the possibility of drift rather than fixing an existing one.
- Raw sources do not leak into client JS (grep of dist/public/assets for a comment that exists only
  in fake-api.ts source: no hit). Keep it that way (see D1 risk).
- No broken internal links or anchors in the current build (script over dist/public: 35 pages, all
  `href="/..."` and `#id` targets resolve). See D10 for making this a check.

Priorities: P1 = do in this wave, P2 = worth doing, P3 = optional / only if touching the area.

---------------------------------------------------------------------------------------------------
## Docs site (packages/docs)

### D1 (P1) Example source lookup by file name instead of a `?raw` import per file
Files: every component page in src/pages/*.tsx (87 `?raw` import lines total; 60 `<Example>` uses,
49 of them with `css`/`cssFileName`), src/components/Example.tsx:4-32, ButtonPage.tsx:275,
ToastPage.tsx:71 (`<CodeBlock title="X.tsx">{xSource}</CodeBlock>`).
Today each example costs 2 imports (component + `?raw`) plus a 6-7 line call, e.g. DialogPage.tsx:32:
    <Example
      source={dialogConfirmSource}
      fileName="DialogConfirm.tsx"
      css={dialogCss}
      cssFileName="dialog.css"
    >
      <DialogConfirm />
    </Example>
Change: add a server-only module `src/examples/sources.ts`:
    const sources = import.meta.glob<string>("./*.{tsx,css}", { query: "?raw", import: "default", eager: true });
    export function exampleSource(file: string): string {
      const source = sources[`./${file}`];
      if (source === undefined) throw new Error(`No example file ${file}`);
      return source;
    }
and change Example to `{ file: string; css?: string; children }` (file name doubles as the title):
    <Example file="DialogConfirm.tsx" css="dialog.css">
      <DialogConfirm />
    </Example>
plus a small `<ExampleSource file="ButtonCssPending.tsx" />` (or `CodeBlock` with `file`) for the two
source-only blocks. Keep the live component import explicit (type-checked, keeps the client
reference graph obvious; do NOT render components through the glob).
A typo becomes a build failure (render errors fail the build, build.ts:21).
Saves: ~87 import lines + ~4-5 lines x 49 css examples + ~1 line x 11 others => ~330 lines across 25
pages; Example.tsx grows ~5 lines; new module ~12 lines.
Risk: (a) HTML must be byte-identical: titles and code are the same strings. (b) `sources.ts` must only
ever be imported from Server Components; if a "use client" module imported it, every example source
would ship to the browser. Add a one-line comment at the top of sources.ts saying so. (c) eager glob
pulls all sources into each page's server chunk: irrelevant for a static build.
Verify: HTML diff procedure below (expect zero diff) and
`grep -rl "A pretend backend" packages/docs/dist/public/assets` stays empty.

### D2 (P1) Remove dead CSS left over from the shared FUNSTACK docs template
Classes with no element anywhere in docs/src (checked against every className in pages, components,
examples; also not produced by the Callout/nav code):
- src/styles/components.css:48-64 `.feature-card*` (17 lines)
- src/styles/components.css:94-149 `.api-nav*` (incl. `.nav-group-label`), `.api-item*` (56 lines)
- src/styles/pages.css:80-114 `.selling-points`, `.selling-point*`, `.features`, `.feature-grid`,
  `.quick-start` (35 lines)
- src/styles/pages.css:116-209 `.api-overview*`, `.api-category*`, `.learn-overview*`,
  `.learn-category*` (~94 lines)
- src/styles/responsive.css:48-69 `.mobile-nav-link*` (22 lines) and :92-94 `.feature-grid` (3 lines)
- src/styles/site.css:21 `.mobile-nav-link.active` (selector half; keep `.nav-link.active`) and
  :44-55 `.status-badge` (12 lines)
Saves ~240 CSS lines. Do not touch `.page` (NotFoundPage, HomePage), `.button.*` (HomePage,
NotFoundPage), `.callout.warning`/`.note` (built from `kind`).
Risk: none if the list is right; the classes are never emitted. Verify: HTML diff is trivially zero;
additionally collect every class token from dist/public/**/*.html and the client chunks
(`grep -ohE 'className:`[^`]*`|className:"[^"]*"' assets/*.js`) and confirm none of the removed
names occur. Note for the lead: site.css:1 says these files are "the shared FUNSTACK docs layout";
if the user wants to keep them byte-aligned with the Router/Static docs for future syncing, skip D2
and say so in the issue instead.

### D3 (P1, behaviour fix, not a pure refactor) `.docs-nav-group` never matches
src/styles/layout.css:177 `.docs-nav-group > .docs-nav-list { margin-left; padding-left; border-left }`
targets a class that no element has: DocsNav.tsx:78 renders `<li key={group}>` without a className.
So the grouped component list ("Buttons", "Overlays", ...) is not indented and has no guide line,
which the CSS clearly intends. Fix: `className="docs-nav-group"` on that `<li>`. This changes the
sidebar's look (intended); it must be called out as a fix in the commit, not hidden in a refactor.
Alternatively delete the rule if the flat look is now the desired one (ask the technical writer).
Size: 1 line. Verify: sidebar screenshot before/after.

### D4 (P2, visible inconsistency) Explicit `default: "–"` renders as `<code>–</code>`
PropsTable (Tables.tsx:59) already renders a plain "–" when `default` is undefined, but five rows set
`default: "–"` and so render the dash in <code>, unlike every other row:
CheckboxPage.tsx:148, CheckboxGroupPage.tsx:16 (transitionRow, used twice), DialogPage.tsx:283,
RadioGroupPage.tsx:184, SwitchPage.tsx:100. Confirmed in the build: `<td><code>–</code></td>` occurs
6 times in components/{checkbox-group(2),checkbox,dialog,radio-group,switch}.html and nowhere else.
Change: delete those 5 lines. HTML changes in exactly those 6 cells (expected; list them in the diff
review). Optionally make `default?: string` reject "–" (not worth a type trick; the delete suffices).

### D5 (P2) App.tsx route table: drop the duplicated path, the nested Outlet routes and the 35 lazyPage stanzas
src/App.tsx:10-69 (35 near-identical `lazyPage(() => import("./pages/XPage.js"), "XPage")`, many
formatted over 4 lines) and :72-200 (`page(path, fullPath, Page, name)` where fullPath = parent prefix
+ path and name = the export name; the `/concepts` and `/components` groups exist only to add a
prefix, App.tsx:99-191).
Change, either step alone is fine:
 1. Flatten: leaf routes take their full path directly under the DocsLayout route
    (`page("/components/button", ButtonPage, "ButtonPage")`), removing the `fullPath` parameter and
    the two pathless-prefix `route({ path, component: <Outlet />, children })` wrappers.
    collectPaths (entries.tsx:6-25) already handles flat leaves.
 2. Load by name: `const pageModules = import.meta.glob<Record<string, ComponentType>>("./pages/*Page.tsx");`
    and `page("/components/button", "ButtonPage")` builds the lazy component and the defer name from
    the one string.
Saves ~110 of 204 lines. Risk: route matching must be unchanged (the router matches nested and flat
equally for these static paths, but verify); entries list must be identical (compare
`collectSitePaths()` output / the set of files in dist/public and sitemap.xml before and after);
deferred chunk names come from `name`, which stays the same. Step 2 loses the compile-time check
that the export exists; mitigate with a throw in the loader (build fails). If the lead prefers
type safety, do step 1 only (~60 lines).

### D6 (P2) Site constants in one place
- src/pageMeta.tsx:1 comment "Placeholder until the deployment target is decided (see wrangler.toml)"
  is stale: ui.funstack.work is live (CLAUDE.md, wrangler.toml).
- src/Root.tsx:13,15 hard-code `https://ui.funstack.work/FUNSTACK_UI_Hero_small.png` instead of
  using SITE_URL; Root.tsx:12 repeats "FUNSTACK UI", which PageHead.tsx:1 has as SITE_NAME.
Change: a tiny `src/site.ts` exporting SITE_URL, SITE_NAME (and the OG image URL built from
SITE_URL); pageMeta.tsx, PageHead.tsx, Root.tsx and build.ts import from it. Fix the comment.
Saves ~0 lines; removes 3 duplicated literals. Risk: none; HTML diff must be zero.

### D7 (P3) Component page shell
All 23 component pages open with the same 6-8 lines (e.g. TabsPage.tsx:15-21, ToastPage.tsx:19-25):
`<div className="learn-content"><PageHead title description /><h2>{title}</h2><p className="page-intro">`.
A `<ComponentPage title description intro={...}>` would save ~4 lines per page (~90 total) and pin the
title/h2 equality. Low value: BehaviourIndex sits at different places (after the first example on
some pages), so it must stay in the page body. Only do it together with D1, if at all. HTML diff
must be zero.

### D8 (P3) Leave the props tables as they are (no data-driven rows)
Checked for shareable rows beyond shared-props.ts: across pages the same prop names recur (disabled
35x, value 24x, transition 16x) but the descriptions are deliberately component-specific (e.g. 13
different `transition` descriptions). Only exact duplicates are 2-3 rows each (Checkbox/Switch
`defaultChecked`, Dialog/Popover Close `disabled`, Title/Description `render`). A shared-row registry
would save <30 lines and couple pages the writer just tailored; not recommended. The page-local
helpers (MenuPage.tsx:13 itemRows, ProgressPage.tsx:15 partProps, CheckboxGroupPage.tsx:13
transitionRow) are fine where they are.

### D9 (P3) Optional: fold the six "cached promise" loaders into fake-api.ts
AccordionThreads.tsx:6-14, DialogOrders.tsx:13-24, PopoverActions.tsx:8-16, TabsSuspending.tsx:7-15,
SliderPrice.tsx:14-22, ComboboxCountry.tsx:34-43 each write the same Map cache (~9 lines). A
`fakeQuery(key, ms, compute)` helper would save ~40 lines, BUT these files are shown to readers via
`?raw`, and the explicit cache teaches that `use()` needs a stable promise. Recommendation: keep as is
(this is user-facing example code). Listed only so the decision is recorded.

### D10 (P3) Make the link check a build step
A 25-line script over dist/public (all `href="/..."` resolve to a built page; every `#frag` matches
an `id` on the target page) found no broken links today, but internal links are hand-written strings
in ~35 pages and in navigation.ts, Concept.tsx:59-85 and Header.tsx:8-14. Running it in
`build.ts` after `build()` (throw on failure) would guard D1/D5 and future prose edits. Adds ~30 lines.

### D11 (P3) Config leftovers
- packages/docs/.wrangler/ (created by local wrangler runs) is not gitignored; it is empty now so git
  does not show it, but the next `wrangler dev` would. Add `.wrangler` to the root .gitignore.
- packages/docs/tsconfig.json lacks `verbatimModuleSyntax`, which CLAUDE.md lists as the repo
  convention (the ui package has it; example has it). Docs code already uses `import type`, so adding
  it should typecheck clean; `allowImportingTsExtensions` is unused (all imports use `.js`) and can go.
- No other leftovers: package.json scripts and deps are all used (@types/node by build.ts, shiki by
  CodeBlock, wrangler by deploy); vite.config.ts is minimal; the two wrangler tomls differ only in
  `name` (intended).

---------------------------------------------------------------------------------------------------
## Playground (packages/example)

The playground is not displayed to users as source, so readability-in-isolation does not constrain
sharing here (unlike docs examples).

### E1 (P1) Shared fake backend module
- `const sleep = ...` is defined in 18 of 19 demo files (e.g. button-demo.tsx:8, combobox-demo.tsx:7,
  toolbar-demo.tsx:13-15 as a function).
- `fakeSave(label, value, { fail })` with console logging: byte-identical in 6 files
  (checkbox-group, number-field, radio-group, select, slider, switch-checkbox; e.g. select-demo.tsx:9-14),
  near-identical in 4 more (accordion-demo.tsx:9-14 logs "value=", combobox, tabs fakeSaveTab, toggle)
  and button-demo.tsx:11-16 `fakeCall(label, { ms, fail })`.
Change: `src/shared/fake-backend.ts` exporting `sleep` and
`fakeSave(label, value?, { ms = 800, fail = false })` that logs `[label] saving …` / `saved …`.
Keep demo-specific loaders (tabs/dialog/popover fetches) local.
Saves ~18 + ~55 = ~75 lines. Risk: console wording changes slightly in 5 demos (accordion's
"value=" prefix, button's "…"/"done"); acceptable for a playground but mention it. Verify: typecheck,
`pnpm --filter funstack-ui-example build`, click through the affected demos.

### E2 (P1) One DemoErrorBoundary
13 copies of the same ~22-line class (button, accordion, toolbar, switch-checkbox, toggle identical;
combobox, field-form, tabs, slider, select, number-field, radio-group differ only in the wrapper
className; dialog-demo.tsx:22 `InlineErrorBoundary` differs in text and button class).
Change: `src/shared/DemoErrorBoundary.tsx` with an optional `className` prop (default "error-box");
dialog keeps its own or passes `className="dlg-error"` plus a `resetLabel` (decide by reading it;
its message omits the "Error Boundary caught:" prefix on purpose?).
Saves ~250 lines. Risk: none visible if each call site passes its current className. Verify as E1,
forcing a rejection in each demo once.

### E3 (P2) Shared playground stylesheet for the genuinely global bits
- `.error-box` is defined only in toggle-demo.css:84 but used by button, accordion, switch-checkbox,
  toggle and toolbar demos: an implicit cross-file dependency that breaks if toggle-demo.css is
  removed.
- `.spinner` + `@keyframes spin` are defined twice, identically (accordion-demo.css:116-130,
  toggle-demo.css:57-71), and `Spinner()` components are duplicated in accordion, toggle, tabs, dialog
  (tsx). Seven more per-demo spin keyframes exist (cb-, cg-, dlg-, menu-, rg-, sl-, tabs-spin; also
  popover) that are all `to { rotate: 1turn }` equivalents.
- The reduced-motion `::view-transition-*(*) { animation: none !important }` block is repeated in
  accordion, tabs, dialog, toggle, popover css; it is global CSS, so one copy suffices.
Change: `src/shared/demo.css` (imported once from main.tsx or App.tsx) with `.error-box`, `.spinner`,
`@keyframes spin`, the reduced-motion VT block; `src/shared/Spinner.tsx`. Leave the prefixed,
per-demo spinner variants alone unless the demo file is touched anyway (their sizes/colours differ;
they are sometimes copied from the design doc's starter stylesheet).
Saves ~60-100 CSS lines + ~12 TSX lines. Risk: cascade order — today accordion-demo.css's `.spinner`
wins over toggle-demo.css's by import order; they are identical, so no visual change. Verify by
screenshots of the toggle/accordion/button demos.

### E4 (P2) Consistent demo shell and App order
- Root element of each demo varies: `<article className="demo">` (9 files), `<section className="demo">`
  (menu, popover), `<section>` (7 files), plus `cb-demo`, `dlg-demo`, `tabs-demo`. Only
  toggle-demo.css:3 styles `.demo section`; `.dlg-demo` has no CSS at all.
- App.tsx:29-48 renders demos in an order unrelated to the docs sidebar, and `<Notifications />`
  (the toast region from toast-demo.tsx) sits between FieldFormDemo and SliderDemo.
Change: a tiny `<Demo title>` wrapper (`<article className="demo"><h2>`) used by every demo, move the
`.demo section` rule into shared/demo.css, order App by navigation.ts groups, render
`<Notifications />` last (or first) with a comment. Optionally a table of contents with anchors.
Saves little (~20 lines); value is consistency. Risk: spacing changes in the 10 demos not wrapped in
`.demo` today (intended). Moving `<Notifications />` changes DOM/landmark order only; verify toasts
still appear.

### E5 (P3) Class-name hygiene
- Slider and Select both use the `sl-` prefix (slider-demo.css `.sl-fill`, `.sl-head`, `.sl-error`;
  select-demo.css `.sl-select`, `.sl-spinner`, `.sl-error-box`, `@keyframes sl-spin`). No overlap
  today, but every stylesheet is global on one page. Rename select's to `sel-`.
- className hooks with no CSS: `dlg-demo` (dialog-demo.tsx:443), `nf-form` (number-field-demo.tsx:184),
  `toast-demo-menu-btn` (toast-demo.tsx:94). Drop them or style them.
- button-demo / toggle-demo use unprefixed `.btn`, `.chip`, `.star`, `.spinner`, `.error-box`.
Saves ~0 lines. Risk: none if renamed consistently; verify with a grep that every class used in tsx
has a rule (script in this audit) and screenshots.

### E6 (P3) tsconfig alignment
packages/example/tsconfig.json has no `noUnusedLocals` / `noUnusedParameters` (docs has both) and
uses extensionless relative imports (`./accordion-demo`) while docs and ui use `.js`. Align both
packages on one config (strict + verbatimModuleSyntax + noUnused*), possibly via a shared
`tsconfig.base.json` at the root. Enabling noUnused* may surface a few unused locals; fix them in
the same commit.

### Not recommended
- Sharing CSS between docs examples and the playground: docs example CSS is themed with the site's
  custom properties (light/dark) and is shown to readers next to each example; playground CSS is
  hard-coded colours and often mirrors the design docs' starter stylesheets. A common base would
  couple the reader-facing files to the playground for ~20 lines of savings.
- Sharing the docs `fake-api.ts` with the playground: the playground's helpers log to the console
  (App.tsx:26 tells the user to "Open the console"), the docs ones must not.
- Deduplicating the three reduced-motion VT blocks in docs examples (popover.css:91, dialog.css:104,
  tabs.css:110): each CSS file is displayed with its example and must stand alone.

---------------------------------------------------------------------------------------------------
## Verifying "identical output" for the docs refactors (D1, D2, D5, D6, D7)

1. Baseline before any change (from a clean master):
     pnpm --filter @funstack/ui build && pnpm --filter docs build
     cp -r packages/docs/dist/public $SCRATCH/before
2. After the change, build again into dist/public and copy to $SCRATCH/after.
3. Normalise hashed asset names, then diff:
     norm() { sed -E 's#/assets/([A-Za-z0-9_.-]+)-[A-Za-z0-9_-]{8}\.(js|css)#/assets/\1.\2#g'; }
     for f in $(cd before && find . -name '*.html' -o -name 'sitemap.xml'); do
       diff <(norm < before/$f) <(norm < after/$f) || echo "DIFF $f"; done
   Expected: no output (D4 and D3 are the only intended diffs; review them separately).
   The file lists must match too: `diff <(cd before && find . -name '*.html' | sort) <(cd after && ...)`.
4. RSC payloads (funstack__/fun__rsc-payload/*.txt) have hashed names; compare the sorted multiset of
   normalised contents (`norm < f | sha256sum` per file, sort, diff). Expected: identical, except that
   client-reference chunk ids may change if D5 moves modules; then diff with chunk ids normalised.
5. CSS refactors (D2): the built `assets/rsc-*.css` shrinks; HTML stays identical. As a guard,
   extract every class token from the after-build HTML and client chunks and check it still has a
   rule (and none of the removed selectors is referenced).
6. Leak check for D1: `grep -rl "A pretend backend" after/assets` must be empty.
7. Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm build` as usual.
