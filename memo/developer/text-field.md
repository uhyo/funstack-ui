# TextField (#181), developer notes

Branch `feat/181-text-field`. Design: `design/components/text-field.md` (accepted b82123c0).

## First steps (text-field.md 14), probed 2026-11-27

Probe file: `packages/ui/src/text-field/probe.browser.test.tsx` (temporary, a bare controlled
React input with a `useState` draft, blur / Enter commit, Escape revert when the draft differs).
Chromium 156 and Firefox 157 locally; WebKit only in CI (host libraries missing here), so the
probe throws its log on WebKit (`PROBE-OUTPUT`) to get it printed. CI run 46000186978.

1. **Blur mid IME composition** (Chromium, CDP `Input.imeSetComposition` "に", then a script
   `blur()`, a real click on a button, a CDP Tab): every time `compositionend` arrives **before**
   `blur` / `focusout`; the composed text was already in the DOM (the last `input` had
   `isComposing: true`, React's onChange heard it), so the blur committed `Savedに` and no draft
   was left. As expected. Firefox, WebKit: not driven (no IME driver).
2. **`type="search"` Escape.**
   - Edited draft, prevented keydown: the native clear does not happen, the revert shows the
     saved text. Chromium, Firefox, WebKit: yes.
   - Untouched field: Chromium clears natively (`input`, value `""`; Firefox too, `input` with
     `inputType: insertReplacementText`), the draft `""` opens, the second Escape reverts. As
     expected (Firefox clears too, which the design did not claim).
   - **WebKit (Playwright 1.64 WebKit 27.2, Linux): no native clear at all.** The untouched
     field keeps "Saved" after the first Escape, no `input`, no `change`; both Escapes are left
     alone. Differs from the expectation ("Chromium and WebKit clear the field").
     WebKit source (`SearchInputType::handleKeydownEvent`, main) clears when
     `keyIdentifier == "U+001B"` with `setValue("", DispatchChangeEvent)`: a **`change`** event,
     not `input` (React's onChange hears both, so a draft `""` would open; a Field listening to
     `input` only would not). Why Playwright's key did not reach it is not known; Safari on
     macOS was not tried.
3. **Undo after a controlled write**: without the write, Ctrl+Z restores the text (all three).
   After an Escape revert, Ctrl+Z does nothing (no event, text unchanged) in Chromium, Firefox
   and WebKit. As expected.
4. **Ellipsis with `field-sizing: content` + `max-inline-size: 80px`**: the input overflows
   (scrollWidth ~300 > clientWidth 80) and a screenshot with `text-overflow: ellipsis` differs
   from one with `clip` in all three engines. As expected.
5. **`useNativeGroupReconciliation` fits** as it stands (read, not yet run): `element` the
   input, `readCurrent` DOM text vs optimistic with the focused-draft adoption, `readDefault`
   clears the draft and returns the computed target, `base` `intendedValue`, `onResetEvent`
   writes `element.defaultValue`. No `onItemMounted` needed (one element, same component).

Stopped after the probes per the lead's instruction (point 2, WebKit differs). The component
draft is in `packages/ui/src/text-field/text-field.tsx` (no tests yet).
