# Review: wave16/overlays (#104, tracker #100)

Branch at c517285 vs origin/master 744f522. Audit implemented: refactor-audit-overlays.md O1-O7,
O10, O18 cast, O19 (part) + controls C12. Reviewed 2026-10-24.

Verification run (scratch worktree): typecheck, lint, format:check clean; build ok; jsdom
2878/2878; browser (chromium+firefox) 799 passed / 23 skipped (50 files). Public `.d.mts` output
identical to master except the Tooltip.Trigger doc comment. esbuild prod bundle of
dialog/popover/menu/combobox/toast: no dev string present on the branch that master strips
(branch bundle 101.5 kB vs 102.3 kB).

Pure-move commits (dc3ec08, 4857bad, b3cf7f5, d907e15, e83d4ad) checked mechanically: every
removed line reappears except import lists / `export` keywords.

## A. Behaviour preservation: no regression found

Checked by reading against master, plus mutations:
- O1 Dialog.Root: open details keep own `returnValue: undefined` (parameter default in an object
  literal; pinned by dialog.test Object.keys row, mutation fails 2). requestClose wrapper records
  before dispatch (mutation: 22 failures). notifyClosed is the unwrapped root close (records
  nothing) - correct, but a mutation making it record passes (the `close` listener clears it
  anyway). Generation advance before dispatch preserved (details built first: unobservable).
  Insertion-effect order: committedOptimistic, (new) callbacks, closeReturnValue clear - relative
  order of the two old ones kept; the new one is independent. Dev text identical (`${part}`).
  Context identity: memo on `root` (+modal); ids now memoised (fewer new objects, not more).
- O2 helpers: Dialog onClose focus return equivalent (dropped `!== body` is implied by
  `contains`). Hook order identical (warned ref sits where warnedFocus was, then
  useExitAnimation + useState). Mutations of afterClose / releaseIfIdle / holdDuringRender /
  returnFocusToTrigger / initial-focus warning / JS-free prop warning each fail BOTH Dialog and
  Popover tests (and Menu / Combobox where relevant).
- O3: element tree identical (component context > ToolbarContext > Activity/content; Menu's
  `<style>` outside ToolbarContext).
- O5 Close: key order type, disabled, commandfor, command, [value], onClick, aria-disabled,
  data-pending, data-disabled - identical. Click-time `value` captured per render as before.
  Dev text identical after template expansion. Hook order identical.
- O6/C12 disabledButton: all six call sites algebraically equal to the old expressions
  (Trigger: `disabledAs === "aria" || (isLibrary && !host)`; Dialog.Trigger:
  `installClick && !host`, invoker `modal && ...`).
- O10: Toast `applyCommands` defers ref deletions / timer clears / dev error to after the loop:
  nothing in the loop reads them. Combobox keyDown evaluates `isPopoverOpen` before the
  disabled / modifier / IME guards (pure read; harmless).
- Hook-order note: Toast's `container` useSyncExternalStore moved into useModalPortalHost, i.e.
  after three `useEffect`s; its passive subscribe now runs after them. Harmless (uSES re-checks
  the snapshot on subscribe), but the commit message's "called where they were" covers only the
  layout effects. useOptionRegistry moved `orderedOptions`' useCallback earlier: no effect.

## Findings (severity order)

M1 (test gap, now shared): the stale close-intent clear is untested. Removing Dialog's
`isShown: isDialogOpen` (default `:popover-open` is wrong for `<dialog>`) or making the predicate
always false passes jsdom + chromium browser tests for Dialog, Popover, Menu. The refactor made
this an option whose omission is silent. Add a row: a part close cancelled (e.g. `cancel`
prevented after a `request-close` command; a popover hide that does not happen) then, a task
later, a dismissal must report `reason: "dismiss"`.

M2 (test gap, now shared by 9 parts): #83 owned-key presence is unpinned. Mutations
"aria-disabled always owned" (would strip a host button's consumer `aria-disabled`) and
"`disabled: false` instead of `undefined` in the focusable branch" pass the full jsdom suite.
Add two rows (e.g. Toggle + Popover.Trigger): host `<button aria-disabled>` render keeps its
own; function render in the focusable branch receives `disabled` key with value `undefined`.

L1 disabledButton: returned `focusable` is never read; option `focusable` means "always the
aria branch" and shares the name with the returned field (destructured as `always`). Drop the
field, rename the option (`alwaysFocusable`).

L2 usePopoverPopup still returns `wrapContent` only for use-popover-hooks.test; port the test to
`renderContent` and drop it from PopoverPopupHook.

L3 toast-viewport call site of useModalPortalHost should state the ordering constraint (before
the region layout effect); only the hook's JSDoc says it.

L4 toggle-group-item.tsx: orphan comment block ("A link or component Item is aria-disabled...")
no longer attached to code.

L5 pre-existing unpinned: JS-free ToolbarContext reset (overlay-popup), initialFocus outside the
popup, commandOf lower-casing.

L6 naming: useOverlayRoot lives in use-popover-root.ts; Dialog uses PopoverMode /
PopoverCloseIntent. Rename file if the overload goes (B1).

## B. Did it get better?

Good, keep: renderOverlayContent; useCloseHold (narrow, removes a subtle triplicated rule);
useInitialFocusTarget; returnFocusToTrigger with predicate; useOverlayClose (-90, one Close);
useAnchoredPlacement; menu-outside.ts, menu-point.ts pointStyle, use-menu-keyboard (narrow:
(menu, nativeFocusgroup) -> {onKeyDown, typingAhead}), menu-gestures + pure armClickSwallow;
toast-queue.ts with pure applyCommands and unit tests (the best split of the set); toast-hotkey;
toast-timers; useModalPortalHost; useOptionRegistry.

Simplify:
B1 Drop the usePopoverRoot overload + wrapper. One `useOverlayRoot` with required `details`;
export `popoverDetails`; Popover and Combobox pass it (Menu already passes its own). Removes the
conditional-type overload, the second options interface and the
`Omit<UsePopoverRootOptions<PopoverLikeDetails>, ...>` indirection. Two call-site lines buy a
lot less type machinery.
B2 combobox-keyboard.ts: fold back into the Root (or keep only `move`). The 12-member
ComboboxKeyTarget (~25 lines) is as large as the logic it hides, is rebuilt with closures per
keydown, maps `open(edge)` back to `pendingEdge`, and has no unit tests, so the "pure" seam buys
nothing. If kept, it must earn it with toast-queue-style tests.
B3 disabledButton / usePopoverPopup trims (L1, L2).
B4 useComboboxForm (10 options) is borderline; keep (coherent concern, moved as a block).

Remaining O19: worth doing - drop "use client" from menu-dom.ts / menu-hover.ts with the
directives test update (conventions 7.1). Not worth it in a behaviour-preserving wave: Tooltip
"[Tooltip]" prefix (dev-text change, own issue), group label context shape, Menu.Item
closeStackLater (risk, no gain), dispatch continuations, Menu.Trigger onBeforeOpen.

## Verdict

Acceptable with minor fixes. Behaviour preserved as far as reading and 25 distinct mutations can show.
Before merge (or as immediate follow-up): M1, M2 tests; B1; B2; L1/L2.
