# Field/Form probes (2026-10-17, wave 5)

Chromium 156.0.8078.4 and Firefox 157.0 (Playwright 1.64.1), React / react-dom 19.3.1. WebKit
cannot launch locally.

- `react-form.browser.test.tsx` (+ `react-form.output.txt`) - vitest browser mode, real clicks:
  F1 required field blocks `<form action>` (invalid event, focus, `:user-invalid`, React's
  `javascript:` action URL); F2 canceled `invalid`; F3 `noValidate`, `requestSubmit()`,
  `checkValidity()`; F4 `useActionState` returning a field error (auto reset of the uncontrolled
  value, `:user-invalid` cleared, `useFormStatus` in a portal, `setCustomValidity` from state);
  F5 `setCustomValidity` persists and blocks the next submit; F6 `form.reset()` clears
  `:user-invalid`; F7 controlled vs uncontrolled after a successful action; F8 `defaultValue` from
  action state survives the reset, `onSubmit` + `startTransition(dispatch)` avoids the reset and
  still sets `useFormStatus`. Copy into `packages/ui/src/__tests__/`, run in `packages/ui` with
  `FUNSTACK_BROWSERS=chromium,firefox pnpm exec vitest run --project browser <file>`; output goes
  to `packages/ui/zz-form-<browser>.txt` (move it here, delete the copies).
  **Firefox F2 and F7 in this combined run did not submit at all** (an ordering artifact of the
  run; not reproduced in isolation). Use `f7-isolated.*` and `user-invalid-canceled.*` instead.
- `f7-isolated.browser.test.tsx` - F7 alone: both engines submit and reset the uncontrolled input.
- `user-invalid-canceled.mjs` - plain DOM: after a submit attempt with a canceled `invalid`
  event, `:user-invalid` matches in both engines (spec: user validity is set before validation),
  and the browser does not move focus to the canceled field.
- `bubble-then-submit.mjs` - negative result: the native validation bubble does not swallow the
  next submit click.
- `field-ax.cjs` - Chromium AX: `invalid` for valueMissing / customError / typeMismatch,
  `aria-invalid` overrides in both directions, `aria-describedby` description, `aria-errormessage`
  relation; `:user-invalid` / `:invalid` states.
