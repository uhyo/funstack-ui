# Working notes: wave 5 research (Toast, Slider, Field/Form), 2026-10-17

Sources / environment:
- BCD 8.1.6 (2026-10-15). chromiumdash stable = 155.0.8059.85 (branch 8059); Playwright Chromium is 156.
- WebKit still cannot launch locally (missing host libs).
- React Aria toast moved into `react-aria` (`dist/private/toast/*.mjs`); `@react-aria/toast` is a
  re-export shim. Base UI is `@base-ui/react` 1.9.0 (`toast/viewport/ToastViewport.mjs`).

Toast findings worth remembering:
- Popover (manual) above a modal dialog: inert, not in Chromium AX tree, even when re-raised.
  WHATWG #9936 open. Portal into topmost `dialog:modal`.
- Sync hide+show of a manual popover keeps focus inside and leaves auto popovers open.
- toast() inside startTransition while another async action pending = held (probe toast-lanes).
- Firefox bug 2082506: Element.ariaNotify no-op in shadow trees (filed 2026-10-16).
- chromestatus: `<rangegroup>` (5199707839266816, Proposed, 2026-09) and step-up/step-down
  invoker commands (5077339740438528, Proposed) - for Slider.

Re-check later:
- WHATWG #9936; screen-reader behaviour of ariaNotify (NVDA/JAWS/Orca) - not measured.

Slider findings:
- React syncs the `value` attribute for controlled value inputs -> form.reset() is a no-op (unlike
  checkboxes). Affects Slider and every controlled text field. Probe 13/react-range-reset.
- Vertical range: Firefox ArrowRight decreases (vertical-lr + rtl), Chromium increases; in
  vertical-lr ltr Chromium Up decreases (visual), Firefox Up increases (logical). Possible interop
  issue to report (human task).
- CDP getFullAXTree `valuetext` property does not reflect aria-valuetext; check Chromium source
  instead (ax_object.cc kAriaValueText).
- WebKit standards-positions summary.json shows #464 interestfor position None (oppose withdrawn);
  chromestatus still says "Negative" - stale.

Field/Form findings:
- React auto-resets after a "successful" useActionState even with returned errors; :user-invalid
  cleared by reset. onSubmit+preventDefault+startTransition(dispatch) avoids reset and still
  sets useFormStatus (react-dom submit plugin path with action null).
- Chromium AX: valueMissing never `invalid`; customError/typeMismatch `invalid` immediately;
  aria-invalid overrides both ways.
- vitest browser runs in Firefox: some real-click submits silently did nothing depending on test
  order (F2, F7 in react-form run). Re-verify surprising Firefox results in isolation or plain
  Playwright before writing them up.
- React 19.3.0 CHANGELOG form items: onReset on auto reset (#35176), submitter (#35590, #29028).
- Re-check: aria-errormessage in VoiceOver macOS; React #29034 / PR #36334 (autoReset).
