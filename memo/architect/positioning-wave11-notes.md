# Architect notes: positioning, wave 11 (#20, #53, #88 RTL), 2026-10-23

Working notes behind conventions 13 and the wave 11 amendments in `design/components/tooltip.md`,
`popover.md`, `menu.md`, `context-menu.md`, `combobox.md` (and one CSS line in `select.md`).
Not a spec; the design docs are.

## Facts relied on (`docs/research/positioning-wave11.md`, probes in `memo/platform-researcher/probes/18-positioning-wave11/`)

1. `getComputedStyle(popup).positionArea` is the **applied** `position-try-fallbacks` option in
   Chromium 156 and Firefox 157 (WebKit by source), synchronously after `showPopover()`, in
   `toggle`, and inside a `scroll` handler. Serialisation is grammar-ordered short logical forms
   (`span-left top`, `self-end span-self-end`, `span-self-x-end bottom`); Firefox writes a
   flipped single keyword as `span-all bottom`.
2. Plain logical `position-area` keywords resolve against the containing block (the root for a
   top-layer popover); `self-*` against the popup's own writing mode. Keyword groups cannot be
   mixed: `block-end span-self-inline-end` is invalid, which is what produced combobox.md's
   "Firefox lacks it".
3. Firefox 2019601: any `position-area` popup whose parent box has a direction different from
   the root's is misplaced along the inline axis, physical keywords included. `anchor()` and
   plain insets are unaffected. No general workaround.
4. Native RTL context menus open to the left of the pointer because the UI locale is RTL
   (Chromium Views, Gecko chrome document, GTK, AppKit); no platform reads the page's `dir`.
5. `self-x-end span-bottom` with `flip-inline` opens a submenu to the right in LTR and to the
   left in RTL, and flips; verified in both engines (RTL page; RTL container in Chromium only).

## Decisions I went back and forth on

- **Same attribute or a new one for the resolved side.** `data-resolved-side` was tempting
  (no behaviour change for existing CSS). Rejected: conventions 4.1 gives a state one name, every
  arrow / gap recipe would need two selectors, and "the side I asked for" is the consumer's own
  prop. Radix and Base UI expose the resolved side under `data-side` too.
- **Where the observer reads.** First plan: `toggle` only. The toggle event is a task after
  `showPopover()`, so one frame could paint with the requested side. A `ResizeObserver`
  observing from mount sees hidden → shown as a 0 × 0 → N resize, delivered after layout and
  before paint, so the attribute lands before the first paint with no change to the
  `showPopover()` call sites (Tooltip's interaction effect and `usePopoverPopup.showPopup`).
  Kept `toggle` as well: it installs / removes the scroll and resize listeners and drives the
  jsdom row (no RO there).
- **`@starting-style` limit.** The starting style is computed at the first style resolution,
  before the RO callback's write; an entry animation keyed on `data-side` starts from the
  requested side on a flipped open. There is no way around it (the resolved side exists only
  after that resolution), so it is documented; the docs' entry recipe keys on opacity and a
  fixed translate.
- **Render cost.** The hook writes state only when the pair changed, so an unflipped open
  costs no render; this keeps Tooltip's "no React work per hover" (its reason for not emitting
  `data-open`). It also terminates any RO loop a consumer's `[data-side]` padding could start.
- **Full grammar or only what we emit.** Parsing only the library's own keywords was simpler,
  but a consumer `style={{ positionArea }}` override is a documented path and should get a
  correct `data-side` too. The parser is total (returns `null`), assumes `horizontal-tb`
  (returns `null` for a vertical `writing-mode`), reads the root's direction lazily only for
  plain `x-*` / `inline-*` tokens.
- **Logical `side` values.** Could have kept the submenu default internal. Added
  `inline-start` / `inline-end` as public `side` values on Tooltip, Popover and Menu: a popup
  "beside the trigger in reading direction" is a real call site, the helper has the cells, and
  the submenu default becomes a nameable value. No `block-*` values: `horizontal-tb` assumed.
- **`state.side` while closed for a logical request.** Honest value (`"inline-end"`) rather than
  an LTR-assumed physical one: the rule stays "resolved while shown, requested otherwise", the
  closed popup is invisible so CSS does not care, and hydration is deterministic.
- **Firefox branch in tests.** `browserName === "firefox"` was the easy branch; a runtime probe
  (`anchorPositionHonoursParentDirection`: an RTL `div` with a physical-keyword popover shown
  against an anchor inside it) is better because Playwright's Firefox may be ahead of the
  release and the day the bug is fixed the row fails by itself.
- **Context menu direction from the popup, not the region or the document.** The popup's
  direction is what lays out the items; the research recommends it; the keyboard already reads
  `getComputedStyle(popup).direction`. Stored in the placement record from `openAt` so the
  Popup's style stays pure and nothing is read in render or on the server.
- **Arrow part.** Conventions resolved question 10 held it "until a component shows it cannot
  be done in CSS on the popup itself". The resolved `data-side` on the Popup makes a `::after`
  arrow correct, so CSS *can* do it; but the user picked #20 "Arrow part" for this wave and the
  part is already designed. Recommended shipping it, with the `::after` recipe documented as the
  zero-markup alternative, and escalated.
- **Native-path listeners.** The hook attaches RO / `toggle` / `scroll` / `resize` through the
  Popup's ref even when `interestfor` is native and the interaction effect attaches nothing.
  Escalated: it touches a product-owner decision, but that decision was about interaction.
- **Combobox `data-side`.** Not added: the Popup has no `side`, no arrow; noted as a follow-up.

## Prior art

- Radix / Base UI: `data-side` is the resolved side (Floating UI's `placement` after flips);
  `align` logical only with a direction provider. React Aria: logical by default.
- CSSWG #13738: the customizable-select picker moved to `self-*` keywords for exactly the
  RTL-control-in-LTR-page case; the Select docs recipe follows it.

## Things to raise later

- A `data-side` (`top` / `bottom`) on `Combobox.Popup` for flipped-listbox styling.
- Chromium's anchored container queries (`@container anchored(fallback)`) as a documented
  consumer recipe for `side={null}`; library use once Gecko and WebKit have a position.
- Layout shifts without scroll or resize are not observed (the next scroll corrects it); a
  Chromium-only exact signal exists (`transitionrun` from an anchored query) and is not built.
- Part B (#21 skip-delay, #88 rest) goes into the same amendment sections once
  `docs/research/interaction-wave11.md` is read.

## Part B (interaction: #21 skip-delay, #88 rest), 2026-10-23

Research: `docs/research/interaction-wave11.md`. Decisions I went back and forth on:

- **Skip-delay without a provider.** React Aria's module-level globals would also work but
  fail across two library copies; the DOM query (`[role="tooltip"]:popover-open`) is stateless
  and is what the native-path CSS checks too, so both paths agree by construction.
- **The selector in the shipped stylesheet.** Conventions 12 (a user decision) allows only
  selector-less at-rules. The native path needs a selector because an inline delay cannot see
  another element. Kept the rule minimal (library marker attribute, one `--fsui-` property) and
  escalated as a user question rather than hiding it under "positioning".
- **Cooldown.** Radix's 300 ms needs a `:root` transition that fights the app's `<html>`
  transition; the plain window (while the previous tooltip shows, 150 ms close delay included)
  covers adjacent controls. Omitted.
- **Dismissal needs movement, not only time.** GTK closes on any release after 500 ms; that
  would close a touch menu on every plain lift (menu above the finger) and a flipped mouse menu
  on a stationary hold. Required movement for both activation and dismissal; time only for
  dismissal.
- **Touch drag ships unverified.** Considered holding it; the failure modes are bounded and a
  plain lift cannot close. Escalated with the device pass as a human task.
- **Touch offset as `--menu-point-gap` inline** with the gap folded into every option, so the
  mouse case computes exactly as before and the consumer knob is a custom property.
- **Eight options, four fallback lists.** Direction × pointer kind, each with two parity
  spellings. Considered one list naming all options; rejected because option order decides the
  flip preference (up before left for mouse, across before down for touch).
- **Wheel guard for every menu** (scoped to the popup element, cheap), close-on-scroll for point
  opens only (anchored menus follow their trigger).
- **CSP.** Hashes exported as a constant with a test that recomputes them (no build step in the
  package); the provider named `CSPProvider` after Base UI, under `@funstack/ui/csp` because it
  is not a part. Per-part `nonce` props rejected once two parts render styles.
- **`nativeMenu` predicate: out.** Not serialisable; `stopPropagation()` is the escape hatch.
- **L1** was already fixed in c6cb71f; folded. **L4** written against the new gesture rules.
