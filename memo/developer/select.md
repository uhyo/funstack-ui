# Developer memo: Select (#50), 2026-10-17

Design: design/components/select.md (230086e, accepted with PO answers in 50228e4). Branch
`worktree-agent-a185e1a0cd8bb37fe`; commits feat(ui) 1114850, feat(example) f107022, docs 4b1c94b,
plus this memo.

## Files

- `packages/ui/src/select/`: index (no directive), context, root, trigger, value, option, group,
  group-label, separator, `select-dom.ts` (shared part ref: node + dev tag / first-child checks),
  all `"use client"`. Tests: `select.test.tsx` (jsdom, 86), `select.browser.test.tsx` (15 rows;
  Chromium runs 14, Firefox 9, WebKit-only row skipped locally).
- `internal/use-native-select-value.ts` (mirror + re-apply, mount reconciliation and reset via
  `useNativeGroupReconciliation`, late options, adoption), `internal/use-hydrated-mount.ts`
  (useSyncExternalStore server-snapshot tell).
- Shared changes: `useControllableAction` gained `adopt(next)` (uncontrolled only, no action);
  `FormAssociatedElement` and the group adapter's `element` widened with `HTMLSelectElement`;
  `platform-attributes.ts` adds `selectedcontent` to `JSX.IntrinsicElements` (needed
  `import type * as React` and `React.`-qualified names, TS4033 otherwise).
- engine.ts: `supportsBaseSelect`, `supportsSelectedContent`.
- Example `packages/example/src/select-demo.{tsx,css}`; docs `SelectPage` + `SelectFruit`,
  `SelectCountry`, `SelectForm`, `select.css`; nav, routes, Home, Action props, Transitions,
  Browser-owned state, Server Components, Roadmap.

## Deviations / additions to the design

1. **Value also refreshes after a form reset.** Chromium 156 does not re-clone `<selectedcontent>`
   on `form.reset()` (probed on plain DOM, no React: value goes back to `a`, content stays
   `Cherry`). research §3 says reset updates it; it does not in Playwright Chromium 156. After the
   library's reset dispatch React's `updateOptions` finds the option already selected, so nothing
   re-clones. Fix in `Select.Value`: a `reset` listener on the owner document (bubbles; filtered
   by `event.target === select.form`) refreshes in a microtask unless cancelled. Covers React's
   automatic reset too. **Should be a repo issue** (upstream Chromium bug or spec gap; not filed).
2. **Adoption** (decision 4 as applied in 50228e4): implicit default = an option whose value is
   `""` (react-dom `updateOptions("")` and Fizz pick it even when disabled), else the first
   enabled option, else `""`. The adopted value is held in a ref (`adopted`) for the rest of the
   layout phase so that the mount reconciliation and re-apply see it; cleared in a microtask (the
   sync adoption render has committed by then). My first version cleared it on
   "optimistic === adopted", which never happens when a pick is pending: bug caught by the
   hydration + pick test.
3. Separator / Group / GroupLabel `className`/`style` functions receive the Root state (design
   elides Separator's state).
4. Option syncs `data-selected` / `data-pending` / `data-disabled` presence at mount (hydration
   keeps stale server attributes; RadioGroup precedent).
5. Tag checks use `tagName`, not `instanceof` (the hydration browser row renders into an iframe:
   another realm, `instanceof HTMLSelectElement` is false). A `render` element that is not a
   `<select>` gets no DOM work (the hook's ref getter returns null).
6. `defaultSelected` mirror writes only the **first** option with the target value (react-dom
   selects the first match), so duplicate values never yield two reset targets.

## Engine / harness facts

- jsdom 30: no `HTMLSelectedContentElement`; old parser drops `<button>`, `<selectedcontent>`,
  `<legend>` and tags inside `<option>` from `innerHTML`, so jsdom hydration rows are text-only
  without Trigger/Value. Selectedness, dirtiness, `defaultSelected` moving a non-dirty option, and
  `form.reset()` follow the spec (same as the architect's probe case 6). The observer filter is
  tested in jsdom by stubbing `HTMLSelectedContentElement` and spying on the `value` setter.
- React dev in jsdom logs "The tag <selectedcontent> is unrecognized in this browser" once
  (jsdom makes it an `HTMLUnknownElement`). Not seen in Chromium or Firefox 157 (docs dev server
  smoke had no console output), so no workaround.
- Chromium UA style: a select's first-child `<button>` is `display: contents`, so "the button has
  a box" (design 14.2 degradation row) is false; the row measures `<selectedcontent>` instead.
- Firefox 157: `<selectedcontent>` box 0 and empty; `:user-invalid` after a blocked
  `requestSubmit()` works; `userEvent.selectOptions` works on the native select.
- The hydration tell works as designed: the Option's mount layout effect sees the server
  snapshot (`hydrated === true`) in a boundary hydrating after the Root and `false` for created
  options. Mutation-checked: forcing `true` makes the created-late-options rows dispatch.
- Load-bearing checks done by mutation: late re-apply (4 rows fail without it), late snapshot and
  `onItemMounted` for hydrated options (late hydration rows fail).
- Docs smoke (Playwright over `pnpm --filter docs dev`): no console errors/hydration warnings in
  Chromium or Firefox on /components/select; pick shows pending then settles; Reload shows
  `selectedIndex -1` then `br`; required blocks; order + auto reset to the new default.

## Not verified / open

- WebKit (cannot launch locally): the 302008 row (15 s timeout), customizable-select rows,
  `<selectedcontent>` refresh timing (WebKit 325898; contingency in design 6.3: defer while
  `:open`), the reset re-clone. Rows branch on feature checks, so a WebKit without the features
  takes the Firefox branch.
- Chromium: `select.value = select.value` keeps `:user-invalid` (reviewer probe P1); no browser
  row for it (review L9, skipped by the product owner).
- (resolved in the review fixes below) `adopt` unit test.

## Review fixes (memo/reviewer/select.md, 2026-10-17)

Commits e4aab3b (ui), 19b3155 (docs), then the `""`-mirror nuance + this memo. Design was
updated by the architect in 79b7393 to match.

- H1: `adoptDefault` is now `{ adopt, established }`; the Root sets an `established` ref in
  every dispatch (pick and platform) and the hook stops adopting (mount re-run under StrictMode
  and late options) once it is true. jsdom row: pick "b", keyed boundary remount, options back,
  "b" kept, one dispatch. Mutation-checked.
- M1: adopt mode's reset target is `mountAdopted` (set in the mount adoption; `undefined` when
  the adopted `""` came from no `""` option). Rows: client-rendered disabled `""` placeholder +
  `<form action>`: untouched submit stays on `""` with no dispatch, a pick then submit resets to
  `""` with one platform dispatch; the existing adopt reset row now expects `defaultSelected`
  on the adopted option. Mutation-checked. Pitfall: an `<output>` inside the form is reset by
  the form reset (textContent -> default value) and React then throws NotFoundError when it
  updates its text node; expose state through `className` instead in form-action rows.
- L3: `Select.Value` uses `useFormReset` with a getter ref to `closest("select")`. Its listener
  registers before the Root's (child layout effects first), so the refresh now runs before the
  Root's reset dispatch; harmless (the refresh assigns the reset value to itself). Row:
  `stopPropagation()` on the form, and `form` attribute switched between two forms.
- L4: WebKit logs `base-select` / `selectedcontent`; Chromium true, Firefox false asserted.
- L5: the late window stays a microtask window (an Option effect cannot know its commit); every
  later report in the window re-applies when the option is the intended or reset-target one
  (at most two O(N) passes per commit). Not unit-tested (no part triggers a second commit in
  one task).
- L6: `SelectContext.groupDisabled`; Group re-provides the context with its `disabled` (passed
  through as a prop, not owned). Option `state.disabled` = Root || Group || own.
- L7: `internal/use-controllable-action.test.tsx` (first unit file for the hook).
- L8: design-only. L9 skipped.
