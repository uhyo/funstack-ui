# Architect notes: Combobox `multiple` (#164), 2026-11-26

Working notes behind `design/components/combobox.md` section 15. Not a spec.

## Prior art (checked 2026-11-26)

- **Base UI 1.9** (`base-ui.com/react/components/combobox`): `multiple`, value is an array of
  item objects. Parts `Chips` (div, wraps chips **and** the Input), `Chip` (div), `ChipRemove`
  (button), `Value` (render prop). "In multiple mode, selecting an item clears the typed filter
  and closes the popup when the input is rendered outside it"; keeping it open means cancelling
  the `item-press` close in `onOpenChange`. Left Arrow from the start of the input focuses the
  chips, Backspace / Delete removes one. No role documented for Chips / Chip; the example sets
  `aria-label` and `aria-description` ("Press Backspace or Delete to remove") by hand, and the
  strings are the consumer's.
- **React Aria 1.22** (`react-aria.adobe.com/ComboBox`): `selectionMode="multiple"`.
  `ComboBoxValue` render prop gives `selectedItems`; the documented way to show them is a
  `TagGroup` (a grid, own Tab stop, arrow keys between tags, Backspace / Delete removes the
  focused tag) whose `onRemove` filters `state.value`. The page does not say what the popup or
  the text do after a pick.
- **Ark UI 5.40**: `multiple`; "When `multiple` is `true`, the `selectionBehavior` is
  automatically set to `clear`"; chips are the consumer's ("render the selected items in a
  separate container") or a `TagsInput` composition. No chip keyboard on the Combobox itself.
- **Headless UI**: `multiple`, value array, the popup stays open, the consumer renders chips
  and clears the query itself.
- **APG**: no multi-select combobox, no chips. Listbox: `aria-multiselectable`, recommended
  model toggles with Space. Closest chip precedent: the layout-grid "pill list" example.

## Decisions I went back and forth on

- **Close after a pick.** Base UI closes by default with the input outside the popup; Headless
  and (as far as I can tell) React Aria stay open. Stay open: a multiple pick is rarely the
  last one, and it deletes the whole "close in the commit that ends the action" path from the
  multiple mode (no open-generation guard, no text guard). If the user wants Base UI's
  behaviour, it is a prop on the Root, not a different design.
- **Clear the text after a pick.** Keeping it helps "java" → Java, JavaScript. Clearing is what
  three of four libraries do and what a token field does. The cost of clearing: the list
  re-renders for `""` under the pointer. If asked for, a `clearOnSelect={false}`-style prop is
  cheap, since nothing else depends on the text.
- **Removed chip: gone at once or pending.** Optimistic rule says gone. The pending-removal
  chip is nicer for a slow server (the user sees what is happening to that item), but needs
  the union of optimistic and committed in `Chips`' state and a `data-removing`-like attribute,
  and it disagrees with CheckboxGroup, where an unchecked box is unchecked at once. Kept as
  decision 4.
- **Chip focus.** Three models: real roving focus (Base UI), a grid with its own Tab stop
  (React Aria), virtual highlight (Ark TagsInput). `aria-activedescendant` cannot point at a
  chip (not in the controlled listbox), so virtual focus would need `ariaNotify` per move.
  Real focus costs: the leave rule must treat `Chips` as inside; the listbox closes when focus
  goes to a chip (it cannot be operated from there).
  I also considered making `ChipRemove` the focus target (honest semantics: "Remove Japan,
  button"). Dropped: `ChipRemove` is optional and the focus ring belongs on the chip.
- **`role` of Chips / Chip.** `list` / `listitem`, with the role dropped while empty. Grid
  (`grid` / `row` / `gridcell`) needs a part per cell. A focusable `listitem` is not an
  interactive role; to check with screen readers.
- **Where `required` lives.** Input (computed) vs Root. Input keeps one call site for both
  modes and puts the browser's bubble on the visible field. The hole: unmatched text would
  satisfy `required`; closed by clearing the text on leave and on Enter while closed.
- **Hidden `<select multiple>`** instead of N hidden inputs: one element, posts natively. Not
  chosen (Firefox form-state restoration, reset algorithm vs React's `selected` handling,
  untested). Worth a probe if the N-inputs exception in conventions 1.1 is unwelcome.
- **Blur with `allowCustomValue`.** Commit (Gmail's recipients, our single mode) vs discard
  (Ark `TagsInput` default `addOnBlur: false`). Commit: losing a typed address on a click on
  Submit is the worse failure.
- **State shape of Input / Clear.** They are not generic over the mode. Added `values` and
  kept `value` (`null` with `multiple`) rather than widening `value` to a union nobody can
  narrow. The Root's state is typed per variant instead.
- **`value: string[]` vs `readonly string[]`** for the prop: kept `string[]` like CheckboxGroup
  and ToggleGroup. Widening all three to `readonly string[]` would be a separate, library-wide
  change.

## Implementation hints (not rules)

- The Root: one `useControllableAction` call whose type depends on the mode; the simplest
  split is two small hooks (single / multiple selection) behind one internal interface
  `{ has(value), isPending(value), toggle, remove, clear, hiddenValues }`, so Option, Clear
  and the keyboard do not branch on the mode.
- `internal/value-set.ts` (`applyPatch`, `toSet`) and `internal/use-value-set.ts` already do
  the set work; a JS `Set` keeps insertion order, which is the order rule of 15.2. The replay
  appends in dispatch order.
- Chip `label` in render: the label cache is a ref map. Read it into the dispatch (store the
  label with the optimistic patch or in Root state) rather than reading the ref during render.
- `useDeferredLeave` needs the `Chips` element as a third "inside" region.
- The removal announcement must read the chip's `textContent` before the optimistic render
  unmounts it: in the event handler, before `dispatch`.
- Announce on the Input, not the List: the List may be unmounted (popup closed).
- Tests that need a browser: the keydown-focus-then-type hand-over, light dismiss on
  `ChipRemove`, `valueMissing` on the visible input while the removal of the last chip is
  pending. Everything else is jsdom.

## For Select `multiple` (#165)

See 15.11. The open question there is the platform one (`<select multiple>` base appearance:
listbox mode shipped in Chrome 145 only; the multi drop-down is behind flags everywhere), not
the value contract, which is this one.
