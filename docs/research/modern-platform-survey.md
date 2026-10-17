# Modern HTML/CSS platform survey for UI primitives

Research date: **2026-10-15**. GitHub issue #4.

Support data was pulled on that date from `@mdn/browser-compat-data` 8.1.6 (timestamp
2026-10-15T13:35Z), caniuse, chromestatus, the Chromium 155 branch `runtime_enabled_features.json5`,
WebKit/Mozilla standards-positions, both Bugzillas, vendor release notes, the web.dev Baseline
digests (Jan–Sep 2026) and the WAI-ARIA APG. Nothing in this document is from memory.

Stable engines on the research date:

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 155 (156 began rolling out 2026-10-14 per chromiumdash; nothing surveyed changes between them) | 2026-10-06 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Popover API, CSS Anchor Positioning, `popover="hint"` and `interestfor` are covered in depth in
[popover-anchor-tooltip.md](./popover-anchor-tooltip.md); they appear here only as table rows.

Verdict legend, following the browser-support policy in `docs/vision.md`:

- **adopt**: shipped in the latest stable of all three engines. Use freely, no fallback.
- **flag**: missing in at least one engine; may be used behind the experimental flag.
- **not yet**: single-engine and/or contested in standards; do not build on it.
- **n/a**: works, but not useful for a React headless library.

## Summary table

Version numbers are the first supporting stable release. `TP` = Safari Technology Preview only.
`pref` = behind an `about:config` pref in Firefox release.

### Disclosure / Accordion

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| `<details>`/`<summary>` | 12 | 6 | 49 | adopt | Accordion, Disclosure |
| `<details name>` (exclusive group) | 120 | 17.2 | 130 | adopt (opt-in, see a11y) | Accordion |
| `::details-content` | 131 | 18.4 (no chained pseudo-elements) | 143 | adopt | Accordion, Disclosure |
| `<details>` auto-opens on find-in-page | 97 | 26.2 (partial: no scroll to match) | 148 | adopt | Accordion, Disclosure |
| `hidden="until-found"` + `beforematch` | 102 | 26.2 (partial: no scroll to match) | 148 | adopt, **but React 19.3 cannot emit it** (see React section) | Tabs, Accordion |
| `:open` | 133 | 26.5 | 136 | adopt (Baseline May 2026) | Accordion, Dialog, Select |
| `interpolate-size` / `calc-size()` (animate to `height: auto`) | 129 | ✗ (in TP 254; position: support) | ✗ (bug 1945962 NEW; position: positive) | flag | Accordion, Disclosure |

### Dialog / top layer

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| `<dialog>`, `showModal()`, `::backdrop`, `:modal` | 37/105 | 15.4/15.6 | 98/103 | adopt | Dialog |
| `dialog.requestClose()` | 134 | 18.4 | 139 | adopt | Dialog |
| `toggle`/`beforetoggle` on `<dialog>` | 132 | 26 | 133 | adopt | Dialog |
| `<dialog closedby>` (light dismiss) | 134 | ✗ (TP; position: support; umbrella bug 284592) | 141 | flag | Dialog |
| `inert` | 102 | 15.5 | 112 | adopt | Dialog, Drawer, Menu |
| `overlay` (keep in top layer during exit transition) | 117 | ✗ | ✗ | n/a: Chromium only and Chromium has a "deprecate and remove" entry; harmless to list in `transition` | Dialog, Popover |
| CloseWatcher | 126 | ✗ (TP; position: neutral) | 149 | flag; prefer built-in close requests of `<dialog>`/popover | Drawer, custom overlays |
| `scrollbar-gutter` | 94 | 18.2 | 97 | adopt | Dialog scroll lock |
| `overscroll-behavior` (`contain`) | 63 (full 144) | 16 (partial) | 59 (full 150) | adopt | Dialog, Drawer, Menu |
| `overscroll-behavior: chain` | 150 | ✗ | 157 | not yet | – |

### Popover / Tooltip (see popover-anchor-tooltip.md)

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| Popover API, `:popover-open`, `ToggleEvent` | 114 | 17 | 125 | adopt | Tooltip, Menu, Toast |
| `ToggleEvent.source` | 140 | 26.5 | 145 | adopt | Menu, Popover |
| `popover="hint"` | 151 (133 old behavior) | ✗ (TP) | 153 (149 old) | flag | Tooltip |
| `showPopover({ source })` implicit anchor | 137 | 26 | 144 | adopt | Tooltip, Menu |
| CSS Anchor Positioning (`anchor()`, `position-area`, `position-try-fallbacks`, `anchor-size()`) | 125 | 26 | 147 | adopt | Tooltip, Menu, Select |
| `interestfor` | 142 | ✗ (position open with a11y concerns) | ✗ (neutral) | not yet / flag | Tooltip |
| `@starting-style` | 117 | 17.5 | 129 | adopt | all animated open/close |
| `transition-behavior: allow-discrete` | 117 | 17.4 | 129 (BCD marks partial: `display` transitions, bug 1882408) | adopt | all animated open/close |

### Invokers / declarative triggers

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| `command` / `commandfor` + `CommandEvent` | 135 | 26.2 | 144 | adopt | Dialog, Popover, Menu, Tooltip triggers |
| `command="request-close"` | 139 | 26.2 | 144 | adopt | Dialog |
| Custom `--` commands | 135 | 26.2 | 144 | adopt | any |
| `commandfor` implicit anchor | 135 | 26.2 | 147 | adopt | Tooltip, Menu |
| `focusgroup` (native roving focus) | 150 (flag `Focusgroup` is `stable` in the 155 branch) | ✗ (position open: device-independence concern) | ✗ (position: positive, meta bug 2070976) | flag | Tabs, Toolbar, RadioGroup, Menu, Listbox |
| CSS `reading-flow` / `reading-order` | 137 | ✗ | ✗ | not yet | Tabs/Toolbar in grid/flex |

### Select / Combobox / Listbox

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| Customizable `<select>` (`appearance: base-select`, `::picker(select)`, `::picker-icon`, `::checkmark`) | 135 | 27 | ✗ (pref `dom.select.customizable_select.enabled` since 149) | flag (degrades to native select) | Select |
| `<selectedcontent>` | 135 | 27 | ✗ | flag | Select |
| Rich content parsed inside `<select>`/`<option>` | 135 | 27 | 153 | adopt (parsing only) | Select |
| `<select multiple>` base appearance | ✗ (proposed) | ✗ (position open) | ✗ | not yet | Listbox |
| `HTMLSelectElement.showPicker()` | 121 | ✗ (TP) | 122 | not yet | Select |
| `field-sizing: content` | 123 | 26.2 | 152 | adopt (Baseline June 2026) | Combobox, Textarea |
| `enterkeyhint` | 77 | 13.1 | 94 | adopt | Combobox, Search |
| `autocomplete` tokens | 14 | 6 | 4 | adopt | Combobox, forms |
| `autocorrect` | 153 | 14.1 | 136 | adopt (Baseline Aug 2026) | Combobox |
| `writingsuggestions` | 124 | 18 | ✗ | not yet | Combobox |
| `contenteditable="plaintext-only"` | 51 | 5 | 136 | adopt | editable Combobox (marginal) |

### Toggle / Switch / Checkbox / Radio

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| `<button aria-pressed>` (APG toggle button) | all | all | all | adopt | Toggle |
| `<input type=checkbox switch>` | ✗ (proposed) | 17.4 | ✗ (no signal) | not yet | Switch |
| `<input type=checkbox role=switch>` (APG) | all | all | all | adopt | Switch |
| `HTMLInputElement.indeterminate` | 1 | 3 | 3.6 | adopt | Checkbox |
| `:user-invalid` / `:user-valid` | 119 | 16.5 | 88 | adopt (widely available) | all form controls |
| `:state()` / `CustomStateSet` | 125 | 17.4 | 126 | n/a (needs custom elements) | – |

### CSS selectors / values

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| `:has()` | 105 | 15.4 | 121 | adopt (widely available) | all |
| `:focus-visible` | 86 | 15.4 | 85 | adopt | all |
| `element.focus({ focusVisible })` | 145 | 18.4 | 104 | adopt | Tabs, Menu, Dialog focus return |
| `::placeholder` | 57 | 10.1 | 51 | adopt | inputs |
| `light-dark()` colors | 123 | 17.5 | 120 | adopt | theming |
| `light-dark()` with `<image>` | 150 | 27 | 150 | adopt | theming |
| `CSS.escape()` | 46 | 10.1 | 31 | adopt | id-based selectors |

### Scroll

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| Scroll snap (`scroll-snap-type/align/stop`) | 69/75 | 11/15 | 99/103 | adopt | Carousel, Tabs strip |
| `scrollsnapchange` / `scrollsnapchanging` events | 129 | ✗ | ✗ | not yet | Carousel |
| `scrollend` event | 114 | 26.2 | 109 | adopt | Carousel |
| Scroll-driven animations (`animation-timeline`, `scroll()`, `view()`) | 115 | 26 | ✗ (Nightly only; pref `layout.css.scroll-driven-animations.enabled`) | flag | Carousel, progress indicators |
| `scroll-state()` container queries | 133 | ✗ (evaluation bugs opened Oct 2026) | ✗ | not yet | sticky headers, Toolbar |
| `::scroll-marker`, `::scroll-button`, `scroll-marker-group: tabs` | 135/154 | ✗ | ✗ | not yet | Carousel, Tabs |
| `scrollbar-width` / `scrollbar-color` | 121 | 18.2 / 26.2 | 64 | adopt | scroll areas |

### View Transitions / navigation / misc

| Feature | Blink | WebKit | Gecko | Verdict | Helps |
| --- | --- | --- | --- | --- | --- |
| Same-document View Transitions, `view-transition-class`, `:active-view-transition` | 111/125 | 18/18.2 | 144 | adopt via React `<ViewTransition>` | all |
| Cross-document `@view-transition`, `pagereveal` | 126 | 18.2 | ✗ | not yet (router concern) | – |
| Navigation API | 102 | 26.2 | 147 | adopt (Baseline Jan 2026); router's domain | Dialog/Menu close on navigate |
| `Element.ariaNotify()` | 141 | 27 | 150 | adopt (interoperable since Safari 27, Sept 2026) | Toast, Combobox announcements |
| `headingoffset` / `headingreset` | ✗ (flag) | ✗ | ✗ (pref) | not yet | Accordion/Dialog headings |
| `aria-actions` | 151 | ✗ | ✗ | not yet | – |

## Recommendations for the initial four components

### Toggle

- **Adopt:** `<button type="button" aria-pressed>`; `:focus-visible`; `data-*` attributes for
  state (`data-pressed`, `data-pending`). `:state()` is n/a because it needs `ElementInternals`.
- There is no native pressed-button element. Keep the label stable when the state flips (APG).
- Nothing here needs a flag.

### Tabs

- **Adopt:** APG tabs pattern with JS roving `tabindex`, `aria-selected`, `aria-controls`;
  `element.focus({ focusVisible })` for programmatic focus; scroll snap for an overflowing tab strip
  with `scrollend`; `<ViewTransition>` for panel switches.
- **Flag:** `focusgroup="tablist"` as the opt-in replacement for roving-tabindex JS (Chromium only).
  Keep the JS path as default; feature-detect with `'focusGroup' in HTMLElement.prototype` (the IDL attribute is camel-cased;
  `'focusgroup' in ...` is always false, issue #43).
- **Tempting but blocked:** `hidden="until-found"` on inactive panels. The platform supports it in
  all three engines, but react-dom 19.3 serializes `hidden` as a boolean attribute, so
  `hidden="until-found"` becomes `hidden=""` on both client and server. See the React section for
  the workaround. `<Activity mode="hidden">` hides with `display: none`, which is also not
  find-in-page searchable, so the two are complementary, not substitutes.
- **Not yet:** `reading-flow` for visually reordered tab lists; `scroll-marker-group: tabs`.

### Accordion / Disclosure

- **Adopt:** `<details>`/`<summary>` as the primitive. It is a zero-JS Disclosure, auto-opens on
  find-in-page in all three engines, exposes `open` state natively, styles with `::details-content`
  and `:open`, fires `toggle` (React `onToggle` works). This primitive can be a Server Component.
- **Adopt, opt-in:** `<details name>` for exclusive groups. Make it opt-in, because single-open
  accordions are an accessibility trade-off (the user loses context when another panel closes) and
  the APG does not require exclusivity.
- **A11y caveat:** `<details>` maps to role `group` and `<summary>` to a disclosure button with
  expanded state. The APG accordion pattern wants each button wrapped in a heading; put the
  heading inside `<summary>` (`<summary><h3>…</h3></summary>` is valid) and verify how each engine
  exposes it before shipping. `<details>` accepts no `role` override.
- **Flag:** `interpolate-size: allow-keywords` (or `calc-size()`) to animate `::details-content`
  height to `auto`. Chromium only today; Safari TP 254 has it and WebKit's position is "support",
  Firefox's position is "positive" with no implementation. Without the flag, animate via
  `<ViewTransition>` (controlled `open`) or a `grid-template-rows: 0fr → 1fr` wrapper.
- **Note:** Safari cannot chain pseudo-elements after `::details-content` (WebKit bug 283446).

### Tooltip

See [popover-anchor-tooltip.md](./popover-anchor-tooltip.md). Short form: adopt Popover API +
Anchor Positioning + `@starting-style`/`allow-discrete`; `popover="hint"` and `interestfor` behind
the flag; `::interest-button` not yet.

## React 19.3 integration notes

Checked against `react-dom` 19.3.1 and `@types/react` 19.3.0 (npm `latest` on the research date).

- **Unknown lowercase attributes pass through.** react-dom has no entry for `closedby`,
  `command`, `commandfor`, `interestfor`, `focusgroup`, `switch` or `name`-on-details, so they are
  set verbatim with `setAttribute`. They reach the DOM on both client and server.
- **Typed in `@types/react` 19.3:** `closedby` (lowercase, on `DialogHTMLAttributes`),
  `popover`, `popoverTarget`, `popoverTargetAction`, `inert`, `enterKeyHint`, `autoCorrect`,
  `autoComplete`, `onToggle`, `onBeforeToggle`, `onCancel`, `onClose`.
- **Not typed:** `command`, `commandfor`, `interestfor`, `focusgroup`, `switch`. The library
  needs a module augmentation of `React.ButtonHTMLAttributes` / `HTMLAttributes` for these.
- **Events React does not synthesize:** `command`, `interest`, `loseinterest`, `beforematch` and
  `scrollsnapchange` have no `on*` prop (`onScrollEnd`, `onToggle`, `onBeforeToggle`, `onCancel`
  and `onClose` do exist), so they need `addEventListener` through a ref. React 19.3's Fragment
  refs expose `addEventListener` on a group of siblings, which fits list-like primitives.
- **`hidden="until-found"` is broken in react-dom 19.3.** `hidden` is in the boolean-attribute
  switch in both `react-dom-client` (`setProp`) and `react-dom-server`; any truthy value becomes
  `hidden=""`, and `@types/react` types it as `boolean`. Workaround: render `hidden` (boolean) so
  SSR output is hidden, then upgrade with `el.setAttribute('hidden', 'until-found')` in a layout
  effect, and listen to `beforematch` to sync React state when the browser reveals the element
  (Chromium removes the attribute itself). No React issue tracking this was found on the research
  date; worth filing.
- **`<ViewTransition>`** (stable in 19.3) wraps the same-document View Transitions API and only
  animates inside transitions, which matches principle 2 of the vision. `addTransitionType` maps to
  `:active-view-transition-type()` in CSS.
- **Server Components:** `<details>`, `<dialog>` + `command`/`commandfor` triggers, and popovers with
  `popovertarget`/`commandfor` work with zero client JS, so those primitives can be RSC-compatible
  in their uncontrolled form.

## Per-feature notes

### `<details>` / `<summary>`, `name`, `::details-content`, find-in-page

Baseline across engines (`name`: Chrome 120, Safari 17.2, Firefox 130; `::details-content`:
Chrome 131, Safari 18.4, Firefox 143). WebKit and Mozilla positions are "support"/"positive" for
exclusive accordions, `::details-content` and auto-expanding details. The `toggle` event is
coalesced; `open="false"` still opens. Closed `<details>` content is revealed by find-in-page
and text fragments in all engines; Firefox before 148 and Safari 26.2 do not scroll to the match
(bugs 2006040, 304174).

A11y: `<details>` is role `group` with no permitted `role` override; `<summary>` is the disclosure
control and its contents are the label. Multiple `open` attributes inside one `name` group resolve
to the first in source order.

### `hidden="until-found"` and `beforematch`

Chrome 102, Firefox 148 (partial from 139), Safari 26.2 (partial). WebKit position "support",
Mozilla "positive". The element renders with `content-visibility: hidden`, so `display: none`,
`display: contents` or `display: inline` on it defeats the reveal. When a match is found the browser
removes the attribute and fires `beforematch` first. See the React section for the react-dom
blocker.

### `<dialog>`: `closedby`, `requestClose()`, toggle events, top layer, `inert`

- `requestClose()` (Chrome 134, Safari 18.4, Firefox 139) fires `cancel` ~~and respects
  `closedby`~~; use it instead of `close()` for user-initiated closes.
  **Correction (2026-10-16):** `requestClose()` **ignores** `closedby`. The HTML spec says so
  explicitly ("even if closedby is set to "none", the same behavior will apply"), and a
  `closedby="none"` dialog closes on `requestClose()` and on `command="request-close"` in
  Chromium 156 and Firefox 157 (probe `memo/platform-researcher/probes/04-dialog/requestclose-closedby.mjs`).
  Only user close requests (Escape, Android back) and light dismiss consult `closedby`. See
  [dialog.md](./dialog.md).
- `toggle`/`beforetoggle` on dialog: Chrome 132, Firefox 133, Safari 26. React 19.3 attaches
  `onToggle`/`onBeforeToggle`/`onCancel`/`onClose` on `<dialog>`.
- `closedby="any|closerequest|none"`: Chrome 134, Firefox 141, Safari TP only (not 27.0).
  WebKit's position is "support" and the umbrella bug was touched in June 2026, so expect a 27.x
  release. Until then the Dialog component must implement light dismiss in JS behind the flag or
  always. Note Firefox bug 2078216 (Android back consumed by `closedby="none"` dialogs).
- Top layer + `::backdrop` + `:modal` are long Baseline. Modal dialogs make the rest of the
  document inert natively; the `inert` attribute (Chrome 102, Safari 15.5, Firefox 112) is for
  non-modal overlays such as Drawers.
- Chrome 154 changed light dismiss for popovers and dialogs to fire on `click` instead of
  `pointerdown`/`pointerup`, so touch scrolling and right-clicks no longer dismiss.

### Customizable `<select>`

Chrome 135, Safari 27.0 (with its own UA default styles), Firefox behind two prefs since 149 (both
`dom.select.customizable_select.enabled` and `layout.css.appearance-base.enabled`; Bugzilla says a
dedicated flag was intentional). Mozilla's position is "positive" with a compatibility concern.
Firefox 153 already parses arbitrary content inside `<select>`, so rich `<option>` markup is safe to
serve to all engines. In unsupported engines the select degrades to the native picker, so this is
the one flagged feature that is safe to leave on. `<selectedcontent>` clones the chosen option's
content (Chrome 150 now updates every descendant `<selectedcontent>`). `<select multiple>` base
appearance and `showPicker()` in Safari are not there yet.

A11y: options keep role `option`; images inside options need `alt`; the accessible name comes from
text content.

### Invoker Commands (`command` / `commandfor`) and `interestfor`

Invoker Commands are Baseline (Chrome 135, Firefox 144, Safari 26.2) including
`show-modal`, `close`, `request-close`, `show-popover`, `hide-popover`, `toggle-popover` and custom
`--name` commands dispatched as `CommandEvent` on the target. `commandfor` also creates an implicit
anchor (Firefox from 147). This is the preferred declarative trigger for Dialog, Menu and Popover
and lets the trigger be rendered on the server. Chromium is still experimenting with scroll
commands (`HTMLCommandForScrollCommands` is `experimental`).

`interestfor`: Chromium 142 only. The HTML PR (#11006) is still open; WebKit's position issue lists
accessibility, device-independence, portability and usability concerns; Mozilla is "neutral" with a
"use cases" concern. Not yet; details in the tooltip doc.

### `<input type="checkbox" switch>` and native toggle semantics

Safari 17.4 only. Chromium's entry is "Proposed" with no milestone; Mozilla has no position; the
HTML PR (#9546) is unmerged. Use `<input type="checkbox" role="switch">` (APG: native `checked`
replaces `aria-checked`) or `<button role="switch" aria-checked>`. For Toggle use
`<button aria-pressed>`; there is no native pressed button, and `:state()` requires a custom
element.

### `field-sizing`, `::placeholder`, `:user-invalid`, `:has()`, `:focus-visible`, `:state()`, `light-dark()`

All Baseline. `field-sizing: content` reached Firefox 152 in June 2026 (Chrome 123, Safari 26.2).
`:user-invalid` and `:has()` became Baseline Widely available in May/June 2026. `light-dark()` with
image values is new (Chrome 150, Firefox 150, Safari 27). `:state()`/`CustomStateSet` is
interoperable (Chrome 125, Safari 17.4, Firefox 126) but only custom elements can set states, so it
is n/a; use `data-*` attributes.

### `@starting-style`, `transition-behavior: allow-discrete`, `interpolate-size`, `overlay`

- `@starting-style` and `allow-discrete` are Baseline (Firefox 129, Safari 17.4/17.5, Chrome 117).
  BCD marks Firefox's `transition-behavior` as partial, citing bug 1882408 about transitioning
  `display`; test exit transitions on `display: none` in Firefox before relying on them, and prefer
  popover/dialog (whose open/close is handled by the UA) over `display` toggles.
- `interpolate-size` / `calc-size()`: Chrome 129 only. Safari TP 254 implements both and WebKit's
  position is "support"; Firefox has "positive" position and an open bug. Flag.
- `overlay`: Chrome 117 only, never implemented elsewhere, and Chromium has a "deprecate and
  remove" chromestatus entry. Do not depend on it for layout, but list it in `transition`:
  Chromium requires it for a correct exit fade (see the correction below); other engines ignore it.
- **Correction (2026-10-16):** exit animations of top-layer elements (popover, dialog) are
  **progressive enhancement**, not cross-engine. Verified by screenshot probes
  (`memo/platform-researcher/probes/04-dialog/exit-anim.mjs`, `entry-anim.mjs`):
  - Firefox closes popovers and dialogs **instantly**: Gecko cannot transition or animate
    `display` (BCD partial; meta bug 1834877 still NEW, Nightly pref not enabled). Entry
    animations via `@starting-style` do work.
  - Chromium animates the exit, but **without `overlay … allow-discrete` in the transition list**
    the element leaves the top layer at once: it drops under z-indexed page content and
    `::backdrop` disappears for the whole fade. So `overlay` is not just harmless but required in
    Chromium for a correct exit (it may become unnecessary if the CSSWG removes the property).
  - WebKit animates the exit (Safari 27.0 fixed a bug in it); top-layer behaviour without
    `overlay` not verified. See [dialog.md](./dialog.md) "Animation".

### Scroll-driven animations, scroll snap, `scroll-state()`, `overscroll-behavior`, `scrollbar-gutter`

- Scroll-driven animations: Chrome 115, Safari 26 (threaded in 26.4), Firefox only in Nightly
  (`layout.css.scroll-driven-animations.enabled`; off in release 158). Flag.
- Scroll snap: Baseline. `scrollsnapchange`/`scrollsnapchanging` events are Chromium only.
  `scrollend` is Baseline since Safari 26.2.
- `scroll-state()` queries (`stuck`, `snapped`, `scrollable`, `scrolled`): Chrome 133/144 only.
  WebKit opened evaluation bugs for each query in Aug–Oct 2026; Firefox has none. Not yet.
- `overscroll-behavior: contain` is Baseline; it only started applying to non-scrollable
  containers in Chrome 144 and Firefox 150 (Safari still partial). `chain` is Chrome 150 and
  Firefox 157 only.
- `scrollbar-gutter: stable` (Safari 18.2) avoids layout shift when a modal locks scrolling.
  `scrollbar-color` reached Safari 26.2.

### View Transitions

Same-document View Transitions, `view-transition-class` and `:active-view-transition` are
Baseline (Firefox 144 was the last engine; `:active-view-transition` became Baseline Jan 2026).
FUNSTACK UI consumes them through React's `<ViewTransition>` (stable in 19.3). Cross-document
transitions (`@view-transition`, `pagereveal`) are still missing in Firefox and belong to FUNSTACK
Router, not the UI library.

### `inert`, `contenteditable="plaintext-only"`, `enterkeyhint`, `autocomplete`

All Baseline (`plaintext-only` since Firefox 136). `autocorrect` became Baseline in Aug 2026
(Chrome 153). `writingsuggestions` is missing in Firefox. Combobox inputs should set
`autocomplete="off"`, `autocorrect="off"`, `enterkeyhint`, and `aria-autocomplete` per APG.

### `CSS.escape()`, `:popover-open`, `:open`, `:modal`

All Baseline; `:open` was the last (Safari 26.5, Baseline May 2026). `:open` matches open
`<details>`, `<dialog>`, `<select>` and input pickers, so components can style open state without a
data attribute. `CSS.escape()` matters when building selectors from user-supplied ids
(`commandfor`, `aria-controls`).

### `reading-flow` / `reading-order`

Chrome 137 only (`ReadingFlowWithSlots` is stable in the 155 branch). WebKit and Mozilla have open
position issues with no position; Firefox bug 1966714 is NEW. Not yet. Note that `focusgroup`
honors `reading-flow` in Chromium, so the two will pair later.

### `focusgroup`

Chromium shipped it in Chrome 150 (2026-06-30); the `Focusgroup` runtime flag is `stable` in the
155 branch and the Chrome 150 release notes list it (chromestatus still says "developer trial",
which is stale). Values: a behavior token (`toolbar`, `tablist`, `radiogroup`, `listbox`, `menu`,
`menubar`, `none`) plus modifiers (`inline`, `block`, `wrap`, `nowrap`, `nomemory`) and a
`focusgroupstart` attribute. The browser collapses participants to one Tab stop, handles arrow
keys and last-focused memory, and infers minimum ARIA roles when roles are generic. Developers
still manage `aria-selected`/`aria-checked` and selection logic. Mozilla's position is "positive"
with a meta bug and no implementation; WebKit's position issue is open with a device-independence
concern; the HTML PR (#11723) is open. `FocusgroupV2` (grid, feed) is experimental. Flag.

### CloseWatcher

Chrome 126, Firefox 149 (which also added back-button dismissal of popovers/dialogs on Android),
Safari TP only with a "neutral" WebKit position. `<dialog>` and popovers already handle Escape and
the Android back button through close requests in all engines, so CloseWatcher is only needed for
custom non-top-layer overlays. Flag, low priority.

### Navigation API

Baseline since Jan 2026 (Chrome 102, Firefox 147, Safari 26.2). FUNSTACK Router owns it. The UI
library may listen to `navigation`'s `navigate` event to close transient overlays, but should not
otherwise depend on it.

### `Element.ariaNotify()`

Chrome 141, Firefox 150, Safari 27: interoperable as of Sept 2026. Lets Toast and Combobox announce
without live-region DOM churn. BCD notes that on macOS an announcement may be dropped when another
accessibility event fires at the same time.

## References

- MDN browser-compat-data 8.1.6 (2026-10-15): https://unpkg.com/@mdn/browser-compat-data@latest/data.json
- Chromium 155 branch feature flags: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8059/third_party/blink/renderer/platform/runtime_enabled_features.json5
- Chrome 150 release notes (focusgroup, popover=hint, overscroll chain): https://developer.chrome.com/release-notes/150
- Chrome 153 / 154 release notes: https://developer.chrome.com/release-notes/153 , https://developer.chrome.com/release-notes/154
- Focusgroup intent to ship: https://groups.google.com/a/chromium.org/g/blink-dev/c/53PP0LgddCQ/m/Be_6nT9VBgAJ
- Focusgroup developer RFC (values, semantics): https://developer.chrome.com/blog/focusgroup-rfc
- chromestatus Focusgroup: https://chromestatus.com/feature/5637601087193088
- WebKit Features for Safari 27.0: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- WebKit Features for Safari 26.6: https://webkit.org/blog/18178/webkit-features-for-safari-26-6/
- Safari Technology Preview 254 (interpolate-size, calc-size): https://webkit.org/blog/18420/release-notes-for-safari-technology-preview-254/
- WebKit standards-positions summary: https://github.com/WebKit/standards-positions (issues 171 focusgroup, 215 close watchers, 329 dialog light dismiss, 348 calc-size, 378 reading-flow, 386 customizable select, 464 interestfor)
- Mozilla standards-positions merged data: https://mozilla.github.io/standards-positions/merged-data.json
- Firefox release notes 150–158: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/158 (and preceding)
- Firefox experimental features: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features
- Bugzilla: interpolate-size 1945962, calc-size 1896734, reading-flow 1966714, focusgroup 2070976, interestfor 1984699
- WebKit Bugzilla: closedby 284592, close watchers 263305, interestfor 297786, interpolate-size 295132, scroll-state 313234, reading-flow 285029
- web.dev Baseline digests Jan–Aug 2026: https://web.dev/blog/baseline-digest-jan-2026 … https://web.dev/blog/baseline-digest-aug-2026
- web.dev "New to the web platform" Jul–Sep 2026: https://web.dev/blog/web-platform-09-2026
- Open UI interest invokers explainer (updated 2026-10-02): https://open-ui.org/components/interest-invokers.explainer/
- WHATWG HTML PRs: interestfor #11006 (open), focusgroup #11723 (open)
- React 19.3 release post: https://react.dev/blog/2026/09/09/react-19-3
- react-dom 19.3.1 source (`hidden` in the boolean-attribute switch): https://unpkg.com/react-dom@19.3.1/cjs/react-dom-client.development.js
- `@types/react` 19.3.0: https://unpkg.com/@types/react@19.3.0/index.d.ts
- WAI-ARIA APG patterns: accordion, tabs, switch, button: https://www.w3.org/WAI/ARIA/apg/patterns/
- MDN `<details>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details
