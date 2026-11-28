# Review: docs/212 (agent skill restructure, "One Escape closes one layer")

Verdict: acceptable with minor fixes.

## Verified correct

- `transition`: on Collapsible.Root/Panel, Accordion.Item/Panel, Tabs.Panel, Button and every
  library Popup (Popover, Dialog and its AlertDialog/Drawer reuse, Menu, HoverCard,
  NavigationMenu, Combobox, MultiSelect); not on Tooltip.Popup (no prop in tooltip-popup.tsx).
- `onOpenChange` owners: the nine listed (AlertDialog and Drawer reuse Dialog's root props).
- `locale` only on NumberField/Progress/Meter roots; NumberField `value?: number | null`.
- `whilePending` defaults: Button "run"; Dialog.Close, AlertDialog.Action "ignore"; Toast.Action
  "ignore" / "run" with closeOnActivate={false}.
- Plain `setOpen(true)` for a shortcut (ActionPropsPage.tsx:492).
- Anchors: action-props "Naming", "Pending actions hold other transitions" (#pending-actions-hold-transitions),
  "Handling a failed save..." (#reject), "Overlapping actions" (#overlapping-actions);
  browser-owned-state #requests-and-facts, #one-escape; field #form-level-errors, #dialog-form
  ("In a Dialog"). All routes named exist in navigation.ts.

## Findings

1. (Medium) Skill rule 15 contradicts toast.md. ToastPage.tsx:196-206 calls a boundary
   around `Toast.Action`, inside the Root, "The recommended place"; the skill says one per
   `Toast.Root`. Recommend around `Toast.Action`; one per Root is the second option.
2. (Medium) Dropped: in controlled mode a `setState` after `await` lands in completion order,
   so an older response can overwrite a newer one. Rule 2 now tells agents to write exactly that
   `startTransition(() => setX(...))` after an await. The docs only imply it (the
   `useActionState` example in #overlapping-actions); nothing states the race. Put the clause back.
3. (Medium) Dropped: `onOpenChange` must set state directly, never in `startTransition` or after
   an `await` (BrowserOwnedStatePage.tsx:200). Covered by the docs, but this is the mistake
   rule 2's exception invites. One clause in the "Requests and facts" bullet.
4. (Low-medium) Dropped but covered by docs, worth one clause each:
   superseded/unmounted rejections go to `reportError` and fail a test run that does not stub it
   (ActionPropsPage.tsx:691); content rendered ahead in JS-free mode must not suspend
   (SuspensePage.tsx:114); JS-free Popover: style `[data-open]`, `state.open` is false (the
   Accordion line kept the same rule); write a popup's exit as a CSS `transition`, not
   `@keyframes` (TransitionsPage.tsx:197).
5. (Low) "Dialog.Close and the other Close parts" (task actions, rule 8) includes `Toast.Close`,
   which has no `action` or `whilePending` (toast-close.tsx).
6. (Low) Toolbar: "A disabled control inside stays focusable" is too broad: it holds for the
   library's Button, Toggle, ToggleGroup.Item and overlay Triggers, not a native `<input disabled>`.
7. (Low) BrowserOwnedStatePage.tsx "with two, the one that opened first" holds only for
   unrelated hints. A HoverCard that contains the showing Tooltip stands down and the Tooltip
   closes first (hover-card.md 2.6, conventions 15 rule 4 stand-down snapshot). Say "two
   unrelated ones". The rest of the section matches conventions 15: the draft first, then global
   hints in open order, then innermost; preventDefault not stopPropagation; IME. The
   Tooltip-in-Dialog example is tested (tooltip.browser.test.tsx:255).

Other drops (owned props, focusgroup flags, RTL details, Combobox Escape detail, OTPField
options, TextField type="search", Avatar onLoad, MultiSelect `required`, Switch type names) are
on their component pages and either cause type errors or are niche; fine to leave out.
