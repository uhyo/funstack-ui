# Probe 20: explicit aria-expanded on popover invokers (#118)

- `node build.mjs` bundles `app.tsx` (Popover / Menu / Combobox from `packages/ui/src`) plus the
  static cases in `static.html` into `page.html` (not committed, about 1.4 MB).
- `node run-chromium.mjs`: Playwright Chromium, reads `Accessibility.getPartialAXTree` over CDP.
- `node run-firefox.mjs`: starts the Playwright Firefox build with `-marionette
  -remote-allow-system-access` and a throwaway profile, drives the page in the content context and
  reads `nsIAccessibilityService` states in the chrome (parent) context, which is the cached tree
  AT clients see. Playwright 1.64 has no accessibility snapshot API any more, and Juggler no longer
  has `getFullAXTree`.
- The Combobox case simulates #112's design: `commandfor` + `command="toggle-popover"` written
  after mount, click cancelled.
- `window.__hang = "open" | "close"` makes `openChangeAction` hang in that direction until
  `window.__release()`.
