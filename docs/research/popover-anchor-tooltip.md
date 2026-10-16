# Tooltip with the Popover API + CSS Anchor Positioning (zero-JS feasibility)

Research date: **2026-10-15**. Support data verified against caniuse, MDN, vendor release notes and
bug trackers on that date. Stable engines on that date:

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 155 | 2026-10-06 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 (Apple release notes; third parties report 09-17) |

Related issue: GitHub #2.

## Summary

A fully declarative, zero-JavaScript tooltip (`<button interestfor>` + `<div popover="hint">` +
implicit anchor positioning) **works today only in Chromium**. Two pieces are missing elsewhere:

- `interestfor` (the hover/focus trigger) is Chromium-only. Firefox has an unconfirmed
  implementation bug and a "neutral" standards position; WebKit withdrew its "oppose" position in
  June 2026 and is re-evaluating, but has not started implementing. It is not in Interop 2026.
- `popover="hint"` is in Chrome and Firefox stable but not in Safari 27.0. WebKit landed it on
  2026-07-17 and it is in Safari Technology Preview 249; it is an Interop 2026 focus item, so a
  Safari 27.x release in the coming months is likely. Safari treats the unknown value as
  `popover="manual"` (no light dismiss, no Escape).

Everything else needed by a tooltip is Baseline across all three engines: the Popover API itself,
`:popover-open`, `@starting-style`, `transition-behavior: allow-discrete`, CSS Anchor Positioning
(including `position-area`, `position-try-fallbacks`, `anchor-size()`), the implicit anchor created
by `popovertarget` / `commandfor` / `showPopover({ source })`, and Invoker Commands.

### Verdicts

| Feature | Verdict | Reason |
| --- | --- | --- |
| Popover API (`popover="auto" \| "manual"`, `popovertarget`, light dismiss, top layer, `:popover-open`) | **Adopt** | Baseline widely available (Chrome 114, Firefox 125, Safari 17). |
| `@starting-style` + `transition-behavior: allow-discrete` for open/close animation | **Adopt** (open); close is progressive enhancement, see correction below | Chrome 117, Firefox 129, Safari 17.4/17.5. Firefox does not run exit animations (corrected 2026-10-16). |
| CSS Anchor Positioning (`anchor-name`, `position-anchor`, `anchor()`, `position-area`, `position-try-fallbacks`, `position-try-order`, `anchor-size()`) | **Adopt** | Chrome 125+, Firefox 147/148, Safari 26.0 (27.0 complete). See caveats for the remaining gaps. |
| Implicit anchor from `popovertarget` / `commandfor` / `showPopover({ source })` | **Adopt** | Spec'd in HTML (`implicit anchor element`); `source` option in Chrome 137, Firefox 144, Safari 26.0. |
| Invoker Commands (`commandfor` / `command`) | **Adopt** (not as a tooltip trigger) | Chrome 135, Firefox 144, Safari 26.2. Click-driven, so useful for "click to pin" but not for hover tooltips. |
| `popover="hint"` | **Adopt behind experimental flag** | Chrome 151, Firefox 153 (revised spec); Safari: STP 249 only. Expected in Safari 27.x (Interop 2026). |
| `interestfor` (Interest Invokers), `interest-delay`, `:interest-source` / `:interest-target` | **Adopt behind experimental flag** | Chrome 142 only. No Gecko or WebKit implementation; WebKit position unresolved. |
| `::interest-button` (touch affordance for `interestfor`) | **Not yet** | Not shipped anywhere; still under CSSWG discussion. |

**Recommendation for the Tooltip component.** Ship a client-side React component that uses the
platform for everything that is Baseline (popover, top layer, anchor positioning, animation), and
uses a small amount of JS only for the trigger (hover/focus with delays, `showPopover({ source })`,
Escape on non-`hint` engines). Offer a zero-JS "Server Component" mode behind an experimental flag
that renders `interestfor` + `popover="hint"` and nothing else. When Safari ships `hint` the flag
for `hint` can be dropped; `interestfor` stays flagged until Gecko and WebKit implement it.

## Support table per engine

Versions are the first stable release with full support. "Stable today" is the engine's current
stable release listed at the top.

| Feature | Chrome | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| `popover` attribute / API | 114 | 125 | 17.0 (iOS 18.3 full) | Baseline widely available 2025-04. |
| `popover="hint"` (revised spec) | 151 | 153 | — (STP 249; not in 27.0) | Chrome 133–150 and Firefox 149–152 had the old `hint` semantics (caniuse: partial). Unknown value falls back to `manual`. |
| `popovertarget` implicit anchor | yes | yes | yes | Spec: show steps set the popover's implicit anchor element to the invoker. |
| `showPopover({ source })` | 137 | 144 | 26.0 | Creates the same implicit anchor and nesting from JS. |
| `commandfor` / `command` | 135 | 144 | 26.2 | Baseline newly available 2025-12-12. Creates implicit anchor. |
| `interestfor` | 142 (Android 154) | — | — | Firefox bug 1984699 UNCONFIRMED; WebKit position re-evaluating (no "oppose" label since 2026-06-02). Not in Interop 2026. |
| `interest-delay`, `interest-delay-start/end` | 142 | — | — | Chromium defaults: 0.25s start, 0.15s end. |
| `:interest-source`, `:interest-target` | 142 | — | — | |
| `::interest-button` | — | — | — | CSSWG issue 12437; excluded from the Chrome ship. |
| `anchor-name`, `position-anchor`, `anchor()` | 125 | 147 | 26.0 | |
| `position-area` | 129 (125–128 partial, old `inset-area` name) | 147 | 26.0 | |
| `position-try-fallbacks` | 128 (125–127 partial) | 147 | 26.0 | |
| `position-try-order` | 125 | 148 | 26.0 | |
| `anchor-size()` | 125 | 147 | 26.0 | |
| `anchor-scope` | 131 | 147 | 26.0 | |
| `position-visibility` | 125 | 147 | 26.2 | New keyword names `anchor-valid` / `anchor-visible`: Safari 27 only (Chrome and Firefox still use `anchors-valid` / `anchors-visible`). |
| Transform-aware anchor positioning | 144 | — | 27.0 | Anchors inside `transform` / zoom boxes are positioned correctly. |
| `@starting-style` | 117 | 129 | 17.5 | |
| `transition-behavior: allow-discrete` | 117 | 129 | 17.4 | |

## How the zero-JS tooltip would look

```html
<button type="button" interestfor="tip-1" aria-describedby="tip-1">Save</button>
<div id="tip-1" popover="hint" role="tooltip">Saves the document (Ctrl+S)</div>
```

```css
[popover="hint"] {
  position: fixed;                 /* positioned relative to the implicit anchor */
  position-area: block-end;
  position-try-fallbacks: flip-block, flip-inline;
  margin: 4px;

  /* enter/exit animation */
  opacity: 0;
  transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
  &:popover-open { opacity: 1; @starting-style { opacity: 0; } }
}
```

**Correction (2026-10-16): the exit half of this animation is progressive enhancement.** Verified
by screenshot probes on Chromium 156 and Firefox 157
(`memo/platform-researcher/probes/04-dialog/entry-anim.mjs`, `exit-anim.mjs`):

- **Firefox hides the popover instantly** on close. Gecko cannot transition or animate `display`
  (BCD marks `transition-behavior` partial; meta bug 1834877 is NEW and the pref is not enabled
  even on Nightly). The fade-in via `@starting-style` works.
- **Chromium needs `overlay … allow-discrete`** in the transition list, as in the snippet above.
  Without it the popover leaves the top layer as soon as it closes and fades out underneath
  z-indexed page content. Keep `overlay` in every documented snippet.
- WebKit animates the exit (Safari 27.0 fixed a closing-animation bug for popovers and dialogs).

Consequence for Tooltip: the documented exit fade is cosmetic and must not be load-bearing.
Nothing in the component may wait for an exit animation (`transitionend`, `getAnimations()`) in
a way that breaks when Firefox ends it immediately, and tests must not assert an exit animation
on Gecko. Details in [dialog.md](./dialog.md), "Animation".

What the platform does for free in Chromium: hover and focus show the popover after a delay, moving
the pointer into the tooltip keeps it open, blur / de-hover hides it after a delay, Escape closes it
and cancels interest, long-press on Android shows it, the tooltip does not close an open
`popover="auto"` menu, and the tooltip is anchored to the trigger without any `anchor-name`.

## Caveats

### `interestfor`

- **Chromium-only.** Firefox: bug 1984699 is UNCONFIRMED with no target milestone; Mozilla's
  standards position is "neutral". WebKit: issue 464 was closed as "oppose" in October 2025, then
  reopened on 2026-06-02 with the oppose label removed ("worthy of a fresh evaluation") after the TAG
  resolved "satisfied with concerns" and `::interest-button` was proposed. No WebKit implementation
  bug has activity. Interop 2026 does not include it. A 2026-09 Interop proposal (#1358) exists for a
  future cycle.
- **Allowed invokers:** `<button>` (not disabled), `<a href>`, `<area href>`, SVG `<a href>`.
  A `<div>` or `<span>` cannot be an interest invoker. For the Tooltip API this means the trigger
  must be (or wrap) a button or link; "tooltip on arbitrary element" needs JS.
- **Touch:** Chromium on Android uses long-press (buttons show interest directly, links via a
  "Show details" context-menu item). The UA stylesheet sets `user-select: none` on buttons with
  `interestfor`. iOS has nothing. `::interest-button` (an explicit tap target) is not shipped.
- **Delays:** `interest-delay-start` / `interest-delay-end` (shorthand `interest-delay`); `normal`
  is 0.25s / 0.15s in Chromium. An infinite value disables that trigger. Delays are read from the
  invoker's computed style, and the UA may scale them for accessibility.
- **Unsupported engines ignore the attribute silently.** The tooltip simply never opens. There is
  no error, so an "experimental flag" implementation must not rely on it being the only trigger
  unless the flag is opt-in.
- Feature detection: `Object.hasOwn(HTMLButtonElement.prototype, "interestForElement")`.

### `popover="hint"`

- Firefox 153 and Chrome 151 implement the revised spec (separate auto and hint stacks). In the
  revised model, opening a hint never closes `auto` popovers, opening a hint closes other
  non-ancestor hints, outside click closes both kinds, and an `auto` popover cannot open inside a
  hint. Chrome 133–150 and Firefox 149–152 had the earlier semantics; both are below stable now.
- Safari 27.0 does not recognise `hint`, so the attribute value is treated as `manual`: no light
  dismiss and no Escape close. A JS fallback must handle Escape itself on WebKit until `hint`
  ships there. WebKit commit 317402@main (2026-07-17) is in Safari Technology Preview 249.
- A `hint` popover has no implicit ARIA role; `role="tooltip"` is still the author's job.

### CSS Anchor Positioning

- Core features are in all three engines. The remaining gaps are edge cases: Chrome and Firefox do
  not yet accept the renamed `position-visibility: anchor-valid | anchor-visible` keywords (the
  older `anchors-*` plural names still work in all engines); Firefox cannot animate `anchor()` /
  `anchor-size()` values and lacks transform-aware positioning (Chrome 144, Safari 27).
- Firefox 156.0 shipped a hang on some anchor-positioned pages, fixed in 156.0.1 (2026-09-22).
  The feature is still "Interop 2026" scope, so expect bug-fix churn.
- The implicit anchor is created by `popovertarget`, `commandfor`, `showPopover({ source })`, and
  (Chromium) `interestfor`. The popover must use `position: fixed` or `absolute` and be positioned
  with `position-area` or `anchor()`; the association alone does not move it.
- The `anchor` HTML attribute is non-standard and should not be used.

### Invoker Commands as a tooltip trigger

`commandfor` + `command="show-popover" | "toggle-popover"` is click-activated. It cannot replace
hover/focus triggering, but it combines with `interestfor` on the same button for "hover to preview,
click to pin" (the explainer specifies that a command-opened popover is not closed by losing
interest). It is Baseline, so a Tooltip-adjacent "Popover" primitive could use it without a flag.

## Accessibility notes

### WAI-ARIA APG tooltip pattern (still marked work-in-progress by the APG)

Requirements: container has `role="tooltip"`; trigger references it with `aria-describedby`;
shows on focus or hover after a short delay; Escape dismisses; focus stays on the trigger; closes on
blur; stays open while the pointer is over the trigger or the tooltip; the tooltip itself is never
focusable (use a non-modal dialog for interactive content).

### What `interestfor` provides automatically (Chromium, per the explainer)

- **Plain hint** (target content is only text, images, generic elements): if the invoker has no
  accessible name, the hint text becomes its name; otherwise it becomes its accessible description.
  No `aria-details`, no `aria-expanded`.
- **Rich hint** (target contains links, buttons, headings, ...): target gets a minimum role of
  `tooltip`, an `aria-details` relation is exposed while visible, the invoker gets `aria-expanded`,
  the target is placed next in focus order after the invoker. Chromium also exposes a
  `has-interest-for` state on the invoker.
- Escape, focus/blur, hover-into-tooltip, and delays follow the APG pattern.

### What still has to be done by the author

- `role="tooltip"` and `aria-describedby` on the trigger are still required for Firefox and
  Safari, and harmless in Chromium (the explicit relation wins over the UA-computed description).
  `aria-describedby` works while the popover is hidden (`display: none`), so screen readers
  announce the description on focus even if the popover never opens.
- For **icon-only triggers** the tooltip is the accessible *name*, not a description. Jake
  Archibald's 2026-07 post documents VoiceOver announcing "Bold" twice with `aria-label` +
  `aria-describedby`, and an unnamed button after removing `aria-label`. The fix is
  `aria-labelledby` pointing at the tooltip (optionally split into name and description spans).
  `interestfor` applies this rule automatically for plain hints; the React component must apply it
  when the trigger has no name of its own.
- JAWS can read sibling tooltips as part of a button's text when they sit next to each other in
  the DOM. Keep each tooltip immediately after its own trigger (the HTML spec also recommends
  placing a popover right after its invoker for reading order).
- Touch devices: with no `interestfor` on iOS and no `::interest-button` anywhere, a touch user
  cannot open a hover tooltip. Tooltip content must not be the only place a piece of information
  lives; this is already the APG stance.
- Screen reader users on Firefox/Safari get the description via `aria-describedby` even though the
  visual tooltip never opens without JS. That is acceptable for AT but still fails sighted
  keyboard users, so the JS fallback must handle focus.

## React 19.3 integration

Checked against `react@19.3.1`, `react-dom@19.3.1`, `@types/react@19.3.0`.

| Attribute | JSX prop | react-dom | `@types/react` |
| --- | --- | --- | --- |
| `popover` | `popover` | Supported, special-cased | Typed: `"" \| "auto" \| "manual" \| "hint"` |
| `popovertarget` / `popovertargetaction` | `popoverTarget` / `popoverTargetAction` | Supported, special-cased (camelCase) | Typed |
| `commandfor` / `command` | `commandfor` / `command` (lowercase) | Passed through as unknown lowercase attributes, no warning (verified with `renderToStaticMarkup`) | **Not typed.** DefinitelyTyped issue #74664 open; four PRs closed unmerged (latest 2026-08-31). |
| `interestfor` | `interestfor` (lowercase) | Passed through, no warning | **Not typed.** |

- Writing `interestFor` or `commandFor` (camelCase) renders the camelCase attribute and logs
  "React does not recognize the `interestFor` prop" in development. Use the lowercase names.
- The library needs a module augmentation of `React.ButtonHTMLAttributes` /
  `React.AnchorHTMLAttributes` (and `HTMLAttributes` for `interestfor`) to type these props until
  DefinitelyTyped merges them.
- `useId` works in Server Components, so trigger/tooltip ids can be generated without client JS.
- Server Component feasibility: in the zero-JS mode (`interestfor` + `popover="hint"`), both the
  trigger and the tooltip are plain markup and can be rendered by a Server Component. The
  cross-engine mode needs a client component to attach hover/focus handlers and call
  `showPopover({ source })`; the markup itself can still come from the server and be enhanced.

### What the React component must still do in JS (cross-engine mode)

1. `pointerenter` / `pointerleave` on trigger **and** tooltip, `focus` / `blur` on trigger, with
   open and close delays (mirror Chromium's 250ms / 150ms defaults, expose as props).
2. Open via `tooltip.showPopover({ source: trigger })` so the implicit anchor and popover nesting
   match the declarative path; close via `hidePopover()`.
3. Escape: not needed where `hint` is supported (light dismiss handles it), needed on Safari 27.0
   where `hint` degrades to `manual`. Also close on `pointerdown` elsewhere for the `manual` case.
4. Skip the handlers entirely when `interestfor` is supported (feature-detect) so Chromium gets the
   native behavior, including touch long-press, and the two mechanisms do not fight.
5. Nothing for positioning, layering, or animation. Those stay in CSS.

### Design implications for the Tooltip API

- The trigger must render a `<button>` or `<a href>` for `interestfor` to apply. An API that
  accepts an arbitrary child as trigger should document that non-button triggers never get the
  native path.
- The component should take the tooltip text as the accessible name when the trigger has none
  (`aria-labelledby`) and as a description otherwise (`aria-describedby`). This mirrors the
  `interestfor` rule and avoids the double-announcement bug.
- Open/close delays belong in the API. In native mode they map to `interest-delay-start/end` on
  the trigger via inline style; in JS mode they map to timers.
- "Everything is transition" has little to attach to here: the open state is owned by the browser
  (top layer), not React state. A `toggle` event listener can surface `data-open` or a render-prop
  value if the design wants React to observe it; it should not drive it.
- `hint` must be the popover type for tooltips so that they can appear over open `auto` popovers
  (menus, comboboxes) without closing them; `auto` would close the menu on open.

## References

- MDN, `popover` attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover
- MDN, Using interest invokers: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
- MDN, `<button>` (popovertarget implicit anchor): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button
- MDN, Using CSS anchor positioning (implicit anchors): https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using
- HTML Standard, popover section (hint state, implicit anchor element): https://html.spec.whatwg.org/multipage/popover.html
- Open UI, Interest Invokers explainer (a11y rules, touch, delays): https://open-ui.org/components/interest-invokers.explainer/
- Chrome 142 release notes (interest invokers shipped): https://developer.chrome.com/release-notes/142
- Chromium Intent to Ship, Interest Invokers: https://groups.google.com/a/chromium.org/g/blink-dev/c/bX1G_yDt6W4
- Mozilla implementation bug 1984699 (UNCONFIRMED): https://bugzilla.mozilla.org/show_bug.cgi?id=1984699
- Mozilla standards position #1181 (neutral): https://github.com/mozilla/standards-positions/issues/1181
- WebKit standards position #464 (oppose withdrawn 2026-06-02): https://github.com/WebKit/standards-positions/issues/464
- Interop proposal #1358, interest invokers (2026-09): https://github.com/web-platform-tests/interop/issues/1358
- Interop 2026 (popover=hint focus item): https://web.dev/blog/interop-2026
- Firefox 153 release notes (new `popover=hint` spec): https://www.firefox.com/firefox/153.0/releasenotes/
- Firefox bug 2039528 (revised hint behavior, WPT sync): https://bugzilla.mozilla.org/show_bug.cgi?id=2039528
- WebKit bug 275048 / PR 62557 "Implement popover=hint" (merged 2026-07-17): https://bugs.webkit.org/show_bug.cgi?id=275048
- Safari Technology Preview 249 release notes (popover=hint): https://developer.apple.com/documentation/safari-technology-preview-release-notes/stp-release-249
- Safari 27 release notes (anchor positioning changes; released 2026-09-14): https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes
- Chrome Developers, "Popover = hint": https://developer.chrome.com/blog/popover-hint
- Chromium dash, M155 schedule (stable 2026-10-06): https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=155
- Firefox 158 release notes (2026-10-13): https://www.firefox.com/firefox/158.0/releasenotes/
- caniuse, `popover="hint"`: https://caniuse.com/mdn-html_global_attributes_popover_hint
- caniuse, Interest invokers: https://caniuse.com/wf-interest-invokers
- caniuse, `interest-delay`: https://caniuse.com/mdn-css_properties_interest-delay
- caniuse, CSS Anchor Positioning (with partial-support notes): https://caniuse.com/css-anchor-positioning
- caniuse, `position-area`: https://caniuse.com/mdn-css_properties_position-area
- caniuse, `position-try-fallbacks`: https://caniuse.com/mdn-css_properties_position-try-fallbacks
- caniuse, `position-try-order`: https://caniuse.com/mdn-css_properties_position-try-order
- caniuse, `position-visibility`: https://caniuse.com/mdn-css_properties_position-visibility
- caniuse, `anchor-scope`: https://caniuse.com/mdn-css_properties_anchor-scope
- caniuse, `anchor-size()`: https://caniuse.com/mdn-css_types_anchor-size
- caniuse, anchor positioning after transforms: https://caniuse.com/mdn-css_properties_anchor-name_position_after_layout
- caniuse, `showPopover({ source })`: https://caniuse.com/mdn-api_htmlelement_showpopover_options_source_parameter
- caniuse, `commandfor`: https://caniuse.com/mdn-html_elements_button_commandfor
- caniuse, `@starting-style`: https://caniuse.com/mdn-css_at-rules_starting-style
- caniuse, `transition-behavior`: https://caniuse.com/mdn-css_properties_transition-behavior
- WAI-ARIA APG, Tooltip pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- Jake Archibald, "Fixing my tooltip accessibility mistake" (2026-07-28): https://jakearchibald.com/2026/my-tooltip-a11y-mistake/
- DefinitelyTyped issue #74664 (`commandFor` / `command` types for React): https://github.com/DefinitelyTyped/DefinitelyTyped/issues/74664
- CSSWG issue 12437, `::interest-button`: https://github.com/w3c/csswg-drafts/issues/12437
