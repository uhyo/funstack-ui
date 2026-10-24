# #121 popovertarget Triggers, no aria-expanded (developer notes)

Branch `feat/121-popovertarget-triggers`, worktree `.claude/worktrees/dev-121`. Do not merge; report
for review.

## Release notes (BREAKING, DOM only)

- BREAKING: `Popover.Trigger`, `Menu.Trigger`, `Menu.SubmenuTrigger` and (after hydration)
  `Combobox.Trigger` render `popovertarget` instead of `commandfor` + `command="toggle-popover"`,
  and a `<button>` Trigger renders no `aria-expanded` (the browser exposes the popup's state on a
  `popovertarget` invoker; ARIA in HTML forbids the attribute there). Migrate CSS from
  `[aria-expanded="true"]` to `[data-open]` (now also written in JS-free mode), or use
  `:has(+ :popover-open)` for pages that never hydrate. Selectors on `[commandfor]` / `[command]`
  for these Triggers move to `[popovertarget]`. A non-button `render` keeps `aria-expanded`.
  No prop or type change beyond `popoverTarget` / `popoverTargetAction` joining the omitted keys.

## Decisions taken while implementing

- `popoverTargetAction: undefined` is an owned key in `usePopoverTrigger` and in
  `Combobox.Trigger`'s `libraryProps` (and `popoverTarget: undefined` in the Combobox, whose ref
  writes the attribute): a render element cannot set an action. popover.md 3.2 says "omitted",
  combobox.md says "owned"; owning it in both is the stricter reading.
- Shared jsdom suite: rows that read the exposed state run twice, `[link Trigger]` (the #118
  mirror's phases on `render={<a href="#" />}`) and button (`popovertarget`, no `aria-expanded`).
- `src/__tests__/ax-tree.ts`: `axExpanded(element)` finds the node by role + accessible name;
  `expectInvokerExpanded(trigger, popup, expanded)` = DOM assertions everywhere + polled AX state on
  Chromium.

## Progress

- [x] Source (hook, popup sync, Combobox ref write, Omit lists, comments), jsdom shim branch +
      `invoker-shim.test.ts`.
- [x] Test sweep (jsdom + browser files).
- [x] Mutation checks (see below).
- [x] Docs pages + example CSS (Popover, Menu, Combobox, PendingOptimistic, BrowserOwnedState,
      ContextMenu, Roadmap breaking line; popover.css / popover-demo.css `[data-open]`).
- [x] Full browser suite on Chromium + Firefox: 50 files, 967 passed, 29 skipped (includes the
      #110, #112, #115, #117, #123 rows). WebKit does not launch locally (host deps): CI job.
- [x] CI run 40104731683 on the branch: ci, browser chromium / firefox / webkit all green.

## Not done / follow-ups

- Screen-reader pass (popover.md amendment: NVDA + Firefox, NVDA/JAWS + Chrome, VoiceOver +
  Safari) is a human task.
- `trigger-ref.ts`'s second-Trigger warning still lists "aria-expanded" among what follows the
  last Trigger; with `popovertarget` every Trigger exposes the state. Left as is (text only).

## Mutation checks (all caught)

shim branch removed (11 jsdom fails); shim action ignored / command event dispatched
(invoker-shim.test); JS-free `toggle` sync no-op (3); JS-free ref sync no-op (1, the late-mount
row); button renders `aria-expanded` again (54 jsdom, 9 menu browser); non-button renders none
(44); Combobox non-button none (1) / button again (8); `popoverTargetAction` not owned (1); AX
helper inverted (6 Chromium).
