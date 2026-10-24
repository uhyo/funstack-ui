# #118 invoker `aria-expanded` = shown state (2026-10-24)

Design: conventions 3.2 / 3.5 / 4.1 / 7.3, decision 40; popover.md #118 amendment and its
"Revision" (1c1945e, review M1); menu.md, combobox.md notes; architect memo
invoker-aria-expanded-118.md. Review: memo/reviewer/issue-118-review.md.

## Change (after the M1 revision)
- `use-overlay-root.ts`: urgent `const [shown, setShown] = useState(false)` on the Root value.
- `use-popover-popup.ts` (library mode): `setShown(isPopoverOpen(element))` in `onToggle`, and
  on ref attach (pre-hydration open); `setShown(false)` on ref detach (removed while open fires
  no `toggle`). JS-free keeps its DOM write.
- `use-popover-trigger.ts`: `isLibrary ? ctx.shown : false`; Combobox Input / Trigger:
  `popover.shown`. `data-open` / `state.open` stay optimistic; `shown` is not in any `state`.
- First version used `committed`; M1: the Combobox Input (no invoker), non-button Trigger
  renders and Firefox read a stale "expanded" over a hidden popup after a dismissal.

## Tests
- Shared suite: pending open `false`; pending part close `true`; dismissal `false` while the
  notification runs; refused dismissal `false` while hidden, `true` after the re-show's toggle;
  defaultOpen `false` until the toggle flush.
- popover.test: SSR defaultOpen `"false"` + hydration `"false"` then `"true"`; platform path
  `"true"` while the "platform" dispatch is pending; Popup unmounted while open -> `"false"`;
  render-count row ([committed, pending, shown] per render: one extra render per show / hide,
  none for the attach's unchanged `false`). The jsdom shim queues `toggle` as a task: assertions
  of `"true"` after a show need `flushTasks`.
- combobox.test: Escape-equivalent dismissal with a deferred close, and one entangled with an
  unrelated pending transition: Input and Trigger `"false"` while pending.
- Browser: popover AX row polls the attribute; new Escape row (300 ms close, sample at 60 ms,
  Chromium AX `expanded=false`); combobox Input Escape row (reviewer's probe, Chromium AX).
- Mutations: trigger shown->committed 12 jsdom + popover Escape browser row; Input or Trigger
  shown->committed 2 combobox rows (+ browser Input row for the Input); no toggle write 34;
  no attach write 5 (platform rows); no detach write 1 (unmount row).
- WebKit not launchable locally (host deps); CI covers it.

## Release-notes line
- Behaviour change: `aria-expanded` on Popover.Trigger, Menu.Trigger, Menu.SubmenuTrigger,
  Combobox.Trigger and Combobox.Input now reports whether the popup is shown (mirrored from its
  `toggle` event) instead of the optimistic open state, in every engine. `data-open` and the
  render-prop `open` are still optimistic: style click feedback with `[data-open]` /
  `[data-pending]`, not `[aria-expanded]`. With `defaultOpen`, the server HTML now renders
  `aria-expanded="false"` (the popup is shown only after hydration); `data-open` is still
  server-rendered. (Screen-reader pass pending before the notes claim AT behaviour.)
