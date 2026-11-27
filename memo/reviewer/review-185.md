# Review: #185 (real reset button) and #184 (fieldset disabled while open)

Branch reviewed: `origin/feat/185-form-reset` at 4f6989b5. The notes branch `review/185` already
existed on origin at 3be6c5b9: the architect's rule 5/7 docs commit on top of 4f6989b5. These notes
are committed on top of that commit as a fast-forward, so nothing was overwritten.

Verdict: the **Combobox fix is correct**. The audit claim "only Combobox was affected" is
**wrong**. A probe run in Chromium and Firefox found two more real-button reset bugs, so the work
is **acceptable with fixes**. Each finding needs a fix or a filed issue before merge, and the
docs' "every caller" claims need correcting.

## Probe

The probe file was kept outside the repo. It clicks the reset button outside act, the same way
`clickReset` does, then waits 100 ms. Script `form.reset()` passes every row. Results for the
real button, identical in Chromium and Firefox:

| Row | Result |
| --- | --- |
| Field required email: type, clear, blur, so the error shows; then reset | `:user-invalid` false, but `aria-invalid="true"` and Field.Error "Please fill out this field." **stay** |
| Field `validate` (`"bad"` is invalid), default "ok": type "bad", blur, reset | value back to "ok", but `validationMessage` stays "no bad" and the error stays |
| `<form onReset={e => e.preventDefault()}>` with a checked Checkbox, reset | the browser does not reset, but the library dispatches `[false, "platform"]` and the box **unchecks** |
| CheckboxGroup controlled, parent refuses the reset, Parent box | OK (Items and Parent stay checked) |

## Must fix (or file before merge)

1. **Field.Root reset refresh runs before the algorithm**, at
   `packages/ui/src/field/field-root.tsx:400-405`. `useFormOwnerEvent(ownerRef, "reset")` with
   a `queueMicrotask` calls `refresh({ reset: true })`, which reads FormData, runs `validate`,
   calls `setCustomValidity` and reads `:user-invalid` and validity. After a button click all of
   that sees the user's values. The algorithm then clears `:user-invalid`, but nothing refreshes
   again. The result is a stale error, a stale `aria-invalid`, and a stale custom validity.
   That custom validity blocks the next submit with "no bad" even though the value is now valid.
   This bug predates the branch. It is in the same class as #185, and the issue asked for an
   audit. It also hits every control inside a Field, Combobox included.
   It slipped through because Field is not a `useFormReset` caller, so the audit skipped it.
   The existing rows, `field.browser.test.tsx:73` and `field.test.tsx:312`, use the script path
   or jsdom.
2. **Rule 7 is confirmed, not derived.** A `preventDefault()` from React's delegated `onReset`
   (or from any listener later than the form-element listener) is invisible to the microtask
   after a button click, so a cancelled reset still dispatches. See
   `packages/ui/src/internal/form/use-form-reset.ts:36-41`. The architect's CHANGELOG entry
   says "to be probed": it reproduces for Checkbox in Chromium and Firefox. It affects every
   `useFormReset` caller and Field too.
3. **The docs overclaim.** The CHANGELOG entry's "Only Combobox was affected", the memo's
   "Not affected" list, and rule 5's "This holds for every caller of `useFormReset`" (from the
   3be6c5b9 commit) are all wrong.
   - `CheckboxGroup.Parent` (`checkbox-group-parent.tsx:196-199`) reads and writes `el.checked`.
     It is harmless today because the algorithm or a later commit overwrites it.
   - `Select.Value` (`select-value.tsx:123-126`) refreshes `<selectedcontent>` from the
     pre-reset selection. The suite row passes, so something later re-clones, but the callback
     is not doing what its comment says.
   - Field is outside the rule's scope entirely.

**Suggested direction** (architect's call). Fix the timing once in the hook instead of in every
caller. In the microtask, `window.event === event` holds only during a task-dispatched event:
the checkpoint runs inside "inner invoke", before the current event is restored. In that case,
defer `onReset` and the `defaultPrevented` check by one task, so they run after the algorithm and
after all listeners. Use the same helper for Field's reset listener. That fixes 1 and 2 and makes
the old rule 5 sentence true in both orders. It also lets Select.Value and Parent keep their DOM
reads. The Combobox computed-target change is still worth keeping, because it is order-free.

## Combobox fix: checked, correct

The change is at `packages/ui/src/combobox/use-combobox-form.ts:58-63`. For a script reset it
is a no-op by construction: `onResetEvent` writes `input.defaultValue = inputDefaultValue`, so the
old DOM read returned the same value. For a button reset, `writeText` in the microtask goes
through the discrete reset event priority, so its commit lands before the algorithm. That commit
sets the value and react-dom rewrites `defaultValue` to the target, so the algorithm restores the
target. Cases checked:

- **Uncontrolled.** The target is the latest `defaultInputValue ?? ""`.
- **Controlled, parent adopts.** The target is the mount-time `inputValue`.
- **Controlled, parent refuses.** The resync layout effect re-writes the parent's text, and the
  row passes.
- **After a pick.** The text goes to `inputDefaultValue`, and `resetValue` dispatches the value
  target with `text: undefined`.
- **`defaultValue` without `defaultInputValue`.** The target is `""`, as before. A dev warning
  already covers this case.
- **`multiple`.** The text target is `""`.

Field integration is not correct, but only because of finding 1, not this change. No row covers
Combobox inside a Field with a real reset. Add one when finding 1 is fixed.

## #184 guard rows

The rows are at `combobox.browser.test.tsx:1701`, `combobox-multiple.browser.test.tsx:117` and
`multi-select.browser.test.tsx:99`. They are not vacuous: if an engine kept the listbox shown,
the click would run and the `not.toHaveBeenCalled` assertion would catch the dispatch.

- **Nit.** The premise is silent. When the `if (isOpen())` branch is skipped, the row passes
  without saying which path it took. Assert the observed premise first: `activeElement` is
  `body` and the listbox is closed, both via `settle`. Then keep the conditional click, or a
  comment saying it is dead today. An engine change would then fail on the premise with a clear
  message. As written, it would fail at `expect(action)` far from the cause.
- **Nit.** `isOpen()` is read right after `flushFor()`. If the focus-leaving close is still
  settling, the click lands on a closing popup. That is harmless (the expected result is the
  same), but `settle(() => isOpen() false)` before the branch removes the ambiguity, and it is
  the same change as the point above.

## Test flakiness

`clickReset` restores the act environment in `finally`, and `leaveActEnvironment` registers its
cleanup once, so this is good. I ran the 32 rows (Chromium and Firefox) once: green.

- **Nit.** `form-reset-button.browser.test.tsx:180` and `:343` assert a negative after a fixed
  50 ms act and timeout. That is acceptable for "nothing changes", but `quietPeriod` (already in
  browser-helpers) states the intent better.
- **Nit.** Several rows assert a second fact synchronously after a `settle` on the first:
  `:96`, `:124`, `:226`, `:248`, `:265` and `:372`. Most belong to the same commit. `:124` (text
  after the hidden value) depends on the text's urgent commit preceding the value's transition.
  That is true today, but wrap it in `settle` to be safe.

## Rule 5 wording (3be6c5b9)

The two-order description is correct per the HTML event loop: a checkpoint runs after a callback
only with an empty JS stack. The rule is needed. Corrections:

- Drop "This holds for every caller of `useFormReset`", or make it true (finding 3).
- Extend the rule to any `reset` listener, not only `useFormReset`, so that it covers Field.
- Add a note that `button.click()`, `fireEvent.click`, `requestSubmit`-style script, and any
  click inside `act` all take the **script** order. Only a real user click (Playwright, outside
  act) shows the button order. This explains why jsdom and act-wrapped rows such as
  `checkable-input-suite.tsx:127` and `value-action-suite.tsx:219` never caught it.
- If the hook-level fix above is adopted, rewrite rule 5 to "`onReset` runs after the
  algorithm and after every listener, in both orders", with the mechanism given once.

## Missing from the suite

- Field (any control) with a shown error.
- `onReset` `preventDefault` on the form.
- Combobox inside a Field.
- A controlled CheckboxGroup or Checkbox that refuses the reset. It passes in the probe; add it
  as a row.

## Re-review at d7201afe: clean

The fix: `useFormReset` calls back through `afterDispatch`, and Field.Root now uses
`useFormReset`.

**Must-fix 1 (Field) and 2 (cancel after the library's listener) are resolved.** I checked that
the new rows really catch the bugs. With only `use-form-reset.ts` and `field-root.tsx` reverted
to 4f6989b5, Chromium and Firefox fail 8 of the 46 rows in `form-reset-button.browser.test.tsx`.
The failing rows are the real-reset rows for a Field error, a Combobox in a Field, a cancel in
React's `onReset`, and a cancel in a document listener. With the branch as it is, all 46 pass. The
script-order rows pass in both cases, which is what they are there for.

**Must-fix 3 (the docs overclaimed) is resolved.** Rule 5 now says the callback runs after the
algorithm in both orders, so the DOM reads in Select.Value and CheckboxGroup.Parent are correct.

**Script order is unaffected.** `form.reset()` finishes its dispatch synchronously, so
`eventPhase` is `NONE` when the microtask runs, and the callback runs there, as before. A nested
call, `form.reset()` from inside another event's listener, takes the same path, because
`eventPhase` belongs to the reset event. I probed React's automatic reset after a real submit
click on Chromium and Firefox, with both a sync and an async `<form action>`. A Checkbox got
`[false, "platform", reset]` and unchecked, inside the default `settle` window.

Nits:
- `use-form-reset.ts:35` drops the cancel function that `afterDispatch` returns. If the
  component unmounts between the click and the task, the callback still runs. That is harmless
  today: Field's `refresh` returns early when the control is null, and the other callers only
  set state or dispatch.
- On the task path there is a one-task gap between the click and the callback. In theory, a
  user input already queued (Chromium gives input priority over timers) could commit before a
  Combobox reset dispatch and be overwritten by it. I did not observe this; recording it only.
- `form-reset-cancelled.test.tsx` runs in jsdom, where the order is always the script one, so it
  passes against the old code too. Its header says it is the script-order control, so this is
  fine.
