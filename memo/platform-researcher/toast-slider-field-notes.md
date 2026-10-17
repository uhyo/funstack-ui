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
