# #158 (native disabled for browser-run clicks) and #157 candidate 4 (usePureTrigger)

Branch `refactor/157-pure-trigger`, 2026-11-24. Two commits: the behaviour change first, then the
behaviour-neutral refactor.

## Commit 1: #158

- `disabledButton` (`internal/render-element.ts`): `handlesClick: false` is now "native unless
  the element certainly cannot be natively disabled" (`certainlyNotDisableable`: not
  `rendersButton` and not a host `<input>`; exactly Form.Submit's old `submitter` expression,
  negated). `handlesClick: true` unchanged (`!isHostButton`), `alwaysFocusable` unchanged.
- `pendingAriaDisabled(props, pending && ignoring)` (same module): native `disabled` wins over
  the pending `aria-disabled`; the aria branch is `true`; else the pending rule. Used by Button,
  `useOverlayClose`, Toast.Action. Menu.Item is never natively disabled, so unaffected.
- Button: `browserRun = action === undefined && (resolvedType !== "button" || commandfor ||
  popoverTarget)`; `disabledButton(render, disabled, { handlesClick: !browserRun,
  alwaysFocusable: focusableWhenDisabled || toolbar })`. The invoker part
  (`commandfor` / `popoverTarget`) is my reading of the user's "a JS-free invoker"; the issue only
  named submit / reset. Tested.
- Form.Submit: `disabledButton(render, disabled, { handlesClick: false })`, same output as before
  in every case (the #83, link and input tests pin it).
- Side effect of the helper change: the JS-free command parts (Dialog / Popover Trigger and Close
  without a handler) on a host `<a>` render now get `aria-disabled` instead of a meaningless
  `disabled` attribute. No click handler is installed there, so the click of an `<a href>` is not
  cancelled (it was not before either). A new row in `overlay-disabled-render-suite.tsx` pins the
  attributes. Docs pages for Dialog / Popover updated.

Tests written first (failed on master): the Button hydration rows (`hydrateFromServer` with a
`mutate` that clicks the server HTML; an enabled control row proves the form submits/resets
before hydration in jsdom), host `<input>` render, invoker rows, pending-then-disabled rows for
Button (host, and a component formAction submitter), Close (shared suite, Dialog + Popover, both
modes) and Toast.Action. Note: a natively disabled button gets no React click at all in jsdom, so
"click cancelled" cannot be asserted on the native branch; assert "no submit / reset event".

## Commit 2: usePureTrigger

`internal/use-pure-trigger.ts`: `usePureTrigger({ whilePending, defaultWhilePending,
openGeneration? })` -> `{ pending, run, ignoring, runActivation(event, work, then?),
pendingProps(disabledProps, pending?) }`. Button passes its merged own + form pending to
`pendingProps`; the Close part keeps `run` (it cancels every click itself). Slider / NumberField
still call `useActionTrigger` directly (no `whilePending`; not in scope, and another developer is
on those files). `pendingAriaDisabled` is no longer re-exported from `use-render.tsx`.
Added `internal/render-element.test.tsx`, a table test of `disabledButton` / `pendingAriaDisabled`.

## Checks run

typecheck, lint, format:check, test:jsdom (3799 + docs 14 after commit 1), build, design refs,
browser tests (Chromium + Firefox) for button, form, menu, toast, popover, dialog: 507 passed,
15 skipped (engine-gated rows).
