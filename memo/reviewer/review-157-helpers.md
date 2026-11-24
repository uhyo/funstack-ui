# Review: refactor/157-helpers (#157, audit candidates 7 and 10)

Branch `origin/refactor/157-helpers` at 7921129, 12 commits on bce647a. Reviewed 2026-11-24.

**Verdict: mergeable as is.** Minor items below are optional follow-ups; nothing blocks.

## Verification

- Scratch worktree: branch merged with `origin/master` 4ba75d0 (clean auto-merge,
  `directives.test.ts` only). `pnpm test:jsdom`: ui 81 files / 3899 tests pass, docs 14 pass.
  `pnpm typecheck` green on the merge. Master's split files (toast, combobox keydown) do not
  import `useConnected` from `report-dropped.js`.
- Mutations (each reverted, worktree removed):
  1. `usePopoverTrigger` drops `beforeOpen` (Menu's open cause): **survives jsdom** (menu, 373
     tests), killed by chromium `menu.browser.test.tsx` "a pointer open focuses the first item
     without :focus-visible". Pinned, but only in the browser project.
  2. `useMountFixed` returns the latest value: killed (4 failures, 2 files).
  3. `useResetTarget` returns the latest controlled value instead of the mount value: killed (31).
  4. `intendedValue` back to `inFlight?.next ?? optimistic`: killed (3, incl. a group Root).
  5. Dialog.Trigger without `checkPopup?.(element)`: killed (1).
  6. Select.Value position check never fires: killed (1, the new portal test).
- Production fold: rolldown production bundle of `src/index.ts`; the new Select.Value text and
  Tooltip texts are absent.

## Behaviour preservation, per helper

- `toggleFromTrigger`: decision table identical to both former copies (intended open +
  `hiddenBeforeToggle` -> `recordCloseIntent` and return; intended open -> `requestClose`;
  closed -> `beforeOpen` then `requestOpen`, all `"activate"`). `beforeOpen(event)` is wrapped
  with the React event, as before. Combobox keeps `preventDefault`, `disabled`, input focus.
- `useMountFixed`: overlay Roots (`isLibrary !== isLibraryNow` equals `mode !== value` on the
  string), Accordion mode and `exclusive`, ToggleGroup `exclusive`: same values, same messages.
- `useResetTarget`: checked all five call sites against the old ternaries, including "neither"
  and "controlled after an uncontrolled mount". NumberField used `valueProp` for the mode test and
  `value` (sanitized) for the mount value; `sanitize` keeps `undefined`, so `value !== undefined`
  is the same test. Select: `(ctrl ? mount : default) ?? value` equals the old
  `value === undefined ? defaultValue : (mount ?? value)` (uncontrolled `value` is undefined).
- `intendedValue` replacements: every site reads a boolean or a set, so the null-check difference
  is unobservable. Dialog.Root using `intendedValue(latestInFlight, optimistic)` rather than
  `intended()` is the right call.
- `reportDropped` without "use client": the module has no imports and no React API; calling it on
  a server falls back to `console.error` (Node has no `reportError`). Removing the directive is what
  makes it safe for directive-free importers (a server module importing a "use client" module gets a
  client reference, not a callable). Client importers are unaffected. `directives.test.ts` pins both
  `report-dropped.mjs` and `call-urgent-handler.mjs` as directive-free and `use-connected.mjs` as
  client.
- Dom-order: Tabs' `compareDocumentOrder(prev, next) < 0` equals the FOLLOWING test (same node:
  both "prev"); Combobox options comparator differs only for identical / unrelated nodes, which
  cannot occur, and now sorts a copy.
- Accordion `resolveArrowKey(key, "vertical", false)`: maps exactly ArrowDown/Up/Home/End.
- Dev warnings: `useControllableAction`, `useTransitionBoundary` -> `useDevWarning`, same texts and
  once-per-instance. Dialog.Trigger's ref-time check: `useElementCheck` callback is stable (deps
  `[]`), so `libraryRef` is not recreated per render; refs attach after the commit's mutations, so
  a later-sibling or portalled Popup is seen. Only difference: an Activity hide/show no longer
  re-warns (intended, documented).

## Findings (by severity)

No blocking or major findings.

### Minor

1. Test gap for the stated behaviour change. CHANGELOG says Select.Value's and Dialog.Trigger's
   warnings now fire once per instance under StrictMode, but no test counts them under StrictMode
   with the warning condition true. `dialog.test.tsx` (new test) only checks the no-false-positive
   case; `select.test.tsx` (portal test) uses `toHaveBeenCalledWith`. A `<StrictMode>` variant with
   a count assertion would pin it.
2. Conventions 7.2's new sentence ("A message starts with the public name of the part and a colon
   ... or the name of the function") is slightly broader than the code: `dialog-form.tsx` warns
   "`` `Dialog.Form` rendered as a `Form.Root` ...``" (backticked name), and
   `useControllableAction` falls back to "A component:" when `warn` is absent. Either soften to
   "should" or fix Dialog.Form's text in a later dev-text pass.
3. CHANGELOG "hand-rolled dev warnings" entry says the two `toast-viewport.tsx` sites are "left
   for the branch that splits it"; that split (#160) is already on master. Accurate at authoring
   time; a follow-up should pick them up (the developer notes name the `useDevWarning(rejected,
   ...)` conversion).

### Nits

4. `number-field-root.tsx`: `const resetTarget = (): number | null => resetBase;` is now a
   vestigial wrapper around a render-time constant (the callers could read `resetBase`). Harmless.
5. `use-popover-trigger.ts`: `toggleFromTrigger` is placed above the module's `const isDev`;
   cosmetic.
6. `production-bundle.test.ts` does not collect `useSelectPartRef`'s `position` argument. The new
   Select.Value check folds correctly (`isDev ? ... : undefined`), but is unguarded by the test.

### Pre-existing, outside this branch (worth an issue in this repo)

7. Dev text leaks into the production bundle: `select-trigger.tsx` `firstChildOfSelect` (and
   presumably `select-group-label.tsx` `firstChildOfGroup`) are module-level functions returning
   message strings without an `isDev` guard; passed as `position` to `useSelectPartRef`, whose
   `useElementCheck` is a no-op in production, so they are dead but not removed. Verified: a
   production rolldown bundle of `src/index.ts` contains "must be the first child of Select.Root".
   `production-bundle.test.ts` misses it because the text is not inside a DEV_CALLEE call's
   arguments. Fix: `isDev && firstChildOfSelect` style or inline `isDev ? ... : undefined`, and
   teach the test about `useSelectPartRef` (with an exclusion for the part-name literal).

## Names and APIs

`useMountFixed(value, message)`, `useResetTarget(value, defaultValue)`, `toggleFromTrigger(ctx,
event, beforeOpen?)`, `intendedValue(latestInFlight | undefined, optimistic)`, `useConnected()`:
narrow and descriptive; each JSDoc states the contract and the callers' responsibilities.
`useResetTarget` returning `undefined` and leaving the fallback to callers is the right shape given
the four different fallbacks. Skipping `useLibraryMode` is sound.

## Opinions on the open suggestions

- (a) Unify the three focusable selectors: **not worth asking the user now.** Tooltip's selector
  only drives a development warning (interactive content in a popup), so changing it moves no
  runtime behaviour; the roving and Menu selectors serve different questions (what may take a
  roving tabindex vs. what counts as focusable inside a menu). A single constant would force a
  decision with no user-facing benefit. Cheaper: a one-line comment at each constant saying why it
  differs. Ask only if a concrete bug turns up (e.g. a hidden input counted as focusable).
- (b) `useWarnOnce()` for handler-time warnings: marginal. Each site is a `useRef(false)` plus an
  `if (isDev)` guard, already covered by the production-bundle test through `console.error`; the
  sites also differ in keying (once per instance vs per duplicate value). Worth adding only if it
  follows the `isDev ? hook : noop` pattern and is added to `DEV_CALLEES`; otherwise skip. Low
  priority.
