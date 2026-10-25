# Wave 18 source audit (read-only, master @ 8ae57fb, 2026-10-25)

Scope: `packages/ui/src` non-test files. Focus: what wave 17 (#108-#127) added to the overlays
(`trigger-ref`, `pointer-capture`, `invoker-press`, the `shown` mirror, popovertarget Triggers,
`ToggleEvent.source`, the interest proxy hide, Menu / Combobox patches). Controls: changes since
the wave 16 audit (#108 CheckboxGroup memo, #113 ToggleGroup/MenuRadio `value`, Toast arrows,
announcer fallback removal, #120 first-invalid batch). Earlier audits:
`refactor-audit-overlays.md`, `refactor-audit-controls.md` (O1-O19 / X list mostly done in #102/#104/#105).

Behaviour-preserving unless marked. "Tests" = files that pin what a change could break; always
`pnpm test:run` (jsdom + all three engines) for anything touching overlays.

## Ranking (value / risk)

| id | finding | effort | risk | breaking |
| --- | --- | --- | --- | --- |
| S1 | Two identical `announce()` + two inline `ariaNotify` calls; stale `"use client"` | S | none | no |
| S2 | Dead `onBeforeToggle` option of `usePopoverPopup` | S | none | no |
| S3 | "While shown" listener lifecycle duplicated in Menu.Popup and Combobox.Popup | S-M | low | no |
| S4 | `.source` read through four ad-hoc casts; invoker helpers split over two modules | S | none | no |
| S5 | Menu.Trigger's `activate` re-implements the default toggle; `opensOnly` flag exists only because of it | S | low | no |
| S6 | Interest-proxy state (4 refs, 2 handlers, 3 hook-in points) inlined in the 511-line `usePopoverPopup` | M | low-med | no |
| S7 | Combobox focus-leave press tracking (~90 lines) inlined in the 882-line Root | M | low-med | no |
| S8 | Content-keyed `useMemo(JSON.parse(JSON.stringify))` set, 5 copies | S | low | no |
| S9 | Comment hygiene: issue/review ids, broken wraps in public JSDoc, stale sentences, misnamed ref | S | none | no |
| S10 | Combobox.Input owns `onFocus` but neither omits nor lists it (`onBlur` is omitted) | S | low | types only |
| S11 | Dialog's context carries `shown` / `setShown` that nothing maintains | S | none | no (internal type) |
| S12 | Non-invoker warning text and reserved invoker keys copied into Combobox.Trigger | S | none | no |
| S13 | `QuietFocusTarget` unwrapped twice; focus-visible detection lives in the popup hook | S | none | no |
| S14 | `reshow()`'s outer `opening` flag looks redundant | S | low | no |
| S15 | Nits: redundant `x !== null &&` before `isPopoverOpen`, destructuring style | S | none | no |
| X | Not worth changing | - | - | - |

Suggested order: S1, S2, S4, S9, S11, S15 (mechanical); S3 + S5 + S12 + S13 (small hook API
tidy, one commit each); S8; then S6 and S7 as separate commits with full browser runs.

---

## S1. Announcement helpers: two identical `announce()`, two inline copies (S, none)

- `internal/announce.ts:18-22` `announce(element, message)` and
  `internal/focus-first-invalid.ts:19-30` `announce(element, message)`: same name, same body
  (empty check, `typeof ariaNotify === "function"`, call). Two exported functions with one name
  in two modules invite the wrong import.
- `combobox/combobox-root.tsx:517-521` and `toast/toast-viewport.tsx:108, 334-338` cast to
  `AriaNotifyTarget` and repeat the guard inline (Toast on the document with `priority`).
- `announce.ts:1` still has `"use client"` although, since #113 A1 removed the live-region
  fallback, it is a pure DOM call (conventions 7.1: no directive; compare `pointer-capture.ts:1`).

Change: one `announce(target: Element | Document, message: string, priority?: "normal" | "high")`
in `announce.ts` (no directive); delete focus-first-invalid's copy and `NotifyingElement` types;
Combobox and Toast call it. The prior audit's X item ("announcement mechanisms differ by design,
keep") no longer applies: the fallback that made them differ is gone.
Benefit: -20 lines, one place for the `ariaNotify` guard. Risk: none (same calls).
Tests: `number-field` announce rows, `field.test.tsx` / `form.test.tsx` first-invalid rows,
`combobox` results-announcement rows, `toast-viewport` announcement rows (all spy `ariaNotify`).

## S2. Dead `onBeforeToggle` option (S, none)

`internal/use-popover-popup.ts:34-35` (declaration, doc "Menu: focus bookkeeping"), `:153`
(destructure), `:339` (call). No caller passes it (`grep onBeforeToggle:` finds only the hook);
Menu's focus bookkeeping moved to `resolveInitialFocus`. Delete. If S3 lands, `onToggle`
(`:36-37`, `:371`) goes too.

## S3. "While shown" listeners duplicated in Menu.Popup and Combobox.Popup (S-M, low)

`menu/menu-popup.tsx:186-193, 210-225` and `combobox/combobox-popup.tsx:94-101, 109-116` each
hold a `useRef<(() => void) | null>`, a `stopX` callback, a `useEffect(() => stopX, [stopX])` for
unmount, and an `onToggle` that attaches on `newState === "open" && isPopoverOpen(element)` and
stops on `"closed"`. That is the only use of `usePopoverPopup`'s `onToggle` option.

Change: replace `onToggle` with `whileShown?: (popup: HTMLElement) => () => void` on
`usePopoverPopup`. The hook attaches in its `toggle` listener (`:342-372`) when the popup is
shown and no cleanup is held, runs the cleanup when it is not shown, and in `setElement`'s
cleanup (`:478-488`). Menu passes `submenu ? undefined : (el) => { listenOutside(...);
listenInvokerPresses(el) ... }`, Combobox passes `listenInvokerPresses`.
Benefit: -25 lines, one lifecycle; the Combobox unmount cleanup that #126 review (item 3) found
untested becomes the hook's, covered once.
Risk (low): unmount cleanup moves from a passive-effect cleanup to the ref detach (earlier, in
the mutation phase); nothing observable can run in between. `submenu` is static per Root.
Tests: `menu-context-trigger.test.tsx` (outside right/middle click, scroll), `invoker-press`
rows in `menu*.test.tsx` / `combobox*.test.tsx`, the #126 browser rows.

## S4. `.source` casts and invoker helpers (S, none)

The non-lib-typed `source` member is read four ways:
`use-popover-popup.ts:127` (`closedByPopoverTarget`), `:315` (beforetoggle open, inline cast),
`:388-389` (`interestSource`), `dialog/dialog-popup.tsx:355` (`{ source?: unknown }`).
Meanwhile `closedByPopoverTarget` (`use-popover-popup.ts:126-132`) and `isPopoverInvoker`
(`internal/invoker-press.ts:21-32`) both answer "is this button an invoker of popup" in
different modules.

Change: `eventSource(event: Event): Element | null` (ToggleEvent, CommandEvent, InterestEvent)
next to `isPopoverInvoker`; move `closedByPopoverTarget` there too and rename the module
`internal/invokers.ts` (it is no longer only about presses). Dialog's `valueOf(source)` keeps its
own button check. Benefit: one documented place for the platform's invoker relationship (with
the support versions now in two JSDocs). Risk: none.

## S5. Menu.Trigger's `activate` duplicates the default toggle (S, low)

`menu/menu-trigger.tsx:143-151` re-implements `usePopoverTrigger`'s default click
(`internal/use-popover-trigger.ts:150-154`: `intended() ? requestClose : requestOpen`) only to call
`menu.setOpenCause("first", isPointerClick(native))` before the open. Because Menu.Trigger has an
`activate`, the hook needs a second flag, `opensOnly` (`use-popover-trigger.ts:46-51`, its doc
says so: "Not `activate !== undefined`: Menu.Trigger has an `activate` that closes"), set only by
SubmenuTrigger (`menu-submenu-trigger.tsx:157`).

Change: add `beforeOpen?: (event: MouseEvent<HTMLElement>) => void` to `usePopoverTrigger`
(called right before the default `requestOpen`); Menu.Trigger passes it instead of `activate`;
drop `opensOnly` and derive the SubmenuTrigger warning from `activate !== undefined`. (The same
two-line toggle is in `combobox-trigger.tsx:152-154`; leave it, see X.)
Benefit: one flag fewer, the default toggle in one place. Risk (low): ordering of
`setOpenCause` vs `requestOpen` stays identical. Tests: `menu.test.tsx` open-cause rows
(pointer vs keyboard focus ring), `use-popover-hooks.test.tsx`, SubmenuTrigger non-button warning row.

## S6. Interest proxy hide inlined in `usePopoverPopup` (M, low-med)

#127 added `interestInvoker`, `interestOpen`, `interestHideTask`, `interestHide`
(`use-popover-popup.ts:169-175`), `onInterest` / `onLoseInterest` (`:387-431`, 45 lines incl.
the long Chromium explanation), a read in the opening `beforetoggle` (`:313-316`), the
`lostInterest` gate in `toggle` (`:346-347, 354, 361`) and five resets in `setElement`'s cleanup
(`:480-484`). It is Chromium-only behaviour threaded through the generic hook; the hook is now
511 lines.

Change: `useInterestDismiss(ctx, popupRef)` in `internal/interest-dismiss.ts` returning
`{ onInterest, onLoseInterest, noteOpen(event), takeLostInterest(): boolean, reset() }`; the
hook calls those at the same four points. Keep the explanatory JSDoc with the extracted code.
Benefit: the generic hook reads as the design 2.x state machine again; the Chromium workaround
is one file, easy to delete when Chromium changes (`invokedVia` behaviour).
Risk (low-med): ordering inside `toggle` (read `interestHide` before the focus-return check) and
the one-task deferral must stay exact. Only Chromium exercises it.
Tests: the #127 rows in `popover*.browser.test.tsx` (Chromium, interest-opened popover, regained
interest cancels the hide), `use-popover-hooks.test.tsx`.

## S7. Combobox focus-leave press tracking inlined in the Root (M, low-med)

`combobox/combobox-root.tsx:725-816` (#111): `presses`, `afterPress`, `unwatchPresses`,
`unwatch`, `watchPresses` (document pointer listeners + window blur), the mount effect, `focusIn`
and the no-`relatedTarget` branch of `focusOut`. It is self-contained ("decide a focus-out after
the press that caused it is released") and only touches `leaveRef`, `inputRef`, `popupRef`.
The Root is the largest file in the package (882 lines).

Change: `useDeferredLeave({ inputRef, popupRef, leave })` in `combobox/use-deferred-leave.ts`
returning `{ focusIn, focusOut }` (the `relatedTarget` branch stays inside it too). Pure move.
Benefit: -95 lines from the Root; the #111 timing reasoning sits next to its code.
Risk (low-med): the effect order (mount effect vs other Root effects) is irrelevant here; keep the
`unwatch` on unmount. Tests: `combobox.test.tsx` label-press rows, #111 / #123 browser rows
(Firefox press-hold-release).

## S8. Content-keyed value sets, five copies (S, low)

`accordion/accordion-root.tsx:221-226`, `toggle-group/toggle-group-root.tsx:203-212` (controlled +
default), `checkbox-group/checkbox-group-root.tsx:216-225` (controlled + default, #108): each
`const key = v === undefined ? undefined : JSON.stringify(v); useMemo(() => key === undefined ?
undefined : toSet(JSON.parse(key) as T), [key])`, with a comment explaining it each time.

Change: `useValueSet(value: string | readonly string[] | null | undefined): ValueSet | undefined`
in a small `internal/use-value-set.ts` (`value-set.ts` is directive-free pure code; keep it so),
with the explanation once. Benefit: -20 lines, one comment. Risk (low): Accordion's value type
includes a single string; `toSet` already handles it. Tests: the "inline value array" rows of the
three groups, `context-stability.test.tsx`.
(CheckboxGroup's `renderedKey` state memo at `:382-386` is a different use; leave it.)

## S9. Comment hygiene (S, none)

- Issue / review ids without need: 64 `#nnn` references in source, 58 of them added by wave 17
  (`use-popover-popup.ts` 10, `use-popover-trigger.ts` 8, `combobox-trigger.tsx` 7). Most sit
  next to a full explanation, where the id adds nothing a `git blame` does not; worst are bare
  review labels: `trigger-ref.ts:11` "(#113 API3)", `use-popover-trigger.ts:192` and
  `combobox-trigger.tsx:135` "(#121 review F1)", `use-popover-popup.ts:169, 398` "amendment #127",
  `announce.ts:4` "#113 A1". Replace with the design section (popover.md 2.3 / 14.x, conventions
  3.5) or drop. Keep ids that point at an upstream bug (DefinitelyTyped #74664, react #...).
- Public JSDoc with broken wraps (lands in consumers' `.d.ts`): `menu/menu-trigger.tsx:84-88`
  (a 140-column line mid-paragraph), `:49-51`, `menu/menu-submenu-trigger.tsx:55-64`,
  `popover/popover-trigger.tsx:50-52`. Re-wrap at 100.
- Stale text: `use-popover-popup.ts:146-147` "Shared by Popover and Menu" (Combobox too);
  `:493` "`role="dialog"` needs a name" (also `menu`, per `needsName`).
- `menu/menu-popup.tsx:263` `devRef` installs the production `pointerdown` `claimPress`
  listener; rename (`pressRef`). Combobox's `devRef` (`combobox-popup.tsx:119`) is dev-only, fine.

## S10. Combobox.Input `onFocus` (S, low; types-breaking)

`combobox/combobox-input.tsx:156-158` installs `onFocus` (the #111 press watch), but the props
type omits `onBlur` (`:45`) and not `onFocus`, and the owned-key list (`:72-78`) does not name it.
A consumer `onFocus` is chained (merge rule), so nothing breaks today; it is the inconsistency
that matters (`onBlur` refused, `onFocus` accepted). Either list `onFocus` as owned and omit it
(breaking for types; matches `onBlur`), or, preferred, keep accepting it and add it to the doc as
"owned, chained". Decide with the architect; docs page props table follows.

## S11. Dialog context carries a dead `shown` mirror (S, none)

`internal/use-overlay-root.ts:50-58, 286, 301-302`: `shown` / `setShown` are on every
`OverlayRootValue`, documented "Dialog does not maintain it", so `DialogContextValue` exposes an
always-`false` field. Change: `DialogContextValue extends Omit<OverlayRootValue<...>, "shown" |
"setShown">` (`dialog/dialog-context.ts:12`). Type-only; runtime object unchanged.

## S12. Invoker texts and reserved keys copied into Combobox.Trigger (S, none)

- The library-mode non-button warning, `use-popover-trigger.ts:118-123`, is repeated nearly
  verbatim in `combobox/combobox-trigger.tsx:91-101` ("Only a <button> is the ... invoker: a
  press ... closes it through light dismiss before the click, so the close is not awaited,
  openChangeAction(false) cannot veto it and there is no exit transition"). Export a
  `nonInvokerMessage(part, tag, noun)` from `use-popover-trigger.ts`.
- `popoverTargetAction` / `commandfor` / `command: undefined` reserved in both
  (`use-popover-trigger.ts:189-194`, `combobox-trigger.tsx:136-139`, same #121 F1 comment).
  A `RESERVED_INVOKER_KEYS` constant spread in both.
Benefit: small (-10 lines), keeps the two texts from drifting.

## S13. Initial-focus plumbing in `usePopoverPopup` (S, none)

- `resolveFocusTarget` (`:197-205`) and `showPopup` (`:208-216`) both unwrap
  `HTMLElement | QuietFocusTarget`. Return `{ target, quiet } | null` from `resolveFocusTarget`.
- `supportsFocusVisibleOption` / `resetFocusVisibleOption` / `QuietFocusTarget` (`:46-118`) are a
  self-contained engine probe; move to `internal/focus-visible.ts` (directive-free), which also
  makes `vitest.setup.ts:8` stop importing from the popup hook.

## S14. `reshow()` sets `opening` around both halves (S, low; verify first)

`use-popover-popup.ts:241-248`: `opening` is read only in the opening branch of `beforetoggle`
(`:311`), and `showPopup` sets it itself (`:222-227`), so the outer set covers only the hide half,
where nothing reads it. Conventions 3.5 describes "re-shows under its own opening flag", which
`showPopup` already satisfies. Drop the outer set (keep `reshowing`), or keep it and say why. Low
value; only do it with the context-menu move rows green on all engines.

## S15. Nits

- `isPopoverOpen` accepts `null`; `x !== null && isPopoverOpen(x)` in
  `combobox-root.tsx:711, 832`, `menu-popup.tsx:213`, `combobox-popup.tsx:111` (where `element` is
  used afterwards keep the check for narrowing).
- `use-popover-popup.ts:153-154`: one option destructured, the next read separately
  (`onToggleOption`); goes away with S2/S3.
- `menu-popup.tsx:180-181, 274`: `const { side } = placement; const resolvedAlign =
  placement.align; const placementRef = placement.ref;` (Popover.Popup destructures in one line).

---

## X. Not worth changing

- **Menu.Trigger's own `onMouseDown` (`menu-trigger.tsx:137-140`, #110) vs the #126 invoker-press
  guard.** The guard also covers the Trigger while shown (it is a `popovertarget` invoker), but the
  two are judged on different predicates by design (conventions 3.5: Trigger on `intended()`,
  foreign invokers on shown), and the Trigger rule also covers a non-button `render`, `disabled`
  and the not-yet-shown pending open. Keep both; at most a one-line cross-reference comment.
- **Combobox.Trigger onto `usePopoverTrigger`.** It must not register as the Root's Trigger (the
  input is the `source`), writes `popovertarget` from the ref after hydration only, is
  `tabIndex=-1`, prevents every press and refocuses the input. Merging would add three flags to
  the shared hook for one caller. S12 shares what is truly common.
- **A `toggle()` on the Root** for `intended() ? requestClose : requestOpen`: two lines in two
  places after S5; not worth an API member.
- **Dialog.Popup listeners via passive effect vs `usePopoverPopup`'s callback ref**, and Dialog's
  effect-based JS-free `autofocus`: the timing differs and is pinned; the prior audit already
  decided to keep it.
- **Memoising Combobox's context** (`combobox-root.tsx:835-864`): now the only unmemoised Root
  context after #108, but it is a perf change needing every callback stabilised, not a tidy-up.
  File as an issue if wanted (with a `context-stability.test.tsx` row).
- **`trigger-ref.ts`'s module-level `WeakSet`** for warn-once: correct (keyed on the Root's ref,
  collected with it); a per-Root `useRef` flag would need threading through the context.
- **`pointer-capture.ts` as its own module** (two callers): fine, it documents the throw.
- **Dialog.Trigger's "no Popup rendered" dev check** has no Popover/Menu counterpart: adding one
  is a behaviour (warning) change, out of tidy-up scope.
- **Per-module `isDev`**, Title/Description per component, Toast's own exit wait: unchanged
  reasoning from `refactor-audit-overlays.md` X.

## Controls since the wave 16 audit

Little accreted. #108 brought CheckboxGroup's context to the memoised pattern the other groups
use (`useLatest` + stable callbacks) and added the third/fourth content-keyed set (S8). #113's
`value` on item states, Toast's `ownsArrows` guard (`toast-root.tsx:243`, reusing
`use-roving-focus.ts`'s helper) and #120's batch `sources` (`focus-first-invalid.ts`) are tidy.
The only control-side findings are S1 (announce) and S8. Slider / NumberField / Select: no
source changes beyond the #105 refactor, which the wave 16 review accepted.
