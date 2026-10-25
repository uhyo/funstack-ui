# Review: #126 foreign invoker press (branch fix/126-foreign-invoker-press, 6116b03) — 2026-10-25

Verdict: **merge after fixes** (F1 required; F2-F4 small, recommended in the same commit).

Scope read: conventions 3.5 (#126 paragraph), menu.md decision 10 / 2.2 / 13.1 / amendment,
combobox.md decision 6 / 5.4 / 12.2 / 14 / amendment, memo/developer/issue-126.md, the full diff.
Branch merges cleanly over master's 2 docs-only commits (no shared files).

## Findings

1. **Medium — the predicate is wider than HTML's invoker relationship: a submit button in a form
   (and a disabled button) is guarded.** `packages/ui/src/internal/invoker-press.ts:17-24`.
   `popoverTargetElement` / `commandForElement` are plain reflections; HTML's "get the popover
   target element" (and command activation) return nothing for a disabled button and for a submit
   button with a form owner, so such a button is neither an invoker nor light-dismiss exempt. The
   repo's own invoker shim already encodes this (`__tests__/invoker-shim.ts:58-59`). Probe
   (Combobox, `<form><button popovertarget={popup}>` = default `type="submit"`, "Jamaicax" typed,
   real mouse), Chromium and Firefox identical:
   - without the guard: focus to the button, `(false,"dismiss")`, text reverted to `""`, submit;
   - with the guard: `mousedown` prevented, light dismiss at pointerup `(false,"dismiss")`, **input
     keeps focus and the unmatched text "Jamaicax" is not reverted**, then the form submits.
   So the guard suppresses `leave()` for a button that is not an invoker, leaving uncommitted text
   in a field while its form submits (Menu: focus is left in the hidden popup and falls to body
   instead of landing on the button). A `<button popovertarget>` without `type` inside a form is a
   realistic consumer mistake. Disabled: Chromium and Firefox do not dispatch `mousedown` for a
   disabled button, so no observable change today, but exclude it for spec parity.
   Fix: in `isPopoverInvoker`, return false when `button.disabled` or
   (`button.form !== null && button.type === "submit"`), add the two negatives to
   `invoker-press.test.ts` (and a Combobox jsdom row for the in-form submit button: not
   prevented). Mention in the design amendment's rule ("names it" = HTML's invoker relationship).

2. **Low — own `Menu.Trigger` in the pending-close window is now guarded; behaviour changed but
   untested and undocumented.** `menu-popup.tsx:211-221`. The Trigger is a `popovertarget`
   invoker of the root popup (#121), so while shown the guard prevents its press even when
   `intended()` is false. Probe (pending close via a Trigger click with a deferred
   `openChangeAction`, then a real second press on the Trigger), Chromium + Firefox:
   - before: the press focuses the Trigger, the menu hides at once (flicker), re-shows after the
     close settles; dispatches `[(false,activate),(true,activate)]`;
   - after: the menu stays shown throughout, focus stays on the item, same dispatches.
   The new behaviour is better and consistent with 3.5, but decision 10 still says the Trigger's
   own `onMouseDown` (judged on `intended()`) is what governs Trigger presses. Add a browser row
   for this case (it is a real behaviour now) and one sentence in menu.md decision 10 / 13.1
   noting the root Popup's guard also covers the Trigger while shown. Architect call whether the
   design text needs it; the code needs no change.

3. **Low — Combobox unmount cleanup is untested.** `combobox-popup.tsx:102`
   (`useEffect(() => stopInvokerPresses, ...)`). Mutation: removing it leaves every jsdom test
   green. Add a jsdom row: open the listbox, unmount the Root, `fireEvent.mouseDown` on a foreign
   `popovertarget` button (still in the document) is not prevented. (Menu's equivalent
   `stopOutside` unmount path predates this change.)

4. **Low — `<input type="button" | "reset" popovertarget>` invokers are not covered.**
   `invoker-press.ts:19` uses `closest("button")`. HTML lets `<input>` buttons carry
   `popovertarget` and they are light-dismiss exempt, so the #126 bug persists for them. The
   design scopes the rule to `<button>`, so this is a design gap rather than a code defect;
   either widen (`closest("button, input")` plus a type check) or state the limit in conventions
   3.5. Shadow DOM invokers (target retargeted to the host) are likewise out of scope; fine to
   leave unstated.

5. **Info — docs wording.** `MenuPage.tsx` / `ComboboxPage.tsx` `openChangeAction` rows: "never
   moves focus out of the menu" is true of the press; a Tab onto the same button still closes as
   `"dismiss"`. Consider "pressing it never moves focus out...". After F1, the Combobox sentence
   could add "(not a submit button in a form)" or leave it to the spec.

## Verified OK

- Matches the amendments: capture `mousedown` on `ownerDocument`, `button === 0`, closest
  `<button>` outside the popup, `popoverTargetElement === popup` or `commandForElement === popup`
  with `/-popover$/`; Menu root only (submenu early return), started next to `listenOutside`,
  stopped through `stopOutside` on `"closed"` and unmount; Combobox `onToggle` start on
  `"open"` + `:popover-open`, stop on `"closed"` and unmount; `??=` / `=== null` guards prevent a
  double registration on coalesced toggles. No leak found.
- `focusout` paths unchanged: Tab onto the foreign invoker still `"dismiss"` (browser row).
- Non-primary buttons not prevented (jsdom rows); ctrl-click on macOS is button 0 and prevented,
  harmless (no click follows). Touch / pen compat `mousedown` handled by the same listener.
- Mutation checks (jsdom, my own): removing the Menu registration fails 2 rows; removing the
  Combobox registration fails 1; dropping `button === 0` fails 4 (incl. the #110 Trigger row,
  through the Trigger-is-invoker overlap); dropping `popup.contains` fails the unit test;
  dropping the `-popover` check fails 2; Combobox stop-on-close removed fails 1; Combobox unmount
  cleanup removed fails **0** (F3). Developer's browser mutation (Chromium + Firefox) reported
  all press / drag-off rows failing; consistent with the probe above.
- jsdom shim IDL getters mirror the popover shim's pattern; no code assigns them.
- Docs rows updated for the one user-visible change; no prop / attribute / default changed.

Probes were run in a scratch worktree (removed afterwards); nothing in the main checkout touched
except this file.
