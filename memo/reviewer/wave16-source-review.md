# Wave 16 source cleanup review (#102, branch wave16/source-cleanup @ 9ed61e9)

Reviewed 2026-10-24 against merge-base d256271. Checks run in a scratch worktree: typecheck, lint,
format:check, build, test:run (jsdom + Chromium): all pass (78 files, 3272 passed, 5 skipped).

Verdict: **merge after minor fixes** (M1 required; the rest are small).

## Findings

### M1 (medium): element / name dev checks no longer strip from production bundles
`useElementCheck(message)` / `useNameWarning(message)` / `useShownNameWarning(..., message)` take the
message (closure or string) as an argument at the call site, outside any `isDev` branch. The hook
returns `undefined` in production, but the argument is live code, so a consumer's minifier cannot
drop it. Base code had `if (isDev && ...) console.error("...")` inside each part, which folds away.
Measured: rolldown bundle of `src/index.ts`, `NODE_ENV=production`, minified:
- base: 0 occurrences of "expected to render", "rendered a <", "has no accessible name";
- branch: 12 / 6 / 6 (28 distinct messages: Accordion.Item/Trigger, Field.Label/Control,
  Form.Root/Submit, RadioGroup/CheckboxGroup.Root, Dialog.Popup/Trigger/Close, Popover.Close,
  overlay popup + trigger, Menu.Popup, Combobox.Popup/Input/List/Trigger/Clear, NumberField.Input/
  Label, Slider.Label, Toast.Close, use-native-checked, Select parts).
- size: 194,307 -> 198,140 B min (+3.8 KB), 59,053 -> 60,720 B gzip (+1.7 KB), despite -150 lines.
Fix: keep the per-file `const isDev` at call sites and pass `isDev && ((el) => ...)` /
`isDev ? "..." : ""` (hooks accept `false`), so the literal folds away. Also note: the hooks still
run `useRef` + `useLatest` (an insertion effect) + `useCallback` per instance in production.
Pre-existing, not this branch: `useDevWarning(cond, "message")` already ships its strings
(e.g. "Tabs.Root: neither `value` ..."); worth a repo issue as a follow-up.

### L1 (low): public `transition` JSDoc lost consumer-facing content
The shortened "Static (conventions 5.1): ..." sentence on ~14 `transition` props drops the
`<Activity>` reveal case (relevant to keepMounted popups / panels) and the consequence (≈250 ms
page cross-fade, next transition waits), and points consumers at an internal design doc they
cannot see. Popover.Popup's "A plain open does not pay it" now has no antecedent for "it".
Suggest: "Static: setting or unsetting it remounts the element. Any value, "none" included, makes a
mount or <Activity> reveal inside a transition start a document view transition (a ~250 ms page
cross-fade the next transition waits for)."

### L2 (low): Menu trigger state docs now wrong
`MenuTriggerState`, `MenuContextTriggerState` (and SubmenuTrigger's alias) became aliases of
`PopoverTriggerHookState`, whose `open` doc says "`false` in JS-free mode". Menu has no JS-free
mode (menu.md 2). Either keep the hook doc mode-neutral or leave Menu's interface.

### L3 (low): undeclared dev-only change
Toast.Close's name warning is now once per instance (was once per attach). Only Dialog.Popup is
declared in the commit message / developer notes. Harmless; record it.

### N (nits)
- `slider.test.tsx`: the 3 removed assertions are only 2 duplicates; `decimalsOf(5) === 0`
  (integer case) is covered nowhere else now. Add it to number-field-format.test.ts.
- `use-native-checked.ts` `group` JSDoc rewrap is ragged ("the hook does / the element check and
  the re-apply / only;").
- `...{ indeterminate: undefined }` (checkbox, checkbox-group-parent): spreading a literal reads
  odd; fine with the comment.
- `TEXT_NAME` is local in toast-close while `BUTTON_NAME` is exported from use-name-warning.
- `menu-point.ts` is Menu-only; `menu/` would be a more natural home (audit placed it in internal/).
- Design docs still name `useMergedRef` (field-form.md 1405/1423, slider.md 904/1057,
  toggle-group.md 1101, conventions.md 1158) and context-menu.md 1120 lists MENU_POINT_* under
  anchor-position.ts. Designer's files; flag to the PO.

## Verified (no issue)
- useMergedRefs: undefined dropped, single ref passed through (object or callback) has the same
  attach/detach effect as the merged callback; memo deps are the refs, same identity rules as the
  old `useMemo(mergeRefs)` / `useMergedRef` at every call site (fixed arity). Slider.Root's
  `useMergedRef(undefined, x)` -> `x` identical. In production some popups now pass `setElement`
  directly (devRef undefined): same effect.
- useLatest replacements: same insertion-effect timing; same effect order. Combobox `committedRef`
  initial value only read after an awaited action rejection (post-commit). TDZ safe.
- requestClose === notifyClosed: same body/deps; identity stable.
- isPopoverOpen: only differs where `:popover-open` throws.
- CSS text of menu point rules / FSUI_PRECEDENCE byte-identical (diffed); CSP hash row passes.
- resolveArrowKey / focusWithRing byte-identical to both old copies; RTL computed by callers as
  before. useNativeFocusgroup identical snapshots. useHydratedMount identical to the Parent's copy.
- value-set / dom-order: identical bodies; the comparator differs from the old Accordion/ToggleGroup
  one in no reachable case (contains -> PRECEDING, contained -> FOLLOWING; a===b handled).
  EMPTY_SET shared across components: never mutated or identity-compared.
- Element checks: run at ref attach (layout), message read through useLatest (insertion effect
  already ran): same timing. Ref callbacks lose deps on isLibrary/modal (re-attach no longer
  happens on a `modal` change): harmless, the re-attach only rewrote the same element.
- Warning texts: string-literal multiset diff over the non-test source shows every message
  unchanged (the two Combobox name messages moved from a template to literals, same text).
- Import-order commit: pure line reordering (sorted-line hash per file unchanged).
- Comment commit: comment-only apart from moving DEFAULT_FOCUS below MenuRoot's JSDoc.
- Tests: only import paths changed plus the slider assertions.
- C14: TabsChangeReason / AccordionChangeReason were never exported from an index; ChangeReason is.
