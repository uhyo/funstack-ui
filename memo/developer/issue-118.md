# #118 invoker `aria-expanded` = shown state (2026-10-24)

Design: conventions 3.2 / 4.1 / 7.3, decision 40; amendments in popover.md, menu.md,
combobox.md; architect notes memo/architect/invoker-aria-expanded-118.md.

## Change
- `internal/use-popover-trigger.ts`: `"aria-expanded": isLibrary ? ctx.committed : false`
  (Popover.Trigger, Menu.Trigger, Menu.SubmenuTrigger).
- `combobox-trigger.tsx`, `combobox-input.tsx`: `popover.committed`.
- `data-open`, render-prop `open`, `children(state).open` stay optimistic. JS-free unchanged.

## Tests
- Shared suite: pending open row `false` (with `data-open`), part-close row `true`, refused
  part close `true` while pending, suspending-content row `false` while pending.
- popover.test: SSR `defaultOpen` -> `"true"`, deferred part close / deferred open, refused
  controlled close.
- menu.test: Suspense open row, #110 Trigger-close rows. combobox.test: refused controlled
  Trigger close (Trigger + Input `"true"`), suspending open (Input + Trigger `"false"` -> `"true"`).
- Browser: menu `expectPendingClose` `"true"`; combobox #112 row `"true"` at +20 ms; popover
  library row flipped; new popover row with a Chromium CDP `expanded` check (ax-tree.ts) that
  agrees with the attribute in the deferred open and deferred Trigger close.
- Mutation: reverting the use-popover-trigger line fails 19 jsdom rows + the browser rows;
  reverting either combobox line fails 3 combobox rows.
- WebKit could not launch locally (host deps); covered by CI.

## Release-notes line
- Behaviour change: `aria-expanded` on Popover.Trigger, Menu.Trigger, Menu.SubmenuTrigger,
  Combobox.Trigger and Combobox.Input now reports whether the popup is shown (committed state)
  instead of the optimistic open state; `data-open` and the render-prop `open` are still
  optimistic. Style pending feedback with `data-open` / `data-pending`, not `[aria-expanded]`.
  (Screen-reader pass pending before the notes claim AT behaviour.)

## Known gap (accepted by design)
Firefox reads a stale `"true"` between a browser-owned dismissal and the commit of its
notification; and `"false"` for a pre-hydration-shown popup until the platform dispatch settles.
