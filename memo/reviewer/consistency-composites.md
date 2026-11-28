# Consistency audit: disclosure, navigation, composite and display components

Scope: Accordion, Collapsible, Tabs, Toolbar, ToggleGroup (roving focus), Menubar and
NavigationMenu (roving and keyboard), Button, Avatar, Progress, Meter, Separator. Checked
against the code on master at fd4c414b, `design/conventions.md` (with `direction-locale.md`,
`internal-hooks.md`, `testing.md`), the component design docs, the docs pages and the skill.
Paths are relative to `packages/ui/src/` unless they say otherwise.

## Matrix (as implemented)

| | State / action | Details | Root state carries value | Arrow keys | `loop` | `orientation` | Disabled item in arrow order | Modifier guard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accordion | `value` / `valueChangeAction` (`exclusive` union) | `reason`, `item`, `open` | no | Root `onKeyDown`, vertical only | none (always wraps) | none (vertical) | **skipped** (still Tab-focusable) | **none** |
| Collapsible | `open` / `openChangeAction` | `reason` | `open` | none | n/a | n/a | n/a | n/a |
| Tabs | `value` / `valueChangeAction` | `reason` | `value` (optimistic) | List `onKeyDown`, own arithmetic | `true` | Root | **reached** | Alt/Ctrl/Meta, `defaultPrevented` |
| ToggleGroup | `value` / `valueChangeAction` (`exclusive` union) | `added`, `removed` | `value` (always `string[]`) | roving engine | `true` | Root | native `disabled`: not an item | engine's |
| Toolbar | none | none | none | roving engine (`memory`) | `true` | Root | `aria-disabled` reached, `:disabled` not | engine's |
| Menubar | none (each Menu's own) | n/a | none (empty state) | roving engine (`memory`) | `true` | none (horizontal) | reached (`aria-disabled`) | engine's |
| NavigationMenu | per Item: `open` / `openChangeAction` / `onOpenChange` | `reason` | Item: `open`, `pending` (no attributes) | none (native Tab) | n/a | n/a | n/a | n/a |

RTL (14.1) is consistent: Tabs reads the List's direction (`tabs/tabs-list.tsx:125`), the
engine the container's (`internal/use-roving-focus.ts:319`), Menubar the bar's
(`menubar/menubar.tsx:171`), all through `resolveArrowKey`; Accordion is vertical only. Value
displays are consistent: `--progress-value` / `--meter-*` / `--slider-value` are all
percentages; `getAriaValueText(value, state)`, `format`, `locale` are identical on Progress and
Meter; `render`, `className` / `style` / `children` as functions of state and `ref` exist on
every DOM part of the family.

## Findings, by severity

### High

**H1. Inside one Toolbar, a disabled control is reachable or skipped depending on which library
part it is.** `Button` reads `ToolbarContext` and passes `alwaysFocusable` (`button/button.tsx:176`),
so a disabled Button is `aria-disabled` and stays in the arrow sequence (APG Toolbar: "so screen
reader users are aware of their presence"). Every other library button in a Toolbar keeps native
`disabled` and drops out: `ToggleGroup.Item` (design `toggle-group.md` decision 13), `Toggle`
(`button.md` 7.3 line 948), and `Menu.Trigger`, whose `alwaysFocusable` is `inBar` only
(`menu/menu-trigger.tsx:214`), likewise Popover / Dialog Triggers. A toolbar of Bold (Toggle),
Align (ToggleGroup), Insert (Menu.Trigger) and Copy (Button), all disabled, exposes only Copy to
arrow keys. The design records the split but gives no reason beyond "as Toggle".
Standard: the APG Toolbar rule applies to every library button-like part rendered inside a
`Toolbar.Root`: `disabledButton(..., { alwaysFocusable: toolbar !== null })` for Toggle,
ToggleGroup.Item and the overlay Triggers (through `usePopoverTrigger`'s existing option).
Breaking: behaviour only (disabled toggles become focusable inside a Toolbar; outside, unchanged).

**H2. Set-valued change details have two shapes.** `AccordionValueChangeDetails` is
`{ reason, item, open }` (`accordion/accordion-root.tsx:45`); `ToggleGroupValueChangeDetails`
(`toggle-group/toggle-group-root.tsx:30`) and CheckboxGroup's are `{ added, removed }`. Both
Accordion and ToggleGroup are multiple-by-default with an `exclusive` union and the same
reducer replay (conventions 3.3), and the skill (line 17) tells users to persist
`details.added` / `details.removed`, which do not exist on Accordion. Conventions 2.2 (line
~436) keeps Accordion's pair "as is" with no reason other than that it came first.
Standard: `added` / `removed` everywhere (Accordion: `added: [item]` on open, `removed: [item]`
on close; an exclusive switch carries both, which `item`/`open` cannot express today: the
implicitly closed item is not reported at all). Breaking: yes; ship `added` / `removed` next to
`item` / `open` first, deprecate the pair, then remove.

### Medium

**M1. Disabled items in arrow navigation: Accordion skips, every other composite reaches.**
`accordion/accordion-root.tsx:179-203` filters `aria-disabled` triggers out of ArrowUp/Down and
Home/End; Tabs reaches them (`tabs.md` decision 7, `tabs/tabs-list.tsx:137-150`, Home goes to
`tabs[0]` even if disabled), and so does the roving engine for `aria-disabled` items
(`internal/use-roving-focus.ts:95-109`; Toolbar, Menubar). `accordion.md` 5 (line 593) even says
"Disabled triggers stay focusable (`aria-disabled`), matching the Tabs convention", while Tabs'
convention is "reachable with arrows". The CHANGELOG has no rationale. Standard: `aria-disabled`
items are in the arrow and Home/End sequence everywhere (APG "focusability of disabled
controls" in composites). Breaking: behaviour only. Docs (`AccordionPage.tsx:290-294`) and the
design table change with it.

**M2. Accordion's arrow handler has no modifier or `defaultPrevented` guard.**
`accordion/accordion-root.tsx:387-401` acts on any `Home` / `End` / `ArrowUp` / `ArrowDown`:
Ctrl+Home / Ctrl+End (scroll to page start/end), Alt+ArrowUp/Down, Meta+Arrow are hijacked and
`preventDefault()`ed, and a consumer's own `onKeyDown` on a Trigger cannot opt out by calling
`preventDefault()`. Tabs (`tabs/tabs-list.tsx:119`), the engine
(`internal/use-roving-focus.ts:287`) and Menubar all return early on
`defaultPrevented || altKey || ctrlKey || metaKey`, and the Tabs and Menubar docs promise
"Keys with Alt, Ctrl or Meta are left to the browser". Standard: the same guard; ideally one
helper next to `resolveArrowKey` in `internal/arrow-keys.ts`. Not breaking. Add a test row
(no test in `accordion/*.test.tsx` mentions a modifier). Minor sibling: Accordion focuses with
`next.focus()` where every other composite uses `focusWithRing`.

**M3. `state.open` in JS-free mode is `undefined` for details-based parts and `false` for
popover-based ones.** `AccordionItemState.open`, `AccordionPanelState.open`,
`CollapsibleRootState.open`, `CollapsiblePanelState.open`: `boolean | undefined`
(`accordion/accordion-item.tsx:35`, `collapsible/collapsible-root.tsx:46`);
`NavigationMenuItemState.open` and `NavigationMenuPopupState.open`: `boolean`, `false` in JS-free
mode (`navigation-menu/navigation-menu-item.tsx:34`, `navigation-menu-popup.tsx:39`), as Popover
and Dialog (`popover.md` 3.1 line 592, "as Dialog decided"). Two decisions for the same fact
("the browser owns it, React does not know"), never cross-referenced. Standard: one of them in
conventions 4.1's `open` row; `false` is the smaller change (most components; narrowing a state
type from `boolean | undefined` to `boolean` does not break consumers' reads). Breaking: a
value change for anyone testing `open === undefined` on Accordion / Collapsible.

**M4. NavigationMenu.Item exposes `open` / `pending` in state but renders no data attributes.**
`navigation-menu/navigation-menu-item.tsx:32-37, 138-148` (design `navigation-menu.md` line 99:
"no attributes", no reason). Conventions 4.1 ("a state has one name ... `data-<name>` on the
element, `state.<name>`") and 4.3 (the owner carries `data-pending`) are followed by the other
item-level owners: `Accordion.Item` and `Collapsible.Root` render `data-open` and `data-pending`.
Standard: `data-open` (optimistic) and `data-pending` on the Item's `li` in library mode.
Not breaking.

**M5. Owned keys are omitted from the props types in some parts and accepted-and-ignored in
others.** Conventions 1.5 says a part's props are the element's "minus the props the part owns".
Omitted: `role` / `aria-orientation` on Toolbar.Root, ToggleGroup.Root, Separator, Progress /
Meter Root (plus the `aria-value*` set), Avatar.Root; `type` / `tabIndex` / `aria-pressed` on
`ToggleGroup.Item` (`toggle-group/toggle-group-item.tsx:41`); `aria-disabled` / `type` on Button.
Not omitted although owned (documented under "Owned keys" in the same file): Tabs.List `role`,
`aria-orientation`, `tabIndex` (`tabs/tabs-list.tsx:37-40` vs `:69-71`); Tabs.Tab `role`,
`aria-selected`, `aria-disabled`, `tabIndex`, `type` (`tabs/tabs-tab.tsx:42-45` vs `:94-96`);
Tabs.Panel `role`, `tabIndex`; Accordion.Trigger and Collapsible.Trigger `aria-disabled`;
Toolbar.Separator `role` is not even owned while Separator's is. A consumer writing
`<Tabs.Tab tabIndex={-1}>` gets no type error and a silently ignored prop; the same on
`ToggleGroup.Item` is a type error. Standard: every owned key that is not a token-merged id list
is omitted from the type (handlers already are). Breaking: type-level only, for code that passes
an attribute that never had an effect.

**M6. Toolbar docs state the wrong pending behaviour for Button.**
`packages/docs/src/pages/ToolbarPage.tsx:185`: "Enter / Space on a `Button`: Runs `action`,
unless disabled or already pending." Button's default is `whilePending="run"`
(`button/button.tsx:78, 180`): a pending Button runs again. ButtonPage's own keyboard table
(`ButtonPage.tsx:189`) has it right ("pending with `whilePending="ignore"`"). Fix the Toolbar
row to match. Docs only.

### Low

**L1. Type names of the `exclusive` unions differ.** `AccordionRootMultipleProps` /
`AccordionRootExclusiveProps` (`accordion/accordion-root.tsx:94, 125`) vs
`ToggleGroupMultipleProps` / `ToggleGroupExclusiveProps`
(`toggle-group/toggle-group-root.tsx:110, 150`). Conventions 9.4 is `<Component><Part>Props`,
so `ToggleGroupRootMultipleProps` / `ToggleGroupRootExclusiveProps`. Breaking for type imports;
export the new names and keep the old as deprecated aliases.

**L2. `AccordionRootState` has no value.** `accordion/accordion-root.tsx:37` is
`{ pending, disabled }`, while `TabsRootState.value`, `ToggleGroupRootState.value` and
`CollapsibleRootState.open` give the Root's function props the optimistic value. Standard:
`value` (optimistic; with M3's choice for JS-free mode). Additive. Related: ToggleGroup's Root
state normalises exclusive mode to `string[]` (documented, `toggle-group-root.tsx:42-46`); an
Accordion `value` should pick the same shape or the props' shape, deliberately.

**L3. Accordion has no `loop`.** Tabs, Toolbar, ToggleGroup and Menubar take `loop` (default
`true`); Accordion always wraps (`accordion/accordion-root.tsx:197-202`). `accordion.md` 5
justifies the missing `orientation` (vertical only in v0) but says nothing about `loop`. Additive.

**L4. Tabs parts whose state and attributes disagree.** `Tabs.Indicator` renders `data-selected`
with no `state.selected`, and has `state.orientation` with no `data-orientation`
(`tabs/tabs-indicator.tsx:14-21, 78-83`); `Tabs.Panel` has `state.orientation` without
`data-orientation` (`tabs/tabs-panel.tsx:23, 141`) and, unlike Accordion and Collapsible Panels,
no `disabled` / `data-disabled`. `Tabs.Indicator`'s `data-pending` is also absent from
conventions 4.1's `pending` row. Standard: 4.1's three forms agree on every part. Additive.

**L5. Menubar renders no `aria-orientation` / `data-orientation`.** Toolbar and Tabs.List always
render both; Menubar is horizontal-only (justified) but gives CSS no `data-orientation` hook and
relies on the implicit ARIA value. Additive, cosmetic.

**L6. Avatar.Root omits `aria-labelledby` from its type but does not own it.**
`avatar/avatar-root.tsx:32` vs the Owned keys line `:58` (`role`, `aria-label`, `aria-hidden`,
`data-status`). Either own it (and say so) or let it through; Progress / Meter token-merge it.

**L7. "Owned keys" JSDoc missing** on every Accordion and Collapsible part, NavigationMenu.Item /
List and Avatar.Fallback (conventions 1.2: "The part's documentation lists its owned keys").

**L8. Docs wording and layout.**
- Keyboard tables use three layouts for the same content: `Key | Behaviour` (Accordion,
  Collapsible, Tabs), `Key | Horizontal | Vertical | Effect` (Toolbar, ToggleGroup),
  `Key | Where | Effect` / `Behaviour` (Menubar, NavigationMenu); key pairs are written
  "Enter / Space", "Space / Enter" (ToggleGroupPage:240) and "Enter, Space" (Menubar,
  NavigationMenu); part names are capitalised on some pages ("Item", "Trigger") and not on
  others ("trigger", "tab"); some cells end with a period, NavigationMenu's do not.
- Tabs' row "Wraps when `loop`" sits on the horizontal row only (`TabsPage.tsx:270`) though
  vertical wraps too.
- Section order and ids: Menubar puts Props before How it works (others the reverse); "Not in
  this version" (`not-in-this-version`, Menubar) vs `not-included` (NavigationMenu).
Standard: one keyboard table layout (`Key | Where | Effect`, with orientation in Where when it
matters), "Enter / Space", part names capitalised as in the API.

## Differences that are justified (not findings)

- ToggleGroup details have no `reason`: no platform path (`toggle-group.md` line 480).
- Tabs `valueChangeAction` is `ChangeAction<string>` while `value` admits `null`: no platform
  path empties it (conventions 3.1).
- Collapsible has no `onOpenChange` while NavigationMenu.Item has one: `<details>` toggles are
  requests with `reason: "platform"`; a popover dismissal is a fact (conventions 2.1, 3.5).
- Transition type suffixes `-expand` / `-collapse` (details-based) vs `-open` / `-close`
  (popover-based): conventions 5.3 table, Collapsible reuses Accordion's names.
- No arrow keys in NavigationMenu (`navigation-menu.md` 5, identical keyboard before and after
  hydration); Menubar horizontal only and no typeahead (`menubar.md`, skill line 58);
  Accordion vertical only (`accordion.md` 5); no `experimental_focusgroup` on Accordion (each
  header is a Tab stop).
- ToggleGroup arrows never press (APG Toolbar); Tabs has `activationMode`.
- Standalone ToggleGroup enters on the pressed Item (`memory: false`), Toolbar and Menubar on
  the last focused (`memory: true`): `toggle-group.md` decision 6.
- Progress `value` optional / `null` indeterminate, Meter `value` required (`progress.md` 2).
- Avatar is named by `alt` on the Root, Progress / Meter by a `Label` part: an image vs a
  widget with a value (`avatar.md`, conventions 1.1 `Label` row).
- Shared `ProgressState` / `MeterState` / `AvatarState` instead of per-part states
  (conventions 9.4).
- Accordion and Collapsible have no `keepMounted` (`<details>` keeps content and reveals on
  find-in-page natively, conventions 3.7); NavigationMenu.Popup's `keepMounted` is `boolean` only
  (Dialog's reason).
- Toolbar has no `disabled` and no item part (`toggle-group.md` line 410).
- Accordion `exclusive` has no `deselectable` (ToggleGroup's, default `true`): a native
  `name` group can always be closed in JS-free mode, so `false` could not hold before hydration.
  Not written down in `accordion.md`; worth one sentence there.
