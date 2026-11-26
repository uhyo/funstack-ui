# #171 OTPField (developer notes)

Branch `feat/171-otp-field`, from `origin/design/171-avatar-scrollarea-otp` (3718ae62) + origin/master.
Avatar is a separate developer on `feat/171-avatar`; I touched neither avatar.md nor its code.
The CHANGELOG entry "#171: `OTPField` decided and implemented" has the amendments, probes and
device checks; this memo is what I would want next time.

## Built

- `packages/ui/src/otp-field/`: `otp-field-filter.ts` (pure: charset table, `applyEdit`,
  `activeRange`), `otp-field-context.ts`, `otp-field-root.tsx` (all state and handlers),
  `otp-field-input.tsx` (element, Field registration, native listeners, WebOTP, mount adoption),
  `otp-field-slot.tsx`.
- Root keeps `useLatest` under the name `propsRef`: React Compiler's lint treats `*Ref`
  identifiers as refs, so `propsRef.current` inside `useCallback([propsRef])` is not a
  "preserve-manual-memoization" warning. Named `latest` it warned on every callback (NumberField
  and Combobox get away with `latest` because the compiler bails on them earlier, I think).

## jsdom facts

- user-event 14.6 fires `beforeinput` (with `inputType`) before each `input`, `insertFromPaste`
  for `user.paste`, and keeps the caret; jsdom fires **no `selectionchange` on inputs**, but
  `select` (after `setSelectionRange`) and `keyup` do arrive. The Root reads the selection on
  those too.
- `expect.objectContaining({ event: undefined })` fails on a `createActionDetails` proxy
  (`event` is not an own key): assert `details.event` directly.
- Field `validate` reads `new FormData(form)`: outside a `<form>` it sees `""`.

## Browser facts

- **Write-back in the input event works in Chromium and Firefox**: assign `input.value`,
  `setSelectionRange()`, then setState. React's post-event `restoreControlledState` runs after
  `flushSyncWork`, so it compares against the new props and writes nothing; the caret stays.
- **Reset button vs `form.reset()`**: with a real click, a microtask checkpoint runs after each
  `reset` listener, i.e. *before* the reset algorithm. `useFormReset`'s `onReset` microtask then
  reads the old DOM value, and the React commit it triggers rewrites `defaultValue` (controlled
  input) to the old text, so the browser "resets" to what was typed. OTPField dispatches its
  computed target instead. Combobox has the bug (probe: `defaultInputValue="Jap"`, type `xyz`,
  click reset, input becomes `""`; script `form.reset()` gives `Jap`). Not fixed; reported.
- `userEvent.copy()` / `paste()` work in headless Chromium and Firefox for a page-internal copy.
- CDP `Emulation.setEmulatedMedia({ features: [{ name: "forced-colors", value: "active" }] })`
  makes `matchMedia("(forced-colors: active)")` true and forces an ordinary input's color.
- WebKit does not launch on this machine (host libraries): branch CI runs it.

## Interpretations I made (in the CHANGELOG amendments)

- No completion for an input event that inserted nothing kept and changed nothing.
- A dropped character over a selection keeps the selection (rule 3a).
- Input omits `onChange` from its props type.
