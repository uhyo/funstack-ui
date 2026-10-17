# Select and Combobox: platform features

Research date: **2026-10-17**. Support data from MDN browser-compat-data 8.1.6 (timestamp
2026-10-15), the Chromium `runtime_enabled_features.json5` of the M155 branch (8059) and `main`,
chromestatus, wpt.fyi stable runs (Chrome 155.0.8059.84, Firefox 157.0, Safari 27.0), the WebKit
and Mozilla standards-positions data, Bugzilla (Mozilla, WebKit), the live HTML spec and the
react-dom 19.3.1 source. Behaviour was verified with Playwright probes on Chromium 156, Firefox
157 with default prefs, and Firefox 157 with the customizable-select prefs turned on
(`memo/platform-researcher/probes/11-select-combobox/`). WebKit still cannot launch locally, so
its column comes from BCD, WPT, release notes and bug trackers, not a probe.

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 155 (155.0.8059.85) | 2026-10-06 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Builds on [popover-menu.md](./popover-menu.md) (auto popover stacking, implicit anchor, focus
return, `aria-activedescendant` vs roving focus), [dialog.md](./dialog.md) ("no portals") and
[form-controls.md](./form-controls.md) (controlled native inputs under transitions, form reset,
mount reconciliation). Those findings are not repeated.

## Summary

**Select should be a real `<select>`, progressively enhanced with customizable select.**
Customizable select (`appearance: base-select`, `::picker(select)`, `<button>` +
`<selectedcontent>`, rich `<option>` content, `::picker-icon`, `::checkmark`, `:open`) ships in
**Chrome 135+ and Safari 27.0**. Firefox has it **only behind two prefs**, not even on in Nightly.
The degradation is clean. Firefox already uses the new `<select>` parser (rich option content and
the `<button>` survive parsing), and it renders the ordinary native select with the option text.
The library needs no fallback code for it. The `appearance` opt-in is the consumer's CSS, so the
library ships the markup and needs **no experimental flag**.

A real `<select>` keeps the following for free in every engine:

- form participation;
- `required` and constraint validation;
- autofill;
- typeahead;
- `<optgroup>` and `<hr>`;
- the native accessibility mapping (`combobox` with a popup);
- mobile pickers where the engine uses them;
- **interaction before hydration**, which also makes a Server Component Select possible.

Its limits shape the API:

- **No open state.** There are no `toggle` events, no `hidePicker()`, and `showPicker()` needs
  user activation (and is behind a flag in Safari). So there is no controlled `open` and no
  `openChangeAction`.
- **The picker is a pseudo-element.** A `<ViewTransition>` cannot wrap it, and there is no ref
  to it. Open/close animation is CSS on `::picker(select)`.
- **No interactive content in the picker.** A search field inside it is impossible.
- **Engine-defined keyboard model.**

Combobox needs are out of Select's reach: search, free text, custom filtering, multi-select
chips, very large or virtualized lists, and loading options on open.

**Combobox is an APG combobox built on the existing popover infrastructure.** It uses
`<input role="combobox">` plus a `role="listbox"` `popover="auto"` opened with
`showPopover({ source: input })`. Focus stays in the input and `aria-activedescendant` marks the
active option. The implicit anchor plus `anchor-size(width)` places and sizes the listbox with no
JS. `<datalist>` and the Open UI "customizable combobox" are not usable today. The text input is
the documented case where an **urgent update is mandatory**. Results render from
`useDeferredValue(query)` inside Suspense.

The probes found five problems in React 19.3.1. They affect the design:

1. **SSR'd `<selectedcontent>` breaks hydration in Chromium.** The parser clones the selected
   option into `<selectedcontent>` before React hydrates. React does not expect children there,
   so it throws a recoverable hydration error and **client-renders the whole root**. Workaround
   (verified clean): render `<selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />`.
2. **Options that mount later lose the controlled `value`.** Options revealed by a Suspense
   boundary inside the `<select>` (also `use()` and lazy loading) are not re-synced to `value`
   by React. The first option ends up selected (Chromium and Firefox). The library must
   re-apply the selection when options mount.
3. **A transition-only controlled `<select>` reverts to the old value until the commit.** This
   is the same restore behaviour as checkboxes. `<selectedcontent>` flickers back too. Render
   `value={optimistic}`.
4. **`<selectedcontent>` does not follow React updates to the selected option's content.** This
   is spec-conformant: it updates on selection changes, not on subtree mutations. A label that
   resolves later, or a re-render of the selected option, leaves a stale button until the next
   pick.
5. React's automatic form reset after a `<form action>` also resets controlled selects
   (react/react#30580). This is the same issue as in form-controls.md.

### Verdicts

| Feature | Verdict | Reason |
| --- | --- | --- |
| Real `<select>` as the Select element (form, `required`, validation, typeahead, `<optgroup>`, `<hr>`, mobile pickers, pre-hydration use) | **Adopt** | Universal. |
| New `<select>` parser (`<button>` first child, rich `<option>` content, `<legend>` in `<optgroup>`, `<div>` wrappers) | **Adopt** | Chrome 135, Firefox 150 (bug 1933591), Safari 27. Verified in Chromium 156 and Firefox 157 with default prefs. React 19.3.1 no longer warns about `<button>` in `<select>` (#34804). |
| Customizable select markup (`<button><selectedcontent>`, rich options) rendered unconditionally; `appearance: base-select` left to consumer CSS | **Adopt as progressive enhancement** (no library flag) | Chrome 135, Safari 27.0. Firefox: prefs only (`dom.select.customizable_select.enabled` + `layout.css.appearance-base.enabled`, since 149). Not enabled in Nightly (bug 2069977 NEW). Firefox shows the native select. |
| `<selectedcontent>` (`Select.Value`) | **Adopt, with the hydration workaround** | Chrome 135, Safari 27. Firefox: parsing and updating exist behind the pref (bugs 1974276, 2038588). Mozilla position on `selectedcontent` is *neutral* (#1142). |
| `::picker(select)`, `::picker-icon`, `::checkmark`, `:open` on select | **Adopt** (CSS hooks, document them) | Chrome 133/135, Safari 27 (`:open` 26.5). Firefox: `:open` on select from 154 (bug 2048183). The pseudo-elements are pref-only. |
| `appearance: base-select` for listbox mode (`multiple` / `size > 1`) | **Not yet** | Chrome 145 only. WebKit position: none (#559). Mozilla: positive (#1304). |
| `appearance: base-select` for `<select multiple>` drop-down | **Not yet** | Chromium flag `CustomizableSelectMultiplePopup` is `experimental`. Firefox pref only. No WebKit work beyond bug 312504 NEW. |
| `selectedcontentelement` attribute, `<selectedcontent>` in `multiple` | **Not yet** | Chromium `experimental` flags only. |
| `HTMLSelectElement.showPicker()` | **Not yet** (not needed) | Chrome 121, Firefox 122. Safari: Technology Preview behind a flag. Needs user activation. |
| Controlled `open` / `openChangeAction` / `<ViewTransition>` on the Select popup | **Not possible** with a native select | No events, no close API, no element. |
| APG combobox: `<input role="combobox">` + `role="listbox"` `popover="auto"` + `showPopover({ source })` + `aria-activedescendant` | **Adopt** | All Baseline (popover-menu.md). Verified in Chromium and Firefox: typing keeps focus, clicks on the input do not light-dismiss, Escape closes and is cancelable, nesting in Dialog and Popover works. |
| `Element.ariaActiveDescendantElement` | **Adopt** (optional) | Chrome 135, Firefox 136, Safari 16.4. Safari 27.0 fixed "comboboxes did not forward focus to their `aria-activedescendant`". |
| `min-width: anchor-size(width)` with the implicit anchor | **Adopt** | Verified in Chromium and Firefox (listbox width = input width + border). |
| `Element.ariaNotify()` for "N results" announcements | **Adopt** (optional) | Chrome 141, Firefox 150, Safari 27. |
| `<datalist>` | **Do not use** for Combobox | No styling, browser-defined filtering and display, no rich content. MDN reports a11y gaps (no zoom, NVDA + Firefox silent). |
| Open UI customizable combobox (`<input list>` + `<datalist>` with `appearance: base`, `beforefilter`, `:filtered`) | **Not yet** | Chromium flag `CustomizableCombobox` is `experimental` (depends on `AppearanceBase`, also experimental). chromestatus: Proposed, no Gecko or WebKit signal. |

## Support table per engine

| Feature | Chrome | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| `appearance: base-select` (single drop-down) | 135 | 149 behind 2 prefs | 27 | Chromium's new UA styles (CSSWG #14256) are `experimental` (`CustomizableSelectNewUAStyles`). Safari 27.0 already ships the new design. Default looks differ across engines. |
| `appearance: base-select` listbox (`multiple`, `size>1`) | 145 | – | – | |
| `appearance: base-select` multi drop-down (`multiple size=1`) | flag (experimental) | 149 behind prefs | – | |
| `<selectedcontent>` / `HTMLSelectedContentElement` | 135 | – (pref) | 27 | Chrome 150: every descendant `<selectedcontent>` updates. `SelectedcontentSpec2` stable from M156. |
| `::picker(select)` | 135 | – (pref) | 27 | |
| `::picker-icon`, `::checkmark` | 133 | – (pref) | 27 | |
| `:open` (select) | 133 | 154 (bug 2048183; BCD's 136 is `<details>`/`<dialog>`) | 26.5 | |
| New select parser (`<button>`, rich content, `<div>`) | 134/135 | 150 | 27 | |
| `<hr>` in `<select>` | 119 | 122 | 17 | Not in the AX tree with native appearance. Chromium base-select exposes `separator`. |
| `HTMLSelectElement.showPicker()` | 121 | 122 | TP (flag) | |
| `<datalist>` (text) | 20 | 4 | 12.1 | `showPicker()` for datalist: Chrome 99, Firefox 149, Safari TP. |
| Mobile and desktop parity of select rendering modes | 142 | – | – | `size>1` gives an in-page listbox on Android. `multiple` without `size` gives an in-page listbox. |
| `ariaActiveDescendantElement` | 135 | 136 | 16.4 | |
| `ariaNotify()` | 141 | 150 | 27 | |
| `field-sizing` | 123 | 152 | 26.2 | |

Standards positions:

| Feature | WebKit | Mozilla |
| --- | --- | --- |
| Customizable select | support (#386) | positive, "compatibility" concern (#1060) |
| Relaxed select parser | support (#414) | positive (#1086) |
| `selectedcontent` | – | neutral (#1142) |
| Base appearance for listbox | none (#559) | positive (#1304) |
| Base appearance for multi drop-down | – | positive (#1349) |
| `selectedcontent` in `multiple` | – | none (#1420) |
| `showPicker()` for select | support (#258) | positive (#886) |
| Customizable combobox | no issue found | no issue found |

WPT stable, `html/semantics/forms/the-select-element/customizable-select/`: Chrome 224/244,
Firefox 79/239 (default prefs), Safari 144/247. Safari fails these tests: picker animations and
`@starting-style` (`select-picker-animations`, `select-picker-starting-style`,
`select-picker-exit-animation`, `picker-icon-animation`), most `*.optional` keyboard and mouse
tests (possibly partly harness limits), and several `selectedcontent-*` mutation tests.

## Findings

### 1. Customizable select: status and degradation

**Chromium (Chrome 135+).** Full single-select drop-down. Listbox mode since 145. The
multi-select drop-down, `selectedcontentelement`, `selectedcontent` in `multiple`, the new UA
styles and `appearance: base` for other controls are `experimental` flags on `main`.

**WebKit (Safari 27.0).** Ships single-select customizable select:

- `appearance: base-select`, `::picker(select)`, `::picker-icon`, `::checkmark`,
  `<selectedcontent>`, rich `<option>` content, `<button>` in select;
- the CSSWG's newer default styles.

Open WebKit work:

- "Customizable `<select>` part 2" (325123);
- `<selectedcontent>` update timing (325898);
- optgroup base rendering (312387);
- multi drop-down (312504);
- listbox (304004).

iOS/iPadOS presentation of a base-select picker is **not documented** (WebKit blog, WWDC26
session 315). Since WPT `customizable-select/button-in-popover.html` runs on the iOS bots
(bug 321701), the picker is probably in-page on iOS too. This needs a device check (open
question 6).

**Gecko (Firefox 158).** Customizable select is behind
`dom.select.customizable_select.enabled` and `layout.css.appearance-base.enabled` (BCD: since
149):

- Meta bug 1944403 has 29 of 68 dependencies open.
- "Enable base select in Nightly" (2069977) is NEW and was filed 2026-09-07.
- A11y support (2041789: combobox accessibles, "dialog role if content is invalid") is in
  review.
- The UA-style bugs (1974785, 20699xx series) are open.

No shipping milestone is known. With the prefs on, Firefox 157 renders the picker, but its
**keyboard model is the native one**: arrows change the value even while open, Enter does not
open, and Tab leaves the picker open. That is a different model from Chromium's.

**Degradation in Firefox with default prefs (probed):**

| | Result |
| --- | --- |
| Parsing | `<button>`, `<selectedcontent>`, `<span>` in options and `<legend>` in optgroup all survive. `<selectedcontent>` is an `HTMLElement` and stays empty. |
| Rendering | Native select. The `<button>` is not rendered. The option text is shown, including any icon text (option `label` was `"OOrange tangy"` for an option with an `aria-hidden` icon "O"). |
| Value, form, validation, reset | Identical to Chromium. |
| Keyboard | Native: arrows and typeahead change the value while closed (`input` + `change` per step). Enter does nothing. Space or Alt+Down opens the native popup. |

Consequence: the visible text of an option must still make sense as plain text. This is
WebKit's "golden rule": always keep text content, mark decorative icons `aria-hidden` /
`alt=""`, and keep icons out of the text, or give the option a `label` attribute. The `label`
attribute has its own problem in Chromium (next section), so prefer clean text content.

### 2. Accessibility mapping (Chromium 156, CDP)

The full tree is in `select-ax.output.txt`.

- **The select maps to `combobox`, `hasPopup="menu"`, `expanded`.** The popup is
  `MenuListPopup` with `option` children, the same as a native select. The value is the
  selected option's name. The `<button>` and `<selectedcontent>` do not add nodes.
- **Option names come from content.** `aria-hidden` icons are excluded ("Orange tangy").
- **Inconsistent `label` attribute.** For `<option label="L1">Content1</option>`, the option is
  named "L1", but the combobox value (and `<selectedcontent>`) shows "Content1". With rich
  content and a `label` attribute, the option took its name from content instead. Do not mix
  them.
- **`<optgroup>`** maps to `group`, named while open. **`<hr>`** maps to `separator` (BCD: native
  appearance does not expose it).
- **Disabled options** are `disabled=true` and not focusable.
- **`required` + empty value** is exposed as `invalid=true` immediately, before user
  interaction.
- **Focus while open is real DOM focus on the `<option>`.** `document.activeElement` is the
  option, the select fires `blur` on open and `focus` on close, and `activedescendant` is set on
  the popup. This is the spec's "run the focusing steps on option". Firefox (pref) and native
  selects keep focus on the select.
- **Listbox mode** (`multiple size=3`, base-select) maps to `listbox multiselectable` with
  `activedescendant`.

Firefox's a11y for base-select is unfinished (bug 2041789). WebKit's is unverified.

### 3. Native `<select>` behaviours to preserve (all probed, unless noted)

| Behaviour | Native `<select>` | APG listbox on popover would need |
| --- | --- | --- |
| Form participation (`name`, `form`, FormData) | Yes, also before hydration | A hidden input mirror |
| `required` → `valueMissing` with a `value=""` placeholder option | Yes ("Please select an item in the list.") | `setCustomValidity` on a focusable mirror. Hidden inputs are barred from validation. |
| `:user-invalid` after interaction | Yes (spec: "send select update notifications" sets user validity) | Manual |
| `form.reset()` → `defaultSelected` | Yes. `<selectedcontent>` updates too. | Manual |
| Autofill (`autocomplete`) | Yes | No |
| Typeahead | Closed (Chromium base-select and native): typing selects at once and fires `input`/`change` per match. Open (Chromium): typing moves focus, Enter commits. | JS |
| Keyboard open/commit | Chromium base-select: Enter, Space, ArrowDown open. Arrows/Home/End move. Enter/Space/click commit. Escape or Tab close **without** committing, and focus returns to the select. | JS |
| `<optgroup>` (+ `<legend>` rich label), `<hr>` | Yes | `role=group` / `separator` |
| `hidden` options skipped | Chromium, Firefox: yes, in keyboard and picker. WebKit ignores `hidden` on native-appearance selects (bug 255335). With base-select it works unless author CSS sets `display` on options. | Manual |
| `multiple` | Native listbox everywhere. Styled only in Chrome 145. | Full JS |
| Mobile pickers | iOS wheel/menu and the Android picker for native appearance. Chrome Android renders the base-select picker in-page. iOS with base-select is unknown. | In-page only |
| Pre-hydration interaction | Works. React does not touch the select's value at hydration (react-dom 19.3.1 `hydrateInstance` only validates), so a pre-hydration pick stays in the DOM, and the library needs **mount reconciliation** as in form-controls.md. | Dead until hydration |

### 4. React 19.3.1 integration (vitest browser mode, Chromium 156 and Firefox 157)

Outputs: `react-select.output.txt` and `react-select-2.output.txt`.

**Controlled value under transitions.**

| Variant | Right after the pick | While pending | After commit |
| --- | --- | --- | --- |
| `value={state}`, `setState` in an async transition | **reverted to old** (`<selectedcontent>` too) | old | new |
| `value={optimistic}` (`useOptimistic`, set in the transition) | new | new | new |

The cause is the same as for checkboxes: `restoreControlledState` → `updateOptions(props.value)`
runs after the event. **Render `value={optimistic}`.** This is the radio-group rule from
form-controls.md.

**Options that mount later.** `<select value="c">` whose options are revealed by
`<Suspense>` + `use()`:

- after the reveal, `select.value` is `"a"` (the first option) in both engines and both
  appearances;
- this is the same with a disabled fallback option, an enabled one, or `null`;
- `updateOptions` runs only in the select's own commit, so a re-render from the select's parent
  works, but a Suspense reveal inside the select does not.

React closed a related report (#17826) as expected behaviour for `defaultValue`. No open issue
covers the controlled case. **The library must re-apply the selection when options mount.** For
example, each `Select.Option` sets `option.selected = true` in a layout effect when it matches
the optimistic value. `selected` as a prop draws a React warning, so this goes through a ref.

**`<selectedcontent>` and React.**

- **Client render works.** The element is cloned on insertion and on every selection change.
  React never touches its children.
- **SSR + hydration in Chromium fails.** The parser has already cloned the option into
  `<selectedcontent>`, so hydration finds unexpected children. The result is a recoverable error
  "Hydration failed because the server rendered HTML didn't match the client", the whole root is
  client-rendered (new `<select>` node), and in dev nothing else is logged. Firefox is fine,
  because nothing is cloned there.

  | Hydration variant | Chromium result |
  | --- | --- |
  | `<selectedcontent />` | **root re-rendered** |
  | `dangerouslySetInnerHTML={{ __html: "" }}` | hydrates. Dev-only "attributes didn't match" error. |
  | `suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }}` | **hydrates, no error**. Later picks still clone. |
  | Button text rendered by React from state (no `<selectedcontent>`) | hydrates. The button no longer updates before hydration. |

- **Stale `<selectedcontent>`.** Updating the text inside the selected `<option>` (React
  re-render, or a Suspense boundary inside the option resolving) does not refresh
  `<selectedcontent>` in Chromium. The spec updates it on selection changes, on parser pops and
  on insertion/move of the `<selectedcontent>`, not on option subtree mutations. In Chromium 156,
  `select.value = select.value` or re-inserting the `<selectedcontent>` forces a refresh, and
  `option.selected = true` does not. Rich option content that loads asynchronously therefore
  needs a library refresh, or must be rendered before the option is selectable.
- **DOM nesting warnings** for `<button>` in `<select>` and `<span>` in `<option>` are gone in
  19.3.1 (`validateDOMNesting` now only rejects `input`, `caption` etc. under `select`). The
  issue #33038 is still open but stale. `Cannot infer the option value of complex children`
  remains: **always pass `value` to options.**
- **Form reset.** React's automatic reset after `<form action>` resets a controlled select to
  `defaultSelected` (react/react#30580, open). Use the same `reset` listener as Checkbox/Radio.

### 5. Select architecture: real `<select>` vs APG listbox on Popover

| Criterion | Real `<select>` (+ base-select) | APG select-only combobox on `popover` |
| --- | --- | --- |
| JS-free / Server Component | Works fully: pick, submit, validate. With the hydration workaround, `<selectedcontent>` works pre-hydration. | Trigger opens via `commandfor`, but there is no selection without JS |
| Form + validation + autofill | Free | Mirror input. Validation is awkward. No autofill. |
| Mobile | Platform pickers | Custom in-page UI everywhere |
| Accessibility | Native mapping, engine-tested | Library-maintained. APG-conformant if done well. |
| Look in Firefox | Native (until Firefox ships) | Identical everywhere |
| Async options (Suspense) | Works in the picker (fallback option), with the selection re-apply fix. **Cannot load "on open"**: no open event. | Free: library-owned open in a transition |
| `valueAction` in a transition, optimistic | Works with `value={optimistic}` (probe B). The browser changes the DOM first, React keeps it. | Works; library owns everything |
| Controlled `open`, `openChangeAction`, VT on open/close | Not possible | Possible |
| Rich content, groups, separators | Yes (Chromium/Safari), text fallback in Firefox | Yes |
| Search in popup, free text, creatable, multi-select chips, virtualization | No | Belongs to Combobox anyway |
| Keyboard model | Engine-defined and different across engines | Library-defined, identical |
| Code size and bug surface | Small | Large (typeahead, focus, positioning, validation, mobile) |

Recommendation: **Select = real `<select>`.** Everything a Select-only combobox can do that a
native select cannot (controlled open, open animation through VT, load on open, identical
cross-engine keyboard) is either cosmetic or belongs to Combobox. The native path gets form
semantics, mobile and JS-free use. Those are the reasons the vision prefers the platform. Firefox
users get a working native select, which is degradation, not a library fallback.

API consequences for the architect:

- **No `Select.Popup` element and no `open` state.** Expose the `:open` pseudo-class in docs.
  Optionally mirror it to `data-open` through `focus`/`blur` heuristics, but there is no reliable
  event, so do not promise it. No `transition` prop for open/close. CSS on
  `::picker(select):open` with `@starting-style` works in Chromium and fails WPT in Safari.
- **Parts map to elements:**

  | Part | Element |
  | --- | --- |
  | `Select` | `<select>` |
  | `Select.Trigger` | `<button>`, first child, `type="button"`; content model forbids interactive content |
  | `Select.Value` | `<selectedcontent>` with the hydration workaround |
  | `Select.Option` | `<option value>` |
  | `Select.Group` | `<optgroup label>` + optional `<legend>` |
  | `Select.Separator` | `<hr>` |

  `::picker-icon` and `::checkmark` are pseudo-elements, not parts.
- **Value is library-owned, with residual browser paths:** pre-hydration picks (mount
  reconciliation), form reset, and Firefox form-state restoration. The same vocabulary as
  RadioGroup (`value` / `defaultValue` / `valueAction`).
- **`multiple`.** Native `<select multiple>` is a listbox (styled only in Chrome 145). A styled
  multi-select drop-down does not exist anywhere stable. Leave multi-select to Combobox or a
  later Listbox.
- **Pending state.** `data-pending` on the `<select>` while `valueAction` runs. `disabled` while
  pending would drop the value from form submission, so do not disable.

### 6. Combobox

**APG pattern.** Editable combobox with list autocomplete:

- DOM focus stays on the input, and `aria-activedescendant` points to the active option;
- the input has `aria-expanded`, `aria-controls` and `aria-autocomplete="list"`;
- the popup is `role="listbox"`, the implicit `aria-haspopup` value;
- Down/Up move the active option, Enter accepts, Escape closes (and optionally clears),
  Alt+Down opens without moving, and printable keys type.

Choose manual vs automatic selection per instance. Roving focus does not apply here. That is the
Menu rule, and popover-menu.md already set Combobox aside for `aria-activedescendant`.

**Platform behaviour of `<input>` + `popover="auto"` listbox opened with
`showPopover({ source: input })`.** Chromium 156 and Firefox 157 behaved identically:

| Case | Result |
| --- | --- |
| Open on `input`/`click` by script (no activation needed) | Opens. Focus stays in the input. Typing continues. |
| Placement `position-area: block-end span-inline-end` + `min-width: anchor-size(width)` | Listbox top = input bottom, same left edge, width = input width + border. No JS. |
| Click the input while open | Stays open. Clicking the `source` does not light-dismiss. |
| Click an option | **Focus moves to `<body>`** (input blurs) unless `pointerdown` is `preventDefault()`ed. With it, focus stays in the input. |
| Escape | Closes, focus stays in the input. With `keydown` `preventDefault()`, the popover **stays open**, so the library can own Escape (APG "clear if already closed"). |
| Tab while open | Focus moves past (options are not focusable), and **the popover stays open**. The library closes it on `focusout`. |
| `popover="manual"` | Never light-dismisses (outside click leaves it open). Not recommended: `auto` gives outside click, nesting and Escape for free. |
| Inside a modal `<dialog>` / inside an auto Popover | Works. Escape closes only the listbox. The dialog or popover stays open. |
| Chromium AX | `combobox "Fruit" autocomplete=list hasPopup=listbox expanded=true activedescendant=o2 controls=lb`; the active option is `selected`. |

**`<datalist>`.** Rejected for Combobox:

- no styling of the list;
- the browser decides filtering and display (Firefox shows the label, Chrome and Safari show
  value plus label);
- no rich content, groups or async control;
- MDN notes that the list does not zoom, cannot be styled for high contrast, and NVDA + Firefox
  do not announce it;
- `showPicker()` for datalist is missing in Safari stable.

It would only make sense as a JS-free fallback (`<input list>` before hydration). That is not
recommended, because it means two different UIs.

**Platform proposals.** The Open UI combobox explainer (updated 2026-08-12) keeps `<input list>`
+ `<datalist>`. With `appearance: base` on both, the datalist becomes a popover, the browser
filters (`search="startswith|includes|pattern"`), `beforefilter` is cancelable for script
filtering, and the pseudo-classes are `:filtered` and `:active-option`. Focus stays in the input.
Status: Chromium flag `CustomizableCombobox` is `experimental`, chromestatus says "Proposed" with
no other-vendor signals, and no positions were filed. **Not yet.** Its vocabulary (author
filtering vs browser filtering, active option) is a good naming guide.

**Async / Suspense filtering.**

- **The input is urgent.** "Transition updates can't be used to control text inputs"
  (react-async-apis.md). The query state is a plain `useState` updated synchronously. This is
  the vision's documented urgent opt-out.
- **Results render from `useDeferredValue(query)`.** Option lists that suspend (`use(search(q))`)
  keep showing the previous results while the new ones load, and fall back only on the first
  load. Stale state is `query !== deferredQuery` → `data-stale` / `aria-busy` on the listbox.
- **No out-of-order results** with this pattern: React renders only the latest deferred value,
  and a cache keyed by query makes earlier promises harmless. Avoid "await fetch then setState"
  inside async transitions. Updates after `await` need their own `startTransition`, and their
  order is not guaranteed.
- **`aria-activedescendant` must be revalidated when the list changes.** If the active option
  unmounts, reset it to none or to the first option (automatic selection). Keep ids stable per
  value.
- **Announcements.** `ariaNotify("5 results")` (Baseline since Safari 27) instead of a live
  region, debounced on settled results.
- **Selection.** `valueAction` in a transition with `useOptimistic`, as Select. Form
  participation needs `<input type="hidden" name value={optimistic}>` for the selected value. The
  visible input can carry its own `name` for free text. A "must pick from the list" constraint
  is `setCustomValidity` on the visible input.

### 7. Anchor positioning, top layer, stacking (Select and Combobox)

The select picker is the spec's "select popover": `show popover` runs with the select as
invoker, so it is an **auto popover nested under the select's own popover ancestor**. Probed in
Chromium 156 and Firefox 157 with the pref:

- **Select inside an auto Popover / Menu.** Opening the picker keeps the popover open. Escape
  closes only the picker, and a second Escape closes the popover.
- **Select outside an open auto popover.** Opening it **closes that popover**, like any unrelated
  auto popover.
- **Inside a modal `<dialog>`** (Chromium). Escape closes only the picker, and the next Escape
  closes the dialog. Do not portal, as before.
- **Placement.** The UA anchors `::picker(select)` to the select with anchor positioning, so
  consumers override `position-area` / `position-try-fallbacks` on `::picker(select)`. Safari
  27 fixed a wrong picker position when the select itself is anchor-positioned.
- **Combobox.** Uses the same rules as Menu (`source` → nested stacking and implicit anchor).
- **WebKit hang risk.** Bug 302008 (`position-try` on a **nested** popover hangs, NEW) applies to
  a Select picker or Combobox listbox opened inside a Popover/Menu. Watch the first WebKit CI
  runs.

## Engine and harness differences tests must branch on

| Gap | Engines | Test strategy |
| --- | --- | --- |
| Customizable select missing | Firefox (default prefs) | Branch on `CSS.supports("appearance", "base-select")`, a new `supportsBaseSelect` in `engine.ts`. Assert native degradation: `<selectedcontent>` empty, value/form/validation identical. |
| Focus while the picker is open | Chromium: on the `<option>`, select gets `blur`/`focus`. Firefox (pref) and native: stays on select. | Never assert `activeElement === select` while open. Assert `:open` and the value. Library focusout logic must ignore focus moving into its own options. |
| Keyboard model | Chromium base-select: arrows move focus while open, commit on Enter/Space/click. Firefox/native: arrows commit immediately, Enter does not open. | Test the library contract (one `valueAction` per committed change, optimistic value), not the engine's key mapping. Use `selectOption`/`value` + `change` for value tests. |
| Native popup opened by mouse | Firefox native dropdown is not in the page. A headless click did not even match `:open`. | Do not pointer-open native selects in Firefox. |
| `<button>` in select `.type` | Chromium 156 returns `"submit"`; the spec and Firefox (bug 2064013, fixed 156) return `"button"`. No submission happened in Chromium. | Render `type="button"` explicitly. Do not assert `.type`. |
| `<selectedcontent>` not refreshed on option content change | All (spec) | Assert the **library** refresh, if one is added. |
| `<selectedcontent>` hydration | Chromium, Safari (clone at parse) | Hydration test with the workaround must report no recoverable errors in every engine. |
| Picker animation | Safari 27.0 fails picker `@starting-style` / exit WPT | Never wait on picker animations. |
| `hidden` options | WebKit ignores it on native-appearance selects (bug 255335) | Do not filter Select options with `hidden`. Filtering is Combobox. |
| Safari WPT failures on `*.optional` keyboard/mouse tests | WebKit | Likely partly harness. Expect Playwright-WebKit differences in picker keyboard handling. Assert outcomes, not keystroke sequences. |
| Clicking an option steals focus from the combobox input | All | The library `preventDefault()`s `pointerdown` on options. Test that focus stays in the input. |
| Combobox popover stays open on Tab / blur | All | The library closes it. Test in every engine. |
| Nested `position-try-fallbacks` hang | WebKit 302008 | Select or Combobox inside Popover/Menu in WebKit CI: watch for timeouts. |
| Playwright WebKit (27.2 trunk) vs Safari 27.0 | WebKit | As before: feature checks over `browserName`. |

## Recommendations

### Select

- **Element.** Render `<select>` with `name`, `required`, `form`, `disabled` and `autoComplete`
  passed through. Set `value={optimistic}` and `onChange` → `valueAction` in a transition.
- **Anatomy.**
  - `Select.Trigger` → `<button type="button">`, first child.
  - `Select.Value` → `<selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />`.
  - `Select.Option` → `<option value>`, always with `value`, and with plain text content that
    works as the Firefox fallback.
  - `Select.Group` → `<optgroup label>` with an optional `<legend>`.
  - `Select.Separator` → `<hr>`.
- **No experimental flag.** The markup is valid and degrades everywhere. Document the opt-in CSS
  (`select, ::picker(select) { appearance: base-select }`), `::picker-icon`, `::checkmark` and
  `:open`.
- **Library fixes for React.**
  - Re-apply the selection when options mount (Suspense-loaded options): set
    `option.selected` in a layout effect from the optimistic value.
  - Refresh `<selectedcontent>` when the selected option's content commits
    (`select.value = select.value`, or re-insert). Alternatively, document that option content
    must be static once rendered.
  - Add a `reset` listener on the form owner.
  - Do mount reconciliation for pre-hydration picks.
- **Async options.** Supported by rendering a fallback `<option disabled>` inside Suspense.
  "Load on open" is not supported, so preload, or use Combobox.
- **No `open` state, no open/close VT.** Value-change VT: open question 4.

### Combobox

- **Markup.**
  - `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls
    aria-activedescendant autocomplete="off">`.
  - `<div role="listbox" popover="auto">`, placed in the DOM right after the input. Open it with
    `showPopover({ source: input })`, from the library, on `input` / ArrowDown / Alt+Down /
    optional click.
  - Options: `<div role="option" id aria-selected>`, not focusable, with `pointerdown`
    `preventDefault()`.
- **Placement.** `position-area: block-end span-inline-end; position-try-fallbacks: flip-block;
  min-width: anchor-size(width)` (inline style, as in Tooltip/Menu).
- **Library JS.**
  - Active-option management (Down/Up/Home/End, wrap optional).
  - Enter accepts. Escape is owned by the library (`preventDefault` on `keydown`): first close,
    then optionally clear.
  - Close on `focusout`.
  - Revalidate `aria-activedescendant` when options change.
  - Optional `ariaNotify` result counts.
- **Async.**
  - Query: urgent `useState`, exposed as `inputValue` / `inputValueChange` (the urgent opt-out
    API the vision anticipated).
  - Results: consumer-rendered `Combobox.Option`s, under `useDeferredValue` + Suspense, with
    `data-stale` while `inputValue !== deferredInputValue`.
  - Selection: `valueAction` in a transition with `useOptimistic`, plus a hidden input for
    `name`.
- **Not used.** `<datalist>`, the Open UI customizable combobox, roving focus.

## Open questions for the architect

1. **Select anatomy and ownership.** Confirm "no `open` state" for Select. Should Select expose
   a best-effort `data-open`, or only document `:open`?
2. **Should `Select.Value` exist as a part**, given the hydration workaround? The alternative is
   the library rendering the selected label into the trigger itself, which loses the
   pre-hydration update and rich-content cloning.
3. **Async option content.** Refresh `<selectedcontent>` automatically, or forbid changing the
   content of a selectable option?
4. **ViewTransition on Select value change.** The browser mutates `<selectedcontent>` during
   React's commit. Is an `update` VT around the trigger worth supporting? Not probed.
5. **Combobox API split.** Select-like Combobox (value from a list) vs free-text Autocomplete
   (value = text). Is there one component with `allowCustomValue`, or two? How does the urgent
   `inputValue` look in the action-prop vocabulary (it cannot be an action)?
6. **iOS base-select presentation** needs a device check (Playwright WebKit does not emulate iOS
   pickers). It affects whether docs recommend `@media (pointer: fine)` around the opt-in CSS.
7. **Multi-select.** Defer to a later Listbox/Combobox `multiple`. Native styled multi drop-down
   is not shipping anywhere.

## Corrections to earlier research

- [modern-platform-survey.md](./modern-platform-survey.md) marks customizable select as "flag".
  The markup degrades to a working native select, and the opt-in is consumer CSS, so the library
  needs no flag. It is progressive enhancement (this doc).
- The survey says `<select multiple>` base appearance is "✗ (proposed)" in Blink. Listbox mode
  (`multiple` or `size>1`) shipped in **Chrome 145**. Only the multi-select *drop-down* is still
  experimental.
- The survey says Firefox parses rich `<select>` content from 153. The parser change landed in
  **Firefox 150** (bug 1933591). `<selectedcontent>` parsing in 152 is pref-gated with the rest.
- The survey lists `HTMLSelectElement.showPicker()` in Safari as "TP". It is still Technology
  Preview **behind a flag** (BCD).

## Upstream issues to track (do not file; listed for a repo issue)

- React: SSR'd `<selectedcontent>` causes a hydration failure and a full client re-render in
  Chromium/Safari (no issue found; human task to report). The workaround is in this doc.
- React: a controlled `<select value>` is not re-applied when options mount inside a Suspense
  boundary in the select (no open issue; #17826 closed for `defaultValue`).
- react/react#30580 (controlled select reset by automatic form reset), #33038 (nesting warnings;
  fixed in 19.3 by #34804, issue still open), #33804 (PR, superseded).
- Chromium: `<button>` first child of `<select>` reports `type === "submit"` (spec: `"button"`).
  Also: the option's AX name uses the `label` attribute while the combobox value uses the content.
  No tracker entries found; human task.
- Firefox: 1944403 (meta), 2069977 (enable in Nightly), 2041789 (a11y), 1974785 (UA styles).
  With the pref on, Tab leaves the picker open.
- WebKit: 325123 (part 2), 325898 (`selectedcontent` update timing), 255335 (`hidden` options),
  312504 / 304004 (multi / listbox), 302008 (nested `position-try` hang); standards-positions
  #559.
- Open UI combobox explainer; Chromium `CustomizableCombobox` flag.

## References

- HTML Standard, the `select` element (content model, select popover, pick an option, focusing
  steps, `selectedcontent` update steps, `button` type in select):
  https://html.spec.whatwg.org/multipage/form-elements.html
- CSS Form Control Styling Level 1: https://drafts.csswg.org/css-forms-1/
- WebKit, "WebKit Features for Safari 27.0": https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- WebKit, "News from WWDC26: WebKit in Safari 27 beta": https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/
- WebKit, "The golden rule of customizable select": https://webkit.org/blog/18117/the-golden-rule-of-customizable-select/
- WWDC26 session 315, "Rediscover the HTML select element": https://developer.apple.com/videos/play/wwdc2026/315/
- chromestatus: customizable select 5737365999976448; listbox 6222145025867776; multi drop-down
  5070067395067904; mobile/desktop parity 5412736871825408; customizable combobox
  5067156794507264; new UA styles 6270612585709568; `selectedcontent` cloning 5863985044914176.
  https://chromestatus.com/
- Chromium `runtime_enabled_features.json5` (M155 branch 8059 and `main`):
  https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- MDN browser-compat-data 8.1.6: https://github.com/mdn/browser-compat-data
- MDN `<datalist>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/datalist
- MDN customizable select guide: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select
- WAI-ARIA APG, Combobox pattern (incl. select-only combobox): https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- Open UI, Combobox explainer: https://open-ui.org/components/combobox.explainer/
- WebKit standards-positions (#386, #414, #532, #559, #258): https://github.com/WebKit/standards-positions
- Mozilla standards-positions (#1060, #1086, #1142, #1274, #1304, #1349, #1420, #886): https://mozilla.github.io/standards-positions/
- Bugzilla: 1944403, 1974787, 1974276, 2038588, 2069977, 2041789, 1933591, 2064013: https://bugzilla.mozilla.org/
- WebKit bugs: 325123, 325898, 255335, 312387, 312504, 304004, 321701, 302008: https://bugs.webkit.org/
- wpt.fyi, the-select-element (stable): https://wpt.fyi/results/html/semantics/forms/the-select-element?label=stable
- React: react/react#33038, #33804, #34804, #30580, #17826; react-dom 19.3.1 source (`updateOptions`,
  `restoreControlledState`, `hydrateInstance`, `validateDOMNesting`).
- Probes and outputs: `memo/platform-researcher/probes/11-select-combobox/`
