# Review: Progress and Meter (#68, wave 6), 2026-10-18

Scope: 6fef197 (on master; the reviewed files are unchanged at a621645), against
design/components/progress.md (accepted, with the acceptance note), design/conventions.md
(including the #68 amendments in f3ab2e4), docs/vision.md, memo/developer/progress-meter.md.
Files: packages/ui/src/progress/*, meter/*, internal/{render-element,range-value,dev-warn}.ts,
internal/use-render.tsx, __tests__/{directives.test.ts,ax-tree.ts,browser-commands.ts},
vitest.config.ts, the two docs pages and five examples, the playground demo.

**Verdict: acceptable with minor fixes.** The library code matches the design closely: ARIA
semantics, owned keys, the directive-free Root with the client context provider, the lane
rule, the region algorithm and the formatting are right, and the tests cover the design's 12.1
and 12.2 rows, including the consumer-lane rows and a real import-graph guard. Nothing is
must-fix. Two should-fix items are in the docs examples (one visibly broken), one is a type
hole that contradicts the accepted design.

Verification: jsdom tests for progress/meter/range-value/directives run in the worktree (261
pass, type tests included); browser tests for progress and meter run locally on Chromium and
Firefox (pass; WebKit does not launch on this machine). CI run 39108973892 on 6fef197: all
three browser jobs and `ci` green. One throwaway Playwright probe in the session scratchpad
(registered `@property` and `var()` fallback, see S1). Existing issues #72 (docs build exits 0
on an RSC error) and #73 (Next.js provider check, screen-reader pass) already record the
developer's open RSC/AT items.

---

## Should-fix

### S1. The indeterminate ring in the docs is invisible
`packages/docs/src/examples/progress.css` (`.demo-progress-ring`:
`conic-gradient(var(--color-primary) var(--progress-value, 25%), …)`), used by the spinner in
`ProgressJobs.tsx` (the Server Component example).

The same file registers `--progress-value` with `initial-value: 0%`. A registered property
with an initial value is never guaranteed-invalid, so the `var()` fallback `25%` is never used:
while indeterminate (no inline `--progress-value`) the gradient is `primary 0%`, i.e. a uniform
grey ring, and rotating it shows nothing. Probed in Chromium: computed `background-image` is
`conic-gradient(rgb(255, 0, 0) 0%, …)` with the fallback written as 25%. The design itself says
the registered property "falls back to its `initial-value`, `0%`" (2.3), so the recipe
contradicts it. Fix: give the indeterminate ring a fixed arc in its own rule
(`.demo-progress-ring[data-indeterminate] { background: conic-gradient(var(--color-primary) 25%, var(--color-border) 0); }`)
and drop the misleading fallback. The playground's `.pm-ring` is only used determinately and is
fine.

### S2. ProgressUpload shows a stale "Done" bar on the second upload
`packages/docs/src/examples/ProgressUpload.tsx:18-35`.

`size` and `sent` are never reset. On a second click the bar renders from `pending` with the
previous run's state (`sent === size`): `data-complete`, the green fill and "Done" for the 600 ms
before the first chunk, then the fill animates backwards to 0. The fix is the page's own advice
(callout, "set a meaningful starting value before calling the action"): `setSize(null);
setSent(0);` in the click handler before `startUpload(…)` (urgent, outside the action), which
makes the example demonstrate the sync-prefix rule instead of tripping over it. The playground
avoids this because its generator yields `null` after the first `await`.

### S3. `defaultValue` type-checks on both Roots and is a silent no-op
`progress-root.tsx:36-46`, `meter-root.tsx:37-47` (the `Omit` list);
`progress.types.test.tsx:21-27` (the test asserts the hole rather than closing it).

Deviation listed by the developer: "`defaultValue` passes through to the div". Design 12.1
"Types" says `defaultValue` is not a prop, and 4.1 says controlled only, no `defaultValue`. The
DOM prop on a `div` does nothing: react-dom drops it (`renderToString(<div defaultValue={30} />)`
is `<div></div>`). So `<Progress.Root defaultValue={40} />`, the spelling every other value
component in this library teaches (Tabs, Slider, ToggleGroup, NumberField), type-checks and
renders an indeterminate bar with no warning. Not acceptable as is: add `"defaultValue"` to both
`Omit` lists (`defaultChecked` too, for the same reason) and turn the type test into
`@ts-expect-error`. A one-line change with no runtime cost.

---

## Nits

### N1. Meter docs: "the four ARIA values (always present)"
`packages/docs/src/pages/MeterPage.tsx:168`. `aria-valuetext` is absent when
`getAriaValueText` returns `null` / `undefined` (the props table two rows up says so, and
`meter.test.tsx:126` tests it). Say "`aria-valuemin`, `aria-valuemax`, `aria-valuenow` always;
`aria-valuetext` unless `getAriaValueText` returns `null`".

### N2. Meter docs: the anatomy snippet next to the Server Component note
`MeterPage.tsx:38-53`. The page says the example is a Server Component, then the anatomy shows
`<Meter.Value>{(state) => …}</Meter.Value>`, which fails from a Server Component (the
developer's finding; the build still exits 0, #72). The Progress page explains the rule; the
Meter page links there only generally. Add one sentence ("from a Server Component, format part
content in the Root's `children(state)`, as the example does") or link to the Progress page's
Server Components section.

### N3. Meter docs omit two developer-facing behaviours
`MeterPage.tsx` props table: `max <= min` warns and renders 0% (stated for Progress only), and
non-finite `low` / `high` / `optimum` count as absent (a deviation from the design; see below).

### N4. "A Root with no parts ships only the context module"
`ProgressPage.tsx:129-130` and the design's 8.1 table. Whether the unused part modules reach the
browser depends on how the RSC bundler emits client references reachable from the server graph
(the namespace object imports all four parts). Not verified; soften to "the parts' code is only
loaded where they are used" or verify against the built docs site's chunks.

### N5. Misplaced doc comment in vitest.config.ts
`packages/ui/vitest.config.ts:36-49`. `emulateReducedMotion` was inserted between
`selectBrowsers`'s JSDoc ("Engines for the browser project …") and the function, so that comment
now documents the command. Move the command above it.

### N6. The lane test uses a plain button, not an action prop
`progress.test.tsx:402-424`. Design 14.7 asked for "a `Button` with an `action`"; there is no
Button in the library, and `useTransition`'s `start` exercises the same React rule, so this is
fine. Noted only because the design text should not be read as a missing row.

### N7. Degenerate range: `aria-valuenow` can exceed `aria-valuemax`
`range-value.ts:5-7`. With `min > max`, `clamp` yields `min`, so `aria-valuenow` > `aria-valuemax`
(invalid ARIA). Acceptable: it only happens with a call-site bug that already warns. No change
requested; the docs could say "renders `min`".

---

## Deviations listed by the developer

| Deviation | Judgement |
| --- | --- |
| `use-render` split into `internal/render-element.ts` | **Acceptable**, and the design's preferred option (14.1). `useRender` keeps its directive and re-exports, so no other part changed. `mergeRenderRef` merges unmemoised only when both a consumer ref and an element ref exist; every merged callback returns a cleanup, so a fresh identity per render is correct (it re-attaches, which is harmless for a node with no library ref). |
| A Server Component can pass function props to the Root only | **Acceptable, inherent.** The parts read context and are client modules (conventions 7.3), so this follows from the accepted design; design 13's MeterStorage row ("`Meter.Value children(state)`") was wrong and the example correctly uses the Root's `children(state)`. The Progress page documents it; N2 for the Meter page. The silent build success is #72. The design doc's section 13 row should be corrected by its owner. |
| Firefox `<meter>` boundary difference | **Acceptable.** HTML leaves the boundaries to the implementation; the design fixes Chromium's operators; the browser test asserts Gecko's operators for the native oracle in Firefox and the library's region everywhere; the Meter page and cross-engine.md record it. Not a browser bug, so nothing for #70. |
| Non-finite `low` / `high` / `optimum` count as absent | **Acceptable.** Matches the platform (an unparsable attribute takes the default), is unit-tested (`meter-region.test.ts:78`), and is the only sane reading. Document it (N3). |
| `aria-valuenow` clamped when the range is degenerate | **Acceptable** (N7). It is the same `clamp`, and the dev warning fires. |
| `defaultValue` passes through to the div | **Not acceptable as is** (S3). |
| oxlint disable for `react/refs` | **Acceptable.** The rule fires on passing `ref` into a helper during render; the value is only forwarded to the element, never read, and the comment says so. Two occurrences, both justified. |

## Checklist notes

- **ARIA / APG.** `progressbar` and `meter` on `div`, not focusable, no keyboard (correct: both
  roles are non-interactive). Indeterminate omits `aria-valuenow` and `aria-valuetext`
  (Chromium exposes no value: CDP row). `aria-valuetext` always for a value, from `Intl`; no
  English default. `aria-labelledby` always carries `${id}-label`, token-merged after the
  consumer's; the CDP row proves `aria-label` still names a Root whose only `labelledby` token
  dangles, and that a consumer token plus the Label concatenate in order. `Value` is
  `aria-hidden` by default and overridable. Owned keys hold against consumer props and `render`
  elements (tested for both Roots).
- **Server Component Root.** Both Root modules are directive-free and import only
  `internal/data-attr`, `dev-warn`, `range-value`, `render-element`, `merge-props`, `types` and
  their context; the provider uses `<Context value>` (not `.Provider`); the context value is
  plain data. The import-graph test (directives.test.ts) walks runtime imports over the sources
  and asserts the context is the only client module reached; it ignores `import type` and
  `export type`, which is right. The built-file directive lists include the new modules.
  The developer confirmed the pattern with @funstack/static; Next.js is #73.
- **Lanes.** No transition anywhere in the parts: they render in the consumer's lane. The
  jsdom rows prove both halves of design 4.2 (post-await plain write renders before settle;
  post-await `startTransition` write is held; sync-prefix write is held), using `act` around
  each step. The docs callout states the rule and the pitfall. No `<ViewTransition>`; the
  browser row spies `startViewTransition` across mount, update and unmount in transitions.
- **Tests.** The jsdom / browser split is right: accessibility tree, registered-property
  transition, `getAnimations()`, reduced motion (new `emulateReducedMotion` command; each
  Vitest session has its own Playwright page, so the emulation does not leak into concurrent
  files), RTL / vertical geometry and the native meter oracle are in browser mode; everything
  else is jsdom. Engines: Chromium reads CDP and a screenshot pixel of a styled native meter,
  Firefox matches `:-moz-meter-*`, WebKit asserts attributes and records the gap, so no row is
  skipped. Timing: the transition row waits 300 ms into a 1 s linear transition and asserts a
  wide band (0 < width < 200), robust enough.
- **Docs props tables vs. types.** Match for every prop, default and state field, apart from N1
  and N3. Data-attribute and custom-property tables match the code.
- **Docs examples.** ProgressJobs and MeterStorage are genuine Server Components and pass
  functions only to the Roots; ProgressForm wires `aria-busy` / `aria-describedby` on the region
  being replaced (APG advice); MeterStrength is the supported sibling-of-control layout with
  `aria-describedby` to the `aria-hidden` Value. Problems: S1, S2.
