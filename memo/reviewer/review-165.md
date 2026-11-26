# Review: MultiSelect (#165), feat/165-multi-select @ c23b3ce9, 2026-11-26

Verdict: **merge after fixes** (one real focus/announcement bug in the Field path; the rest minor).

Ran: jsdom all 88 files pass (directives test needs a build first); browser multi-select, combobox,
menu, field, select on Chromium + Firefox pass (WebKit cannot launch here; branch CI green on
all three). typecheck, lint pass.

## Findings

1. **Medium. Double `collectInvalid` for one `invalid` inside a Field with a Field.Error.**
   field-root.tsx:363-366 (capture listener on the validity element, calls collectInvalid with
   source = the select) + multi-select-trigger.tsx:214-218 (own listener, calls collectInvalid
   again with the same source). focus-first-invalid.ts:44 treats a second add for the same
   source as a new attempt and starts a new batch. Probed (temporary browser test, deleted),
   Chromium and Firefox:
   - Field(Field.Control required) above Field(MultiSelect required), both with Field.Error,
     submit: focus ends on the MultiSelect Trigger, not on the first invalid control. Breaks the
     document-order rule of field-form.md 2.5.
   - MultiSelect alone in a Field with Field.Error: the second batch finds focus already on the
     Trigger and calls `ariaNotify("Please select an item in the list.")`, the browser string,
     on top of the Field.Error description read by the focus move.
   Fix: in the Trigger listener skip the collect when the Field already handled it:
   `const handled = event.defaultPrevented; event.preventDefault(); if (!handled && attempt) collectInvalid(...)`.
   Add tests: two invalid Fields in document order (browser, real submit click), and an
   ariaNotify spy for the single-Field case. The existing jsdom Field test passes with the bug.

2. **Low. The anchor positioning of the validity element is dead weight now.**
   multi-select-trigger.tsx:86-105, 279-282. It existed so the bubble pointed at the Trigger;
   with `invalid` always cancelled there is no bubble and no browser focus/scroll to the select.
   The inline `anchor-name` overrides a consumer stylesheet `anchor-name` on the Trigger only
   while `required` is set (developer point 4). Fix: drop `anchor-name`/`positionAnchor` and use
   a plain visually hidden style (position absolute, 1px, clip); update B.10, docs Trigger
   "owned" row, the browser test that asserts the overlay.

3. **Low. `onKeyUp` guard unverified and removes a consumer prop.**
   multi-select-trigger.tsx:53, 259-261. Probe: plain button with Space keydown prevented gets
   0 clicks on keyup in Chromium and Firefox; WebKit not probed. Handlers are composed by
   merge-props, so there is no need to omit `onKeyUp` from the props type (design B.3 does not
   list it). Fix: keep the handler only if WebKit needs it (probe in CI), stop omitting
   `onKeyUp`, and add a browser assertion that Space toggles once.

4. **Low. User navigation during loading is overridden by the pending edge.**
   use-active-option.ts:79 + multi-select-keyboard.ts:61-84, multi-select-option.tsx:152. With
   some options mounted outside the Suspense boundary and a Status inside the List, arrows /
   hover set the active option, then the armed edge replaces it when loading ends. Fix: clear
   `pendingEdgeRef` in `activate`/`move` and the Option pointermove.

5. **Low. `as unknown as Details`** (internal/action/use-multiple-selection.ts:392). Hides any
   mismatch. Narrower: `...(extra as Extra)` in the object literal, then no cast on the result.
   Same for the reset (line 410). Internal only.

6. **Nit. Trigger has no `form` attribute** (multi-select-trigger.tsx:236). The reset listener
   falls back to the Trigger (root.tsx:307-309) whose form owner ignores the Root `form` prop
   when neither `name` nor `required` is given. Fix: `form: ctx.form` on the button.

7. **Nit. `data-placeholder` with function children** (multi-select-value.tsx:78): fine as a
   "nothing chosen" hook, documented and amended. No change.

## Checked, no issue

- Moves to internal/: Combobox behaviour identical (HiddenValues equivalent incl. the empty
  nameless input; duplicate warning text unchanged; loading defaults false; resolver unused).
  Menu typeahead identical (empty item list still consumes the key, Space rule same).
- Field changes: outside listener only when the registered element resolves no validity element
  (only a button does); effect re-run on `control` only re-binds listeners. Field.Label onClick
  only affects a `<button>` control (no other Field control registers a button).
  `focusTargetOf(button)` affects only button controls.
- Select.Root `multiple`: type error, dropped, warned once; select.md 13 and CHANGELOG updated.
- APG: Space/Enter toggle, Tab does not toggle, Alt+ArrowUp closes, aria-activedescendant
  cleared when closed, aria-selected on every option, aria-multiselectable, label names list.
- Docs props tables match the types (Root, Trigger, Value, Option, Popup); skill updated.

