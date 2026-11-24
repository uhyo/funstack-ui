# #157 refactor-audit candidates 7 (small helpers) and 10 (dev warnings)

Branch `refactor/157-helpers`, based on `bce647a`. Not merged. A trial `git merge-tree` against
`origin/master` at `4ba75d0` (after the combobox / toast split, #160) merges cleanly
(`directives.test.ts` changed on both sides, no conflict).

## Candidate 7, per helper

| # | Helper | Result |
| --- | --- | --- |
| 1 | `useMountFixed(value, isDev && message)`, `internal/use-mount-fixed.ts` | Done: overlay Roots' mode, Accordion's mode and `exclusive`, ToggleGroup's `exclusive`. `useLibraryMode` not done: with `useMountFixed` a mode detection is one call holding only its own prop list and message. Added to `production-bundle.test.ts` `DEV_CALLEES`. |
| 2 | `useResetTarget(value, defaultValue)` in `use-form-reset.ts` | Done: Slider, NumberField, Select, Combobox (value and text). Returns `undefined` when absent; callers keep their own fallback, since the four differ for "controlled after an uncontrolled mount" (Slider / Select: current value; NumberField / Combobox: `null`). |
| 3 | `intendedValue` | Done at all six sites (`useNativeChecked` x2, Accordion x2, Dialog.Root, `useOverlayRoot.intended`). Signature accepts `undefined` `latestInFlight`. Dialog.Root uses `intendedValue(latestInFlight, optimistic)`, not `intended()`: `intended()` reads `optimistic` through `useLatest`, which is equal there only by insertion-effect order. |
| 4 | `useRegisterCount` | Done: NumberField Labels, Combobox Statuses (with `countRef`) and Labels. |
| 5 | `compareDocumentOrder` / `sortByDocumentOrder` | Done: Tabs' transition direction, Combobox options. Skipped: toast (now `toast/use-toast-focus.ts` `byDocumentPosition` on master, after the split). |
| 6 | `internal/focusable.ts` | **Skipped.** The three selectors differ (roving: no hidden input, no `area` / `iframe`, `contenteditable` not `false`; Menu: any `input`; Tooltip: `area[href]`, `iframe`, any `[contenteditable]`, no `summary`). Unifying them changes behaviour; keeping three constants in one file says nothing about which differences are wanted. Needs a decision (category B). |
| 7 | `toggleFromTrigger(ctx, event, beforeOpen?)` in `use-popover-trigger.ts` | Done: `usePopoverTrigger`, Combobox.Trigger. |
| 8 | `resolveFieldDefaults` in Combobox.Root | **Skipped** (file excluded). Equivalent on master: `resolveFieldDefaults(field, { name: props.name, disabled: props.disabled ?? false, required: false })`, using `name` / `disabled` only. |
| 9 | Accordion keys | Done: `resolveArrowKey(key, "vertical", false)`; `nextTrigger` keeps its own arithmetic (works from a disabled current trigger, which the roving engine never has). New test: ArrowLeft / ArrowRight do nothing, also in RTL. |
| 10 | Directive-free `reportDropped` | Done: `useConnected` moved to `use-connected.ts`; `callUrgentHandler` imports `reportDropped`. `directives.test.ts` rows added. |

## Candidate 10

- Tooltip: `[Tooltip] ` becomes `Tooltip.Trigger: ` (two) / `Tooltip.Popup: ` (one); the
  mechanism stays (an effect in the Root that reads DOM attributes of state-held elements and
  re-runs on `provides` / element change; neither hook fits). New test pins the prefixes.
  Conventions 7.2 now states the `Part.Name: ` form.
- Converted: `useControllableAction` x2 and `useTransitionBoundary` (`useDevWarning`);
  `Select.Value` outside `<select>` (`useSelectPartRef` position check); `Dialog.Trigger` without
  a Popup (`useElementCheck` from its ref). Those last two used to warn per effect run (twice
  under StrictMode), now once per instance. New tests: Select.Value in a portal warns;
  Dialog.Trigger before its Popup under StrictMode does not warn.
- Not converted (timing fits no helper): from callbacks or handlers: `field-root.tsx` two
  controls / two Errors, `use-thumb-registry.ts` x2, `slider-root.tsx` no Track,
  `use-option-registry.ts` duplicate, `radio-group-root.tsx` partial hydration,
  `menu-context-trigger.tsx`, `overlay-popup.tsx` `useInitialFocusTarget`. From effects reading
  the DOM or refs: `field-root.tsx` no control, `use-item-order.ts`, Tooltip. A fourth helper for
  "once per instance from a callback" (`useWarnOnce(): (message) => void`) would cover the first
  group; not added (the task said the existing three).
- Skipped files: `toast-viewport.tsx` (two sites; on master its "another Toast.Viewport already
  renders this manager" could be `useDevWarning(rejected, ...)`, `rejected` being state, one
  commit later and once per instance; `toast.update: no toast` is in a handler and stays).
- The "no Popup rendered" check for Popover / Menu Triggers (audit row 14) not added: new
  warnings are a behaviour change.

## Checks

- jsdom: master 75 files / 3856 tests; branch 81 files / 3890 tests, all pass.
- Browser, `FUNSTACK_BROWSERS=chromium,firefox`: master 54 files, 1049 passed, 39 skipped.
  Branch: 54 files, 1049 passed, 39 skipped (same skip count).
- `pnpm typecheck`, `pnpm lint` (two pre-existing warnings), `pnpm format:check`, `pnpm build`
  green.
