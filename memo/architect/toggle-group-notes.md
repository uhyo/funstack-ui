# Architect notes: ToggleGroup and Toolbar (#66), 2026-10-18

Working notes behind `design/components/toggle-group.md`. Not a spec; the design doc is.

## The decision I went back and forth on: who owns `tabindex` in a Toolbar

A Toolbar's items are arbitrary (library triggers, plain buttons, links, inputs), and the "current"
item is a focus fact, not a value, so Tabs' trick (render `tabindex` from the selected value;
List-as-tab-stop with a focus redirect for the null case) does not transfer:

- List-as-tab-stop for "no pressed item" would make Shift+Tab out of a multiple-mode ToggleGroup a
  double stop in the common all-released state. Rejected as a default.
- Registration with state (Items register value + disabled, Root computes the stop) gives correct
  roving `tabindex` for ToggleGroup Items only; it costs a render after mount and does nothing for
  plain children of a Toolbar. Server HTML still carries no useful `tabindex` (registry empty), so
  the pre-hydration story is the same as the DOM-written one.
- Item wrapper parts (`Toolbar.Button render={<Menu.Trigger />}`) or a context read in every
  trigger part: the PO asked that `Toggle` stay unchanged; `Menu.Trigger`'s `onKeyDown` is owned,
  so an outer part's handler would be dropped; the call site doubles in wrappers.
- React Aria's Tab interception over natural `tabindex`: re-implements sequential focus navigation.

Chose: one engine (`useRovingFocus`) that queries items from the DOM and writes `tabindex` through
the DOM, for both the Toolbar and a standalone ToggleGroup. Precedent in conventions 7.4 (DOM-written
`aria-expanded` for JS-free Popover; `hidden="until-found"` upgrade). Cost named in recommendation 6
for escalation. Standalone ToggleGroup uses the same engine with `memory: false` and a pressed-first
`entry`, so there is one mechanism, not two.

## Why `exclusive` and not `multiple`

Accordion already discriminates on `exclusive` (`string | null` vs `string[]`), and toggle.md §10
forecast exactly that shape. Base UI's `multiple` (single default) would be the second spelling of
the same idea in one library.

## Why `deselectable` (default true)

A pressed `aria-pressed` button announces that it can be released. `required` would suggest form
validation (CheckboxGroup renders native `required`), which a ToggleGroup has no part in.
`disallowEmptySelection` (React Aria) is a double negative. Exclusive-variant-only, so
`exclusive={false} deselectable` is a type error.

## Menu.Trigger in a vertical toolbar

Perpendicular-axis opening generalises both the APG Toolbar example (horizontal: Down opens) and
`Menu.SubmenuTrigger` (inside a vertical menu: Right opens). Needs `getComputedStyle(trigger).direction`
at keydown for RTL. The alternative (Enter / Space only in vertical toolbars) is simpler and APG-legal;
listed as the alternative in recommendation 4.

## Tab from a text-entry item

Chromium's native `focusgroup="toolbar"` moves Tab to the next item from an input (research 1.3). The
JS path must match or the flag changes behaviour. Bounded interception: the target is always an item
the engine already found. APG's "one such control, last" keeps it mostly unobservable.

## Things to verify at implementation (browser suite)

- A role-less wrapper (`div role="group"`) between `focusgroup="toolbar"` and its buttons is
  transparent in Chromium (the probe nested a `focusgroup="radiogroup"`, not a plain group).
- `focusgroupstart` on a `role="group"`'s child under `focusgroup="toolbar … nomemory"` enters there.
- `el.tabIndex = -1` written by the engine vs React: none of the library's trigger parts renders
  `tabIndex`, so React never rewrites it; confirm with `Toggle`, `Menu.Trigger`, `Popover.Trigger`.
- `MutationObserver` + `useEffectEvent`: the observer callback must not run `apply` during a React
  commit (it runs as a microtask after mutations; fine).

## Conventions edits made (pending acceptance)

Header note; 1.1 `Item` / `Button` / `Separator`; 3.2 roving stop paragraph; 3.6 `Toolbar.Button`;
4.1 `pending` / `pressed` / `orientation`; 5.3 types; 7.1 `toolbar-context.ts`; 7.4 row; 8 flag
row; 9.1 files; Open questions entry.

## Wave 7: #74 probe (2026-10-18)

`memo/architect/probes/toolbar-radios-focusgroup.mjs` (+ `.output.txt`), Chromium 156.0.8078.4
through the repo's Playwright install, no flag (`focusGroup` is in the prototype in that build).
Same-`name` native radio groups inside `focusgroup="toolbar wrap"` and `toolbar block`.

What changed against my open-question proposal (6e61bdb):

- Confirmed: radios own all four arrows (not only the toolbar's axis) plus Home / End; the group
  checks as it moves and wraps within itself; the toolbar's arrows land on the checked radio, else
  the first from either side; Tab / Shift+Tab from the checked radio (or any radio when none is
  checked) go to the adjacent toolbar item, as from a text input; memory re-enters on the radio.
- Added: Tab from an unchecked radio with a checked sibling visits the sibling first. That is plain
  native sequential navigation (only the checked radio is tabbable), so the JS rule replicates it;
  it is rare (arrows check as they move, so an unchecked focused radio needs a click or script).
- Dropped: `role="radio"` from the unit rule. Chromium treats `button[role=radio]` as plain
  toolbar items unless they sit in their own nested focusgroup, which is a separate segment.
- Noted: entering an unchecked group from the right lands on the **first** radio, not the last
  (`b3` ArrowLeft → `s`).

Design: section 17 (rule, test rows 25-28); #75 as section 18. The Toolbar page's callout should
be rewritten by the implementer per 17.2 item 6.
