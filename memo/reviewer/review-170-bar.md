# Review: Menubar (#170), branch `feat/170-menubar` @ 7b8e6a5a

Reviewer, 2026-11-27. Against origin/master, design/components/menubar.md (accepted), menu.md,
conventions 1.2 / 7.1 / 9.1, and the user's decisions (single `<Menubar>` around Menu.Roots;
old menu closes at once, new Trigger focused and pending; hover switches only while a menu is
open; horizontal only).

**Verdict: acceptable with minor fixes.** One must-fix (a regression for Menu outside a bar),
one should-fix test gap; the rest are nits.

Verified: jsdom menubar/menu/toolbar/popover (778 pass), browser menubar + menu on Chromium and
Firefox locally (WebKit not launchable here), CI run 45920631674 at 7b8e6a5a green on all three
engines; `pnpm lint` (design refs, internal layering) and typecheck and format:check clean.

## Must fix

1. **Consumer `onPointerMove` on a `Menu.Trigger` outside a bar is dropped.**
   `packages/ui/src/menu/menu-trigger.tsx:195-203,216`. Outside a bar `onPointerMove` is
   `undefined`, but the key is still passed in `handlers`, spread into `libraryProps`
   (`use-popover-trigger.ts` `merged = { ...handlers }`), and `libraryProps` is the owned layer
   of `mergeProps`, where a present key with `undefined` removes the prop
   (`internal/merge-props.ts` `layer`, "an owned layer ... removes the prop"). Probe:
   `<Menu.Root><Menu.Trigger onPointerMove={fn}>` + `fireEvent.pointerMove` → `fn` called 0
   times on the branch, 1 time on master. Fix: only add the key in a bar
   (`...(bar !== null && { onPointerMove })`), and add a jsdom row for a plain Menu.Trigger's
   consumer `onPointerMove` (the existing row at menubar.test.tsx:810 covers only the in-bar case).

## Should fix

2. **The "skip a menu the browser just hid" guard is untested.** `packages/ui/src/menubar/menubar.tsx:73`.
   Mutation: dropping `&& !menu.hiddenBeforeToggle()` leaves all 48 jsdom rows green. The logic
   itself is right (same shape as `hover-card/use-hover-card-interest.ts:176`): step 1's focus move
   hides the old popup synchronously through Menu.Popup's blur rule, its `toggle` is a task away,
   so without the guard the old Root would get `openChangeAction(false, "dismiss")` as well as the
   `onOpenChange` fact. Pin it: in menubar.test.tsx:311 give File an `openChangeAction` spy and
   assert it is not called during the switch (and the same for a hover switch).

3. **No row for a second switch while the first target's items suspend** (the case the lead
   asked about). Probe (not committed): Edit's items suspend, ArrowRight from File, ArrowRight
   again on Edit's pending Trigger → View opens at once, Edit gets `[true, activate]`,
   `[false, dismiss]`, never shows, no fact; resolving Edit's data later shows nothing. So the
   behaviour is right, but it is unpinned. The only second-switch row (menubar.test.tsx:560)
   uses a deferred `openChangeAction`, which is a different mechanism (React's async-action
   entanglement). This answers the architect's "Not measured" in the a9cc4b18 CHANGELOG entry:
   with suspended content alone, nothing entangles; the superseded open never shows and the
   next open commits at once.

## Nits

4. **CHANGELOG over-generalises the entanglement.** `design/CHANGELOG.md:14474-14476` ("the next
   target's open is entangled with that pending transition and commits when it settles"). True
   only when the pending part is an async `openChangeAction` (or an item action, walkthrough 8.3);
   with suspending items the next open commits at once (finding 3). Same wording in the developer
   memo. The architect's a9cc4b18 entry already narrows it to `openChangeAction(true)`; the
   developer's entry still reads as general.

5. **Disabled Trigger ARIA is misdescribed.** A disabled Trigger in a bar is not an invoker
   (`disabledButton` with `alwaysFocusable` → `invoker: false`), so it renders no `popovertarget`
   and **does** render `aria-expanded="false"` (`use-popover-trigger.ts`, `invoker ? undefined :
   ctx.shown`). Rendered: `<button aria-disabled="true" aria-expanded="false" role="menuitem"
   aria-haspopup="menu" …>`. That is correct ARIA, but `design/CHANGELOG.md:14458` attributes
   Chromium's `expanded=false` to `aria-haspopup`, the probe page
   (`memo/developer/probes/170-menubar-ax/page.html:21`) gives the disabled View a `popovertarget`
   unlike the component, and the docs ARIA row (`packages/docs/src/pages/MenubarPage.tsx:230`)
   and menubar.md 6 say "no `aria-expanded`" without the disabled exception. Fix the wording;
   the architect may want one clause in menubar.md 6.

6. **`preventDefault()` before a no-op step.** `packages/ui/src/menu/menu-popup.tsx:243-244`: with
   `loop={false}` at an end, a single-menu bar, or a Root in the bar whose `triggerRef` is not a
   registered Trigger (a `Menu.ContextTrigger` Root placed directly in the bar), the arrow is
   consumed and nothing happens. Harmless today (nothing else acts on ArrowLeft/Right on an
   item); could return a boolean from `step` and prevent only when it switched.

7. **Dev warning false positive with suspended menus.** `packages/ui/src/menubar/menubar.tsx:169`:
   "no menu of the bar after mount" fires when every Menu.Root is inside a Suspense boundary that
   shows its fallback at mount (the bar commits, the Triggers do not). The row at
   menubar.test.tsx:838 does not suspend. Consider checking in a later effect / on first key, or
   documenting.

8. **Menu mode ends on a disabled Trigger.** Arrowing File → (disabled) View → next: focus moves
   to File but nothing opens, because View is not intended open. This follows the design (2.2
   step 3 and 2.3 "a Trigger whose menu is intended open"), so not a developer defect; flag for
   the architect whether a switch onto a disabled Trigger should keep the bar in menu mode (native
   menubars do).

9. **Conventions 7.1 list.** `internal/menubar-context.ts` follows 7.1 (cross-folder context in
   `internal/`, `"use client"`, imports only React) and 9.1 (`check-internal-layers` passes), and
   it is listed in internal-hooks.md. Resolved on this branch by the architect (a9cc4b18): 7.1
   now names it and menubar.md's status line says implemented.

10. **`onPointerMove` called "owned" in docs.** `MenubarPage.tsx:116-117` and the Menu.Trigger
    JSDoc list `onPointerMove` as an owned key while also saying the consumer's still runs; it is
    a merged handler, like `onKeyDown`. Wording only.

## Checked, no finding

- APG Menubar: `role=menubar` named by consumer, Triggers `menuitem` + `aria-haspopup`, one Tab
  stop with memory, Arrow/Home/End roving (RTL from the bar's computed direction), ArrowDown /
  Enter / Space / ArrowUp unchanged, ArrowRight from any non-SubmenuTrigger item at any depth,
  ArrowLeft only at top level (submenu ArrowLeft prevented by the submenu popup first), Escape and
  item activation return focus to the new Trigger (browser rows, all engines), Shift+Tab lands on
  the Trigger, Tab leaves and hides a hover-opened menu, disabled Trigger focusable / announced /
  never opens. axe-core and the Chromium AX tree confirm the popup-as-child anatomy.
- Async React: switch opens are `openChangeAction(true, "activate")` in a transition with
  `data-open` / `data-pending`; shown menus are hidden with `hidePopover()` and reported as
  `onOpenChange(false, "dismiss")`; pending opens superseded with `requestClose(event,
  "dismiss")`; focus-leave does the same; null `relatedTarget` closes nothing. Controlled Roots
  follow 3.9.4.
- Switch order (focus Trigger, close others, request target) matches 2.2; the Trigger is focused
  before `showPopover`, so the platform's focus return is right.
- Hover: `pointermove`, not touch, not disabled, only while another menu is intended and not
  already hidden; no delay.
- Menu outside a bar: apart from finding 1, `menu-trigger.tsx` changes are gated on `inBar`
  (`role`, `alwaysFocusable`, the vertical-Toolbar key path) and `menu-popup.tsx` adds nothing when
  the context is `null`; Menu jsdom and browser suites pass unchanged.
- `usePopoverTrigger`'s `alwaysFocusable`: only ORed into `disabledButton`'s option, so the
  non-button warning stays the ordinary one; `submenuItem` behaviour unchanged.
- Registry keyed by Trigger element via a ref callback with cleanup, through `useMergedRefs`
  (stable); order from `sortByDocumentOrder`.
- Tests: no fixed sleeps in jsdom; browser rows use `settle` / `expect.poll`; engine branch only
  for the CDP tree, axe on all engines. `axe-core` is a devDependency used only by
  `menubar.browser.test.tsx` (not shipped; MPL-2.0, fine for a dev tool).
- Docs: Menubar props table (`loop`, `className` / `style` / `children` functions, `render`) and
  `MenubarState` match `menubar.tsx`; package export, tsdown entry, index re-export, directives
  and action-naming lists updated; skill entry and roadmap present.
