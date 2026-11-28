# Component page standards (docs half of #199)

2026-11-28, branch `docs/consistency-pass`. Every component page in `packages/docs/src/pages`
follows these. A new page copies them; a change to one of them is a change on every page.

## 1. Sections: order, ids, heading text

Fixed order, fixed ids, fixed heading text. Optional sections are left out when they do not apply;
the required ones are never left out.

| Order | id | Heading | Required |
| --- | --- | --- | --- |
| 1 | (intro, hero `Example`, `BehaviourIndex`) | | yes |
| 2 | `anatomy` | Anatomy | yes |
| 3 | `how-it-works` | How it works | no; h4s for its topics |
| 4 | own ids (`swipe`, `scrolling`, `links`) | the topic's own | no; only here, between how-it-works and props |
| 5 | `props` | Props | yes; one h4 per part, anatomy order |
| 6 | `data-attributes` | Data attributes | yes |
| 7 | `keyboard-and-aria` | Keyboard and ARIA | yes |
| 8 | the five `BehaviourSection`s | fixed by `components/Concept.tsx` | yes |
| 9 | `forms` | Forms | form controls, Button, Dialog family |
| 10 | `styling` | Styling | no |
| 11 | `recipes` | Recipes | no; one section, h4 per recipe (CSS and React alike) |
| 12 | `browser-notes` | Browser notes | no |
| 13 | `not-included` | Not included | no; what the component does not do, and what to use instead |

## 2. Keyboard tables

- Columns: `Key | Behaviour`. Optional, always with these names and in this order:
  `Key | Where | Behaviour | Who | Dispatches`.
  - **Where**: the focused part, or the state the row applies to ("Trigger", "listbox open",
    "Item, vertical group", "anywhere"). Use it as soon as one row needs it; then every row has a
    cell. The Key cell holds keys only: never "Enter on the Trigger", always Key "Enter", Where
    "Trigger".
  - **Who**: who handles the key (the browser, a part), where the browser/library split is the point
    (Popover, Dialog, AlertDialog).
  - **Dispatches**: whether the key dispatches the value action (form controls that already have it).
- **Variant columns** replace `Behaviour` when the same key behaves differently per variant, and are
  named after the variant: `Horizontal | Vertical` (Slider: every key acts in both orientations),
  engine columns (Select), element columns (Button). Where an orientation only decides *whether* a
  key acts (Tabs, ToggleGroup, Toolbar), the orientation goes in **Where**, not in columns.
- Non-key input (Click, Hover, Pointer press, Touch, Wheel) may be a row; it is written as the input,
  first letter capitalised.
- A part named in Where is written as in the API, capitalised, no article ("Trigger", "Tab",
  "Item"); other Where cells are lowercase phrases ("a native radio", "listbox closed").
- Behaviour cells are sentences in the third person present ("Opens", "Moves focus"), ending with a
  period. Who / Where / Dispatches cells are fragments with no period.
- The modifier guard of conventions 3.10 is one row, worded identically:
  Key "Any of these with Alt, Ctrl or Meta, or already default-prevented", Behaviour
  "Not handled: the key is the browser's." (Accordion, Tabs, ToggleGroup, Toolbar, Menubar).
- "What assistive technology hears" tables of non-interactive components: `Case | Rendered | Announced`
  (Avatar, Separator).

## 3. Key spelling

- Key names are `KeyboardEvent.key` names: Enter, Space, Escape, Tab, Home, End, PageUp, PageDown,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, F8. Never "Left", "Down", "Up
  arrow", "Return", "Esc" (exception: a platform's own name for a shortcut it defines, such as
  ContextMenu's "Ctrl+Return on macOS", left as the platform writes it).
- Alternatives are joined with " / " and nothing else: "Enter / Space", "Enter / Space / ArrowDown",
  "Tab / Shift+Tab". A pair is in the order its Behaviour reads: "ArrowDown / ArrowUp" with
  "Next / previous". No commas, no "or", between keys.
- Several arrow keys at once: "Any arrow key / Home / End". Typeahead input: "A printable character".
- Modifiers with "+" and no spaces: Shift+Tab, Alt+ArrowDown, Ctrl+Enter / Cmd+Enter. "Cmd" in a
  shortcut a user presses (with its Ctrl twin); "Meta" in the guard sentence, which is about
  `metaKey` on every platform.
- Direction: "(swapped under `direction: rtl`)". Not "mirrored under RTL", not `dir="rtl"` (the
  library reads the computed direction).

## 4. Data attributes table

- Columns `Attribute | On | Meaning`; optional `Pseudo-class` column between On and Meaning where the
  page pairs each attribute with its platform pseudo-class (the native inputs: Checkbox, Switch,
  CheckboxGroup, RadioGroup, Select). Single-element components keep the On column (On = the
  component's name), so every table has the same shape.
- Pseudo-classes, pseudo-elements and the custom properties a part writes are rows of the same
  table, recognisable by their syntax (`:open`, `::details-content`, `--drawer-swipe-x`). Props
  (`side`, `align`, handlers) are not rows: they belong in the props table or a sentence.
- On cells: the page's own parts by bare name ("Root", "Trigger, Close"); another component's parts
  in full and as code (`Menu.Trigger` on the Menubar page).
- Mode qualifiers lead the cell: "Library mode: …. JS-free mode: …." (not a trailing
  "(library mode only)").

## 5. Props tables and the two fixed lines

- `PropsTable` only (Prop / Type / Default / Description). `className` / `style` / `children` rows
  from `functionProps` / `stylingProps`; the `render` row from `renderProp(element, state, note?)`.
  Every `render` description starts with `renderDescription`: "Replace the default <x> (element
  form) or take over rendering (function form)." and adds what the replacement must keep as a
  second sentence ("It must keep an `<input>`; …"). A row covering several parts is written by hand
  with the same opening.
- `disabled` on a form control: "Native `disabled`, or the enclosing `Field.Root`'s; never
  dispatches. A disabled <x> is not submitted."
- `PartFacts`:
  - **State**: "`XState` is `{ … }`; …".
  - **Owned**: the list of keys. Nothing owned: "none." A Root with no element: "none: the Root
    renders no element (no `ref`, `className` or `style`)." plus what else the Root has.
  - Keys owned but never written: a closing sentence "Owned and never written: `a`, `b`."
  - **No "Not in the props type" lists on parts.** The rule is stated once, where "Owned" is
    defined (`/concepts/render`, from conventions 1.5): an owned key that is not one of the part's
    own props is left out of the props type, except token-merged id lists, keys only removed in one
    case, and keys owned only inside another component. A part notes only an exception.

## 6. Part names and terms

- A part is written as in the API, capitalised, when the text means the part: the Trigger, the
  Popup, the Root, an Item. The namespace is added (`Menu.Trigger`, as code) for another component's
  part or where two namespaces meet.
- Lowercase is for the generic thing the user sees (an accordion item, the popup, the listbox, a
  menu) and for the concept term "trigger" (`/concepts/pending-and-optimistic#trigger`). On a page
  whose component has a Trigger part, "the trigger" is always the part: "Trigger".
- "Tab stop", with a capital T (the key's name).
- No "directive-free": say "no `"use client"`" (the term was never defined).
- `onOpenChange` owners: the conventions 2.1 list of nine, copied whole or not at all.

## What this pass did not unify (on purpose)

- The Meaning of `data-pending` rows: each states what is in flight for that part, which differs
  per component; only the mode-qualifier form and the Close rows' sentence (identical on Popover,
  Dialog, AlertDialog, Drawer) are fixed.
- A Dispatches column on every form control (V-L4 suggestion): needs per-control verification;
  CheckboxGroup, RadioGroup and Select have it.
- ContextMenu's Opening / pointer tables under How it works: component model tables, not keyboard
  tables.
