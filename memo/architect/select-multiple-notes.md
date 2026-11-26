# Architect notes: Select multiple / MultiSelect (#165), 2026-11-26

Working notes behind `design/components/multi-select.md`. Not a spec.

## Prior art (from the research doc and from memory; not re-fetched today)

- **Base UI 1.9**: `Select.Root multiple`. Its single Select is already a JS listbox
  (`Select.Trigger` is a button, `Select.Popup`, `Select.Item`), so the flag changes the value
  type only. `Select.Value` takes a function child. Hidden input for forms.
- **React Aria 1.22**: `Select selectionMode="multiple"`; a hidden native `<select>` for forms
  and autofill. Same remark: the single Select is a JS listbox.
- **Headless UI 2.2**: `Select` is a thin wrapper around the native select; the custom one is
  `Listbox`, which has `multiple`. The closest precedent for the split recommended here.
- **Ark UI**: `Select multiple` (JS), and a separate inline `Listbox`.
- **Radix**: no `multiple` on Select. shadcn users build a multi-select from Popover and
  Command (a combobox with a search field).
- **Mantine, PrimeReact, Carbon**: a component named `MultiSelect`.
- **APG**: "Select-Only Combobox" (single; Tab selects), "Listbox" (multi-select: Space
  toggles, optional Shift / Ctrl+A range keys). No multi-select select-only combobox example;
  the design combines the two.

The statements about Headless UI, Ark, Radix, Mantine, PrimeReact and Carbon are from memory.
The docs writer should re-check them before they appear on a docs page.

## Decisions I went back and forth on

- **Home.** (a) is what users of three libraries type first. What decided against it: the
  parts cannot be typed (a part does not see the Root's flag), and the future native
  `<select multiple size=1>` wants the same name. (b) is the cheapest diff, but
  `Combobox.Trigger` would mean two things and the server HTML must already know which
  (`tabindex`, `role`), so a Root prop is needed anyway; at that point it is a component in
  all but name, placed where nobody looks.
- **Name.** `Listbox` would be general (it could take single selection later) but #162 P3
  says "inline Listbox". `MultiSelect` is narrow on purpose. If the user later wants a JS
  single select, the honest path is to rename before 1.0, not to pick a vague name now.
- **`aria-expanded` on the Trigger.** Conventions say no `aria-expanded` on a `popovertarget`
  button. Three ways out: (1) not an invoker, and keep the listbox open across the Trigger's
  own press with pointer capture (the Input's trick; but capture retargets the click away
  from the button, which the Trigger needs); (2) an invoker without the attribute (a combobox
  with no state before hydration, and static checkers flag the missing required state);
  (3) an invoker with the attribute from `shown`. Chose (3). Chromium and WebKit ignore the
  attribute in favour of the popover's state, Firefox ORs: all three agree with `shown`.
  Not probed with `role="combobox"` on the button: B.16.
- **Document order vs pick order.** Tried to make document order work: sort by the registry's
  DOM order when the options are mounted, else keep the stored order. That gives an order
  that changes when the listbox opens. Dropped.
- **Labels for `Value`.** Considered `keepMounted` by default so the options are in the HTML.
  It does not help: a hidden `<Activity>` runs no effects, and the server runs none either,
  so the label cache is empty in exactly the cases that matter. Considered an `items` prop
  (Base UI): a second source of truth next to the rendered options, and wrong for options
  that load on open. Function `children` it is.
- **`required`.** Candidates for the validity element: a hidden `<select multiple>` mirror
  (posts natively too, but #164 rejected it: Firefox restoration, React's `selected`
  handling), a hidden text input (message "Please fill out this field"), a checkbox (wrong
  message), a one-option `<select>` with a computed `required` (right message, nothing to
  control or restore). Chose the last. The bubble's behaviour after the focus hand-over is
  the main unknown; if it is bad in an engine, the fallback is to cancel `invalid`, focus the
  Trigger and rely on `Field.Error`, and to document `required` as needing a Field.
- **`disabled` and the hidden inputs.** Combobox's hidden inputs still post while disabled.
  A native disabled select posts nothing. Kept Combobox's rule so the form hook is shared;
  worth revisiting for both components together.
- **Tab.** The APG single select-only combobox selects on Tab. With several values that is a
  toggle of whatever the user arrowed past. Tab only closes.

## Implementation hints (not rules)

- Wait for #164 to merge; build on its selection interface
  (`{ has, isPending, toggle, remove, clear, hiddenValues }` in the #164 notes).
- The shared listbox hooks need `action/` and `overlay/` (the popover root) and the form
  reset from `form/`; `form/` and `overlay/` may not import each other (conventions 9.1), so
  either the shared hooks stay split by subject or `internal/` gets a fourth subfolder above
  both. Decide with `scripts/check-internal-layers.mjs` in hand.
- Typeahead: lift the buffer and the matcher out of `menu/use-menu-keyboard.ts`.
- `Field.Label` forwards a click to a button control. Our own `Label` cancels the forward at
  the source; `Field.Label` needs the same rule for this control (a small Field change).
- jsdom covers the keys, the value rules and the hidden inputs. Browser tests: the Trigger's
  press while open (no light dismiss), focus on WebKit after a mouse press, the validity
  element, anchoring and `min-width`.

## If the user picks another home

- (a): the document becomes sections of select.md; select.md decisions 1, 2, 12, 15 and
  section 13 change; ask about research option D first, since it removes B.4's API.
- (b): combobox.md section 16; `required` on the Root for this mode; a `selectOnly` prop (or a
  second trigger part) because the server HTML differs.
