# Review: #121 popovertarget Triggers, no aria-expanded (branch feat/121-popovertarget-triggers, e79e495)

Verdict: **acceptable with minor fixes** (F1 to F4 before merge; F5 to F7 optional).

## Method

- Read the popover.md / menu.md / combobox.md amendments, conventions 41, the developer memo, the
  whole source diff and the test diff (shared suites, per-component jsdom and browser files).
- Private worktree at e79e495: `vitest --project browser src/popover src/menu src/combobox` on
  Chromium + Firefox: 8 files, 383 passed, 7 skipped.
- Probe file (real mouse, both engines; removed afterwards): pre-hydration click in an iframe
  (Popover JS-free, Popover library, Menu), JS-free nested/sibling stacking, the exemption,
  ToggleEvent.source, a render element with `commandfor`/`command`, two Triggers in one Root.

## Probe results (Chromium and Firefox identical)

- Pre-hydration click: the server HTML has `popovertarget` on Popover and Menu Triggers; a real
  click opens the popup natively, anchored below the Trigger (gap 0), `toggle.source` = Trigger.
  Hydration: Popover library and Menu dispatch once `(true, "platform", event undefined)`, content
  (Menu items) mounts into the open popup, no recoverable errors; JS-free Popover gets
  `data-open` from the ref sync. A later click closes with `(false, "activate")`. Menu opening
  empty before hydration and focus not moving when the items land is the documented behaviour
  (menu.md decision 2, popover.md 2.4) and is unchanged from master, which server-rendered
  `commandfor` too. Combobox keeps no server `popovertarget` (existing browser row).
- JS-free stacking: inner Trigger inside the outer popup nests (both open); a press on the inner
  Trigger while open closes only the inner; a press on the outer Trigger closes it once (no
  re-open); a sibling Trigger closes the other (`source` null for that light dismiss).
  Sources: `pa:a, pin:inner, pin:inner, pa:a, pa:a, pa:null, pb:b`.
- Light-dismiss exemption, anchoring, nested library popovers, submenus: covered by the branch's
  browser rows (#110, #112, #115, #117 rows, nested, resolved side, submenus), all green here.

## Findings

### F1 (Medium) Render-element `commandfor` / `command` are no longer stripped; test coverage removed
`packages/ui/src/internal/use-popover-trigger.ts:180-196` (libraryProps),
`packages/ui/src/combobox/combobox-trigger.tsx:131-135`,
`packages/ui/src/popover/popover.test.tsx:452` ("never lets a render element override the owned keys").
On master the hook wrote `commandfor`/`command` (owned: a render element's values were overwritten,
and stripped when no invoker). Now they are only omitted from the props type, but a `render`
element (`ReactElement<Partial<ComponentPropsWithRef<"button">>>`, which includes the augmented
`commandfor`) still passes them through. Measured in both engines: JS-free Trigger with
`render={<button commandfor="other" command="show-popover" />}` renders both `commandfor` and
`popovertarget`, and a click opens `#other`, not its own popup (Invoker Commands take precedence
over `popovertarget` in the activation behaviour). Same before hydration in library mode, and
for a Combobox Trigger's server HTML. The design's own reason for reserving the keys (popover.md
3.2: "a second activation behaviour ... would conflict with its `popovertarget`") argues for
owning them at runtime. The sweep rewrote the override test from `commandfor`/`command` to
`popoverTarget`/`popoverTargetAction`, silently dropping the assertion that a render element
cannot set them.
Fix: add `commandfor: undefined, command: undefined` to the hook's and Combobox's libraryProps
(as the developer did for `popoverTargetAction`), keep them on the render element in the override
test and assert `not.toHaveAttribute("commandfor"/"command")`. Same for SubmenuTrigger via the hook.

### F2 (Minor) Docs and a doc comment say a component `render` keeps `aria-expanded`; it does not
`packages/docs/src/pages/PopoverPage.tsx:119, :385, :506, :570`; `MenuPage.tsx:284, :518`;
`RoadmapPage.tsx:40` (release note); `packages/ui/src/menu/menu-trigger.tsx:85`.
`rendersButton` treats a component render as a button, so an enabled component render is an
invoker: `popovertarget`, no `aria-expanded` (the branch's own `menu.test.tsx` row "server HTML:
a disabled Trigger with a component render..." asserts exactly that for the enabled
`PlainButton`). Only a host non-button element (a link), or a component render while disabled
(the `aria-disabled` branch), renders `aria-expanded`. Design popover.md 3.2 says "a non-button
`render`", which is right. Reword to "a link or other non-button element (or a disabled
component `render`)". `popover-trigger.tsx:46` ("a non-button `render`") is already correct.

### F3 (Minor) Stale JS-free dev warning
`packages/ui/src/internal/use-popover-trigger.ts:124-126`: "Only a <button> runs
`command="toggle-popover"`". Should say "Only a <button> is a `popovertarget` invoker; this
trigger will not open the popover...".

### F4 (Minor) Stale trigger-ref warning and doc comment (developer's deferred item)
`packages/ui/src/internal/trigger-ref.ts:9-13` and `:24-28`. Measured with two `<button>`
Triggers in one Root (both engines): every button Trigger names the popup, so the browser exposes
the state on each and a press on the other while open is **not** outside (library: `(false,
"activate")`, JS-free: the native toggle). What follows only the last-mounted one is the `source`
(anchor, focus return) and, in JS-free mode, `data-open` (written through `triggerRef` only: after
clicking Trigger 1, Trigger 2 had `data-open` and Trigger 1 had not). Recommended text:
- comment: "only the registered one is the popup's `source` (anchor, focus return) and, in JS-free
  mode, the one whose `data-open` is kept current."
- warning: "...the popup only follows the last one mounted (its anchor, focus return and, without
  an action, `data-open`). Render one ${part} per Root."
(The "counts as outside" clause was arguably already stale since #112's `commandfor`.)

### F5 (Low) AX coverage gaps against the implementation plan
The plan listed AX rows for SubmenuTrigger and Menu.Trigger in every phase, and "true again after a
refused dismissal re-shows". Present on Chromium: Popover (closed, deferred open, open, pending
close, after Escape), Menu.Trigger (pending close, after close, dismiss), Combobox.Trigger (pending
close, after close, Escape), SubmenuTrigger only `true` (`menu.browser.test.tsx:557`). Missing:
SubmenuTrigger `false` (closed / after ArrowLeft), Menu.Trigger during a deferred open, and the
refused-dismissal re-show on any component. Nothing was weakened (the old browser rows had no AX
assertion there either; the jsdom link-Trigger rows cover the mirror phases), so optional, but one
SubmenuTrigger `false` row is cheap and pins the `menuitem` mapping.

### F6 (Low) `axExpanded` lookup by role + `textContent`
`packages/ui/src/__tests__/ax-tree.ts:47-58`. Polling is correct (`expect.poll` retries on the
throw for 0 or 2+ matches; a stale tree can only delay, not pass, a `false` after a close; the
`true` rows in pending windows are re-checked with `isOpen()`/`data-pending` afterwards in the
Combobox and Popover Escape rows). Weaknesses: the name heuristic ignores `aria-labelledby`, and
whitespace or hidden text inside the Trigger would not match Chromium's computed name; the
Combobox pending window is a fixed 300 ms, so a slow `getFullAXTree` on a loaded runner fails the
row (false negative, not a false pass). More robust: resolve the element itself with
`DOM.getDocument` + `DOM.querySelector` (or `DOM.describeNode`) and
`Accessibility.getPartialAXTree({ nodeId, fetchRelatives: false })`, as
`memo/architect/probes/121-popovertarget/ax-chromium.mjs` does. Optional.

### F7 (Info) Developer deviation: `popoverTargetAction` (and Combobox `popoverTarget`) owned
Agree. Owning `popoverTargetAction: undefined` enforces "the default `toggle` is never written";
Combobox's `popoverTarget: undefined` is required, or a render element's value would reach the
server HTML and make the Trigger a live pre-hydration invoker (combobox.md 3.3). Design 3.2's
"omitted" wording can be aligned to "owned (never written)" by the architect; not a code issue.
F1 is the same argument applied to `commandfor`/`command`.

## Checks with no finding

- Test sweep: the shared suite's `expectExpanded` became `expectShown(kind)`, every former
  state row now runs twice (`<button>`: `popovertarget` + no `aria-expanded`; `[link Trigger]`:
  the #118 mirror values in every phase), so no phase lost its value assertion. Per-file jsdom
  rows that dropped a button's `aria-expanded` value either moved to a link-Trigger variant
  (popover.test.tsx #118 rows), are covered by the Combobox Input's `aria-expanded` next to them,
  or by the shared suite. Browser rows swapped to `expectInvokerExpanded` (Chromium AX). The only
  silent loss found is F1's override row.
- Disabled-render suite: no-invoker renders assert `aria-expanded` from `shown`; native-disabled
  buttons keep `popovertarget` and no attribute (sub-decision 5).
- jsdom invoker shim: `popovertarget` branch only when `commandfor`/`command` absent (matches the
  precedence measured in F1), no `command` event, actions mapped, `invoker-shim.test.ts` covers it.
- JS-free `data-open` sync (toggle listener + ref sync for late mount) and its tests.
- Docs/example: no `[aria-expanded="true"]` selectors remain in CSS; migration line on the
  Roadmap page and the Popover page's `[data-open]` / `:has(+ :popover-open)` recipe are clear
  (the recipe needs the Popup right after the Trigger, which the text says). Remaining
  `commandfor` mentions are Close, Dialog, Button and foreign-invoker text, all correct.
  Only stale Trigger claims: F2.
