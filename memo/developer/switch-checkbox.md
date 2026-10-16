# Developer memo: Switch and Checkbox (#30), 2026-10-16

Implementation of `design/components/switch.md`, `design/components/checkbox.md` and the shared
native-input machinery of conventions 3.8.

## What is where

- `packages/ui/src/internal/`
  - `types.ts`: public `ChangeReason = "activate" | "platform"`, re-exported from the root.
  - `use-form-reset.ts` ("use client"): stable `reset` subscription on `ref.current.form`.
    A deps-less layout effect re-reads the owner after every commit and moves the listener only
    when the owner changed; a separate `[]` layout effect removes it on unmount. Listener queues a
    microtask, skips `defaultPrevented`, calls the `useEffectEvent`-wrapped handler.
  - `use-native-checked.ts` ("use client"): ref callback (dev tag/type warning once), mount
    reconciliation, re-apply after every commit, reset via `useFormReset`;
    `guardCheckableChange(event, dispatch, component?)`.
  - `use-native-group-reconciliation.ts` ("use client"): mount reconciliation + `useFormReset` on
    a fieldset, `Object.is` compare against `base()`. Not imported by any entry yet, so it is not
    in `dist` and not in the directive test (TODO for RadioGroup in `directives.test.ts`).
- `packages/ui/src/switch/`, `packages/ui/src/checkbox/`: components, `index.ts`, jsdom tests,
  browser tests.
- `packages/ui/src/__tests__/checkable-input-suite.tsx`: every Switch-plan row, parametrized by
  `{ name, Control, role, extraState, changeTypes }`; run by both component test files (Checkbox
  maps rows 1-25 one to one). `checkable-input-browser-suite.tsx`: same for browser rows.
- `packages/ui/src/__tests__/engine.ts`: `checkedMatchesWhileIndeterminate`.
- Example: `packages/example/src/switch-checkbox-demo.{tsx,css}`.

## Decisions / deviations

- **Group mode re-apply skips `checked` in the mount commit.** Conventions 3.8 rule 3 says mount
  reconciliation runs "before the re-apply effect". For a single control that holds by
  declaration order inside one hook. For a group it cannot: the members' layout effects run
  before the Root's (children first), so the Items would overwrite the hydrated DOM before the
  Root's `useNativeGroupReconciliation` reads it. `useNativeChecked` therefore never re-applies
  `checked` in the mount commit (React has just written it from the prop, or kept the hydrated
  value for the residual path). StrictMode's re-run of the mount effects is detected with a
  per-render token object captured by the effect (the re-run closes over the same render), so
  the second run also skips. `defaultChecked` and `indeterminate` are applied at mount as usual.
  Verified load-bearing: with the skip disabled, the group hydration tests fail.
- **`defaultChecked` is written before `checked`** in the re-apply effect: after a reset the
  dirty-checkedness flag is clear, and writing the `checked` content attribute (which is what
  `defaultChecked` reflects) then moves `checked` too; writing `checked` afterwards settles it.
- **`guardCheckableChange` takes a third, optional `component` argument** for the warning prefix
  (the design's signature has two). "Once per instance" is implemented as once per input element
  (a module-level `WeakSet` keyed by `event.target`), since a plain function has no instance.
- In the reset handler of `useNativeChecked` the options are read directly (not through the
  hook's other Effect Events): oxlint's rules-of-hooks rejects calling an Effect Event from a
  callback passed to another hook. `useFormReset` already wraps the handler in `useEffectEvent`.
- Checkbox `indeterminate` defaults to `false` and the hook always receives a boolean, so going
  from `indeterminate` to `undefined` clears the property.
- `indeterminate: undefined` in Checkbox's `libraryProps` needs an `as object` spread because the
  input props type has no `indeterminate`.

## Platform / tool findings

- **jsdom bug**: `_legacyCanceledActivationBehavior` for checkboxes does `checked = !checked`
  instead of restoring the pre-activation checkedness. After React's restore (to the unchanged
  prop) jsdom toggles it to the wrong value, so the DOM half of row 26 (cancelled pass-through
  `onClick`) is only asserted in the browser tests. Worth reporting to jsdom (human task).
- **Chromium 156: `:checked` does not match a checkbox that is checked AND indeterminate**;
  Firefox 157 does. Conventions 4.2 calls `:checked` / `data-checked` an exact equivalent; that
  is false for this combination in Chromium. Test asserts per engine via
  `checkedMatchesWhileIndeterminate`; the example styles the checkbox with `[data-checked]`.
- **Entanglement poisons later tests.** A test that fails before resolving its deferred leaves
  an async action pending; every later transition in the same file (same React instance) is
  entangled with it, so a single failure cascades into many unrelated ones (settle commits never
  land). Resolve deferreds before assertions that might fail, or read the first failure only.
- `userEvent` from `vitest/browser` is not wrapped in `act`, so console spies also catch React's
  act warnings; filter by message.
- WebKit not run locally (host libraries, see `browser-mode.md`); CI covers it.
- Firefox form-state restoration across reload: not automatable in vitest browser mode (needs a
  top-level navigation); TODO note in `checkable-input-browser-suite.tsx`. Same code path as the
  pre-hydration click, which is covered in both engines.

## For RadioGroup

- Items: `useNativeChecked({ type: "radio", group: true, checked, defaultChecked })`; no
  `latestInFlight` needed (the Item never reports). Root:
  `useNativeGroupReconciliation({ element, readCurrent, readDefault, base, onPlatformChange })`.
  `src/internal/use-native-group-reconciliation.test.tsx` has a minimal radio group built exactly
  that way (hydration, StrictMode, reset to a value and to `null`, cancelled reset).
- Add `internal/use-native-group-reconciliation.mjs` to the directive test's client list.
- `guardCheckableChange(event, dispatch, "RadioGroup.Item")` for the click guard and warning.
