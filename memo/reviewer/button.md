# Reviewer memo: Button (#79), 2026-10-22

Reviewed d8136b4 (feat(ui)!: Button, Toolbar.Button removed), 465d106 (example), 0201cec (docs)
against `docs/vision.md`, `design/conventions.md` (as amended), `design/components/button.md` and
`memo/developer/button.md`.

Gates I ran: jsdom for button, toolbar, dialog, popover, menu, toast, number-field, slider, internal
(24 files, 1129 tests, no type errors); browser project for button + toolbar on Chromium and
Firefox (57 passed, 1 skipped: the Chromium-only AX row on Firefox); `pnpm typecheck` and
`pnpm lint` clean. WebKit not run locally.

Verdict: **acceptable with minor fixes.** The core (guard, owned keys, `type`, per-submitter
`formAction` pending, Toolbar integration, hook option) is correct and well tested. Two a11y /
footgun issues in `render` handling should be fixed in code, and the design doc needs amending
for deviations 1 and 2 (the code is right, the design is wrong).

## Probes (scratch tests outside the repo, jsdom)

1. Two `Button formAction` A and B both pending, resolve A only: A clears, B stays pending (works;
   the committed test does not assert it).
2. A non-awaiting "+1" Button (`action={() => { inc(); }}`) clicked three times while an unrelated
   `useTransition` async action is pending: **1 call**, Button stays `data-pending`.
3. Plain `Dialog.Trigger` clicked while an unrelated Button's async action is pending: the dialog
   does not open until the Button's action settles (conventions 2.3 item 5, not Button-specific).
4. `<Button disabled render={<a href="#x" />}>` renders `<a href="#x" disabled="" data-disabled="">`:
   no `aria-disabled`.
5. `<form><Button action={f} render={<MyButton />}>` (MyButton spreads props onto `<button>`)
   renders `<button>` with **no `type`**, i.e. a submit button.
6. aria-disabled + `type="submit"` default button, Enter in a field: no submission (good).

## Findings, by severity

### Must fix

1. **Disabled `render={<a href>}` outside a Toolbar exposes an enabled link to AT.**
   `packages/ui/src/button/button.tsx:151-152`. Native `disabled` means nothing on `<a>`, so the
   element gets a meaningless `disabled=""` attribute and no `aria-disabled`; the click is
   cancelled (button.tsx:162-166), so a screen-reader user hears an ordinary link that does
   nothing. The docs and design promote `render={<a href>}`. Fix: when the rendered element is not
   a `<button>`, use the focusable-disabled branch (`aria-disabled="true"`, no `disabled`), e.g.
   `const focusable = focusableWhenDisabled || toolbar !== null || !rendersButton(render)`
   (check the `<MyButton>` interaction with finding 2), plus a row-1/row-2 assertion. The design
   tables (4 "Owned keys", 8.1) need the same sentence. Other parts with a link `render` and
   `disabled` likely share this; worth a library-wide look (not reviewed here).

### Should fix

2. **`render={<MyButton />}` inside a form silently becomes a submit button.**
   button.tsx:146 (`rendersButton` is true only for `undefined`, a function, or a host
   `"button"` element). Design section 1 and row 9 advertise "a styled `<MyButton>` that spreads its
   props"; inside a `<form>`, an `action` Button rendered that way runs its action **and** submits
   the form, which is exactly what decision 6 (`type="button"` by default) exists to prevent, and
   the "action + submit" dev warning does not fire because `type` is undefined. Options: pass
   `type` to any non-host (component) render element too (a component that forwards to `<a>` gets
   a harmless `type` hint), or document it prominently. Needs an architect decision since
   `rendersButton` is the library-wide rule; for Button, the general-purpose button, the risk is
   highest.

3. **The "+1, do not await" escape hatch fails under entanglement.** Design 5.4 and
   `packages/docs/src/pages/ButtonPage.tsx:179-180` say a non-awaiting action "ends `pending` at
   once; every click counts". Probe 2: while any other async action in the app is pending, the
   Button's commit is held, the rendered-`pending` guard source stays true, and further clicks are
   **dropped** (not merely delayed). The page's own previous bullet describes the held window, but
   the +1 bullet contradicts it. At minimum qualify the docs and design 5.4. The architect may also
   reconsider whether the rendered-`pending` source should apply when this Button's own work has
   already settled (in-flight counter at 0): dropping intent is worse than the "looks pending"
   inconsistency the source was added for.

4. **Row 11 intermediate assertion missing.** `packages/ui/src/button/button.test.tsx:661-669`
   resolves A then B and checks only the end state. The design row requires "resolve A → only A
   clears". Probe 1 shows it works; add `expectNotPending(A)`, `expectPending(B)`,
   `expectPending(Publish)` between the two resolves.

5. **Playground styles a pending Button as disabled.** `packages/example/src/toolbar-demo.css:56`
   still uses `.tb-item[aria-disabled="true"]` (opacity .5, overriding the pending .7). The docs
   CSS was fixed to `[data-disabled]` (`packages/docs/src/examples/toolbar.css:34`); do the same here.

### Minor

6. Two Buttons sharing **one** `formAction` function (`formAction={dispatch}` with different
   `name`/`value`) both show pending and both ignore clicks, because the match is by function
   identity (button.tsx:120). Inherent to `useFormStatus` (no submitter); document it next to the
   identity note in the props table.
7. `ButtonInvoker.tsx` lacks the "Button styled by `[data-pending]` CSS only" the design 14 table
   lists; the page text covers it in prose, so optional.
8. `ButtonSave.tsx`: `setCalls` runs in a `startTransition` inside the action, so the "Action calls"
   counter only updates when the save settles. It still demonstrates "one call", just not live.

## Developer's listed deviations

1. **Trigger-wrapped async action holds `showModal()` (design 2.3, 7.1, row 15).** The code is
   correct; **the design must change.** The open is a transition and every transition started
   while an async action is pending is entangled with it (conventions 2.3 item 5, verified on
   19.3.1; probe 3 shows the same with a plain Trigger and an unrelated Button). The Dialog only
   calls `showModal()` on committed state by design, so the Button cannot fix this without
   breaking the Dialog's model. The design's `action={prefetchProfile}` example violates the
   conventions' own "await only what the UI must wait for" rule. Amend 2.3 (non-awaiting
   `() => { void prefetchProfile(); }`, plus a sentence that an awaited action holds the open),
   7.1, and row 15 ("while `a` pends the Trigger shows `data-open` / `data-pending` and the dialog
   opens when `a` settles"). The test (button.test.tsx:842-875), docs page and ButtonCompose
   already reflect the real behaviour.
2. **Row 25, no view transition on a `transition="none"` update.** Accept; React starts a VT
   for a `"none"` boundary only on mount/reveal. The test asserting 0 for `"none"` and 1 for
   `"auto"` is the better row. Amend design row 25.
3. **Hyphenated `aria-disabled` not type-checked.** Accept: TypeScript does not check unknown
   hyphenated JSX attributes. `expectTypeOf<ButtonProps>().not.toHaveProperty("aria-disabled")`
   plus the owned-key removal test cover the intent.
4. **Playwright `force: true` (row 22).** Accept: Playwright's actionability check treats
   `aria-disabled="true"` as disabled; the real pointer click still dispatches, which is the
   behaviour under test. The comment at button.browser.test.tsx:72 explains it.
5. **`useDevWarning` (console.error) where the design says "warns".** Accept; it is the library's
   single warning channel, once per instance, in an effect.
6. **oxlint disable for the `submittedWith` ref read in render** (button.tsx:119). Accept: the ref
   is written only in the click handler, before the submission whose status the render shows;
   same precedent as progress-root / meter-root. A stale value can only match a function this
   Button itself submitted with.

## Checklist notes (verified, no action)

- Re-entry guard: in-flight ref plus rendered `pending`, `preventDefault()` on ignored clicks,
  never `stopPropagation()`; rows 5, 6, 8 and the same-task double click cover it.
- `useActionTrigger` option change: the positional form is kept, `ignoreWhilePending` defaults to
  `false`, `run`'s boolean return is ignored by the old call sites, and the counter is inert when
  the guard is off. Dialog.Close, Popover.Close, Menu.Item, Toast.Action, Slider and NumberField
  tests all pass unchanged.
- Focus retention (row 21) passes on Chromium and Firefox; Toolbar roving keeps aria-disabled
  Buttons in the sequence; Tooltip on a pending Button opens by hover and focus (row 23).
- Owned keys and `type` ownership match design 4. A focusable-disabled submit button blocks
  implicit submission (probe 6).
- Toolbar.Button removal is complete: no references in code, tests, docs examples, playground or
  exports; `toolbar/index.ts` has only Root and Separator; directives test asserts the dist files
  are gone; Toolbar page has the migration callout and the Roadmap marks the breaking change;
  toggle-group.md has the superseded note (a13f5c8).
- Exports: root, `@funstack/ui/button` in package.json and tsdown; `button.mjs` "use client",
  `index.mjs` directive-free.
- The docs props table matches `ButtonProps` (defaults, the type rule, the formAction identity note).
