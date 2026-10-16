# Reviewer memo: Switch and Checkbox (#30), 2026-10-16

Reviewed master at 62c17da (impl d474a34, df5e8f5, demo 1aa5392) against `design/conventions.md`
(incl. b8bdf14, which landed during the review: `:checked` caveat in 4.2, mount-commit rule in
3.8 rule 3), `design/components/{switch,checkbox}.md`, `docs/research/form-controls.md`.
`pnpm build`, `pnpm typecheck` (uncached), `pnpm lint` pass. `vitest run` with
`FUNSTACK_BROWSERS=chromium,firefox` three times: run 1 had 6 browser files fail to import
(Vite dep re-optimisation, two `?v=` hashes, "reading 'config'"; no test failed), runs 2 and 3
679 passed. Switch 73 + Checkbox 85 jsdom tests; every suite row runs for both components and,
where the plan says "both", both modes. Browser: 19 tests per engine, Chromium and Firefox green.
WebKit not run locally.

dist: `switch/switch.mjs`, `checkbox/checkbox.mjs`, `internal/use-form-reset.mjs`,
`internal/use-native-checked.mjs` start with "use client"; both `index.mjs` do not; `./switch`
and `./checkbox` in exports; index `.d.mts` import platform-attributes; `ChangeReason` exported
from the root. `use-native-group-reconciliation` is not in dist (no entry imports it yet).

Verdict: **acceptable with minor fixes** for Switch and Checkbox. The shared group adapter needs
one design fix before RadioGroup builds on it (M1).

## Probes (scratch jsdom + browser tests, Playwright on the built example; all deleted)

1. External `checked` change while pending (controlled): DOM stays on the optimistic value while
   the parent flips true/false; after settle the DOM equals the parent's value. OK.
2. Controlled "update on success" overlap: resolve 2 then 1 -> parent ends `true` though the
   user's last click asked `false`; DOM agrees with the parent. Resolve 1 then 2 -> `false`.
   Same class as Accordion probe 6; the latest-wins guard is uncontrolled-only.
3. Reset while a click action is pending: one `platform` dispatch `false`; after both settle DOM
   `false`, not pending. Superseded rejection of the click after the reset dispatch reaches the
   boundary.
4. React auto reset, controlled parent refusing: DOM re-synced to `true`, `defaultChecked` stays
   mount-time `false`.
5. `useFormStatus().pending` true during submit; the Switch has no `data-pending`. OK.
6. jsdom canceled activation: plain input, listener sets `checked=false` then preventDefault ->
   jsdom ends `true` (spec: restore pre-activation value, `false`). Developer's jsdom bug claim
   confirmed.
7. `disabled` prop true + `render={<input disabled={false} />}`: input natively enabled,
   `data-disabled` present, click dispatches nothing, DOM restored. Desync of native vs attribute.
8. `<fieldset disabled>`: `:disabled` true, no `data-disabled`, no dispatch; form reset of a
   fieldset-disabled Switch still dispatches `platform` (conventions 2.3 item 6). OK.
9. Latest dispatch rejects while an older one is pending: the boundary sees nothing until the
   older settles (React keeps the whole async transition pending). Then one error, as designed.
10. preventDefault in the action: one warning per element; a remounted element warns again.
11. Chromium vs Firefox: `:checked` on checked+indeterminate false in Chromium, true in Firefox
    (confirms developer; conventions 4.2 now says so).
12. Click on a still-dehydrated Suspense boundary around a standalone Switch (Chromium, Firefox):
    no `onChange`; after hydration exactly one `platform` dispatch, DOM and `data-checked` agree,
    next click `activate`. The mount-commit skip opens no hole for single controls.
13. **Group items hydrating after their Root** (Suspense between Root and Items, Root already
    hydrated, radio `m` clicked before the Items hydrate): no dispatch, DOM shows `m`, optimistic
    `s`. Desync until that Item next commits. See M1.
14. Test hazard: a test leaving a deferred pending makes the next test's sync action stay
    `data-pending` (entangled). A registry of open deferreds settled in `afterEach` (after
    `cleanup()`, inside `act`) removes it (verified).
15. Example, Chromium: all six sections behave (autosave flip+pending+keep; rejection -> boundary
    -> reset; veto rolls back with inline error; form submit blocked by `required`, auto reset to
    saved defaults, reset button to defaults; select-all mixed -> checked without dash while
    pending, failure brings the dash back; sibling-track focus ring, pending opacity, label click).
    `switch "Email notifications" [checked]` in the a11y tree. Only console error is the
    intentional rejection.

## Findings

- M1 group late mount: `use-native-checked.ts:113` skips `checked` in an Item's mount commit,
  and `use-native-group-reconciliation.ts:48` reconciles only at the Root's mount. Items that
  mount after the Root (nested Suspense, selective hydration) are never reconciled. Fix before
  RadioGroup: Items with `group: true` notify the Root when their mount commit is not the Root's
  (Root re-runs `readCurrent()` vs `base()`), or such Items re-apply at mount. Add a test.
- M2 test hazard mitigation: `deferred()` (and `createSuspender` entries) register in a
  module-level set; `vitest.setup.ts` `afterEach`: `cleanup()`, then
  `await act(async () => { for (const d of open) d.resolve(); })`, then clear.
- L: controlled overlap intent loss (probe 2): document in switch.md 6.5/6.9.
- L: `disabled` pass-through (probe 7): own it in `libraryProps`, or derive `data-disabled` from
  the merged value, or document.
- L: owned-key doc comments (`switch.tsx:90`, `checkbox.tsx:102`) say a render element cannot set
  `onChange`; the merge runs both handlers.
- L: group test harness `setValue(next)` after `await` without `startTransition`
  (`use-native-group-reconciliation.test.tsx:116`). Missing RadioGroup-relevant rows: React auto
  reset on the fieldset, controlled refusal re-sync, `defaultValue` change then reset, two groups
  in one form, late-mounting Items.
- L: browser suites flood stderr with act warnings (vitest/browser `userEvent`).
- L: Vite re-optimisation flake on a cold browser run; likely runtime discovery of
  `react-dom/server` / `react-dom/client` in browser tests. `optimizeDeps.include` for the
  browser project (cause unverified).
- L demo: select-all parent derives from committed selection, so it shows "all" while a row's
  uncheck is pending; row actions close over a stale `selected` (two quick row clicks lose one);
  "Make the next save fail" persists for every later save.
- Issue to record in this repo (human files upstream): jsdom canceled activation toggles instead
  of restoring (probe 6). Chromium `:checked` + indeterminate (probe 11).

## Design / conventions text proven wrong (as of b8bdf14)

- switch.md 3 (line 324), 6.7 (line 537) and row 19 (line 774): a pass-through `onClick` that
  calls `preventDefault()` is an already-cancelled click: no dispatch, no warning, DOM reverts
  (conventions 2.3 item 3, rule 9; implementation and row 26 follow that).
- conventions 3.8 table (line 735) and switch.md 7 item 3 (line 661): re-apply order is
  `defaultChecked` -> `checked` -> `indeterminate`, and it matters (skipped `checked` write
  leaves dirty-checkedness clear after a reset, so a later `defaultChecked` write moves it).
- conventions 3.8 rule 9: `guardCheckableChange(event, dispatch, component?)`; "once per
  instance" is once per input element.
- conventions 4.1 `checked` row (line 798) still says `:checked` is an exact equivalent;
  contradicts the new 4.2 caveat.
- conventions 3.8 rule 3: "the Root reconciles at mount" misses Items mounting later (M1).
- conventions 2.4: the latest dispatch's rejection reaches the boundary only once every older
  dispatch has settled (probe 9).
