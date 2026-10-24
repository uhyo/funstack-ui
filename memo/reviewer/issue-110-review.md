# Review: #110 fix branch `fix/110-menu-trigger-close` (d41ee99, 82b9c67)

Verdict: **merge**. The fix matches menu.md decision 10 / 2.2 / amendment and conventions 3.5.
None of the findings block it. F1 and F2 are older bugs of the same kind in other paths and need
follow-up issues. F3 is an optional test tightening.

## Verified by experiment (scratch worktree, Chromium + Firefox, removed afterwards)

- Mutation (prevent disabled): jsdom rows 1-3 fail and browser rows 4-5 fail on both engines with
  "activeElement is the Trigger, expected the item". The developer's claim holds.
- `:active` on the Trigger while the button is held with the mousedown prevented: true on Chromium
  and Firefox, open and closed, so press styling is kept.
- Right press on the Trigger while open: the press is not prevented, focus moves to the Trigger,
  and the `focusout` hides with `(false, "dismiss", toggle)`. This matches the design: outside
  right-click is an immediate dismiss (2.2 row #45).
- Submenu open, then a click on the root Trigger: the platform light-dismisses the submenu at
  pointerup (it sits above the invoker's popover) with "dismiss", and focus returns to the
  SubmenuTrigger, inside the tree. The root stays shown and closes through `(false, "activate",
  click)`. This is acceptable but untested and missing from walkthrough 12 (F4).
- Trigger rendered as `<a href>` or `<span tabindex role=button>`: the menu is hidden at pointerup,
  before the click (F1).

## Findings

### F1 (medium, pre-existing, follow-up issue) A non-button Trigger is light-dismissed before its click (Menu and Popover)
`packages/ui/src/internal/use-popover-trigger.ts:142` sets `commandfor` only where `disabledProps.invoker`.
Light dismiss only excludes popover invokers, which are buttons. With `render={<a/>}` or a
`<span>`, the pointerup of a click on the open Trigger runs the platform's light dismiss, and the
popup is hidden before `click`. Probe log, Chromium and Firefox, identical for Menu and Popover:
`["click open=false","toggle"]`, with calls `[..., "false/activate/click"]`. The reason is
correct only because the `toggle` task lands after the click. The close itself is browser-shaped:
the popup is gone before `openChangeAction(false)` settles, there is no view-transition exit, and
there is no veto. This is the conventions 3.5 "single source" hazard through a different
mechanism. The #110 prevent does not cover it, because preventing mousedown does not cancel light
dismiss. Menu.Trigger's own docs accept link renders (`aria-disabled` "link or component
render"). Related docs overclaim: `packages/docs/src/pages/MenuPage.tsx:617-619` "the click then
closes it like an item's activation, on every browser" is true only for a `<button>` Trigger.
Either qualify the sentence now ("with a `<button>` Trigger") or leave it until the follow-up
lands. Needs an architect decision. Options: snapshot `intended()` at pointerdown as
Combobox.Trigger does and re-show or veto; document that library-mode Triggers must be buttons for
this guarantee; or dev-warn.

### F2 (low, pre-existing, follow-up issue) Non-modal Dialog with `lightDismiss` + `experimental_closedBy`: a Trigger click while open closes it
`packages/ui/src/dialog/dialog-popup.tsx:484-486`. The JS baseline excludes the Trigger ("The
Trigger re-opening a non-modal dialog is not a click outside"). Native `closedby="any"` does not.
Probe, Chromium and Firefox: with the JS path the dialog stays open (`["true/activate/click"]`);
with closedBy it closes (`[..., "false/dismiss/close"]`). WebKit has no `closedBy`, so it takes
the JS path. The outcome therefore depends on the flag and the engine, which contradicts the
JSDoc at `dialog-popup.tsx:63-67` ("behaves the same"). This is not a focus hazard, but it is the
same family of engine-dependent Trigger outcomes. Needs an architect decision: accept and
document, or keep the JS exclusion for the Trigger.

### F3 (low) Row 6's WebKit branch passes even if the prevent applies while closed
`packages/ui/src/menu/menu.browser.test.tsx:1006-1012` (row 6). `focusedWhileClosed.every(Boolean)`
also holds for `[]`. On CI's Linux WebKit, which focuses clicked buttons, mutation M2 (prevent
regardless of `intended()`) yields `[]` and passes there. Chromium, Firefox and jsdom row 1 still
kill M2, so the gap is per-engine only. Cheap tightening: click a plain `<button>` first as a
baseline. If it got focus, expect `[true]` for the Trigger; otherwise expect `[]`. The row then
asserts one outcome on every engine without naming one.

### F4 (info) Submenu-open Trigger press is unspecified
See the experiment above. The submenu hides at pointerup ("dismiss") while the root waits for its
action. This is consistent with 2.2, where submenus are always "dismiss", but it is not in
walkthrough 12 and has no row. Optional: one sentence in menu.md walkthrough 12, and a browser row
asserting that focus stays inside the tree (the SubmenuTrigger).

### F5 (info) `MenuTriggerProps` drops `onMouseDown`
`packages/ui/src/menu/menu-trigger.tsx:26`. This is a type-level breaking change for consumers
passing `onMouseDown` as a prop. It is consistent with the owned-handler pattern (`onClick` and
`onKeyDown` are omitted the same way, and a `render` element's handler still runs first, per
conventions 1.2). Mention it in the alpha release notes.

### F6 (nit)
- `MenuPage.tsx:277` owned-keys text: "a press" should say "a primary-button press", because the
  right button is deliberately not prevented.
- `menu.browser.test.tsx:44`: the `deferred` import sits after the component imports, apart from
  the other `../__tests__/` imports.

## Checklist items with no finding

- Touch: compat `mousedown` comes after `pointerup` at tap. Its default is the focus move, so the
  prevent stops focus in Chromium and Firefox, and iOS never focuses. Touch `pointerdown` on the
  invoker button is excluded from light dismiss. This is reasoning only: there is no touch command
  in the browser harness. Pen behaves as mouse.
- Text selection: the prevent blocks starting a selection drag on the Trigger while open, which
  does not matter for a button. Drag-to-select from Menu.Trigger is not a Menu feature: 2.6
  press-drag-release is ContextTrigger-only. Press, drag onto an item, release gives no click on
  the item (the click target is the common ancestor). Pointer focus follows hover, and the menu
  stays open, as walkthrough 12's dragged-off case says. Before the fix, the press itself closed
  the menu.
- Assistive technology: AT activation (doDefaultAction or VoiceOver press) fires `click` without
  `mousedown`, taking the same click path. Simulated mouse clicks (Voice Control, Dragon) behave
  as a mouse. Browse-mode focus moves are keyboard-like and still close through `focusout`, as
  intended.
- `disabled` Trigger while open: native disabled gets no focus anyway. With `aria-disabled`, the
  press is now prevented and the click is refused, so the menu stays open. Previously the
  `focusout` closed it. That is acceptable.
- SubmenuTrigger and ContextTrigger do not share the handler. A SubmenuTrigger is an item inside
  the tree, so `focusout` does not fire. ContextTrigger presses are light dismiss and outside
  handling, unchanged.
- Other overlays: Combobox.Trigger and Clear already prevent mousedown and snapshot at pointerdown.
  Popover has no library `focusout` close, and a `<button>` Trigger is an invoker (but see F1).
  Dialog's JS outside path excludes the Trigger (but see F2), and modal dialogs make the Trigger
  inert. Select is native. Tooltip's pointerdown hide is intended. No other `focusout` close sees
  a Trigger press.
- Should there be a right-button browser row? No. With "prevent any button" (M3), a real right
  press still closes through the outside `contextmenu` path with "dismiss"; only where focus
  lands differs. jsdom row 1 covers the button scoping.
- Docs: the `openChangeAction` row addition is accurate for all three listed closes (ArrowLeft
  goes through `requestClose` as well). The owned-keys row and the JSDoc agree with the code.
