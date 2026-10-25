# Architect notes: issue #132 (wave 18 design questions S10, D3), 2026-10-25

## S10: Combobox.Input `onFocus`

Facts checked:
- `combobox-input.tsx` installs `onFocus` → `ctx.focusIn` (starts the #111 press watch). The
  props type omits `onBlur`, `onClick`, `onPointerDown`, ... but not `onFocus`; the JSDoc owned
  list does not name it. Design 3.2 still said "`onFocus` ... pass through" (pre-#111 text).
- Runtime today: `mergeProps` chains handlers (consumer's pass-through first, then the library's),
  so a consumer `onFocus` runs, nothing is clobbered. Types are the only inconsistency.
- Conventions 1.5: "the library's own prop-form event handlers are omitted from the type". Every
  other part follows it: Tabs.Tab installs and omits `onFocus`; Menu.Popup, Tabs.List,
  Toast.Viewport, ToggleGroup.Root, Toolbar.Root omit it. No precedent for "owned, chained".

Decision: omit (`"onFocus"` in the Omit), list as owned. Types-only break, alpha. Rejected "keep
and document as composed": would need a third handler category in 1.5 and a per-part judgement
of which handlers are passive enough; one key is not worth that. Escape hatches for consumers:
`onFocusCapture` (passes through, 1.5) or the function form of `render`.

## D3: the CSS exit recipe for Menu and Combobox

Mechanism: Popover.Popup, Menu.Popup, Combobox.Popup all wrap the popover element in the boundary
(`useTransitionBoundary`) and hide via `usePopoverPopup`'s layout effect `element.hidePopover()`.
So the Chromium double image (Dialog #46 M2, Popover 10.2) applies by construction.

Evidence:
- Menu: already on CI. `menu.browser.test.tsx` runs `describeOverlayInBrowser`, whose
  "a CSS exit (recipe=%s)" rows assert `fading === (!recipe && chromium)` for the item-activation
  close, with a live `::view-transition-new` iff fading.
- Combobox: not in the shared suite; its VT rows only check the `old` image. Ran a throwaway
  `probe-132.browser.test.tsx` (deleted) in Chromium + Firefox: `addExitStyle("fade", "200ms",
  { openPseudo: ":popover-open", recipe })`, type "j", click option "jm" (accept-close), at
  `ready`: Chromium recipe=false → display != none, old + new images; recipe=true → display none,
  old only; Firefox → old only both ways. 4/4 passed (vitest 5.0.5, Chromium 1248 build).

Docs/CSS gaps found: docs `menu.css` (also used by ContextMenu examples), `combobox.css`;
playground `menu-demo.css`, `combobox-demo.css`; MenuPage / ComboboxPage Styling sections.
Recommend the rule on the whole popup class (`.demo-menu`, `.menu`), not a `-vt` variant:
submenus close with the parent and would otherwise be captured live too.

Files edited: design/components/combobox.md (3.2, 11.3, 11.4, 12.2, 14, amendment),
design/components/menu.md (9, 13.2, amendment), design/conventions.md (5.1 one sentence).

## Third question (from #128 review F1): disabled focusable Combobox.Trigger as invoker

Facts: `use-popover-trigger.ts:178` renders `popoverTarget` only while
`disabledButton(...).invoker` (false when focusable && disabled, i.e. `aria-disabled` on a
link/component render); `combobox-trigger.tsx` ref writes `popovertarget` on any BUTTON. The
#112 amendment's F7 paragraph had recorded the asymmetry (aria-disabled Trigger exempt from light
dismiss, press does nothing) as behaviour, not a decision. Not covered by tests (Combobox is not
in `describeOverlayDisabledRenders`).

Decision: follow the shared rule (no invoker while disabled-and-focusable; `aria-expanded` from
`popover.shown` then). Reasons: one rule for all overlay Triggers (decision 41, docs); an inert
control's press while open should light-dismiss, as the native-disabled flavour already does;
the implicit expanded state is replaced by the explicit attribute. Narrow case (component render
+ disabled). Edited combobox.md 3.3, F7 paragraph, 12.1, 14, new amendment; conventions 41.
