# Wave 23: HoverCard / PreviewCard (#166) and Select `multiple` (#165)

Research date: **2026-11-26**. Part of #162. Builds on
[popover-anchor-tooltip.md](./popover-anchor-tooltip.md),
[popover-menu.md](./popover-menu.md), [select-combobox.md](./select-combobox.md) and the
Tooltip, Popover and Select designs (`design/components/tooltip.md`, `popover.md` 2.9,
`select.md` 13). This doc covers only what is new or has changed since then.

Stable engines on the research date (BCD 8.1.10, timestamp 2026-11-19; chromiumdash):

| Engine | Stable | Date | Next |
| --- | --- | --- | --- |
| Blink | Chrome 158 | 2026-11-17 | 159 early stable since 11-18, stable 12-08 |
| Gecko | Firefox 160 | 2026-11-10 | 161 beta |
| WebKit | Safari 27.2 | 2026-10-26 | 27.3 beta (2026-11-16) |

What the labels mean: **verified** = checked today against a primary source (spec PR text,
Chromium source or runtime flags file, BCD JSON, bug tracker REST, vendor release notes) or
measured by a probe. **Inferred** = my reading or forecast. The probes ran in Playwright
Chromium 156.0.8078.4 and Firefox 157.0 (headless, Linux). WebKit does not launch on this
machine, so WebKit rows come from sources only. Scripts and outputs are in
`memo/platform-researcher/probes/21-wave23/`.

## Summary and verdicts

| Feature | Verdict |
| --- | --- |
| HoverCard on the Popover machinery: `<a href>` Trigger, Popup right after it, JS hover / focus with delays (cross-engine) | **Adopt** |
| `interestfor` on the HoverCard Trigger (native hover, focus, long-press and lost interest in Chromium) | **Adopt behind experimental flag**. Still Chromium-only. The spec PR is still open, and WebKit and Gecko have implementation bugs (both NEW / UNCONFIRMED) |
| `popover="hint"` for the HoverCard popup | **Adopt behind experimental flag** until Safari 27.3 is stable. It is in the 27.3 beta release notes. Then **adopt** it as the type |
| `popover="auto"` for the HoverCard popup | **Not recommended**. Opening the card on hover closes any unrelated open menu, select picker or combobox (verified in Chromium and Firefox) |
| `::interest-button` (touch affordance) | **Not yet**. The runtime flag is `experimental` in M156, M158, M159 and main, and the pseudo-element does not render. BCD's "Chrome 149" is wrong |
| Customizable `<select multiple>` drop-down (`multiple size=1` + `base-select`) | **Not yet**. Chromium has only an `experimental` flag and no intent to ship. The spec PR has been open since 2026-01. Gecko has prefs only. WebKit has no position and its bug is NEW |
| `base-select` listbox (`<select multiple>` in page) | **Not yet** as the base of Select `multiple`. It is Chrome 145+ only, and native listboxes in Firefox and Safari need Ctrl/Cmd-click to select more than one option |
| Select `multiple` built on Combobox's listbox machinery as a select-only combobox (button + `aria-multiselectable` listbox in a popover) | **Adopt** (recommended option, decision for the user) |

**HoverCard recommendation.** Build it as a thin variant of Popover in library mode, with
Tooltip's two-mechanism shape:

- **Baseline.** JS hover and `:focus-visible` focus with open/close delays.
  `showPopover({ source })`, so the card is anchored to the trigger and nested correctly.
  JS Escape and outside-pointerdown. The card stays open while the pointer or focus is inside it.
- **`experimental_interestFor`.** The platform does all of that in Chromium, adds long-press, and
  the library steps aside. Popover 2.9 already handles the lost-interest hide.

Use `manual` as the baseline type and `hint` behind a flag, as Tooltip does. Drop the flag
when Safari 27.3 ships. Render the Popup immediately after the Trigger. Unlike Radix and
Base UI, the card is then reachable by keyboard in every engine, as the platform intends (see
"Keyboard"). Content must still be supplementary. Do not put `aria-describedby` on the
trigger. Touch users get nothing except Chromium long-press on the flagged path.

**Select `multiple` recommendation.** Do not wait for the platform; a styled multi-select
drop-down will not be in all three engines in 2027 (inferred). Do not build it on a native
`<select multiple>` listbox either. Build it on the Combobox `multiple` machinery (#164) as an
APG select-only combobox with a multi-select listbox. This is a different implementation from
today's native-`<select>` Select, so it is an **API design decision**: either `Select.Root
multiple` with a different internal path, or a separate part (for example a Combobox without
an input, or a `MultiSelect`). Decide with the user (#165 asks for that).

---

## Part 1: HoverCard / PreviewCard (#166)

### 1.1 `interestfor` status per engine

| | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| `interestfor` on `<a href>`, `<area href>`, `<button>` | 142 (BCD) | no. Bug 1984699 UNCONFIRMED (last change 2026-11-14); WPT `html/semantics/interestfor/` runs in Gecko CI (intermittent bug 2097865, 2026-11-25) | no. Bug 297786 NEW (last change 2026-03-30) |
| `interest-delay(-start/-end)`, `:interest-source`, `:interest-target`, `InterestEvent` | 142 | no | no |
| `::interest-button` | **not shipped**: `HTMLInterestForInterestButtonPseudo` is `experimental` on M156 (8078), M158 (8127) and main; `CSS.supports("selector(::interest-button)")` is true in 156, but a rule with `content` renders nothing (probe `interest-button.mjs`). BCD says 149; that is wrong | no | no |
| Standards position | (author) | **neutral**, "concerns: use cases" (#1181, closed; discussion active 2026-11-24) | **none**: oppose withdrawn 2026-06-02, issue #464 open (labels: accessibility, device independence, usability, portability) |
| Spec | whatwg/html PR #11006 **open**, actively edited (last commits 2026-11-24). ARIA / HTML-AAM mapping PR w3c/aria#2617 open | | |
| Interop | Not in Interop 2026. Proposed for the next cycle (#1358, open, updated 2026-11-13) | | |

All rows verified. Chromium spec-alignment changes are coming: `InterestForSpecAlignment` is
`stable` on main but not on the M159 branch, so it lands in **M160** (stable 2027-01-05). The
spec PR adds rules the library should know about (verified in the PR diff):

- **Focus return does not re-grant interest.** When a popover hides and focus returns to an
  invoker whose `interestfor` names that popover, the invoker's "suppress next focus interest"
  is set. Focus moving back from the card to the link does not re-open the card. This is the
  same rule the Popover design applies by hand in 2.9 (it skips the Trigger focus fallback after
  a lost-interest hide).
- **Long-press** on a touch device: a `<button>` gains interest at once (UA style
  `button[interestfor] { user-select: none }`). An `<a>` or `<area>` gets an optional "show
  interest" item in the touch context menu, unless `contextmenu` was cancelled. This is
  *explicit interest*: no delay, and de-hover or blur does not end it.
- **Author guidance (added 2026-11-24, after Mozilla's review):** do not put `interestfor`
  aimed at a *rich* target on an element that also opens a popover or disclosure on
  activation (`commandfor` + a popover command, or `popovertarget`), or that already has an
  explicit `aria-expanded`. If an author does, the interest invoker wins over the command
  invoker for the implicit `aria-expanded` / `aria-details`, and an explicit `aria-expanded`
  wins over both. **This affects the API**: Popover 2.9's "hover to preview, click to pin" (a
  Trigger that has both `commandfor` and `interestfor`) is now against spec guidance when the
  popup is rich. A HoverCard Trigger should be a link, or a button that does not open
  anything on click.
- Authors should not move focus in response to `interest` / `loseinterest` (or `autofocus` in
  the target). Content that needs significant scrolling (maps, large tables) does not belong
  in an interest target.

**Default delays changed (correction).** Chromium's `normal` was **0.5 s / 0.25 s** through
M156 and is **0.25 s / 0.15 s** since M157. Verified from `kDefaultInterestDelay*Seconds` in
`element.h` on branches 7444 (M142) to 8078 (M156), and 8103 (M157) to 8154 (M159). The probe
measured about 503 ms with `normal` in Chromium 156. Earlier research and the Tooltip design
quoted 0.25 / 0.15 for M142. That figure was wrong then and is right now. Tooltip always renders
explicit inline delays, so nothing breaks.

### 1.2 What the platform does with an interactive target (Chromium probe)

Probes: `hovercard.mjs`, `ax-focus.mjs`, `nested.mjs`. The page has an `<a href interestfor>`
and a card containing a link, a button and a `<select>`.

| Behaviour | Result (Chromium 156) |
| --- | --- |
| Keyboard focus (Tab) on the link | Card opens after the start delay. Focus stays on the link |
| Tab while the card is open | Focus goes **into the card** (first link, then the button). This holds even when the card is at the end of `<body>`, far from the link in the DOM: the shown popover is placed right after its invoker in sequential focus order. After the card's last focusable, Tab continues after the invoker |
| Shift+Tab back to the link | Card stays open |
| Escape | With focus on the link: the card closes and focus stays on the link, with no re-open. With focus inside a `hint` card: the card closes (`nested.mjs`, script-opened card). Focus return after an interest open with focus inside was not probed |
| Focus leaves both link and card | Card closes after the end delay (`loseinterest`, then `toggle` closed) |
| Hover the link, then move into the card | Opens. Moving into the card keeps it open. Leaving both closes it after the end delay |
| An unrelated `popover="auto"` menu is open, then the link is hovered | `hint` card: menu stays open. `auto` card: **menu closes** |
| `<select>` picker or `popovertarget` menu (auto) opened inside a `hint` card | Picker or menu opens, card stays open (Chromium and Firefox, `nested.mjs`) |
| Card type `manual`, Escape with focus inside the card | Nothing (`manual` has no close request). The JS path must handle it |

**AX tree (CDP, Chromium 156).** Plain target (text only): the card text becomes the link's
**description**. Rich target (contains a link, heading or button): the link gets a **`details`**
relation to the card, and **no `expanded` state**. The card itself is `group` with no name.
Its role is not `tooltip`, despite the explainer. With an explicit `role="dialog"
aria-label`, the card is `dialog "…" modal=false`. An explicit `aria-describedby` on the link
adds the card's name as the description and keeps `details`. (Verified only on Chromium 156;
M160's spec-alignment changes may change some of this.)

**What the explainer says the platform should do** (Open UI explainer, updated 2026-11-02):

- Partial interest (an earlier keyboard mode) **was removed**. Focus shows interest after the
  delay, and focus moving into the target keeps it.
- A rich hint gets `aria-details`, `aria-expanded` on the invoker, and a minimum role of
  `tooltip`.
- Plain-vs-rich is decided by the content, not by the popover type.

Chromium 156 implements `details` but not `aria-expanded` or the `tooltip` role (verified as
above).

### 1.3 `hint` vs `auto` vs `manual` for a hover card

| Type | Engines | Opening the card | Escape / outside click | Nested menu or picker inside | Verdict |
| --- | --- | --- | --- | --- | --- |
| `hint` | Chrome 151, Firefox 153, **Safari 27.3 beta** (BCD "27.3", 27.3 beta release notes "Added support for `popover=hint`") | Never closes open `auto` popovers. Closes other non-ancestor hints, so it replaces an open tooltip | Native | Works (verified Chromium and Firefox) | Target type. Flag until Safari 27.3 is stable (Safari 27.2 treats it as `manual`) |
| `auto` | All | **Closes any unrelated open auto popover** (menu, select picker, combobox listbox); verified in both engines | Native | Works | Reject: hovering a link must not close the user's open menu |
| `manual` | All | Closes nothing | JS (Tooltip's handlers) | Works | Baseline, the same as Tooltip |

This matches Tooltip's decision 4. Popover's Popup is `dialog[popover="auto"]`, so a
HoverCard on the Popover machinery needs the popover type as an internal option. The open
state, `openChangeAction`, Suspense on open and pending state can stay shared.

### 1.4 Prior art: Radix HoverCard and Base UI PreviewCard

Verified from the libraries' docs and published sources (Radix `@radix-ui/react-hover-card`
1.2.1 `dist/index.mjs`; Base UI `@base-ui/react` 1.9.0 `preview-card/*`):

| | Radix HoverCard | Base UI PreviewCard |
| --- | --- | --- |
| Stated audience | "For sighted users to preview content available behind a link." "Intended for sighted users only, the content will be inaccessible to keyboard users." "Ignored by screen readers." | "Preview card content is not touch, keyboard or screen reader navigable." The link stays the only accessible interface; put the same information on the destination page |
| Trigger | `<a>` | `<a>` |
| Delays | `openDelay` 700, `closeDelay` 300 | `delay` 600, `closeDelay` 300 |
| Focus | Opens on any `focus` (no delay) and closes on `blur` | Opens on focus after `delay` (floating-ui `useFocus`) |
| Keyboard into the card | **Prevented**: every tabbable inside the content gets `tabindex="-1"` | Not managed. The popup is portalled and has `tabIndex=-1`, so Tab from the link goes to the next element in the page, not into the card |
| Touch | Pointer handlers ignore `pointerType === "touch"`. `touchstart` on the trigger is `preventDefault()`ed | Hover is `mouseOnly` |
| ARIA | None on trigger or content | None (no `useRole`). Dismiss on Escape and outside press |
| Pointer travel | Grace via close delay | `safePolygon()` |

Other prior art: GitHub hover cards (changelog 2024-07-29) let a keyboard user press
**Alt+ArrowUp** on a focused link to open the card and move focus into it. Escape returns to
the link. The community discussion calls the shortcut hard to discover.

**Is "hidden from keyboard and AT" acceptable?** Under WCAG it is defensible **only if** the
card is purely supplementary: everything in it, including actions such as "Follow", is also
reachable through the link's destination (2.1.1 Keyboard is then met by the destination).
WCAG 1.4.13 (Content on Hover or Focus) still applies to whatever does appear: it must be
dismissible without moving the pointer or focus (Escape), hoverable (pointer can move into it)
and persistent. My recommendation (inferred) is to follow the platform rather than Radix:

- **Open on `:focus-visible` focus** after the same delay as hover (Tooltip does this). Tab
  then enters the card in every engine because the Popup sits right after the Trigger in the
  DOM. That is the behaviour Chromium's `interestfor` gives natively, so the flagged and
  unflagged paths agree.
- **Never disable the card's tabbables** (Radix's approach). The platform does not, and doing
  so would make actions in the card unreachable.
- **Known cost:** a keyboard user who pauses on a link longer than the delay must Tab through
  the card's content to reach the next link. Mozilla raised Tab-speed heuristics in #1181
  (2026-11-24) without a resolution. A HoverCard with heavy interactive content is the wrong
  tool; such content needs a click Popover.
- **AT:** no `aria-describedby` (the card is not the link's description, #166). On the flagged
  Chromium path the platform adds `details`. On the JS path the library could set
  `aria-details` on the trigger while the card is open, which matches what Chromium does.
  `aria-expanded` on a link would announce "collapsed" on every user link. The HTML-AAM PR
  (#2617) still proposes it, and Chromium does not implement it. **Do not add `aria-expanded`
  until #2617 settles.** Popup role: none required. A consumer can pass `role="dialog"
  aria-label` (verified: Chromium exposes a non-modal dialog). Library default: open question
  for the architect.

### 1.5 Touch

- **Chromium (flagged path):** long-press on a link offers a context-menu item that shows the
  card; long-press on a button shows it at once (spec PR, explicit interest). Verified in the
  spec text. Chromium on Android has supported long-press since 142 (earlier research). Not
  probed on a device.
- **iOS Safari, Firefox Android, JS path:** no hover. Ignore `pointerType === "touch"`, as
  Tooltip, Radix and Base UI do. A tap follows the link. No library long-press: it would fight
  the native link context menu and differ from the platform's explicit interest.
- `::interest-button` would be the touch answer (the TAG asked for it to show by default on
  hover-less devices). Not shipped (1.1).

### 1.6 Fallback for engines without `interestfor`

This is Tooltip 2.2 with three changes:

1. **Focus inside the card keeps it open.** Listen for `focusin` / `focusout` on the Popup.
   Losing focus to outside both Trigger and Popup starts the close timer. Tooltip cannot have
   focus inside, so it lacks this.
2. **Outside `pointerdown` closes; a pointerdown inside the card does not.** Tooltip closes on
   any pointerdown, which would make the card's buttons unusable.
3. **Escape** closes and `preventDefault()`s while open (Tooltip's handler), with focus left on
   the Trigger or returned to it when focus was inside the card. Do not re-open on that focus
   return: the spec's "suppress next focus interest" rule, already implemented by hand in
   Popover 2.9.

Everything else (delays, warm-up skip, `showPopover({ source })`, anchor positioning,
`@starting-style`) is shared. Feature detection is unchanged:
`"interestForElement" in trigger && trigger.hasAttribute("interestfor")`.

---

## Part 2: Select `multiple` (#165)

### 2.1 Platform status per engine

| Feature | Chromium | Firefox | WebKit | Source |
| --- | --- | --- | --- | --- |
| `base-select` single drop-down | 135 | prefs only (`dom.select.customizable_select.enabled` + `layout.css.appearance-base.enabled`), since 149. Enable-in-Nightly bug 2069977 NEW (2026-11-02); meta 1944403 NEW, 70 deps | 27.0 | BCD, Bugzilla |
| `base-select` listbox (`<select multiple>`, `size>1`) | 145 | – | – (bug 304004 NEW, last change 2025-12-18) | BCD, WebKit REST |
| `base-select` **multi drop-down** (`multiple size=1`) | flag `CustomizableSelectMultiplePopup` = `experimental` on M156, M158, M159 and main; chromestatus 5070067395067904 "Proposed", no intent | 149 behind the same prefs (BCD); Gecko bug 2032593 UNCONFIRMED | – (bug 312504 NEW, last change 2026-04-23) | flags file, chromestatus, BCD |
| `<selectedcontent>` in `multiple` | flag `SelectedcontentMultiple` = `experimental` (depends on the above) | – | – | flags file |
| Spec, multi drop-down | whatwg/html PR #12069 "Define base appearance for select multiple drop-down" **open** (approved by one editor 2026-06-04, last activity 2026-08-23); fixes #12049. HTML-AAM: w3c/aria#2771 | | | GitHub |
| Spec, `selectedcontent` in `multiple` | whatwg/html #12342 open, "needs implementer interest"; Chromium is prototyping (2026-11-05), and Anne van Kesteren has an implementation in progress (2026-10-21) | | | GitHub |
| Standards positions, multi drop-down | – | positive (#1349) | **none** (#609 open) | GitHub |
| Standards positions, listbox | – | positive (#1304) | **none** (#559 open) | GitHub |
| Interop | Customizable single select was **not selected** for Interop 2026 (#995). Re-proposed for the next cycle (#1393) | | | GitHub |
| Close/OK button in a multi picker | Open UI #1217 closed (2026-05-04) | | | GitHub |

Recent WebKit work is all on single select: Safari 27.2 added `::field-content`, and 27.3 beta
fixes drag-to-pick, several `<selectedcontent>` behaviours and CSP. Nothing for multiple
(release notes, verified).

**Is a styled multi-select drop-down coming soon?** (inferred) Chromium could ship it in
2027 once #12069 lands; the code and WPT (`customizable-select-multiple-popup`) exist. Firefox
first has to ship customizable select at all; it is not even on in Nightly. WebKit has taken
no position. Under the vision's policy it would be an experimental-flag feature for at least
all of 2027, and a single-engine one for most of it.

### 2.2 What native `<select multiple>` does today (probe `select-multiple.mjs`)

| | Chromium 156 native | Chromium 156 `base-select` | Firefox 157 native |
| --- | --- | --- | --- |
| `<select multiple>` (no size) | in-page listbox (`listbox multiselectable`). **A plain click replaces the selection**; Ctrl/Cmd-click toggles. ArrowDown moves the selection; Space does nothing | in-page listbox. **A plain click toggles.** ArrowDown moves focus only; Space toggles | in-page listbox. A plain click replaces the selection (as in Chromium native) |
| `<select multiple size=1>` | **a drop-down with a picker** that toggles on click and stays open (AX `combobox hasPopup=menu`, `MenuListPopup`), but not styleable: `SupportsBaseAppearance` is false for a multi menulist without the flag | the same picker (flag off, so not base appearance) | a one-row listbox |

Source for the Chromium row: `HTMLSelectElement::UpdateUsesMenuList()` on M156 ("the same
regardless of the platform: `<select multiple size=1>` MenuList (popup)", part of the Chrome
142 desktop/mobile parity change) and `SupportsBaseAppearanceInternal()`. Safari macOS was not
probed. iOS renders `<select multiple>` as a button that opens the system picker (27.3 beta
fixes its button text).

The conclusion: a native multi-select gives a consistent, styleable drop-down in no engine
combination. Its mouse model even differs between Chromium base-select and everything else.

### 2.3 Options

| Option | Engines and look | Keyboard / a11y | Forms, no-JS | Effort, risk |
| --- | --- | --- | --- | --- |
| **A. Wait** for `multiple size=1` + `base-select` | Chromium flag only today. Realistically 2027+ for one engine, later for three (inferred) | Native (combobox + multi listbox; HTML-AAM PR #2771) | Native form value and `required`. Works before hydration | No work now; nothing to ship for #165 |
| **B. Native `<select multiple>` listbox**, alone or inside a Popover | Styled only in Chrome 145+. Firefox and Safari show a native listbox; iOS shows a native button and picker even inside a popover | Native listbox semantics. Plain click replaces the selection outside Chromium base-select. Most users do not know Ctrl/Cmd-click | Native form value. Works without JS (in a `commandfor` Popover too) | Low code, but a poor and inconsistent UX. Not a "Select" drop-down |
| **C. Select-only combobox with a multi-select listbox, on Combobox `multiple` (#164)** | Identical everywhere. Fully styleable. Popup is `popover="auto"` + anchor positioning (Combobox's) | APG: `button`/`div` with `role="combobox"` + `aria-haspopup="listbox"`, a `role="listbox" aria-multiselectable="true"` popup, `aria-activedescendant` (focus stays on the trigger), Space/Enter toggles, the popup stays open while picking. Library-owned and testable; matches React Aria `Select selectionMode="multiple"`, Base UI `Select multiple` and Headless UI `Listbox multiple` | One hidden `<input name>` per value, or a hidden `<select multiple>` for `required` validation and native form reset. **No JS: nothing works** (the trigger can open the popover through `commandfor`, but picking needs JS) | Medium. Shares Combobox's listbox, option, active-descendant, async and `string[]` value code (`details.added` / `removed`, select.md 13). Loses native mobile pickers |
| **D. C now, swap to the native element later** under the same API | C everywhere, then a real `<select multiple size=1>` once all engines ship | Changes keyboard model and focus behaviour at the swap (Chromium base-select moves DOM focus into the picker; select-combobox.md) | Hidden inputs, then native | Only if C's API is limited to what a native select can also do: no controlled `open`, no `Select.Popup` props, no `<ViewTransition>` on the popup |

**Recommendation: C.** It is the only option that gives a styled, accessible multi-select in
all three latest stable engines. It reuses #164 instead of a third listbox implementation, and
it is the shape the surveyed libraries with a multi-select Select ship (React Aria and Base UI
verified today; Headless UI `Listbox multiple`, Ark UI and Ariakit from the #162 survey). B fails the "great accessibility and
modern" bar in two of three engines. A is not a plan for 2027.

API questions for the architect and the user (these change the API):

- **Name and home.** `Select.Root multiple` would put two unrelated implementations behind
  one component: today's Select is a real `<select>` with native forms, pre-hydration picks and
  native mobile pickers (select.md); this one is a JS listbox. Alternatives are
  `Combobox` without an `Input` (Combobox 13 already lists a "searchable select" variant), or
  a dedicated part. Keeping the real-`<select>` Select single-only makes the
  progressive-enhancement story honest.
- **D-compatibility.** If the user wants a later swap to native, C's public API must avoid
  what a native select cannot do (controlled `open`, popup `transition`).
- **Value display.** `<selectedcontent>` in `multiple` is experimental (#12342). A
  `Value` render prop over `string[]` (Base UI's "first + N more", React Aria's TagGroup) is
  library-side either way.
- **Form participation.** Hidden inputs (Combobox has one today) or a hidden `<select
  multiple required>` mirror. The mirror gives `required` and form reset natively (React Aria
  uses a hidden select). Decide together with #164.

---

## Corrections to earlier research

- [popover-anchor-tooltip.md](./popover-anchor-tooltip.md) says Chromium's `normal` interest
  delays are 0.25 s / 0.15 s. They were **0.5 s / 0.25 s for M142 to M156** and are 0.25 s /
  0.15 s since M157 (1.1).
- The same doc's "rich hint" description (minimum role `tooltip`, `aria-expanded` on the
  invoker) is not what Chromium 156 exposes. It exposes `details` only, and the target is a
  nameless `group` (1.2).
- BCD 8.1.10 lists `::interest-button` as Chrome 149. The flag is `experimental` through main,
  and the pseudo-element does not render in 156 (1.1).
- The `interestfor` + `commandfor` combination ("hover to preview, click to pin",
  popover-anchor-tooltip.md "Invoker Commands as a tooltip trigger"; Popover 2.9) now goes
  against the spec PR's author guidance when the popup is rich (1.1).

## Upstream items (do not file; for a repo issue, human task)

- **BCD:** `css.selectors.interest-button` should be `false` (or a flag) for Chrome. The
  runtime flag `HTMLInterestForInterestButtonPseudo` is `experimental` on M156 to M159 and main.
- **Chromium:** the rich-hint mapping in 156 has `details` but no `expanded` and no `tooltip`
  role, which differs from the explainer and the HTML-AAM PR #2617. Re-check after M160
  (`InterestForSpecAlignment`) before reporting.
- Track: whatwg/html #11006 (interestfor), w3c/aria #2617; Bugzilla 1984699, WebKit 297786;
  whatwg/html #12069 and #12342, w3c/aria #2771; WebKit 312504, 304004; Gecko 2032593, 2069977;
  Interop proposals #1358 and #1393.

## References

- whatwg/html PR #11006, "Add the `interestfor` attribute" (open; commits to 2026-11-24): https://github.com/whatwg/html/pull/11006
- w3c/aria PR #2617, interestfor mappings (open): https://github.com/w3c/aria/pull/2617
- Open UI, Interest Invokers explainer (updated 2026-11-02): https://open-ui.org/components/interest-invokers.explainer/
- Mozilla standards position #1181 (neutral; 2026-11-24 discussion): https://github.com/mozilla/standards-positions/issues/1181
- WebKit standards position #464 (open, no position): https://github.com/WebKit/standards-positions/issues/464
- Bugzilla 1984699: https://bugzilla.mozilla.org/show_bug.cgi?id=1984699 ; 2097865: https://bugzilla.mozilla.org/show_bug.cgi?id=2097865
- WebKit bug 297786: https://bugs.webkit.org/show_bug.cgi?id=297786
- Interop proposals #1358 (interest invokers), #1393 (customizable select), #995 (not selected for 2026): https://github.com/web-platform-tests/interop/issues/1358 , https://github.com/web-platform-tests/interop/issues/1393 , https://github.com/web-platform-tests/interop/issues/995
- Chromium `runtime_enabled_features.json5` (branches 8078 / 8127 / 8154, main): https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- Chromium `element.h` / `element.cc` (interest delays, `InterestGained` / `InterestLost`): https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/dom/element.cc
- Chromium `html_select_element.cc` M156 (`UpdateUsesMenuList`, `SupportsBaseAppearanceInternal`): https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/core/html/forms/html_select_element.cc
- chromiumdash (stable 159.0.8154.34 early stable; M159 schedule): https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=159
- chromestatus 5070067395067904 (multi drop-down, "Proposed"), 6222145025867776 (listbox, 145): https://chromestatus.com/feature/5070067395067904
- MDN browser-compat-data 8.1.10 (2026-11-19): https://github.com/mdn/browser-compat-data
- Safari 27.3 beta release notes (2026-11-16; `popover=hint`, select fixes): https://developer.apple.com/documentation/safari-release-notes/safari-27_3-release-notes
- Safari 27.2 release notes (2026-10-26): https://developer.apple.com/documentation/safari-release-notes/safari-27_2-release-notes
- whatwg/html PR #12069 (multi drop-down base appearance, open): https://github.com/whatwg/html/pull/12069 ; issue #12049: https://github.com/whatwg/html/issues/12049 ; #12342 (`selectedcontent` in multiple): https://github.com/whatwg/html/issues/12342
- w3c/aria PR #2771 (HTML-AAM for multi drop-down): https://github.com/w3c/aria/pull/2771
- Standards positions: Mozilla #1349, #1304; WebKit #609, #559: https://github.com/mozilla/standards-positions/issues/1349 , https://github.com/WebKit/standards-positions/issues/609
- Bugzilla 1944403, 2069977, 2032593, 2041789; WebKit 304004, 312504, 325123
- Open UI #1217 (OK/Cancel in a multi picker, closed): https://github.com/openui/open-ui/issues/1217
- Radix HoverCard docs: https://www.radix-ui.com/primitives/docs/components/hover-card ; source `@radix-ui/react-hover-card@1.2.1`
- Base UI Preview Card docs: https://base-ui.com/react/components/preview-card ; source `@base-ui/react@1.9.0` `preview-card/`
- Base UI Select (`multiple`): https://base-ui.com/react/components/select ; React Aria Select (`selectionMode`): https://react-aria.adobe.com/Select
- GitHub changelog, keyboard navigation for hovercards (2024-07-29): https://github.blog/changelog/2024-07-29-keyboard-navigation-improvements-for-hovercards/ ; feedback: https://github.com/orgs/community/discussions/133986
- WCAG 2.2, 1.4.13 Content on Hover or Focus: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- WAI-ARIA APG, Combobox (select-only) and Listbox (multi-select): https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ , https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- Probes: `memo/platform-researcher/probes/21-wave23/` (`hovercard.mjs`, `ax-focus.mjs`, `nested.mjs`, `timing.mjs`, `interest-button.mjs`, `select-multiple.mjs`, `experimental-check.mjs`, `bisect.mjs`)
