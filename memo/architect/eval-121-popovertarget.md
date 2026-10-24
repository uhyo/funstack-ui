# Evaluation: `popovertarget` Triggers with no `aria-expanded` (#121, option E of #118)

Date: 2026-10-24. Architect evaluation only; no design doc changes. Inputs:
`docs/research/invoker-aria-expanded.md`, the #118 amendment and M1 revision in
`design/components/popover.md`, conventions 3.2 / 3.5 / 7.3 / 7.4 and decision 40, #110 / #112 /
#115 / #123 in combobox.md, menu.md and popover.md, `use-popover-trigger.ts`,
`use-popover-popup.ts`, `combobox-trigger.tsx`, `dialog-trigger.tsx`, the jsdom invoker shim, the
docs pages, #19. Probes (plain DOM, real pointer, Chromium 156 and Firefox 157; WebKit from
`main` source): `memo/architect/probes/121-popovertarget/`.

## Summary

- **Adopt, before 0.1.0, as one scheduled overlay wave item; not conditional on w3c/html-aria#514
  merging.** The platform facts are already settled: Chromium and WebKit ignore the attribute on
  an invoker today, all three engines map `popovertarget` natively, and the alpha is the only
  cheap moment to remove a consumer-visible attribute (`aria-expanded` on every overlay Trigger).
  Rough effort: about three agent-days (design amendment 0.5, implementation and tests 1.5 to 2,
  review 0.5).
- Nothing the library relies on is lost. Light-dismiss exemption, implicit anchor, nested
  stacking, cancelled-click suppression and `ToggleEvent.source` behave identically for the two
  attributes in Chromium and Firefox (measured) and in WebKit (source: `handlePopoverLightDismiss`
  checks `commandForElement()` then `popoverTargetElement()`; `topmostPopoverAncestor` reads the
  popover's `invoker`, set by "show popover" for both). The one thing that goes away is the
  `command` event from the library's own Trigger, which the Trigger cancels anyway.
- Two engine findings beyond the research: Firefox, like Chromium, exposes **no** state for an
  invoker inside its own popover (so `Popover.Close` is unaffected by the choice of attribute in
  those two engines; WebKit's quirk stays source-only), and a `role="menuitem"` invoker
  (`SubmenuTrigger`) gets the implicit state in both.
- Two design choices to escalate (section 8): keep an explicit `aria-expanded` on Triggers that
  render no `popovertarget` (non-button `render`), and what JS-free mode writes on the Trigger in
  place of today's `aria-expanded` DOM write (`data-open`, or nothing plus a `:has()` recipe).

## 1. What changes per component

| Part | Today | After E | Notes |
| --- | --- | --- | --- |
| `Popover.Trigger` | `commandfor` + `command="toggle-popover"`, `aria-expanded` (library: `shown`; JS-free: DOM-written) | `popoverTarget={ids.popup}` (default action `toggle`, not rendered), **no `aria-expanded`** when it is an invoker | Both modes. JS-free: the Popup's `toggle` listener no longer writes `aria-expanded` (section 5 for what, if anything, replaces it). |
| `Menu.Trigger` | same, plus `aria-haspopup="menu"` | same change | `aria-haspopup` unaffected; measured: the implicit state is exposed next to it. |
| `Menu.SubmenuTrigger` | same, `role="menuitem"` | same change | Measured: `menuitem expanded=true/false` in Chromium, `menuitem [expanded,expandable]` in Firefox. |
| `Combobox.Trigger` | `commandfor` / `command` written through the ref after hydration (#112), `aria-expanded` (`shown`) rendered | `popovertarget` written through the ref after hydration, no `aria-expanded` | Pre-hydration the Trigger has no state at all (today: `"false"`); the Input keeps its explicit `aria-expanded` and is the widget's primary control, so acceptable. The ref write is `setAttribute("popovertarget", id)`, lowercase. |
| `Combobox.Input` | explicit `aria-expanded` (`shown`) | unchanged | `role="combobox"` requires it; it is no invoker. |
| `Popover.Close` | `commandfor` + `command="hide-popover"` | **unchanged** | Measured: an invoker inside its own popover exposes no expanded state in Chromium and Firefox with either attribute, so `popovertargetaction="hide"` buys nothing, and the `command` event is what gives the Popup a foreign hide's reason (section 2). WebKit's "AXExpanded=YES inside own popover" quirk (research upstream report 2) is attribute-independent and stays a human-filed report. |
| `Dialog.Trigger` / `Dialog.Close` | `commandfor` + `show-modal` / `request-close` | **unchanged** | `popovertarget` acts only on `[popover]` elements; a modal `<dialog>` has no attribute-driven opener other than `command="show-modal"`. `Dialog.Trigger` renders no `aria-expanded` and #514 covers only the three popover commands, so the Dialog is outside this issue entirely. A `Popover.Popup` rendered as `<dialog popover>` is a popover and is targeted normally. |
| `Button` | in-flight guard cancels the click | unchanged | The guard is attribute-agnostic (`preventDefault()` cancels any activation behaviour); the `ButtonInvoker` docs example keeps `commandfor`. |
| Tooltip, Toast, Select | no invoker Trigger, or browser-owned picker | unchanged | |

Rendering detail: react-dom 19.3.1 knows `popoverTarget` / `popoverTargetAction` as the canonical
prop names (the lowercase spelling warns "Invalid DOM property"), serialises them camelCase in
server HTML (`popoverTarget="p"`, parsed case-insensitively) and lowercases them through
`setAttribute` on the client. So the Trigger writes the typed camelCase prop, and the attribute
leaves the conventions 7.4 augmentation and lowercase-pass-through rows. `@types/react` types the
action as `"toggle" | "show" | "hide"`.

Where the Trigger is **not** an invoker (a `render` that is not a `<button>`, #115; the
`aria-disabled` branch where the attributes are withheld), nothing exposes a state unless the
attribute is rendered. Recommendation: render `aria-expanded={shown}` exactly when no
`popovertarget` is rendered. That is conforming under #514 (the MUST NOT is for elements that
carry `popovertarget` or a popover `command`), keeps today's behaviour for a link-shaped Trigger
in every engine, and is one conditional in `usePopoverTrigger`. `aria-expanded` stays an
omitted key in every Trigger's props type, so no consumer can add it back onto an invoker
(Firefox would OR it in, section 4).

## 2. What we lose

- **The `command` event from the library's own Trigger.** Nothing: the Trigger cancels its
  click in library mode, so no command ever ran, and in JS-free mode nobody listened to it. The
  Popup's `onCommand` stays for **foreign** `commandfor` invokers (a consumer's `<button
  commandfor command="hide-popover">`), where it records `reason: "activate"`; the jsdom tests
  that drive it through `dispatchCommand` keep passing.
- **A foreign `popovertarget` invoker's close reads as `"dismiss"` today and after.** Optional
  improvement, not required by E: `ToggleEvent.source` is the invoker button for a
  `popovertarget` activation and `null` for Escape, light dismiss and script
  (measured, open and close, Chromium and Firefox; BCD: Chrome 140, Firefox 145, Safari 26.5,
  within the "latest stable" policy), so `onBeforeToggle` could record `"activate"` when
  `newState === "closed"` and `source` is an `HTMLButtonElement`. Worth a one-line follow-up
  issue; it also removes the last reason a foreign invoker would prefer `commandfor`.
- **Custom commands.** The Trigger never had one and `command` is an owned key, so no consumer
  could pass `--custom`; nothing lost. A consumer who wants a Trigger button to also carry a
  custom command cannot, before or after (a second activation behaviour on the same button is a
  conflict; keep `commandfor` / `command` omitted from the Trigger props types as reserved keys).
- **`command` for Dialog.** Untouched (table above).
- **`interestfor` interplay.** No Trigger renders `interestfor` today (Tooltip's own Trigger is
  a different part), so there is no interplay to lose. HTML allows `popovertarget` and
  `interestfor` on one button (hover shows, click toggles), exactly as it allows `commandfor`
  and `interestfor`; a future "popover with hover preview" is equally possible either way.
- **Modernity.** `popovertarget` (Chrome 114, Firefox 125, Safari 17) is older than `commandfor`
  (Chrome 135, Firefox 144, Safari 26.2), but the Trigger's job, toggle a popover, is the exact
  thing `popovertarget` exists for; Invoker Commands stay on `Popover.Close`, the Dialog parts and
  the `Button` example. Say so in the design; it is not a loss against the vision.
- **A jsdom-observable state.** The DOM attribute was the one thing jsdom could assert about the
  Trigger's exposed state. After E the attribute assertions become `not.toHaveAttribute
  ("aria-expanded")` plus `toHaveAttribute("popovertarget", id)`, and the Chromium CDP row
  (`src/__tests__/ax-tree.ts`) is the only state assertion in CI. Firefox and WebKit cannot be
  asserted in CI (Firefox's tree needs Marionette's chrome context, which the vitest browser
  runner does not have; WebKit has no inspection path). Acceptable because all three engines
  implement one HTML-AAM mapping with no attribute to drift from it; the Firefox Marionette
  harness in `memo/architect/probes/121-popovertarget/ax-firefox.mjs` is the manual check.

## 3. Light dismiss, implicit anchor, nested stacking, per engine

Plain DOM, real `mouse.down` / `mouse.up`, popover shown by script with the button's click
cancelled (the library-mode shape). `probe.mjs`, full output in `output.txt`.

| Row | Chromium 156 | Firefox 157 | WebKit (`main`, source) |
| --- | --- | --- | --- |
| Press on `commandfor` + `toggle-popover` button, popup shown by script, click cancelled | open at `pointerup` + 20 ms and after | same | `handlePopoverLightDismiss`: `button->commandForElement()` is checked first (`Document.cpp` 11742) |
| Press on `popovertarget` button, same | open throughout | same | `button->popoverTargetElement()` next (11744); an `<input type=button popovertarget>` too (11747) |
| Press on `popovertarget` + `popovertargetaction="show"` | open throughout | same | same path (the action is not consulted) |
| Press on a plain button | hidden at `pointerup` | same | hidden |
| Press on a **disabled** `popovertarget` button | hidden at `pointerup` | same | `popoverTargetElement()` returns null when `isDisabledFormControl()` (`HTMLFormControlElement.cpp` 342) |
| Popup shown with another element as `source` (the Combobox: `source: input`), press on the `popovertarget` button | open | open | the exemption reads the button's target, never the popover's `source` (#123 unchanged) |
| Cancelled click (mouse, Enter, Space) on a closed popup's `popovertarget` button | nothing opens, no `beforetoggle` | same | activation behaviour runs only for an uncancelled click, as for `command` |
| Native click on `popovertarget` (JS-free) | opens; popup `top` equals button `bottom` with `position-area: bottom` (implicit anchor); second click closes | same | "show popover" sets the implicit anchor from the invoker for both attributes |
| Script `showPopover()` with no source | centred (no anchor) | same | unchanged |
| Nested: outer shown by script, inner opened natively by a `popovertarget` button inside it, inner a **sibling** of the outer in the DOM | outer stays open, inner opens; Escape closes the inner only | same | `Element::topmostPopoverAncestor` checks the composed-tree parent and `popoverData()->invoker()` (`Element.cpp` 6804 to 6807); the invoker is set from the activating button for both attributes |
| Nested, inner a **descendant** of the outer | same | same | the parent branch |
| Nested, inner shown by script with `source: innerButton` (library mode) | both open | same | `source` sets the invoker; attribute-independent |
| Press on the outer's `popovertarget` invoker with a two-deep stack open, click cancelled | inner hidden, outer stays | same | the outer is the "topmost clicked popover", everything above it hides |
| `ToggleEvent.source` on `beforetoggle` | the button for a `popovertarget` open and close; `null` for Escape, outside click, script | same | shipped in Safari 26.5 (BCD) |
| `command` event | fired for `commandfor` only | same | by definition |

So the #112 exemption, the Menu's implicit anchor and pre-hydration open, and the nesting rules
of popover.md 2.6 and menu.md hold unchanged. Chromium and Firefox also exempt a `commandfor`
with a non-popover command (combobox.md notes it); with `popovertarget` the question does not
arise. The browser rows to re-run on the switch are the existing ones (combobox.browser "Trigger
close" and "Pre-hydration typing", menu.browser positioning and submenu rows, popover.browser
"Click on the Trigger" and nested rows), with the attribute names swapped; the WebKit CI job
covers the engine not probed locally, as #112 did.

## 4. Accessibility outcome per engine

From the research (measured, Chromium and Firefox; WebKit source) plus the `ax-*` probes.

| Shape | Chromium | Firefox | WebKit (source) |
| --- | --- | --- | --- |
| `popovertarget`, no attribute, popup open / closed | expanded / collapsed | expanded / collapsed | expanded / collapsed (`supportsExpanded()` / `isExpanded()` consult `popoverTargetElement()`) |
| same with `popovertargetaction="show"` or `"hide"` (button outside the popover) | same | same | same |
| `role="menuitem"` + `popovertarget` (SubmenuTrigger) | `menuitem expanded=…` | `menuitem [expanded,expandable]` | not measured; the role check (`supportsExpanded`) accepts menuitem |
| disabled `popovertarget` button | no state | no state | `popoverTargetElement()` null when disabled |
| target missing or not a popover | no state | no state | no state (HTML-AAM: no mapping) |
| hide button **inside its own popover**, `commandfor` or `popovertarget` | no state (HTML-AAM exclusion) | **no state** (new finding: Gecko excludes too) | expanded while shown (research report 2, not measured) |
| `popovertarget` + explicit `aria-expanded="false"`, popup open | expanded (attribute ignored) | expanded (OR) | expanded |
| `popovertarget` + explicit `aria-expanded="true"`, popup closed | collapsed | **expanded** (OR) | collapsed |

The Firefox OR: with no attribute rendered, the OR has nothing to OR in, so the three engines
agree in every phase, including the one phase #118 left open (the `toggle` task between the
platform's hide and the Root's `shown` mirror; there is no mirror to lag). The residual Firefox
difference is therefore zero for the library's own markup. The OR only matters if an author adds
`aria-expanded="true"` to a `popovertarget` button; keeping the key omitted from the props types
is the whole mitigation, and after #514 that markup is non-conforming anyway.

Phase table after E, every engine, invoker Triggers:

| Phase | exposed |
| --- | --- |
| closed; pending open (popup hidden) | collapsed |
| open; pending part-initiated close (popup shown) | expanded |
| browser-owned dismissal, notification pending (popup hidden) | collapsed, at the hide itself (not a task later) |
| `defaultOpen` before hydration | collapsed (not shown) |
| pre-hydration open found at mount | expanded, from the moment the browser showed it |
| disabled Trigger while its popup is shown | **no state** (today: `aria-expanded="true"` read by every engine, because a disabled button is no invoker). Transient and rare; accept, or render the attribute on a native-disabled Trigger too, which #514 forbids literally. Recommend accept. |

Non-button Trigger renders keep an explicit attribute (section 1) and are read in every engine
as today. `Combobox.Input` is unchanged. The screen-reader pass (NVDA + Firefox, NVDA or JAWS +
Chrome, VoiceOver + Safari) is due either way; after E it checks one mapping instead of an
attribute plus a mapping.

Conformance: today's markup is flagged by the Nu checker (validator #1855) and will be by
axe-core (#4837, open, last activity 2026-06-18) and IBM Equal Access (#2334). #514 itself is
open, `mergeable_state: dirty`, last updated 2025-12-01, "Meets 2 implementations req": it is
not moving, and it does not need to for the engines to behave as it says.

## 5. JS-free mode and #19

What E removes: the one "JS-free" DOM write the Popover has (conventions 7.4, the `aria-expanded`
row; popover.md 2.1 "what still runs JS in this mode"). After E the JS-free Trigger is a static
`<button popoverTarget>` whose exposed state the browser owns, before and without hydration. That
closes the accessibility blocker conventions 7.3 names for a directive-free Popover: before
hydration today a JS-free Trigger carries `aria-expanded="false"` while a pre-hydration click may
have shown the popup (Firefox reads the attribute; Chromium and WebKit ignore it), and after E
every engine is right at every moment.

What E does not change about #19: #19 is **resolved** (user decision 2026-10-23, option A of
`docs/research/zero-js-variants.md`): no second, directive-free anatomy. The Popover's parts stay
client modules (they need context for ids and the mode), and the remaining JS-free hydration work
stays: the `toggle` listener still restores focus for nested popovers (6.2) and applies
`initialFocus`, and `Close` with an `action` still runs it. So E does not make the Popover
"zero JS"; it makes the JS-free mode's markup correct and conformant with no DOM-written ARIA, and
it is the prerequisite if a `@funstack/ui/popover/native` ever joins the recorded Accordion plan.
Conventions 7.3's Popover bullet changes from "not viable until the gap closes" to "viable in
principle; not scheduled (same reasons as Accordion's option B)".

The styling hook. popover.md 10 shows `.btn[aria-expanded="true"]` as the "both modes" hook; in
JS-free mode there is no `data-open` (no React state) and after E no `aria-expanded`. Options:

- (i) Keep the one DOM write but write **`data-open`** from the Popup's `toggle` listener (and
  the Trigger's ref for a late-mounting Trigger), exactly the mechanism that writes
  `aria-expanded` today. `[data-open]` then works in both modes (optimistic in library mode,
  the shown state in JS-free mode, where the two coincide because there is no pending phase).
  The 7.4 row survives as "styling state for a browser-owned open, written from `toggle`".
  Costs: a DOM write stays in JS-free mode (it is already there), and `data-open` is absent
  until hydration (as the `aria-expanded` sync is today).
- (ii) Write nothing; document `button:has(+ [popover]:popover-open)` for an adjacent Popup
  and the `anchor-name` / `:popover-open` combination otherwise. Works with zero JS, including
  on a page that never hydrates. Costs: no hook when the Popup is not the Trigger's next
  sibling; a Server Component author must know the recipe.

Recommendation: (i), plus the (ii) recipe on the docs page for no-hydration pages. (i) keeps
the published CSS contract "`[data-open]` on the Trigger" true in both modes, which is simpler
to document than "library mode `data-open`, JS-free `:has()`". Escalate (section 8).

## 6. Breaking changes for consumers, and migration size

Consumer-visible:

- **`aria-expanded` disappears from `Popover.Trigger`, `Menu.Trigger`, `Menu.SubmenuTrigger`
  and `Combobox.Trigger`** (DOM attribute; the props key stays omitted). CSS selectors on
  `[aria-expanded="true"]` (our own popover.md 10 and the Popover page show one) and consumer
  tests asserting the attribute break. Migration: `[data-open]` (library mode today; both modes
  with option (i) above). Assistive technology hears the same or better.
- **`commandfor` / `command` are replaced by `popovertarget` on those Triggers** (DOM). CSS on
  `[commandfor]` is unlikely; a consumer who reads `trigger.commandForElement` gets null and
  should read `popoverTargetElement`. The keys stay owned / omitted, so no props change.
- No public prop, state field or type changes. `PopoverTriggerProps`' `Omit` list is unchanged
  (`aria-expanded` stays omitted). Combobox's `Omit` keeps `commandfor` / `command` (reserved) and
  gains `popoverTarget` / `popoverTargetAction`.
- Release note: a BREAKING line under 0.1.0-alpha.N, with the two selector migrations.

Migration size (counts from `grep`, 2026-10-24):

| Area | Files | What |
| --- | --- | --- |
| Source | `internal/use-popover-trigger.ts` (attribute + conditional `aria-expanded`), `combobox/combobox-trigger.tsx` (ref write, props `Omit`), `internal/use-popover-popup.ts` (JS-free write: `data-open` or removal), `internal/platform-attributes.ts` (comment only; `commandfor` / `command` stay for Close, Dialog, Button), doc comments in `popover-trigger.tsx`, `menu-trigger.tsx`, `menu-submenu-trigger.tsx`, `popover-close.tsx` | about 6 files, small diffs |
| Test shims | `__tests__/invoker-shim.ts` gains a `popovertarget` / `popovertargetaction` branch (activation behaviour, no `command` event, disabled and submit-button exclusions); `popover-shim.ts` comment | 2 files |
| jsdom tests | `overlay-open-state-suite.tsx` (22 `aria-expanded` / `expectExpanded` sites), `popover.test.tsx` (26 + 16 `commandfor`), `menu.test.tsx` (10 + 7), `menu-context-trigger.test.tsx` (2 + 2), `combobox.test.tsx` (22 + 15; the Input's rows stay), `overlay-disabled-render-suite.tsx` (8), `use-popover-hooks.test.tsx` (1) | about 7 files, roughly 130 assertion sites, mostly mechanical (`expectExpanded(x)` becomes "no attribute" on invokers and keeps its value on the Input and non-button rows) |
| Browser tests | `popover.browser.test.tsx` (24 + 9), `combobox.browser.test.tsx` (10 + 7), `menu.browser.test.tsx` (6), `overlay-browser-suite.tsx` (5) | 4 files; the Chromium AX rows grow into the only state assertions (each phase of the table in section 4, on Popover, Menu, SubmenuTrigger and Combobox Trigger; the existing `getAXNodes` helper suffices) |
| Design docs | conventions 3.2 (urgent row, bounded rule), 3.5 (optimistic-source cell, the 3.5 trap paragraph's attribute names), 7.3 (Popover bullet, the Menu paragraph), 7.4 (three rows), decision 7 text, decision 40 superseded by a new numbered decision; popover.md (about 25 places: decisions 7 and 12, anatomy, 2.1, 2.2, 2.7, 3.2, 3.4, 4, 9, 10, 11, 13.2, 13.3, 14.2, 14.3, the #118 amendment gets a pointer); menu.md (about 12); combobox.md (about 15: 3.3, the #112 amendment's "why `commandfor`" paragraph, test rows) | one architect amendment pass |
| Docs site | `PopoverPage.tsx` (7), `MenuPage.tsx` (4), `ComboboxPage.tsx` (2), `BrowserOwnedStatePage.tsx` (1), the pending-and-optimistic concept page, the CSS example | 5 pages; Dialog and Button pages unchanged |

## 7. Recommendation

**Adopt, scheduled before 0.1.0, as one wave item with the design amendment first.** Not now
in the sense of "interrupt the current wave": the #118 M1 revision closed the Firefox window to
the `toggle` task, so there is no accessibility emergency. Not later in the sense of "wait for
#514": the PR is stale and the engines already behave as it prescribes; the trigger for the
work is the release boundary, because the attribute removal is the one consumer-visible break
and the alpha is when it is cheap. If the project prefers a condition, use "before the first
non-prerelease version", not "#514 merged".

Grounds, in order of weight:

1. Correctness in every engine with no mirror: the exposed state is the popover's own,
   everywhere, including the pre-hydration and `toggle`-task phases a React mirror cannot cover.
2. Conformance: the Nu checker stops flagging the Triggers; axe-core and Equal Access will not
   start.
3. Nothing load-bearing is lost (section 3, measured on two engines and read in the third).
4. It removes the Popover's DOM-written ARIA and the 7.4 typing row for Triggers, and reopens the
   directive-free Popover as "viable, not scheduled".
5. Cost is bounded and mostly mechanical: about three agent-days, one BREAKING release line.

Effort: architect amendment (popover.md, menu.md, combobox.md, conventions, new decision) 0.5
day; developer (source, shim, tests, docs pages) 1.5 to 2 days, most of it the assertion sweep;
reviewer 0.5 day with the three CI engine jobs green. Sequence: amendment, then implementation,
then the screen-reader pass that #118 already owes.

Rejected alternatives: keep A (today) indefinitely: conformant markup never arrives, and the
attribute's meaning keeps needing a mirror the platform does not; switch `Popover.Close` too:
no accessibility gain (section 4) and the `command` reason is lost; render both
`popovertarget` and `aria-expanded`: the exact markup #514 forbids and what Firefox ORs.

## 8. Decisions to escalate to the product owner

1. **Timing**: adopt before 0.1.0 as a scheduled wave item (recommended), or wait for #514.
2. **Non-button Trigger renders keep an explicit `aria-expanded`** (recommended: yes; conforming,
   no behaviour loss for link-shaped Triggers).
3. **JS-free styling hook**: `data-open` DOM-written from `toggle` (recommended) versus nothing
   plus a `:has()` recipe.
4. **Follow-up issue** (small, independent): classify a foreign `popovertarget` invoker's close as
   `"activate"` from `ToggleEvent.source` in `onBeforeToggle`.
5. **Disabled Trigger with its popup shown exposes no state** after E: accept as transient
   (recommended) or render the attribute on a native-disabled Trigger against #514's letter.

## Upstream (human task, unchanged from the research)

Gecko: no implicit state for `commandfor` invokers (E makes it moot for the library's Triggers,
but `Popover.Close` and Dialog still render `commandfor`; Close expects no state anyway). WebKit:
an invoker inside its own popover exposed as expanded (affects `Popover.Close` whichever
attribute; Firefox was measured here to exclude it, so WebKit is the only engine with the quirk).
