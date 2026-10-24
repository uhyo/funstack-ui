# Explicit `aria-expanded` on popover invokers (#118)

Date: 2026-10-24. Engines: Chromium 156.0.8078.4 and Firefox 157.0 (Playwright builds, measured),
WebKit `main` (source only; WebKit does not launch on this machine).

## Summary

The question: when a `<button>` invokes a popover (`commandfor` + a popover `command`, or
`popovertarget`), does an explicit `aria-expanded` win over the state the browser derives from the
popover? The answer differs by engine and by attribute:

- **Chromium and WebKit: the platform state always wins**, for both `commandfor` and
  `popovertarget`. The explicit attribute is never read on these buttons.
- **Firefox: `commandfor` has no implicit mapping at all**, so the explicit attribute is all that
  is exposed. For `popovertarget` the two are OR-ed: the button is expanded if the popover is open
  *or* `aria-expanded="true"`.
- **Spec direction:** HTML-AAM maps both invoker kinds to an implicit `aria-expanded`. ARIA in HTML
  PR #514 (open, labelled "Meets 2 implementations req") says authors MUST NOT put `aria-expanded`
  on those buttons. Under Core-AAM 3.2, once the host language declares that conflict, user agents
  must ignore the ARIA attribute. That is what Chromium and WebKit already do. The Nu HTML
  checker already reports it (validator/validator#1855, closed 2025-11-29). axe-core (#4837) and
  IBM Equal Access (#2334) have open issues for the rule.

For FUNSTACK UI, the Trigger's optimistic `aria-expanded` reaches assistive technology only in
Firefox. In Chromium and WebKit, AT hears whether the popup is actually shown. During a pending
async close it hears "expanded", and during a pending open "collapsed". So the three engines
disagree today, and the attribute will be non-conforming once PR #514 lands.

**Verdict:** the design claim that the explicit attribute wins is wrong. Change the design (see
Options; recommendation: **option A now, option E as the follow-up**). Not an adopt/flag question.

## Measured behaviour

Plain buttons, popovers `popover="manual"` placed after a filler paragraph (not adjacent). Full
output: `memo/platform-researcher/probes/20-invoker-aria-expanded/`.

| Button | Popover | Chromium 156 | Firefox 157 | WebKit (source) |
| --- | --- | --- | --- | --- |
| `commandfor` + `toggle-popover`, `aria-expanded="false"` | open | expanded | **collapsed** | expanded |
| `popovertarget`, `aria-expanded="false"` | open | expanded | expanded | expanded |
| `commandfor` + `toggle-popover`, `aria-expanded="true"` | closed | collapsed | **expanded** | collapsed |
| `popovertarget`, `aria-expanded="true"` | closed | collapsed | **expanded** | collapsed |
| `commandfor` + `toggle-popover`, no attribute | open / closed | expanded / collapsed | **no state** | expanded / collapsed |
| `popovertarget`, no attribute | open / closed | expanded / collapsed | expanded / collapsed | expanded / collapsed |
| `commandfor` + `show-popover`, `aria-expanded="false"` | open | expanded | collapsed | expanded |
| `commandfor` + `command="--custom"`, `aria-expanded="false"` | open | collapsed (attribute) | collapsed | collapsed (attribute) |

The library's Triggers, built from `packages/ui/src` at `c69c312`. All three render `commandfor` +
`command="toggle-popover"`; the Combobox Trigger gets them after mount, simulating #112. The
action hangs in one direction to hold the pending state.

| Trigger phase | DOM `aria-expanded` | popup shown | Chromium 156 | Firefox 157 | WebKit (source) |
| --- | --- | --- | --- | --- | --- |
| closed | `false` | no | collapsed | collapsed | collapsed |
| pending open | `true` | no | **collapsed** | expanded | **collapsed** |
| open | `true` | yes | expanded | expanded | expanded |
| pending close | `false` | yes | **expanded** | collapsed | **expanded** |

The results are the same for `Popover.Trigger` (library mode), `Menu.Trigger` and the simulated
`Combobox.Trigger`. The JS-free `Popover.Trigger` (DOM-synced attribute) and today's
`Combobox.Trigger` (no `commandfor`) agree in every engine, because the attribute equals the
popup state.

## Engine sources (main, 2026-10-24)

- **Chromium** `third_party/blink/renderer/modules/accessibility/ax_node_object.cc`,
  `AXNodeObject::IsExpanded()`. The checks run in this order: `commandForElement()` with a valid
  built-in popover command, then `popoverTargetElement()`, then `<summary>`; only after those is
  `aria-expanded` read. Each invoker branch returns early with `popoverOpen()`. A button inside its
  own popover is excluded, per HTML-AAM.
- **WebKit** `Source/WebCore/accessibility/AccessibilityObject.cpp`, `supportsExpanded()` /
  `isExpanded()`. `commandForElement()` with Show/Hide/Toggle popover, otherwise
  `popoverTargetElement()`, returns `isPopoverShowing()` before `aria-expanded` is read.
  `popovertarget` support landed 2023-06-03 (c28221ccaa) and `commandfor` support 2025-03-13
  (362e1d2e9a, "Implement AXExpanded handling for command buttons"). **No exclusion for an invoker
  inside its own popover**, unlike HTML-AAM and Chromium. A `Popover.Close`
  (`commandfor` + `hide-popover`, inside the popup) is therefore exposed as "expanded" in WebKit
  while the popup is open. Not measured.
- **Gecko** `accessible/html/HTMLFormControlAccessible.cpp`, `HTMLButtonAccessible::NativeState()`,
  adds `EXPANDABLE`/`EXPANDED` from `GetEffectivePopoverTargetElement()` only. That function
  (`dom/base/nsINode.cpp`) reads `popovertarget`, not `commandfor`; `commandfor` is only used for
  the `details` relation (`LocalAccessible::GetCommandForDetailsRelation`). `ExplicitState()` then
  calls `ApplyARIAState()`, and `MapTokenType` (`accessible/base/ARIAStateMap.cpp`) only ORs bits
  in, so ARIA cannot clear a native `EXPANDED`. Bug 1867811 (2023-12) added the `popovertarget`
  mapping. No Bugzilla bug covers `commandfor`.

## Spec status

- **HTML-AAM** 3.6.25 (`command` in the Toggle/Show/Hide popover states) and 3.6.109
  (`popovertarget`): `aria-expanded=true` when the popover is shown and `false` when it is hidden.
  It is undefined when the popover is an ancestor of the button or not in the DOM, and there is no
  mapping when the target is not a valid popover. HTML-AAM does not say how this combines with an
  author's `aria-expanded`.
- **Core-AAM** 3.2: user agents use the WAI-ARIA semantics, except that "when a host language
  declares a WAI-ARIA attribute to be in direct semantic conflict with a native attribute ... user
  agents MUST ignore the WAI-ARIA attribute". HTML has not declared this conflict yet.
- **ARIA in HTML** PR w3c/html-aria#514 (opened 2024-04-15, last updated 2025-12-01, review
  required). It adds "Authors MUST NOT use the `aria-expanded` attribute on an element which also
  has a `popovertarget` attribute", and the same for `command` in the Toggle/Show/Hide popover
  states. Test page: https://w3c.github.io/html-aria/tests/popover-and-command.html. Scott O'Hara,
  in #513: "popovertarget on a button should not have an aria-expanded declared with it."
  Once this merges, Chromium and WebKit are conformant and Gecko's OR for `popovertarget` is not.

## Implications for FUNSTACK UI

1. The claim "the Trigger's explicit `aria-expanded` wins / overrides Chromium's implicit state"
   is false in Chromium and WebKit. It appears in `design/components/combobox.md` (around line
   1829), `menu.md:807`, `popover.md:964` and `conventions.md:1334`.
2. `conventions.md:1788` says "only Chromium maps the invoker's expanded state natively". For
   `commandfor` it is Chromium and WebKit. For `popovertarget` all three engines map it. That
   bears on #19, the zero-JS Popover (option E below).
3. The optimistic `aria-expanded` exists to report intent while an action is pending. Chromium and
   WebKit already expose the shown state instead. That is defensible: APG's `aria-expanded` means
   "the controlled element is displayed", and the user can still reach the shown popup. The real
   defect is that the three engines disagree.
4. In Chromium and WebKit, `Combobox.Trigger` gets the implicit mapping once #112 adds
   `commandfor`. The input (`role=combobox`, no invoker) keeps its explicit, optimistic
   `aria-expanded` in all engines. So during a pending close, the input says "collapsed" while the
   Trigger says "expanded". The input is the primary control, so this matters little.

## Options

- **A. Render the shown state, not the optimistic one, in `aria-expanded` on invoker Triggers.**
  Use the committed open state, which is what is shown in library mode, and keep `data-open` and
  the render-prop `open` optimistic. All three engines then agree: Firefox reads the attribute,
  and Chromium and WebKit compute the same value. Small change, mostly in `usePopoverTrigger` and
  `ComboboxTrigger`. Cost: the markup stays non-conforming under PR #514, and the Nu checker flags
  it now. After a browser-owned dismissal (Escape, light dismiss), Firefox may read a stale
  `"true"` until the notification commits; the other engines are always right. Corrects the
  conventions rule "`aria-expanded` optimistic" for invoker Triggers.
- **B. Drop the invoker relationship in library mode** (no `commandfor`). The explicit attribute
  then wins everywhere. **Not recommended:** #112 depends on the invoker for the light-dismiss
  exemption, and Menu (conventions, #39) depends on it for the implicit anchor and pre-hydration
  open.
- **C. Keep the current behaviour and document the split** (Firefox optimistic, the others shown
  state). Inconsistent, and non-conforming once PR #514 lands. Not recommended.
- **E. Switch Triggers to `popovertarget` and render no `aria-expanded`.** All three engines then
  expose the shown state natively, and the markup conforms to PR #514. As a bonus, this removes
  the blocker conventions 1788 names for a directive-free Popover (#19): a static Trigger needs no
  attribute kept current. Costs, all design-level: conventions 7.4 types `commandfor`;
  `popovertarget` fires no `command` event, so `use-popover-popup.ts` `onCommand` (a foreign
  invoker's close, reason `"activate"`) no longer sees it; #112's light-dismiss exemption and the
  implicit anchor must be re-verified with `popovertarget` (HTML and WebKit's
  `handlePopoverLightDismiss` treat both the same, per combobox.md). Gecko's OR does not matter
  when no attribute is rendered. `Popover.Close` can keep `commandfor` + `hide-popover`.

**Recommendation:** A now, because it is contained and makes the engines agree. Then evaluate E
as a cross-component change for the architect, since it is the spec-aligned end state and helps
#19. Neither changes a public prop. A changes what `aria-expanded` means on the Trigger
(the "optimistic" line in conventions 1334), and E changes owned attributes (`popovertarget`
instead of `commandfor`/`command`) on every overlay Trigger. Screen-reader passes (NVDA+Firefox,
NVDA/JAWS+Chrome, VoiceOver+Safari) should confirm the announcement after either change.

## Upstream reports (human task)

- **Gecko (Bugzilla, Core :: Disability Access APIs):** a `<button commandfor command="toggle-popover|show-popover|hide-popover">`
  exposes no expanded/collapsed state (HTML-AAM 3.6.25). `HTMLButtonAccessible::NativeState()`
  only consults `GetEffectivePopoverTargetElement()`. Secondary: for `popovertarget`, an author's
  `aria-expanded="true"` on a closed popover's invoker is exposed as expanded (the ARIA bits are
  OR-ed). Chromium and WebKit ignore the attribute, as ARIA in HTML #514 requires.
- **WebKit (bugs.webkit.org, Accessibility):** an invoker inside its own popover (for example
  `<div popover><button commandfor=self command=hide-popover>`) is exposed with AXExpanded=YES.
  HTML-AAM 3.6.25/3.6.109 says `aria-expanded=undefined` when the popover is an accessibility
  ancestor, and Chromium implements that exclusion. Source:
  `AccessibilityObject::supportsExpanded()`/`isExpanded()`, which have no ancestor check. A
  measurement in Safari would confirm it before filing.

## References

- HTML-AAM: https://w3c.github.io/html-aam/ (3.6.25 `command`, 3.6.109 `popovertarget`)
- Core-AAM 3.2: https://w3c.github.io/core-aam/#mapping_conflicts
- ARIA in HTML PR: https://github.com/w3c/html-aria/pull/514, issue https://github.com/w3c/html-aria/issues/513
- Checkers: https://github.com/validator/validator/issues/1855, https://github.com/dequelabs/axe-core/issues/4837, https://github.com/IBMa/equal-access/issues/2334
- Chromium: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/accessibility/ax_node_object.cc
- WebKit: https://github.com/WebKit/WebKit/blob/main/Source/WebCore/accessibility/AccessibilityObject.cpp (commits c28221ccaa, 362e1d2e9a)
- Gecko: https://github.com/mozilla-firefox/firefox/blob/main/accessible/html/HTMLFormControlAccessible.cpp, `accessible/base/ARIAStateMap.cpp`, `dom/base/nsINode.cpp`; https://bugzilla.mozilla.org/show_bug.cgi?id=1867811
- Probe: `memo/platform-researcher/probes/20-invoker-aria-expanded/`
