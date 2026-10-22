# Button (#79, wave 8)

Design: design/components/button.md (6cdfc85), conventions 2.5 / 3.4 / 3.6 amended.

## What landed

- `packages/ui/src/button/` (`button.tsx` "use client", `index.ts` no directive), subpath
  `@funstack/ui/button`, root exports `Button`, `ButtonProps`, `ButtonState`,
  `ButtonActionDetails`.
- `useActionTrigger(options?: { openGeneration?, ignoreWhilePending? } | (() => number))`: the
  positional form stays for Dialog.Close / Popover.Close / Menu.Item (untouched, #81). `run`
  returns `false` when ignored. In-flight counter in a ref, decremented when `work` settles
  (both branches); the guard also reads the render's `pending`.
- `Toolbar.Button` removed (file, namespace member, types, root exports). Toolbar tests, docs
  examples, example playground switched to `<Button>`. directives.test.ts asserts
  `dist/toolbar/toolbar-button.{mjs,d.mts}` are gone (tsdown `clean: true` removes them).
- `submittedWith.current` is read during render (oxlint `react/refs` disabled on that line, as in
  progress-root / meter-root): written only in the click handler before the submission.
- Dev warnings go through `useDevWarning` (console.error, once per instance), like every other
  library warning; the design says "warns" for action + submit/reset.

## Findings that differ from the design

1. **Trigger-wrapped Button with an async action (row 15, section 2.3).** The Trigger's open and
   the Button's action start in the same click, so React entangles them: the Trigger shows the
   optimistic `data-open` (and the Button `data-pending`) at once, but the Dialog's
   `showModal()` waits for the commit, which waits for the action to settle. The design said the
   dialog is open while `a` pends. Test asserts the real behaviour; docs example uses a
   non-awaiting action (`void prefetch()`) and the page explains it. The design's
   `action={prefetchProfile}` example would hold the dialog closed for the prefetch duration.
2. **ViewTransition settle under `transition="none"` (row 25).** react-dom 19.3 starts no view
   transition for an *update* of a "none" boundary (only mount / reveal), so the count is 0. Test
   asserts 0 for "none" and 1 for "auto" (the boundary does animate the settle).
3. Row 1 "a consumer aria-disabled prop is not accepted (type)": JSX does not type-check
   hyphenated attributes, so `<Button aria-disabled>` compiles. The type claim is covered by
   `expectTypeOf<ButtonProps>().not.toHaveProperty("aria-disabled")`; at runtime a stray one is
   removed by the owned key.
4. Row 22 needs `{ force: true }` for the second click: Playwright's actionability check treats
   `aria-disabled="true"` as not enabled.
5. Row 11 works as designed: with A and B both submitting, `useFormStatus().action` is per
   submission and each Button shows only its own pending (verified in jsdom).

## Chromium AX tree (row 26)

A pending Button (`aria-disabled="true"`) has AX property `disabled: true`, name unchanged; the
property is absent again after settle.

## Gate notes

- One full `test:run` (jsdom + Chromium + Firefox in parallel) failed NumberField's CDP touch-hold
  row once; not reproduced in the browser project alone (x3) nor in two more full runs. That test
  does not exercise the guard (NumberField's `runStep` keeps `ignoreWhilePending` off).
- WebKit cannot run locally (missing host libraries); CI covers it.
