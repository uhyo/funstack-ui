# Review: OTPField (#171), branch feat/171-otp-field @ 59995614

Verdict: **merge after fixes** (findings 1-3). Design, filter and a11y are sound.

Ran: `pnpm --filter @funstack/ui build`, jsdom + jsdom-isolated (99 files, 4612 tests, pass),
browser `src/otp-field` on Chromium and Firefox (33 pass, 1 skipped: the Chromium-only AX row;
WebKit not installed here, branch CI green), `pnpm lint`, `typecheck`. Three throwaway probes
(deleted, not committed) confirmed findings 1-3.

## Findings

1. **High. WebOTP request re-issued on every render, and live again after a manual completion.**
   `useActionTrigger().run` is a new function each render, so `complete`
   (otp-field-root.tsx:343-365), `webOTPCode` (542-555) and `change` / `compositionEnd` change
   identity every render; the WebOTP effect (otp-field-input.tsx:171-192) depends on
   `webOTPCode`, so it aborts and calls `navigator.credentials.get` again on each keystroke.
   Probe: click + 4 digits = 6 `get` calls, and after the code was completed by hand one request
   is still live (the render after `complete()` aborted it re-created it). Design 8 says manual
   completion aborts the request; a late SMS would now overwrite the typed code and re-run
   `completeAction` / `submitOnComplete`. Fix: effect keyed on `experimentalWebOTP` only, read
   `webOTPCode` through a latest-ref; keep a "done" ref set by `complete()` so no new request
   starts after a completion; or make `run` stable (store it in a ref in the Root). Add a jsdom
   row: `get` called once across typing, no live signal after completion.
   Same root cause also re-attaches all native listeners every render
   (otp-field-input.tsx:135-159). Harmless but wasteful; goes away with the same fix.

2. **Medium. `submitOnComplete` blocked by a stale Field `validate` result.** Field.Root's
   capture `input` listener (field/field-root.tsx:356) runs `validate` on the browser's
   pre-filter text and sets custom validity; the Root's React `onChange` then writes back and calls
   `requestSubmit()` synchronously (otp-field-root.tsx:362) before `useFieldValueChange`
   re-validates in the layout effect. Probe: `Field validate={v => /^\d{4}$/.test(v) ? null :
   "4 digits"}`, paste `12 34`: value `1234`, submit never fires (invalid). Also hits rule-5
   overtype at the end of a complete code (DOM holds 7 chars at validate time). Fix: before
   `requestSubmit()`, when inside a Field call `fieldContext.notifyChange(true)` (sync refresh on
   the written DOM), or defer the submit to a layout effect after the commit. Add the probe as a
   test.

3. **Medium. Slots can become the pointer target; the docs' own CSS triggers it.** A Slot that
   forms a stacking context (`position`, `opacity < 1`, `transform`, `filter`, an animation of
   those) paints after the positioned Input in tree order and takes the hit test. The docs and
   playground dim Slots while pending (`packages/docs/src/examples/otp-field.css:66-68`,
   `packages/example/src/otp-field-demo.css:54-55`); probe in Chromium and Firefox:
   `elementFromPoint` over a Slot with `opacity: .6` is the Slot. So clicking a box while pending
   neither focuses nor moves the caret. The docs caveat (OTPFieldPage.tsx:337) covers only
   `position`. Answer to "z-index inline?": prefer **`pointer-events: none` as an owned inline
   style on the Slot** (otp-field-slot.tsx:344), which matches design 1 ("never the pointer's
   target") and creates no stacking context. `z-index: 1` on the Input alone would lift it over
   the page's later `z-index: auto` positioned content (sticky headers, in-page dropdowns) unless
   the Root also gets `isolation: isolate`. Then drop the docs caveat and add a browser row with
   a dimmed/positioned Slot. Record as an amendment of design 6 (owned keys).

4. **Low. Completion during an open composition.** otp-field-root.tsx:400-408 completes (and
   `submitOnComplete` submits) from derived text while the IME has not committed; an Escape that
   cancels the composition leaves an action run for text that is gone, and a submit posts the raw
   composing text (full-width digits from a Japanese IME fail `pattern`). Design 4.1 chose this
   for Gboard, so not a blocker: at least skip `requestSubmit` while composing, and list the
   cancel case among the owed device checks. Firefox's order (compositionend, then a final
   `input` with `isComposing: false`) is not scripted in the non-Chromium branch of the browser
   test; applyEdit falls back safely by inspection, but a row would pin it.

5. **Low. `valueRef` desync with a controlled parent that ignores an edit.**
   otp-field-root.tsx:330 sets `valueRef.current = next` before the parent decides; if it does
   not re-render, the layout effect never resets it, and the next edit's `changed` compares with
   a value that was never rendered. Set it only when uncontrolled, or reset it in the edit path
   from the rendered value.

6. **Low. Stale wording in the design doc.** design/components/otp-field.md:262 "(proposed)" and
   :272 "Open decision 3 in the changelog": decided; rules-only doc should say so.

7. **Nit.** `propsRef` (otp-field-root.tsx:313): acceptable, the codebase already names
   `useLatest` results `*Ref` (two other `propsRef`, `selectedRef`, `shownRef`, ...); add a
   one-line comment on why. The Chromium-only AX row uses `it.runIf` (reported as skipped
   elsewhere); fold it into a test that branches, like the forced-colours row.

## Checked and fine

- Lanes: text urgent (`callUrgentHandler`, no transition; tested with a held transition),
  `completeAction` in `useActionTrigger`'s transition with types, every completion runs, not at
  mount / hydration / reset / controlled change / disabled / read-only (all tested).
- Conventions 2.1 `<event>Action` row is sound; consider adding that `<event>` must not be a
  state name, so it cannot be used to dodge `<state>ChangeAction`.
- Filter: charset incl. full-width digits, cut to length, overtype, rule 5, paste-replaces
  (rule 2), selection replace, rule 3a restores text and selection, deletion fallback, caret
  write-back in the input event (browser-tested). Diffing by before-selection prefix/suffix is
  robust; odd shapes fall back to rule 6.
- Forms: name/form/required/derived pattern on the one input, no maxlength, reset adopts the
  computed target (and `defaultValue` written in the reset event): correct; the Combobox reset
  defect noted in the changelog should get an issue in this repo.
- A11y: one textbox named by label / Field.Label / aria-label, Slots `aria-hidden`, unnamed
  warning, forced-colour probe, WCAG 3.2.2 callout on the docs page and in the prop doc.
- Developer deviations (Input calls `useFieldControl`, `onChange` omitted, run found by diffing,
  raw text while composing, selection read on focus/select/keyup): all sound.
- Docs props tables match the types; skill line accurate; exports and action-naming list updated.
