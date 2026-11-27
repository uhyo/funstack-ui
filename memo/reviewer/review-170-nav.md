# Review: NavigationMenu (#170), branch feat/170-navigation-menu @ bc445802

Reviewer, 2026-11-27. Against origin/master 2cbfc36d, design `design/components/navigation-menu.md`
(accepted), conventions, Popover. Section 9 left to the architect (review/170-nav, b98e3ebc, which
already accepts the developer's open choices).

Verified locally in a worktree: ui build, `tsc`, `pnpm lint` (design refs, layering), `format:check`,
docs `tsc`; jsdom navigation-menu + `src/__tests__` 481/481; browser navigation-menu files on
Chromium and Firefox 26/26 (Firefox alone 13/13). **WebKit could not launch here either** (nor on
the developer's machine): the WebKit rows have never run. Merge only after the CI WebKit job is green.

## Verdict

Acceptable with minor fixes. One should-fix on tests; the rest are nits. No correctness bug found.

## Should fix

1. **The shared browser overlay suite is not run.** `navigation-menu.browser.test.tsx` has its own
   13 rows but no `describeOverlayInBrowser` (`__tests__/overlay-browser-suite.tsx:326`), which
   Popover, Menu, Combobox and Dialog run. testing.md's "Fact handler (both)" row names that suite
   for every overlay Root with `onOpenChange`, and this branch adds `NavigationMenu.Item` to
   that set (overlay-open-state.md 3.9). Rows that matter here and run only in jsdom (or not at all):
   - "a real press while open": the own Trigger's awaited close vs light dismiss with Playwright's
     pointer. This is where `whileShown: listenInvokerPresses` (`navigation-menu-popup.tsx:209`)
     and the focus-leave close meet. The guard also blocks focus on the **own** Trigger's
     mousedown, because `isPopoverInvoker` matches it.
   - "a dismissal runs no view transition" with `transition` set: Escape, a press outside, and
     the focus-leave fact. The browser `transition` row (`navigation-menu.browser.test.tsx:234`)
     only counts the open and the Link close. The jsdom types test covers types, not a real
     `startViewTransition`.
   - The exit animation and the deferred unmount (library mode, CSS exit).
   The suite supports `popoverTarget: true`, and the Harness is Popover-shaped, so wiring it up
   should be cheap. If a row cannot apply, record why per testing.md rather than dropping it.

## Nits

2. **Shared warning wording still says "Root".** `internal/overlay/use-overlay-root.ts:286-289`: the
   new noun "panel" is right, but the text keeps "`onOpenChange` is where a controlled **Root** is
   told". `internal/overlay/trigger-ref.ts:25-27` says "mounted in the same **Root** … per **Root**".
   For NavigationMenu, `Root` is a real part with no open state, so the message points at the wrong
   part. Suggest an owner noun next to `nouns` (`"navigation-menu": "Item"`), or wording without
   "Root". The test (`navigation-menu.test.tsx:577`) only checks "this panel".
3. **The comment on the invoker guard is narrower than the code.** `navigation-menu-popup.tsx:207-208`
   says "a foreign invoker of the panel outside the Item", but the guard also matches the panel's own
   Trigger (it is an invoker, outside the popup). That is harmless: focus is already inside the
   Item, and the platform's hide returns it. Correct the comment so nobody "fixes" it later.
4. **JS-free mode records a close intent nothing consumes.** `navigation-menu-item.tsx:317` calls
   `recordCloseIntent` before `hidePopover()` in both modes. It does no harm (`clearLater` drops it),
   but `if (mode === "library")` would match the comment on the line above it.
5. **The docs do not say that `target="_blank"` and `download` links close the panel.**
   `NavigationMenuPage.tsx`, the Link section: it lists modifier clicks as the way to keep the
   panel open. Since the architect made "`target` and `download` are ignored" a rule (b98e3ebc),
   add one clause, so nobody expects a `target="_blank"` link to keep the panel open.
6. **The transition-types callout's advice is vague.** "Match your page animation on something the
   panel's commit does not change" (`NavigationMenuPage.tsx`, the transition-types Callout) gives
   no concrete selector. Suggest the actionable half: "or give the panel no `transition`", plus a
   pointer to the router-side fix once its issue exists. The architect's memo has text for an
   issue in this repo (a human carries it to FUNSTACK Router); filing that issue here is still
   open.
7. **testing.md's action-naming row is stale.** "`onOpenChange` on exactly PopoverRootProps,
   MenuRootProps, ComboboxRootProps and DialogRootProps" (testing.md, the Action naming row) was
   already missing HoverCard and MultiSelect. The test (`action-naming.test.ts:480`) now lists
   `NavigationMenuItemProps` too. Since the branch edits the neighbouring row, align this one.
8. **Missing blank line in the CHANGELOG.** `design/CHANGELOG.md:14444`: the new `##` heading
   directly follows the previous paragraph. The menubar branch appends at the same place, so expect
   a merge conflict there.

## Checked and fine

- **APG disclosure navigation.** No menu roles anywhere. A real `<nav>`. `ul[role=list]`, a
  consumer-overridable default (`navigation-menu-list.tsx:185`). A `<button popovertarget>` with
  no `aria-expanded` or `aria-controls`, per `docs/research/invoker-aria-expanded.md` and Popover:
  Chromium and WebKit expose the platform state, and Firefox ORs it. A `div popover` with no
  role. `aria-current` passes through, with no `data-current`. Escape returns focus to the Trigger
  in both modes (browser rows), and so does a followed Link. Opening moves no focus.
- **JS-free without hydration.** `navigation-menu.browser.test.tsx:91-131` parses
  `renderToString` output with no script and exercises toggle, Escape, focus return, one panel at
  a time, light dismiss and the Tab order through the panel. This is a real no-JS test. The jsdom
  rows check the server HTML (links present in JS-free mode, an empty panel in library mode) and
  a panel opened before hydration.
- **Directive-free Root and List.** Neither has a directive. Both import only `render-element.js`
  and types. `directives.test.ts` lists them and adds them to the "reaches no client module"
  graph check. The docs site example `NavigationMenuSite.tsx` is a Server Component.
- **Request vs fact.** Focus leaving a shown panel is `hidePopover()` plus a `"dismiss"` fact
  carrying the `focusout` event. A pending open is superseded through `requestClose(event,
  "dismiss")`. A null `relatedTarget` closes nothing. A followed Link is `requestClose(event,
  "activate")` (awaited, a transition, with types), or `hidePopover()` in JS-free mode. Modified
  and non-primary clicks are ignored. The listeners attach through refs, so `onBlur` and `onClick`
  stay the consumer's. The shared open-state suite runs with both part closes (the Trigger and a
  Link): optimistic, rollback, overlapping, suspending content, controlled parity, facts and
  adoption.
- **Consistency with Popover.** Item props mirror Popover.Root. Trigger props and state are
  aliases. Popup omits `onToggle` / `onBeforeToggle` like Popover.Popup, with the same
  `side` / `align` / `keepMounted` / `transition` semantics and JS-free warnings.
- **Docs props tables match the declarations.** The parts, defaults, owned keys, state shapes,
  `AnchorAlign` including `center`, and the data-attributes table all agree with the code.
- **Shared-code changes.** The `nouns` entry is fine apart from nit 2. The suite's `component`
  option is minimal and correct (`overlay-open-state-suite.tsx:354`), and no other place derives
  the prefix from `name`.

## Opinion on the developer's deviations (CHANGELOG, "Implementation choices")

All acceptable. I agree with the architect's acceptance in b98e3ebc.
- Function `className` / `style` / `children` on Root, List and Link: required by conventions 1.3.
- Trigger types as aliases: right. A separate interface would only drift.
- The `focusout` as the fact's event: better than `toggle`. It names the cause, as Combobox and
  HoverCard do.
- `listenInvokerPresses`: needed. Without it, a foreign invoker's press would close the panel at
  the focusout and its toggle would re-open it. See nit 3 for the comment.
- Ignoring `defaultPrevented`: necessary. A native listener cannot see React's handlers, and a
  router link always prevents the default. `closeOnActivate={false}` is the escape hatch.
  `target` / `download` closing the panel: fine, but document it (nit 5).
- The development warnings as built: fine. The adjacency check runs once after mount, which is
  enough for a static structure.
