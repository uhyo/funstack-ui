# Refactor audit: overlay family (#100)

Scope: `packages/ui/src/{popover,menu,dialog,tooltip,select,combobox,toast}/` (non-test) and the
internal modules they use (`use-popover-{root,trigger,popup}`, `use-resolved-placement`,
`anchor-position`, `use-exit-animation`, `content-focus-probe`, `transition-boundary`,
`use-action-trigger`, `use-delayed-pair`, `tooltip-warm`, `modal-registry`,
`use-modal-registration`, `render-element`, `merge-props`, `use-latest`, `announce`, ...).
Audited at 1208aa2 (2026-10-24). Behaviour-preserving only: public API, DOM output, data
attributes, owned-key presence and timing must not change.

Line numbers are as of that commit. "Tests" names the files that pin the behaviour a change
could break; every row assumes `pnpm test:run` (jsdom + all three browser engines).

## Ranking (value / risk)

| id | finding | est. size | risk |
| --- | --- | --- | --- |
| O1 | DialogRoot re-implements usePopoverRoot | -110 lines | med |
| O2 | Dialog.Popup re-implements half of usePopoverPopup | -80..-100 lines | med |
| O3 | Popup content wrapper (`Activity` / `wrapContent` / ToolbarContext) x4 | -40 lines | low |
| O4 | Dead `keepMounted` option of usePopoverPopup; `initialFocus` required but unused by 2 of 3 callers | -5 lines, clarity | low |
| O5 | Popover.Close and Dialog.Close are the same part twice | -90 lines | low-med |
| O6 | Disabled / invoker attribute block duplicated in 6 parts | -40 lines, 3 identical comments | low-med |
| O7 | Anchored placement plumbing triplicated (Popover / Tooltip / Menu Popup) | -30 lines | low |
| O8 | `isPopoverOpen` copied 5 times, `matches(":popover-open")` inline ~10 more | -30 lines | low |
| O9 | Accessible-name dev checks: 5 implementations | -40 lines | low |
| O10 | Oversized files: split menu-popup, menu-context-trigger, toast-viewport, combobox-root | clarity (no net loss) | low (pure moves) |
| O11 | Ad-hoc "latest ref" pairs instead of `useLatest` (combobox-root x4, use-popover-popup) | -15 lines | low |
| O12 | usePopoverRoot `requestClose` / `notifyClosed` are byte-identical | -8 lines | low |
| O13 | Menu-point CSS constants and `FSUI_PRECEDENCE` live in `anchor-position.ts` | clarity | low |
| O14 | `useMergedRef` lives in use-field-control; popups hand-roll `useMemo(mergeRefs)` | clarity | low |
| O15 | Element-tag dev checks: ~9 hand-written variants; Select already has a helper | -40 lines | low |
| O16 | Comment hygiene: ~40 review-ID references, misplaced JSDoc | clarity | none |
| O17 | Small dead code / dead exports | -15 lines | none |
| O18 | Type tidiness (duplicate state types, aliases) | -20 lines | none |
| O19 | Sibling inconsistencies (naming, context shapes, close-after-settle, transition types) | clarity | low |
| X | Things that look duplicated but should stay (do not do) | — | — |

Suggested order: O4 + O3 (same change), O8, O12, O16, O17, O18 first (mechanical, low risk);
then O5, O6, O7, O9, O13, O14, O15; then O1, O2 (each its own commit, full browser run); O10
splits last or interleaved, as pure file moves.

---

## O1. DialogRoot re-implements usePopoverRoot (med, ~-110 lines)

Duplicated spans:

- Mode detection, once from the first render, plus dev warning:
  `dialog/dialog-root.tsx:106-116` vs `internal/use-popover-root.ts:148-161`.
- `useControllableAction<boolean>` call with the same options and `transitionTypes(component, next ? "open" : "close")`:
  `dialog-root.tsx:118-129` vs `use-popover-root.ts:163-174`.
- Refs, close-intent record/take with a `setTimeout(0)` stale-intent clear (`clearLater`):
  `dialog-root.tsx:73-85, 131-144` vs `use-popover-root.ts:124-136, 177-200`. Only the
  "still open" predicate differs (`dialog.open` vs `:popover-open`).
- Open generation: `dialog-root.tsx:145-152` vs `use-popover-root.ts:186-190`.
- `committedOptimistic` + `intended()`: `dialog-root.tsx:154-166` vs `use-popover-root.ts:185, 202-208`.
- `requestOpen` / `requestClose` / `notifyClosed`: `dialog-root.tsx:181-207` vs `use-popover-root.ts:228-251`.
- Memoised value with an 16-entry dependency list: `dialog-root.tsx:213-254` vs `use-popover-root.ts:258-296`.

`design/components/popover.md:642` already allows sharing with Dialog.

Change: generalise `usePopoverRoot` (or rename to `useOverlayRoot`) with
- `isShown(element)` for `clearLater` (default `:popover-open`; Dialog passes `el.open`);
- a `details(event, reason, extra)` builder so Dialog can add `returnValue` (Dialog's open builds
  `{ reason, returnValue: undefined }`: the **own** `returnValue` key with value `undefined` must
  stay, it is visible to `Object.keys` / a Server Function serialiser);
- Dialog keeps on top: `modal`, `closeReturnValue` + its insertion effect + `takeCloseReturnValue`
  (`dialog-root.tsx:168-179`), and a `requestClose` wrapper that records `returnValue` first.
  `onDispatch` is the natural hook for recording it, but it runs for opens too; keep the wrapper.
- Rename the ref/id fields so both share one shape (`popupRef`, `ids.popup`; see O19), or expose
  Dialog-specific aliases in `DialogContextValue`.

Ordering to preserve: Dialog's `requestOpen` calls `nextOpenGeneration()` before `dispatch`
(same as `send` in `use-popover-root.ts:214-226`); `requestClose` writes `closeReturnValue`
before `dispatch`. Dialog's `notifyClosed` takes `event: Event` (non-optional) and a third
argument.

Risk (med): generation and intent timing (close of a previous open, the Close stale-close row),
`returnValue` reaching `details`, memoisation identity (#48).
Tests: `dialog/dialog.test.tsx` (133 cases: Close stale-close, returnValue, veto, notify),
`dialog/dialog.browser.test.tsx`, `internal/context-stability.test.tsx` (Dialog rows),
`internal/use-popover-hooks.test.tsx`.

## O2. Dialog.Popup re-implements half of usePopoverPopup (med, ~-80..-100 lines)

Duplicated spans in `dialog/dialog-popup.tsx` vs `internal/use-popover-popup.ts`:

- Hold children through a library-driven close without `transition` ("previous value in state"):
  `226-237` vs `160-170` (identical apart from names).
- Close-time exit handling: `472-482` vs `374-384` (identical block, same comments).
- Release rule in the apply effect: `385-387` vs `315-323` (same five conditions).
- `resolveInitialFocus` helper: `98-104` vs `115-121` (identical); the dev "resolved to no
  element / outside" warning: `280-293` vs `207-218`.
- JS-free `autofocus` while mounted: `392-398` (effect) vs `431-438` (callback ref): same rule,
  two mechanisms.
- Focus return to Trigger: `323-330` and an inline copy in `onClose` `457-463` vs `186-196`
  (popover variant also skips a Trigger inside a hidden popover).
- Command string parsing: `404` vs `394`
  (`String((event as Event & { command?: string }).command ?? "").toLowerCase()`).
- Accessible-name dev check: `636-648` vs `449-467` (see O9; Dialog's has no `warned` ref, so it
  re-warns every time `shown` turns true; the popover one warns once).
- `transition` / `keepMounted` JS-free dev warnings: `247-256` vs `popover/popover-popup.tsx:139-148`.

Change: not a full merge (Dialog has showModal/show, `close`/`cancel`/`submit`, the
dismissed-while-pending record, light dismiss). Extract into an internal module (for example
`internal/overlay-popup.ts`):
- `useCloseHold(committed, isLibrary, transition)` returning the `ExitAnimation` plus
  `settleClose(element, echo)` (the 374-384 block) and `releaseIfIdle(element, committed, awaitingClose, shown)`;
- `resolveFocusTarget(part, popup, initialFocus, warnedRef)`;
- `returnFocusToTrigger(element, trigger, { skipHiddenPopover })`;
- `commandOf(event)`;
- `useJsFreeAutofocus` (pick one mechanism; the callback-ref one avoids a passive-effect window,
  but switching Dialog to it is a timing change: keep Dialog's effect unless a test pins both).
- the dev warnings of O9 and the two JS-free prop warnings.

Risk (med): focus return differs subtly between the variants (Dialog's apply-effect variant only
runs after `contentProbe.hadFocus()`; its `onClose` variant only acts when focus is inside; the
popover one also checks `insideHiddenPopover`). Keep the predicates per caller.
Tests: `dialog/dialog.test.tsx`, `dialog/dialog.browser.test.tsx` (exit animations, focus
return), `popover/*.test.tsx`, `menu/menu*.test.tsx`, `internal/use-popover-hooks.test.tsx`.

## O3. Popup content wrapper repeated four times (low, ~-40 lines)

`popover/popover-popup.tsx:165-187`, `menu/menu-popup.tsx:588-606`,
`combobox/combobox-popup.tsx:124-141`, `dialog/dialog-popup.tsx:655-670`: each builds
`keepMounted ? <Activity mode={visible ? "visible" : "hidden"}>{wrapContent(x)}</Activity> :
visible ? wrapContent(x) : null`, then wraps in `<ToolbarContext value={null}>` (plus a
component context). The JS-free branch (Popover, Dialog) returns the children unwrapped.

Change: `usePopoverPopup` returns `renderContent(children: ReactNode): ReactNode` doing the
Activity / visible / wrap / ToolbarContext part (the hook already owns `visible` and
`wrapContent`, and receives `keepMounted`; see O4). Dialog uses the same helper (export a pure
`renderOverlayContent({ isLibrary, keepMounted, visible, wrapContent }, node)`). Components keep
their own outer context provider.
Risk (low): element tree must stay identical (ToolbarContext inside the component context;
Menu's `pointRules` `<style>` stays outside ToolbarContext, inside MenuListContext).
Tests: keepMounted / Activity rows in popover, menu, combobox, dialog test files;
`context-stability.test.tsx`.

## O4. Dead `keepMounted` option; over-required `initialFocus` (low)

- `UsePopoverPopupOptions.keepMounted` (`internal/use-popover-popup.ts:27`) is never read by the
  hook (only `part`, `initialFocus`, `transition`, `onBeforeToggle`, `onToggle`,
  `resolveInitialFocus`, `source` are). Passed by `popover-popup.tsx:153`, `menu-popup.tsx:382`,
  `combobox-popup.tsx:95` and `use-popover-hooks.test.tsx:44`. Either delete it or give it a use
  with O3 (recommended).
- `initialFocus` is a required key (`:20`) although Menu and Combobox pass `initialFocus:
  undefined` and override with `resolveInitialFocus` (`menu-popup.tsx:372`,
  `combobox-popup.tsx:~92`). Make it optional.
Risk: none at runtime. Tests: typecheck, `use-popover-hooks.test.tsx`.

## O5. Popover.Close and Dialog.Close are the same part (low-med, ~-90 lines)

`popover/popover-close.tsx:74-163` and `dialog/dialog-close.tsx:77-170` differ only in: the
command (`hide-popover` vs `request-close`), the native close (`hidePopover()` vs
`close(returnValue)` with an open check), Dialog's `value` / `returnValue` in `details`, and
part names in messages. Same `installClick` / `focusable` / `noInvoker` logic, same `devRef`, same
`onClick` with `useActionTrigger({ openGeneration })`, same owned keys and comments.

Change: `internal/use-overlay-close.ts` taking `{ part, isLibrary, popupId, command, disabled,
render, action, buildDetails(native), closeNatively(event), requestClose(event), openGeneration }`
and returning `{ state, libraryProps, ref }`; each part adds `value` (Dialog) on top.
Risk (low-med): owned keys must keep presence/absence exactly (`aria-disabled` is always a key
here, unlike the Trigger's conditional spread); the JS-free + action path records the close
intent before the native close.
Tests: Close rows in `popover.test.tsx` / `dialog.test.tsx` (re-entry #81, stale close,
`aria-disabled` while pending, #83 link render), the button.md 16.4 re-entry row.

## O6. Disabled / invoker attribute block duplicated (low-med, ~-40 lines)

The "link or component render whose click this part handles gets `aria-disabled`; a disabled
one in that branch is no invoker" computation appears in:
`internal/use-popover-trigger.ts:143-170`, `dialog/dialog-trigger.tsx:102-142`,
`popover/popover-close.tsx:79-87,138-150`, `dialog/dialog-close.tsx:83-91,144-157`,
`combobox/combobox-trigger.tsx:104-118`, `combobox/combobox-clear.tsx:69-76`.
The comment "(wave 9 review M1)" paragraph is copied verbatim three times.

Change: one pure helper in `render-element.ts`, e.g.
`buttonDisabledProps(render, disabled, { handlesClick, invoker?: { for, command } })`
returning `type`, `disabled`, `aria-disabled`, `commandfor`, `command` with the exact key
presence each caller has today. Note the variants: Popover/Dialog Trigger spread
`aria-disabled` only in the focusable branch (key absent otherwise, so a host button's own
`aria-disabled` passes through); Close parts always own it (pending). The helper must take that
as a flag, or the Close parts add their pending override afterwards. Combines naturally with O5.
Risk (low-med): owned-key presence (conventions 1.2), JS-free invoker markup before hydration.
Tests: #83 rows (link / component render, disabled) in popover, dialog, menu, combobox test
files; SSR markup rows.

## O7. Anchored placement plumbing triplicated (low, ~-30 lines)

`popover/popover-popup.tsx:159-161, 200, 210-217`; `tooltip/tooltip-popup.tsx:91-97, 106,
117-124`; `menu/menu-popup.tsx:345-347, 437-441, 574, 615-624`. Each: `useResolvedPlacement`,
`useMemo(mergeRefs(own, placement.ref))`, `...(side !== null && { "data-side", "data-align" })`,
and a style function `{ positionArea: positionArea(sideProp, alignProp), positionTryFallbacks,
...consumerStyle }` unless `side === null`.

Change: `useAnchoredPlacement({ side, align, fallbacks })` in `use-resolved-placement.ts`
returning `{ side, align, ref, dataAttributes, style(consumerStyle) }`. Menu passes
`fallbacks: submenu ? "flip-inline" : POSITION_TRY_FALLBACKS` and keeps its point branch.
Risk (low): the inline style must remain the *requested* values (not resolved) and sit under the
consumer's style. Tests: `use-resolved-placement.test.tsx`, placement rows in popover / tooltip /
menu jsdom and browser files.

## O8. `isPopoverOpen` copies (low, ~-30 lines)

Five definitions: `internal/use-popover-root.ts:114`, `internal/use-popover-trigger.ts:60`,
`internal/use-popover-popup.ts:81`, `popover/popover-close.tsx:45`,
`combobox/combobox-root.tsx:173`; plus `tooltip/use-tooltip-interaction.ts:226` (`isOpen`,
adds `isConnected`) and bare `.matches(":popover-open")` in `menu/menu-popup.tsx:240, 389, 411,
536`, `menu/menu-trigger.tsx:49`, `menu/menu-context-trigger.tsx:112, 170, 179`,
`internal/use-resolved-placement.ts:150`, `toast/toast-viewport.tsx:787`.
Change: one `isPopoverOpen(element: Element | null)` in a tiny pure internal module (no
directive), used everywhere. Keep the `try/catch` form (the toast viewport relies on it for a
render element without popover support).
Risk (low). Tests: whole suite (jsdom shim), browser files.

## O9. Accessible-name dev checks (low, ~-40 lines)

Five implementations with different rules: `internal/use-popover-popup.ts:449-467` (role-gated,
once), `dialog/dialog-popup.tsx:636-648` (not once: re-warns whenever `shown` flips),
`combobox/combobox-trigger.tsx:57-73` (`useNameWarning`, exported from a part file and imported by
`combobox-clear.tsx:14`), `combobox/combobox-list.tsx:59-75`, `toast/toast-close.tsx:35-52` (not
once, no `title` check).
Change: `internal/use-name-warning.ts` with one microtask-deferred, once-per-instance check taking
`(part, message, accepts?: (el) => boolean)`. Dev-only output; Dialog and Toast.Close would warn
once instead of repeatedly (dev-only, acceptable, but state it in the commit).
Risk (low; dev-only). Tests: dev-warning rows that spy on `console.error` (check counts:
`toHaveBeenCalledTimes` assertions may pin the repeat).

## O10. Oversized files: natural seams (low, pure moves)

- `menu/menu-popup.tsx` (634): move `scrollsWithin` + `listenOutside` (`195-298`, ~105 lines) to
  `menu/menu-outside.ts`; `pointStyle` (`158-189`) with the point constants of O13 to
  `menu/menu-point.ts`; typeahead buffer + `runTypeahead` + `onKeyDown` (`356-360, 456-526`) to a
  `useMenuKeyboard(menu, nativeFocusgroup)` hook. Leaves ~330 lines.
- `menu/menu-context-trigger.tsx` (573): `startDrag`, `guardTouch` and the constants (`60-250`)
  to `menu/menu-gestures.ts`; `armClickSwallow` (`370-399`) can become a pure function there taking
  a `{ current }` slot. Leaves ~300.
- `toast/toast-viewport.tsx` (913): the pure queue model (`Entry`, `makeEntry`, `withFlags`,
  `partition`, `plainText`, `138-199`) and the command reducer body of `apply` (`463-550`, made
  pure: `(entries, commands, isRendered) -> { next, dismissed, leaving }`) to `toast/toast-queue.ts`
  (unit-testable without React); the hotkey helpers (`90-119`) to `toast/toast-hotkey.ts`; the
  timer map (`207-224, 300-355, 413-417`) to a `useToastTimers` hook; the portal host
  (`121-136, 745-769`) to `useModalPortalHost`. Leaves ~450.
- `combobox/combobox-root.tsx` (905): `keyDown` / `move` / `activeEnabled` (`724-808`) to
  `combobox-keyboard.ts` (pure over a small interface); the form block (`584-661`: reset targets,
  resync, `useFormReset`, mount reconciliation) to `useComboboxForm`; the option / status / label
  registry (`417-489`) to `useOptionRegistry`; the text lane (`282-313`, the `TextRecord`
  bookkeeping) is entangled with dispatch and is better left in place.
- `dialog/dialog-popup.tsx` (700) shrinks by O2; the light-dismiss / non-modal Escape listeners
  (`519-634`) are a clean `useDialogDismiss(dialog, { modal, lightDismiss, nativeClosedBy, triggerRef })`.
- `internal/use-popover-popup.ts` (470) shrinks by O2 / O3 / O9; no further split needed.
Risk (low): pure moves; watch hook order (React rules) and the `useEffectEvent` closures.
Tests: the component test files, unchanged.

## O11. Ad-hoc "latest ref" pairs (low, ~-15 lines)

`useRef(x)` + `useInsertionEffect(() => { ref.current = x })` instead of `useLatest`:
`combobox/combobox-root.tsx:271-276` (propsRef, popoverRef), `333 + 380-382` (committedRef),
`827-830` (leaveRef); `internal/use-popover-popup.ts:404-407` (handlers). `textRef`
(`288-291`) is also written imperatively in `writeText` and must stay a plain ref (it may still use
`useLatest`'s ref, since `useLatest` returns a mutable `RefObject`, but that blurs the contract:
keep it). `committedRef` starts at `null` rather than the committed value: harmless (no action
runs before the first commit) but note it in the commit.
Risk (low). Tests: `combobox.test.tsx` (rollback, revert rows), `context-stability.test.tsx`
(`useLatest` concurrency row).

## O12. `requestClose` and `notifyClosed` identical (low, ~-8 lines)

`internal/use-popover-root.ts:236-251`: same body, same deps; the comment says so. Define one
callback and return it under both names (`notifyClosed: requestClose`) so the two call sites keep
their meaning. Dialog's two differ (`closeReturnValue`), so after O1 the same applies to the
shared core. Risk (low). Tests: `use-popover-hooks.test.tsx:174` (stable identities).

## O13. Shipped-CSS constants in `anchor-position.ts` (low, clarity)

`internal/anchor-position.ts:212-297` holds `MENU_POINT_*`, `MENU_POINT_RULES`,
`MENU_POINT_FALLBACKS` and `FSUI_PRECEDENCE`, which `tooltip/tooltip-trigger.tsx:5` imports from
the *positioning* module. `tooltip-warm.ts` is the sibling for Tooltip's stylesheet. Move the menu
ones to `internal/menu-point.ts` (beside `pointStyle` from O10, or keep `pointStyle` in Menu) and
`FSUI_PRECEDENCE` to a `shipped-styles.ts` both import. The CSS text must be byte-identical
(`csp/csp.test.tsx` recomputes the SHA-256). Risk (low). Tests: `csp.test.tsx`,
`anchor-position.test.ts`, `menu-context-trigger.test.tsx`.

## O14. Merged-ref idioms (low, clarity)

`useMergedRef(a, b)` is a generic hook living in `internal/use-field-control.ts:76-81`; Popover,
Menu, Combobox, SubmenuTrigger hand-roll `useMemo(() => mergeRefs(...), [...])`
(`popover-popup.tsx:161`, `menu-popup.tsx:438-441` (three refs), `combobox-popup.tsx:101`,
`menu-submenu-trigger.tsx:147`, `tooltip-popup.tsx:95-97`). Move it to `merge-props.ts` /
`use-render.tsx` as a variadic `useMergedRefs(...refs)` and use it everywhere. Keep its
"single ref passes through" shortcut (callers rely on not wrapping an object ref only where both
are defined, so the variadic form must filter `undefined` the same way). Risk (low).
Tests: whole suite (ref attach / detach).

## O15. Element-tag dev checks (low, ~-40 lines)

Hand-written "rendered a <x>, expected <y>" checks in ref callbacks:
`use-popover-popup.ts:417-422`, `use-popover-trigger.ts:95-101`, `dialog-popup.tsx:260-265`,
`dialog-trigger.tsx:77-83`, `dialog-close.tsx:96-104`, `popover-close.tsx:92-100`,
`menu-popup.tsx:425-430`, `combobox-popup.tsx:100-105`, `combobox-input.tsx:~90-98`. Select has a
generic helper (`select/select-dom.ts:49-83`, `useSelectPartRef`). Generalise it into
`internal/use-element-check.ts` (`(part, accepts(el), message(el))`, once per instance) and
use it everywhere; the five `() => {}` "cleanup so the merged ref never calls back with null"
devRefs disappear with it. Dev-only; some current checks are not once-per-instance (they re-warn
on remount), which the helper would change (dev-only). Risk (low).

## O16. Comment hygiene (none)

Pattern 1, review-ID and history references that explain nothing to a reader without the
review: about 40 in scope, ~85 counting bare issue numbers. Opaque because the same ID means
different things in different reviews ("H1" is WebKit's focus ring in the menu review,
`use-popover-popup.ts:45,172,306`, and the click swallow in the context-menu review,
`menu-context-trigger.tsx:323,364`). Worst files: `menu-popup.tsx` (9: `227, 283, 375, 405,
431, 500, 540`), `menu-context-trigger.tsx` (5: `106, 211, 323, 333, 364`), `dialog-popup.tsx`
(5: `210, 213, 336, 353, 490`), `use-popover-popup.ts` (4), `dialog-root.tsx:147,157`,
`dialog-form.tsx:95` ("the review's walkthrough 11.8 variant"), `render-element.ts:66` ("review
fold F1"), `use-action-trigger.ts:82` ("review M2 / PO rule"), and the "(wave 9 review M1)"
paragraph copied three times (O6). Rule: keep the *reason* (one clause), drop the ID; keep a
`#NN` issue number only where the issue is the place to read more, and point to the design
section instead where one exists.

Pattern 2, misplaced or stale doc comments:
- `menu/menu-root.tsx:76-86`: the `MenuRoot` JSDoc sits above `const DEFAULT_FOCUS`, so it
  documents the constant and `MenuRoot` has none in editors. Move the constant above the comment.
- `use-popover-popup.ts:286-293`: "review of #48, finding 4" plus a run-on sentence; the same
  paragraph is copied in `dialog-popup.tsx:332-340`.

Pattern 3, very long comments that restate design docs: `use-resolved-placement.ts:31-52`
(22 lines), `use-latest.ts:5-22`, `menu-popup.tsx:217-231` and `300-320` (owned-key list that
wraps mid-sentence at `316-319`), `menu-context-trigger.tsx:95-108, 201-216, 362-369`,
`toast/toast-viewport.tsx` header. Trim to what the code needs and link the design section.
Line-wrapping drift (lines far past the formatter's width in comments): `popover-trigger.tsx:43`,
`popover-popup.tsx:28`, `menu-trigger.tsx:15, 71`, `dialog-root.tsx:145`,
`use-tooltip-interaction.ts:97` (the formatter does not rewrap comments).

## O17. Dead code and dead exports (none, ~-15 lines)

Verified with a whole-`src` search (production files, excluding tests):
- `menu/use-menu-item.ts:22, 73`: `MenuItemBase.list` is returned and never read.
- `menu/menu-submenu-trigger.tsx:83`: `activate: open` passed to `useMenuItem` never runs: the
  SubmenuTrigger does not spread the item's `onClick` (it uses `usePopoverTrigger`'s), and the
  item's Enter / Space go through `element.click()`. Make `activate` optional, or pass nothing.
- `internal/use-popover-popup.ts:27`: `keepMounted` (O4).
- Exports used only in their own file: `defaultComboboxAnnouncement` (`combobox-root.tsx:163`,
  not re-exported from `combobox/index.ts`), `isPointerClick` (`menu-trigger.tsx:60`),
  `TOOLTIP_WARM_PROPERTY` (`tooltip-warm.ts:6`), `PopoverContextValue` (`popover-context.ts:6`,
  a bare alias of `PopoverRootValue`), `ToastRootStateShape` (O18). `transitionBoundary`
  (`transition-boundary.tsx:23`) is exported only for its test: fine, keep.
- `use-delayed-pair.ts` is fine; `sync-presence.ts` is fine.

## O18. Type tidiness (none, ~-20 lines)

- `toast/toast-context.ts:62-69` `ToastRootStateShape` restates `ToastRootState`
  (`toast-root.tsx:14-22`) "to avoid an import"; an `import type` is erased, and
  `popover-context.ts:4` already does exactly that. Replace with `import type`.
- `PopoverTriggerState` (`popover-trigger.tsx:8-14`), `MenuTriggerState` (`menu-trigger.tsx:12-18`)
  and `PopoverTriggerHookState` (`use-popover-trigger.ts:6-13`) are the same shape three times;
  make the public ones aliases of the hook's (or the hook generic over the public one). Same for
  `MenuContextTriggerState`.
- `use-popover-root.ts:220`: `createActionDetails(event, { reason }) as unknown as Details`. With
  O1's builder this default can be typed by making `details` required for `Details` other than
  `PopoverLikeDetails` (overloads), removing the double cast.
- `menu-radio-group.tsx` / `menu-checkbox-item.tsx`: `createActionDetails(event, {}) as
  ActionDetails` casts are unnecessary (`T & ActionDetails` already).
- `combobox-root.tsx:577`: inline `ariaNotify` structural type; `toast-viewport.tsx:226-228` and
  `announce.ts:7` declare their own. One `AriaNotifyTarget` type in `announce.ts` (types only; do
  not merge the mechanisms, see X).

## O19. Sibling inconsistencies (low, clarity)

- Dialog's context names its ref and id `dialogRef` / `ids.dialog` where Popover / Menu /
  Combobox use `popupRef` / `ids.popup` (`dialog-context.ts:25, 70`). Align with O1.
- Group label context: Menu provides `{ labelId }` (`menu-context.ts:208-213`), Combobox a bare
  string (`combobox-context.ts:88`). Pick one.
- Close-after-settle: `Menu.Item` uses `useActionTrigger({ openGeneration })` + a direct
  `requestClose` (`menu-item.tsx:70, 84`); CheckboxItem / RadioItem use `closeStackLater`
  (`menu-context.ts:176-182`), a second implementation of the same generation guard.
  Both are correct; using `closeStackLater` in `Menu.Item` too reads more uniformly (the double
  guard is harmless).
- Continuation after a controllable dispatch: the `after` WeakMap keyed by `details` is written
  twice (`menu-checkbox-item.tsx:66-77`, `menu-radio-group.tsx:57-68, 79-81`); Combobox does the
  same with `dispatchMeta` (`combobox-root.tsx:331`). A small `useDispatchContinuations()` helper
  (or a `then` parameter on `useControllableAction`'s `dispatch`) removes it. Low value.
- `combobox-root.tsx:169` hard-codes `["fsui-combobox", "fsui-combobox-select"]` instead of
  `transitionTypes("combobox", "select")` (every other part uses the helper). Keep a module
  constant for identity, built with the helper.
- Dev message prefix: Tooltip uses `"[Tooltip] ..."` (`tooltip-root.tsx:117, 123, 130`); every
  other part uses `"Part.Name: ..."`. Check tests that match the text before changing.
- `menu-trigger.tsx:114-122`: Menu.Trigger's `activate` re-implements usePopoverTrigger's
  default toggle only to call `setOpenCause` before an open; an `onBeforeOpen` option (or calling
  `setOpenCause` in a click handler placed in `handlers`) would avoid the copy. Low value.
- `type="button"`: Tooltip.Trigger puts it in pass-through props before `rest` (consumer may
  override, `tooltip-trigger.tsx:119`) while every overlay trigger owns it. Probably deliberate
  (Tooltip.Trigger has no click handler); document it in the part's owned-keys comment rather
  than change it.
- `"use client"` on pure helper modules: `menu/menu-dom.ts`, `menu/menu-hover.ts` use no React;
  conventions 7.1 says such modules carry no directive (`anchor-position.ts`, `tooltip-warm.ts`
  follow it). Harmless; drop for consistency.

## X. Looks duplicated, keep as is

- `const isDev = process.env.NODE_ENV !== "production"` per module (12 files in scope). Do not
  centralise into an imported constant: consumers' bundlers replace `process.env.NODE_ENV` per
  module and fold the branch; an imported binding is not reliably constant-folded across modules
  by every bundler, so dev-only code could ship to production. Not worth the risk for one line.
- `report()` in `use-controllable-action.ts:72` and `use-action-trigger.ts:37`: could be shared
  (tiny), but not worth a module.
- Announcement mechanisms: `announce.ts` (ariaNotify + live-region fallback, NumberField),
  Combobox's List `ariaNotify` (no fallback, by design 6.4), Toast's `document.ariaNotify` with
  priority. The fallback behaviour differs by design; merging would change behaviour.
- Combobox's context value is rebuilt every render (`combobox-root.tsx:860-887`) unlike the
  memoised roots (#48). Memoising it changes render counts (not DOM) and needs every callback
  stabilised; it is a perf change, not a tidy-up. File separately if wanted. (Tooltip, Toast and
  Combobox are also absent from `context-stability.test.tsx`.)
- Popover / Dialog `Title` and `Description` (4 near-identical 40-line files): a factory would
  save little and obscure the per-component public types.
- `ToastRoot`'s own exit wait (`toast-root.tsx:213-232`) vs `useExitAnimation`: different
  semantics (drop vs hold), keep.
