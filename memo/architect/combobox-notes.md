# Architect notes: Combobox (#50), 2026-10-17

Working notes behind `design/components/combobox.md`. Not a spec.

## Prior art read for this design

- Base UI (1.6): separate `Combobox` ("filterable Select, no free text") and `Autocomplete`
  (`value` is the text; `mode: list | both | inline | none`). Parts: Root, Label, InputGroup,
  Input, Trigger, Icon, Clear, Value, Chips/Chip/ChipRemove, Portal, Backdrop, Positioner,
  Popup, Arrow, Status, Empty, List, Row, Item, ItemIndicator, Group, GroupLabel, Separator,
  Collection. Root props: value/defaultValue/onValueChange, inputValue/defaultInputValue/
  onInputValueChange, filter (or null), filteredItems, items, autoHighlight, highlightItemOnHover,
  multiple, name/form/autoComplete, open/defaultOpen/onOpenChange, isItemEqualToValue,
  itemToStringLabel, openOnInputClick (Autocomplete), submitOnItemClick (Autocomplete).
  Async: `filter={null}`, fetch in onInputValueChange with AbortController, `aria-busy` on Popup.
- React Aria `ComboBox`: one component, `allowsCustomValue` (text reverts on blur without it),
  `inputValue`/`onInputChange`, `selectedKey`/`onSelectionChange`, `menuTrigger: input|focus|manual`,
  `loadingState`, `formValue: "text" | "key"`.
- Ark UI `Combobox`: `allowCustomValue`, `inputBehavior: autohighlight|autocomplete|none`,
  `selectionBehavior: replace|clear|preserve`, `openOnClick`, `loopFocus`.
- Headless UI `Combobox`: `value/onChange`, `Combobox.Input displayValue`, `onChange` for query,
  `immediate`, `nullable`, `virtual`.

Borrowed: Empty/Status/List/Popup split (Base UI), `allowCustomValue` + blur revert (React Aria),
`openOnClick` / `loop` (Ark), `autoHighlight` (Base UI/Ark). Rejected: `items`/`filter`/
`itemToString` (Server Component boundary, duplicates options, not Suspense-shaped), Portal/
Positioner/Arrow, Chips (v1), `displayValue` (two explicit states instead).

## Decisions I went back and forth on

- **Urgent action naming.** Three candidates: `onInputChange` (first `on*` ever; would be
  copied), `inputValueAction` (reads as a pure trigger), `inputValueChangeAction` typed
  `UrgentChangeAction`. Chose the third: the triple survives, the type carries the lane. The
  cost is that the name does not shout "urgent"; the type and the doc comment do.
- **Active option lane.** Considered a transition (everything is transition). Rejected because
  arrow-key navigation would freeze while any async action is pending (entanglement), and
  because activedescendant is focus, which is urgent/browser-owned everywhere else. Rule
  proposed for conventions: virtual focus is urgent.
- **Hidden input location.** Root renders it as its single element (conditional on `name`).
  Alternatives: a `HiddenInput` part (noise), the Input rendering two elements (breaks the one-
  element rule), a wrapper div (unasked-for element, wrong anchor box).
- **Popup vs List.** The research's single `role=listbox popover=auto` element cannot hold
  Empty/Status. Two parts; `aria-controls` → List, `showPopover` on Popup.
- **Close after accept.** Followed Menu decision 3 (stay open with data-pending, close in the
  settle commit). Text changes at once; rollback reverts it. Escalated as question 4.
- **Label derivation.** Library writes text only on accept (label read from DOM at that
  moment), revert, Clear, reset, mount. Never from a `value` prop change. Preselected values
  need `defaultInputValue`. Dev warning at mount. Escalated as question 3.
- **Escape.** Not intercepted; platform close watcher handles it; second Escape reaches an outer
  Dialog. Dropped "Escape clears" (APG optional). Escalated as question 9.
- **Tab accept.** No. Escalated as question 5.
- **Trigger `commandfor`.** No: the anchor must be the input. Escalated as question 8.
- **`announce` default.** None (no shipped strings). Escalated as question 6.
- **Logical `position-area`.** `block-end span-inline-end` instead of the shared physical
  helper; RTL for free; no side/align props.

## Things to verify during implementation

- `useDeferredValue` re-render is NOT entangled with a pending async action (section 4's claim;
  browser row "typing while a save is pending"). If it is, document and move on; the design
  does not depend on it beyond that sentence.
- React's optimistic sync flush happens before implicit form submission on Enter (hidden input
  carries the new custom value in FormData), in all three engines.
- `useDeferredValue` + `use()` inside the List: a *newly mounted* boundary shows its fallback
  (first open) but an already-shown one keeps old results under a deferred update. Confirm
  there is no fallback flash when the List's children function identity changes per render.
- react-dom keeps the DOM value of a hydrated text input and fires no onChange (mount
  reconciliation reads it in a layout effect; `suppressHydrationWarning` on `value` may be
  needed — check whether hydration warns about a value attribute mismatch; it should not, since
  React compares the `value` *attribute* for inputs? Verify).
- `encodeURIComponent(value)` as an id fragment: characters `!'()*` are left as is and are valid
  in ids; fine. Empty-string value → id `..-option-`; allowed but discourage `""` values.
- Firefox form-state restoration of the visible text input across reloads arrives through mount
  reconciliation; the hidden input is not restored (hidden inputs are not autofilled/restored).
- WebKit 302008 with `flip-block` on the listbox inside Popover (dedicated row).
- `ariaNotify` on an element inside a popover: announced? (Chromium 141+, Firefox 150, Safari 27.)
- `onPointerDown preventDefault` on the Popup also blocks text selection inside options and the
  scrollbar drag? Scrollbar drag still works with preventDefault on pointerdown in Chromium (the
  scrollbar is not a pointer target for the event's default action of focus change… verify in
  Firefox / WebKit; fallback: prevent only when `target.closest('[role=option]')`, and accept the
  blur-on-scrollbar case through `relatedTarget === null`? No: scrollbar clicks focus nothing; the
  input keeps focus in Chromium. Verify).

## Status

Design written and committed as proposed; eleven questions for the product owner; conventions
changes listed in the doc (not applied: another session owns conventions.md today).

## After acceptance (2026-10-17)

Accepted with one user override: `announce` ships a default English message ("No results" /
"1 result" / "N results"), overridable, `null` to silence. New conventions section 11 (built-in
strings: English defaults, accessibility-only, always a function prop, no locale mechanism).
Conventions feedback 1 to 12 applied (2.6 urgent lane, 3.2 virtual focus row, 3.5 residual
paths, 1.1 vocabulary, 4.1 rows, 5.1 deferred note, 5.3 types, 7.3, 8, 9.4, 10.1 row,
resolved question 27, decisions row 11).
