# Consistency audit: overlays and menus

Scope: Dialog, AlertDialog, Drawer, Popover, HoverCard, Tooltip, Menu (incl. ContextTrigger,
SubmenuTrigger), Menubar, NavigationMenu, Toast; Combobox / MultiSelect / Select only for open
state. Audited on master at fd4c414b (0.1.0-alpha.27). Sources compared: the public types in
`packages/ui/src/<name>/`, the shared overlay hooks (`internal/overlay/`), the design docs,
conventions (+ overlay-open-state.md, placement.md), the docs pages and the agent skill.
Line numbers are as of that commit.

Bottom line: the open-state machinery is shared (`use-overlay-root.ts`, `use-popover-popup.ts`,
`use-popover-trigger.ts`, `useTransitionBoundary`, `use-action-trigger`), so the runtime
behaviour is far more uniform than the wave-by-wave history suggests. Prop names
(`open` / `defaultOpen` / `openChangeAction` / `onOpenChange`, `delay` / `closeDelay`,
`side` / `align`, `keepMounted`, `transition`, `initialFocus`, `whilePending`, `disabled`),
`details.reason` values, Close-part pending / `aria-disabled` rules, the `fsui-<c>[-open|-close]`
types, the dev warning for `open` without `onOpenChange`, `data-side` / `data-align` and the
"no `data-open` on the Popup" rule are consistent. No high-severity finding. What remains is one
real prop-naming split, one mode-dependent styling-hook gap, type-level omissions of owned keys,
and drift between the several hand-maintained lists of "which Roots have `onOpenChange`".

## Matrix (what was compared)

| | Popover | Dialog / Alert / Drawer | HoverCard | Tooltip | Menu | NavMenu (Item) | Toast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| open props | 4 | 4 (Alert: no `modal`) | 4 | none (browser) | 4 | 4 on Item | none; `onClose` |
| JS-free mode | yes | yes | no | n/a (always) | no | yes | n/a |
| Popover API | `auto` on `<dialog>` | none (`<dialog>` modal/show) | `manual` / `hint` flag | `manual` / `hint` flag | `auto` | `auto` | `manual` (Viewport) |
| parts | Trigger Popup Close Title Description | + Form; Alert: Cancel / Action | Trigger Popup | Trigger Popup Arrow | Trigger Popup items Submenu/ContextTrigger | List Item Trigger Popup Link | Viewport Root Title Description Action Close |
| `disabled` on | Trigger, Close | Trigger, Close | Root | Root | Trigger, items | Trigger | Action, Close |
| side / align default | bottom / center | Drawer `side` = edge | bottom / center | top / center | bottom (sub: inline-end) / start | bottom / start | n/a |
| delays | - | - | 600 / 300 | 250 / 150 | 100 / 150 (submenu) | - | - |
| initial focus | `initialFocus` | `initialFocus` (Alert: Cancel) | none | none | first item | none | n/a |
| close-after-action prop | - | Form `closeOnSettle` | - | - | `closeOnActivate` | Link `closeOnActivate` | Action `closeOnSettle` |
| Trigger `data-open` JS-free | DOM-synced | **never** | n/a | n/a | n/a | DOM-synced | n/a |

## Findings, by severity

### M1 (medium). `closeOnActivate` vs `closeOnSettle` for the same rule

- `menu/menu-item.tsx:51` `closeOnActivate` ("Close the whole menu once `action` settles", default
  `true`); also `menu-checkbox-item.tsx:55`, RadioItem, `navigation-menu/navigation-menu-link.tsx:32`.
- `toast/toast-action.tsx:50` `closeOnSettle` ("Close the toast when the action resolves", default
  `true`); also `dialog/dialog-form.tsx:66`.
- Menu.Item and Toast.Action are the same kind of part (a pure trigger of mixed ownership,
  conventions 2.5.1 lists them side by side at `design/conventions.md:762-765`): the consumer's
  `action`, then a library close only if the latest run resolved; the `whilePending` default
  flips on the same prop. The two names describe the identical contract from two angles.
- Not justified anywhere: menu.md 2.3 and toast.md name their prop without reference to the other;
  the CHANGELOG (CHANGELOG.md:541, 583-591) treats them as parallel.
- Standard: `closeOnActivate` for button-like parts whose activation may carry an action
  (Menu items, NavigationMenu.Link, Toast.Action); keep `closeOnSettle` only on `Dialog.Form`,
  where "settled" carries more (no throw *and* no `Form.Root` field error) and there is no
  "activation". So: rename `Toast.Action closeOnSettle` → `closeOnActivate`.
- Breaking: yes (public prop rename; pre-1.0, a deprecated alias for one release is cheap).
  Touches toast-action.tsx, toast.md, ToastPage, conventions 2.5.1 wording, SKILL.md:17.

### M2 (medium). JS-free Trigger `data-open`: Popover and NavigationMenu sync it, Dialog never does

- Popover / NavigationMenu: `internal/overlay/use-popover-trigger.ts:200-203` and
  `use-popover-popup.ts:195` write `data-open` on the Trigger from the popup's `toggle` in JS-free
  mode (decision #121, CHANGELOG.md:3799: "`[data-open]` is the styling hook in both modes").
- Dialog / AlertDialog / Drawer: `dialog/dialog-trigger.tsx:186` renders
  `dataAttr(state.open)`, which is `false` in JS-free mode; `design/components/dialog.md:137`
  "never emitted (use `:open` on the dialog)"; DialogPage.tsx:497 "library mode only".
- So `.trigger[data-open]` works on a JS-free Popover and a JS-free NavigationMenu but silently
  never matches on a JS-free (non-modal) Dialog or Drawer. #121 only replaced Popover's earlier
  `aria-expanded` write; Dialog never had one, and no doc records a reason for Dialog to differ
  (`<dialog>` fires `toggle` too, so the same listener works).
- Related, inside the Popover family: `PopoverTriggerState.open` (`use-popover-trigger.ts:80`) is
  `false` in JS-free mode while `data-open` is DOM-synced, so `className={({open}) => ...}` and
  `[data-open]` disagree there. Documented, but the user-facing rule "data-open = state.open"
  of every other part breaks; at least say it on the Trigger's state row of PopoverPage /
  NavigationMenuPage.
- Standard: every overlay Trigger with a JS-free mode DOM-syncs `data-open` from the popup's
  `toggle` (Dialog: the `<dialog>`'s `toggle`). Non-breaking (additive).

### M3 (medium, docs read by agents). The "which Roots have `onOpenChange`" lists disagree

Ground truth (the type guard `src/__tests__/action-naming.test.ts:476-488`): Popover, Menu,
Combobox, MultiSelect, Dialog, AlertDialog, Drawer, HoverCard Roots and `NavigationMenu.Item`.

| Where | Missing |
| --- | --- |
| `packages/ui/skills/funstack-ui-knowledge/SKILL.md:26` | HoverCard.Root, NavigationMenu.Item |
| `design/conventions.md:370` (the "complete list of such handlers") | HoverCard.Root, NavigationMenu.Item, MultiSelect.Root; also cites `overlay-open-change.md`, now a pointer stub |
| `design/conventions.md:40` (Decisions row 11) | MultiSelect |
| `design/conventions.md:330` (2.1 naming table) | MultiSelect (AlertDialog / Drawer implied) |
| `design/overlay-open-state.md:16` ("the five overlay Roots", and 3.9.13 "the five Roots and NavigationMenu.Item") | MultiSelect (it runs on `use-overlay-root.ts` and has the warning) |

The skill is the one consumers' agents read: an agent told HoverCard has no `onOpenChange`
writes a controlled HoverCard that re-opens after every lost interest. Standard: one list, the
type guard's, copied verbatim into all five places (or the four design places point to
conventions 2.1). Non-breaking.

### M4 (medium-low). Owned non-handler keys: omitted from the props type on some parts, not others

Conventions 1.5 requires omitting owned *event handlers*; owned attributes are left to each part,
and the parts chose differently:

- `popover/popover-trigger.tsx:20-31` and `menu/menu-trigger.tsx` omit `aria-expanded`,
  `commandfor`, `command`, `popoverTarget`, `popoverTargetAction` (PopoverPage.tsx:282: "Not in
  the props type").
- `dialog/dialog-trigger.tsx:35-37` owns `commandfor` / `command` (`:168-169`) but keeps them in
  the type; so do `dialog/dialog-close.tsx:45-47` (owned `commandfor` / `command`, `:103`),
  `popover/popover-close.tsx:35-37` (`:92`), `alert-dialog/alert-dialog-action.tsx:18-20`.
- Popup level: `popover-popup.tsx` omits `popover`, `open`, `aria-modal`; `dialog-popup.tsx`
  omits `open`, `closedby` but not `popover` (a `<dialog popover>` would break `showModal()`).

Effect: `<Popover.Trigger commandfor=…>` is a type error, `<Dialog.Trigger commandfor=…>`
compiles and is silently overwritten or removed (owned key, `merge-props.ts` owned layer).
Standard: every owned, never-consumer-settable attribute is omitted from the type (Popover's
rule), extended to Dialog.Trigger / Close, Popover.Close, AlertDialog.Action / Cancel,
Drawer.Close, and `popover` on Dialog.Popup. Breaking only at the type level, for props that
never worked.

### L1 (low). MultiSelect docs say a fact is always `"dismiss"`

`packages/docs/src/pages/MultiSelectPage.tsx:185`: "Always `false`, `reason: "dismiss"`". The
shared popup hook classifies a foreign `popovertarget` / `commandfor` invoker's close as
`"activate"` for every popover overlay (`internal/overlay/use-popover-popup.ts:339`, `:433`),
which `MultiSelectOpenChangeDetails` itself says (`multi-select-root.tsx:51-52`) and ComboboxPage
:319 documents for Combobox. Not pinned by a MultiSelect row (its browser test's `"activate"` row
is its own Trigger). Fix the page text to Combobox's wording, and add the foreign-invoker row to
the MultiSelect tests.

### L2 (low). Pure-trigger details types: Popover.Close is the only one without a named type

`popover/popover-close.tsx:49` `action?: Action<[details: ActionDetails]>`; every sibling names
one (`MenuItemDetails` is an empty `extends ActionDetails`, `menu-item.tsx`; `DialogCloseDetails`,
`DrawerCloseDetails`, `AlertDialogCancelDetails` / `ActionDetails`, `ToastActionDetails`,
`ButtonActionDetails`). Standard: export `PopoverCloseDetails` (alias of `ActionDetails`).
Non-breaking.

### L3 (low). Toast.Title / Toast.Description have no `State` type

`toast/toast-title.tsx:14`, `toast-description.tsx:14` type their function props with
`ToastRootState` and export no `ToastTitleState` / `ToastDescriptionState`; Popover and Dialog
export `PopoverTitleState = PopoverPopupState` etc. Conventions 9.4: `<Component><Part>State`.
Standard: export the aliases. Non-breaking.

### L4 (low). `transition` JSDoc diverges for one shared implementation

All Popups go through `useTransitionBoundary` and `withCssTransitionCut`
(`use-popover-popup.ts:240-302`, `dialog-popup.tsx:271, 305`). But only Popover / Dialog /
NavigationMenu document "Static: setting or unsetting it remounts the element"; only Popover /
Dialog the "any value, `"none"` included, starts a document view transition" cost; only Popover /
Dialog / Menu the CSS-transition cut; HoverCard (`hover-card-popup.tsx:83-86`) and
NavigationMenu (`navigation-menu-popup.tsx:88-92`) say none of the last. Same for Combobox /
MultiSelect. Standard: one paragraph, copied (or a shared docs row like `functionProps`).

### L5 (low). `openChangeAction` JSDoc: rejection route stated on some Roots only

Popover, Dialog, HoverCard, NavigationMenu.Item: "Rejections reach the nearest Error Boundary
above Root/Item". `menu/menu-root.tsx` `openChangeAction` omits it. Add it.

### L6 (low). Conventions 5.3 type table has no Dialog row

`design/conventions.md:1681-1712`: Popover, AlertDialog ("Dialog's: …"), Drawer rows, but no
`Dialog` row, and no `Tooltip` row ("none", as Toast has). Add both.

### L7 (low). Stale submenu default in menu.md

`design/components/menu.md:81` comment `side="right" align="start" by default`; the default is
`inline-end` since #53 (menu.md:44, `menu-popup.tsx` JSDoc). Edit the comment.

### L8 (low). Docs pages: keyboard tables and section order differ

Heads: Popover / Dialog / AlertDialog `["Key","Behaviour","Who"]`; Menu / NavigationMenu / Toast
`["Key","Where","Behaviour"]`; Menubar `["Key","Where","Effect"]`; HoverCard `["Key","Behaviour"]`;
Tooltip `["Interaction","Behaviour"]`; Drawer has prose only (points to Dialog). Section order:
Menubar puts `props` before `how-it-works`; "not-included" (HoverCard, NavigationMenu) vs
"not-in-this-version" (Menubar). Standard: `["Key","Where","Behaviour"]` (add "Who" only where
the browser/library split is the point), the common section order, one id for "not included".

### L9 (low). SKILL.md lists of Close / pure-trigger parts omit Drawer.Close

`SKILL.md:14` (task actions), `:17` (pure triggers, whilePending defaults) list Dialog.Close,
AlertDialog.Cancel / Action, Popover.Close but not Drawer.Close (`:16` has it). Add it.

## Differences that are intentional and justified (not findings)

- Tooltip has no open state, no `transition`, no `keepMounted`, children mounted at mount
  (tooltip.md 4.1; conventions 3.9).
- HoverCard: every close of a shown card is a fact; `openChangeAction(false)` only cancels a
  pending open (hover-card.md 2.5; conventions 3.9.2 crossovers).
- `disabled` on the Root for Tooltip and HoverCard, on the Trigger elsewhere: the hover Trigger
  is the consumer's link/button and must keep working (hover-card-root.tsx `disabled` JSDoc).
- Close reasons: Dialog.Close / Popover.Close `"activate"`, Toast.Close `"dismiss"`
  (conventions 2.2).
- Toast.Close has no `action` / `whilePending` / `pending`: a toast has no request channel
  (toast.md 9).
- Arrow part on Tooltip only; Popover / HoverCard use a `data-side` pseudo-element recipe
  (popover.md 10, hover-card.md 2, tooltip.md wave 11).
- HoverCard has no Title / Description / Close (hover-card.md:87-90); Toast.Title is a `div`,
  not a heading (toast.md:88).
- Default `align`: `center` for Popover / HoverCard / Tooltip, `start` for Menu / NavigationMenu
  (dropdown convention; menu.md 7, navigation-menu.md 11); Tooltip `side` `top`
  (popover.md:1110). No `offset` prop anywhere: the gap is CSS margin (placement.md).
- Combobox / MultiSelect: no `side` / `align` (combobox.md 10, multi-select.md:677);
  MultiSelect's Trigger has `aria-expanded` (role `combobox`, multi-select.md:568).
- Drawer `lightDismiss` defaults to `modal`, Dialog's to `false` (drawer.md:150).
- AlertDialog reuses Dialog's transition types; Drawer has its own (alert-dialog.md 8,
  drawer.md decision 14).
- `initialFocus` only on dialog-like popups; Menu focuses its first item; NavigationMenu,
  HoverCard and Tooltip move no focus on open.
- JS-free mode only on Popover, Dialog family and NavigationMenu.Item (conventions 3.9.11).
- Popover API kind per component (`auto` / `manual` / `hint` flag) follows each pattern's
  dismissal model; `experimental_hint` and `experimental_interestFor` are named alike where
  both exist (Tooltip, HoverCard).
