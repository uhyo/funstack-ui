# Architect notes: Avatar, ScrollArea, OTP field (#171), 2026-11-26

Working notes behind `design/components/avatar.md`, `design/components/otp-field.md` and the
#171 entry in `design/CHANGELOG.md`. Not a spec.

## What I read

- #171, #162 (wave 25), vision, conventions 1.1, 1.2, 2.1 to 2.6, 4, 5, 6, 7.1, 8, 11;
  `separator.md` in full; `number-field.md` (decisions, anatomy) and `field-form.md` (decisions,
  4.3, 7.1, 7.2); the #169 changelog entries for the shape of a "proposed" entry.
- react-dom 19.3.1 development build (`maySuspendCommit`, `suspendInstance`,
  `waitForCommitToBeReady`, the view-transition image wait).
- No probes were run. No browser was opened. Everything about engine behaviour below is from
  browser-compat-data, vendor trackers, the React source or the libraries' docs, and is marked
  where it is an expectation rather than a reading.

## Platform facts (browser-compat-data 8.1.11, timestamp 2026-11-26)

Current stable: Chrome 158, Firefox 161, Safari 27.2.

| Feature | Chrome | Firefox | Safari | Note |
| --- | --- | --- | --- | --- |
| `scrollbar-width` (`auto` / `thin` / `none`) | 121 | 64 | 18.2 | |
| `scrollbar-color` | 121 | 64 | 26.2 | |
| `scrollbar-gutter` | 94 | 97 | 18.2 | |
| `::-webkit-scrollbar` and friends | 2 | no (a `display: none` shim existed in 153 to 154, removed in 155) | 4 on macOS; iOS honours only `display: none` since 13 | Chromium ignores the pseudo-elements once `scrollbar-width` or `scrollbar-color` is not `auto` (CSSWG resolution); WebKit has a bug to match, not checked in 26.2 |
| Scroll-driven animations (`animation-timeline`, `scroll()`, `view()`, `animation-range`, `timeline-scope`) | 115 / 116 | **159** | 26 | In all three now. The survey in `docs/research/modern-platform-survey.md` still says Firefox Nightly only: stale |
| `scroll-state()` container queries | 133 (`scrolled` 144) | no | no | Chromium only |
| `::scroll-button()`, `::scroll-marker`, `scroll-marker-group` | 135 | no | no | Chromium only |
| `scrollend` event | 114 | 109 | 26.2 | |
| `@media (scripting)` | 120 | 113 | 17 | |
| `selectionchange` on `<input>` | 127 | 92 | 18 | |
| `beforeinput` | 60 | 87 | 10.1 | |
| `::selection` | 1 | 62 | 1.1 on macOS, **no on iOS** | matters for the OTP overlay |
| `navigator.credentials.get({ otp })` | 84 Android, 93 desktop | no | 27 | WebOTP |
| `HTMLImageElement.decode()` | 64 | 68 | 11.1 | |
| `autocorrect` attribute | 153 | 136 | 14.1 | |
| `ariaNotify()` | 141 | 150 | 27 | |

Keyboard-focusable scrollers: Chrome made a scroll container with no focusable child a Tab stop
(announced for 130, moved to 132 per the Chrome blog); Firefox has long done so; WebKit has not
(bugs.webkit.org 277290, "AX: Scrolling containers inoperable with keyboard", NEW, last touched
2026-11-20).

## Prior art, as read today

- **Avatar.** Radix: `Root` / `Image` / `Fallback`, the image is rendered only once a
  `new Image()` preload succeeded, `Fallback delayMs`, `onLoadingStatusChange`. Base UI 1.9: the
  same three parts, status `idle | loading | loaded | error`, "the image is preloaded and only
  rendered once it has loaded" unless `keepMounted`, `Fallback delay` (default 0). Ark UI: the
  same anatomy with `onStatusChange`. None says anything about server rendering.
- **ScrollArea.** Radix (`Root` / `Viewport` / `Scrollbar` / `Thumb` / `Corner`, `type` default
  `"hover"`, `scrollHideDelay` 600): its own Accessibility section opens with "In most cases,
  it's best to rely on native scrolling and work with the customization options available in
  CSS." Base UI adds `Content`, overflow-edge data attributes and CSS variables for edge
  distance, and has no accessibility section. Both keep native scrolling in the viewport, hide
  the native bar and draw `div`s.
- **OTP.** input-otp (what shadcn/ui wraps): one invisible input, slots from a render prop
  (`char`, `isActive`, `hasFakeCaret`), selection rewritten on `selectionchange`, manual paste,
  password-manager badge detection, a `<noscript>` stylesheet. Base UI 1.9 `OTPField` (preview):
  one `<input>` per slot plus a hidden validation input, `validationType`, `onValueComplete`,
  `autoSubmit`, `mask`; its docs ask for an `aria-label` on every input after the first
  ("Character 2 of 6"). Radix `unstable_OneTimePasswordField`: one input per character plus a
  required `HiddenInput`, `autoSubmit`. Ark UI `PinInput`: N inputs, `HiddenInput`, `value:
  string[]`, `otp`, `mask`, `blurOnComplete`, `autoSubmit`. React Aria, Headless UI, Ariakit:
  none of the three parts.

## Avatar: what I went back and forth on

- **Suspense.** The issue's idea. The finding that settled it is in react-dom: under a
  `<ViewTransition>`, in a transition lane, an `<img>` whose props pass `maySuspendCommit`
  (`src` set, **no `onLoad`**, not `loading="lazy"`) holds the commit (decode, up to 800 ms, 50
  ms when the byte estimate is over budget) and then the animation (in-viewport images, up to
  500 ms). So React already does the bounded version of what the issue asks, and the one thing
  a library can do wrong is attach `onLoad`. Every headless Avatar I looked at listens with
  React props or preloads with `new Image()`; ours must use native listeners.
- A library-owned `use(promise)` was the alternative. It loses the server HTML (an image
  cannot load on the server), has no bound, needs a URL cache, and breaks conventions 6.
- **Where the name goes.** `alt` on the Image is the familiar spelling, but then a failed
  image leaves initials as the only name, and the Fallback would need `role="img"` and the
  alt from a sibling that may not render. The Root is rendered before its children on the
  server, so it cannot learn the Image's `alt` in time. `alt` on the Root gives one name in
  every state and makes the inner `<img alt="">`, which is also what lets a broken image paint
  nothing over the fallback without script. Cost: differs from Radix and Base UI; nothing
  interactive may live inside the Root. Left as decision 2.
- **Status names.** The server cannot know whether an `Avatar.Image` with a source will render
  under the Root (streaming: the Root's tag is out first), so the first status has to be one
  that is true in both cases. Hence `"idle"` (Base UI's word), and CSS uses `:has(img)` for
  "an image may still arrive".
- **`naturalWidth === 0` on a complete image** is both "broken" and "SVG without intrinsic
  size" per the HTML definition of natural dimensions. `decode()` separates them. Expectation,
  to be confirmed by a browser test in three engines.
- **Broken image with `alt=""`**: HTML's rendering section treats an `img` that represents
  nothing as an empty inline element. Expectation that all three engines paint nothing even
  when CSS gives the element a size; a browser-test row.
- **Delay.** Radix's `delayMs` exists because their fallback is the only thing rendered while
  the image loads. With the image in the DOM and the fallback under it there is one paint, and
  the "show nothing for 400 ms" variant is a CSS animation delay gated on `:has(img)`.

## ScrollArea: why not

What a ScrollArea part was for in 2021: one way to restyle a scrollbar when Firefox had only
`scrollbar-color` / `scrollbar-width` and Chromium / WebKit only `::-webkit-scrollbar`. Today
the standard properties are in all three engines.

What a native scroller still cannot do:

- a thumb shape (radius, inset, exact thickness) in Firefox and on iOS; `thin` is the only
  size and its pixels are the engine's;
- an overlay scrollbar on a platform whose scrollbars are classic (Windows, most Linux), that
  is, a bar that takes no layout space (`overflow: overlay` is gone);
- a bar that hides until hover or scroll on those platforms.

What a custom-drawn bar costs:

- the user's OS settings stop applying: "always show scroll bars", scrollbar size, forced
  colours (a `div` thumb is a background colour, which forced-colors mode removes);
- a small pointer target unless the consumer sizes it (WCAG 2.5.8);
- track click, middle-click autoscroll and drag behaviour reimplemented and never quite native;
- script on every scroll and resize to place and size the thumb (a scroll-driven animation can
  place a thumb with no script, but cannot size it: there is no CSS value for
  `clientHeight / scrollHeight`);
- nothing for assistive technology: the bar is `aria-hidden` in every library that draws one.

And there is no Async React in it: no state the library owns, no action, nothing pending.

The other things Base UI's part offers have platform answers now: overflow-edge fades are a
scroll-driven animation on the scroller in all three engines, and `scrollbar-gutter: stable`
removes the layout shift. The one real accessibility gap in native scrollers is Safari's
keyboard access, and its fix (`tabindex="0"`, a role and a name on scrollers without focusable
content) is a decision about the content that the author makes better than a ResizeObserver.

Recommendation: no part. A docs page "Scroll areas" with the recipe below, written and
verified in three engines by whoever builds the page.

### Recipe draft (not run in a browser)

```css
.scroll-area {
  overflow: auto;
  scrollbar-width: thin;                        /* auto | thin | none */
  scrollbar-color: var(--thumb) transparent;    /* thumb, track */
  scrollbar-gutter: stable;                     /* no shift when content starts to overflow */
  overscroll-behavior: contain;                 /* do not scroll the page at the ends */
}
.scroll-area:hover, .scroll-area:focus-within { scrollbar-color: var(--thumb-strong) transparent; }
```

```html
<!-- Only when the content has nothing focusable: Safari gives a scroller no Tab stop. -->
<div class="scroll-area" tabindex="0" role="region" aria-label="Release notes">…</div>
```

Edge fades without script (the timeline is inactive when nothing overflows, so the registered
properties keep their initial `0px` and no fade is drawn):

```css
@property --fade-start { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --fade-end   { syntax: "<length>"; inherits: false; initial-value: 0px; }
.scroll-area {
  mask-image: linear-gradient(to bottom,
    transparent, #000 var(--fade-start), #000 calc(100% - var(--fade-end)), transparent);
  animation: scroll-fade linear both;
  animation-timeline: scroll(self);
}
@keyframes scroll-fade {
  0%        { --fade-start: 0px;  --fade-end: 2rem; }
  10%, 90%  { --fade-start: 2rem; --fade-end: 2rem; }
  100%      { --fade-start: 2rem; --fade-end: 0px; }
}
```

To check when the page is written: the mask also fades the ends of a classic scrollbar (may
want the mask on a wrapper's pseudo-element instead); `10%` of a short scroll range is a few
pixels (an `animation-range` in lengths is better); a rounded thumb for Chromium and desktop
Safari means choosing `::-webkit-scrollbar-*` **instead of** the standard properties there
(`@supports not selector(::-webkit-scrollbar)` around the standard ones), since the standard
ones switch the pseudo-elements off.

If the user wants a part anyway, the smallest honest one is a single `ScrollArea` element:
the scroller itself, `tabindex="0"` and `role="region"` when it overflows and has no focusable
descendant (measured), and nothing drawn. I do not recommend it: it is a Safari workaround
with a ResizeObserver, against "no fallbacks".

## OTP field: what I went back and forth on

- **One input vs N.** Decided by principle 5 and by Field: one input is `Field.Control`'s
  contract with nothing added. N inputs need a hidden input, a validity mirror and a built-in
  string per input.
- **Visible text with `letter-spacing`** (no drawn caret at all, works without script). Very
  attractive, and dead on three counts: uniform pitch only (no "3 + 3" grouping), monospace
  needed for letters, and WCAG 1.4.12 text-spacing overrides break the alignment.
- **Overtype in `beforeinput` vs in `input`.** `beforeinput` + `preventDefault()` is cleaner
  on desktop but composition events are not cancelable, and a prevented event is an edit the
  Field never hears. Normalising after the fact in `input` keeps every edit a native event.
- **`maxlength`.** Kept by every N-input library (1 per input) and by input-otp. Dropped here:
  it truncates before the filter and blocks the keystroke that should replace the last
  character. `pattern` covers the no-script case.
- **`completeAction` name.** See otp-field.md 3.1. I think the vision's `fooAction` wording
  covers it, but the conventions table has no row, so it is a decision.
- **`whilePending`.** Conventions 2.5.1 says every pure trigger accepts both values. Here an
  ignored activation is a typed code thrown away, so the prop is absent. If the reviewer wants
  the rule kept literally, `"ignore"` could mean "do not run, and keep `aria-disabled` off";
  I do not think it earns a prop.
- **Completion at mount.** A restored value (reload, back navigation) is indistinguishable
  from a typed one. Not running is the safe side. NumberField avoids the question with
  `autocomplete="off"`, which an OTP field cannot use.
- **`submitOnComplete`.** Three of the N-input libraries have `autoSubmit`. It is one line of
  library code and it is where Async React pays off most (the Form's channel: pending, server
  errors on the Field, focus, reset). WCAG 3.2.2 is the argument against a default of `true`,
  not against the prop. Left as decision 4.
- **WebOTP.** BCD now lists Safari 27, so it is Firefox-only missing: an `experimental_` prop
  by conventions 8. Not verified on a device. The keyboard suggestion from
  `autocomplete="one-time-code"` already covers iOS and most Android keyboards, so the flag is
  an extra, not the autofill story.

## Device probes owed before implementation (OTP)

None of these can be answered from documentation:

1. iOS Safari: selection highlight and the selection handles over a transparent-text input
   (`::selection` is not supported there); whether the paste callout and the SMS suggestion
   appear with the proposed inline style; zoom on focus below 16px.
2. Android Chrome with Gboard, `charset="alphanumeric"`: which `inputType`s arrive, whether
   composition ever ends before blur, whether the filter's write at `compositionend` fights
   the keyboard.
3. Autofill events per engine: is there a `beforeinput` before an autofill's `input`?
4. Caret restore after a controlled write in React 19.3 (`setSelectionRange` in a layout
   effect) in three engines.
5. Password managers (1Password, Bitwarden, the built-in ones): where the badge lands on an
   input that covers the row.
6. Forced colours on Windows: `forced-color-adjust: none` keeps the text transparent.
