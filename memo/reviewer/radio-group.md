# Reviewer memo: RadioGroup (#31), 2026-10-16

Reviewed master at 267a9a6 (impl c9e11d0, late-item fix fca36ae, demo 53ba371) against
`design/conventions.md` (incl. 267a9a6's 3.8 text), `design/components/radio-group.md`,
`docs/research/form-controls.md`, `memo/reviewer/switch-checkbox.md`.

`pnpm build`, `pnpm typecheck` (forced), `pnpm lint` pass. `pnpm test:run` with
`FUNSTACK_BROWSERS=chromium,firefox` three times: run 1 failed only the known Accordion flake
(`sync action (uncontrolled) > click dispatches…`), runs 2 and 3 959 passed. RadioGroup: 82 jsdom
+ 12 browser tests per engine, all green every run. WebKit not run locally.

dist: the four part files, `internal/use-native-group-reconciliation.mjs`,
`use-native-checked.mjs`, `use-form-reset.mjs` start with "use client"; `radio-group/index.mjs`
does not; `index.d.mts` imports platform-attributes; `./radio-group` in exports; root re-exports
the namespace and six types.

Verdict: **acceptable with minor fixes**.

## Probes (scratch jsdom tests, Playwright on the built example; all deleted)

A. Two synchronous `form.reset()` while a reset to `null` is pending: real Root 1 platform
   dispatch; a copy of the Root with `latestInFlight()?.next ?? optimistic` dispatches `null`
   twice. The whole RadioGroup jsdom suite (82) passes against that `??` copy: nothing guards rule 1.
B. Suspense between Root and Items, Root hydrated, b/c dehydrated, server value b. Real click on
   hydrated "a": react-dom `restoreStateOfTarget` throws "ReactDOMInput: Mixing React and
   non-React radio inputs with the same `name` is not supported." (uncaught, window `error`);
   the action ran once ("a"). After the boundary hydrates: DOM `:checked` = a, but `data-checked`
   on **a and b**; dev "attributes didn't match" hydration warning; no platform dispatch.
B2/B3. Programmatic controlled `value` change while b/c dehydrated: transition update is held
   until the boundary hydrates (no dispatch, ends on new value); urgent update client-renders the
   boundary (no dispatch). The documented "accepted limitation" did not reproduce.
C. Late items hydrating unchanged: 0 dispatches. StrictMode + pre-hydration click on a late item:
   1 dispatch.
D. Reset while a click action is pending (uncontrolled): one platform dispatch to the default;
   DOM/data-checked on the default during and after.
E. `form="ext"` on Root: FormData and reset of the external form work, one dispatch.
F. Controlled, an Item added on the client while `value` equals it: React gives it
   `defaultChecked=true`, so two radios carry `defaultChecked` (mount-time "a" and the new "c").
G. Example, Chromium + Firefox: autosave pending (Item, Root, legend text, spinner), rapid
   arrows latest wins; rejecting group -> boundary -> reset remounts on default; controlled veto
   rolls back with inline error, focus stays on the vetoed radio; RTL arrows mirrored; Tab enters
   on the checked radio and leaves the group in one press. Form section (Chromium): blocked submit
   -> `:user-invalid` on enabled radios only, submit posts `size=m`, auto reset lands on the new
   default (defaultChecked mirrored), arrow skips disabled xl and wraps, reset button returns to
   the latest default. Firefox: after a blocked submit, real pointer clicks never reach the page
   (validation popup; programmatic click works; plain HTML not affected in my layout) - test
   environment artifact, not a library finding.
H. Chromium AX tree (CDP): every group `radiogroup` named from the legend (`relatedElement`).
   The required group reports `required: false`; the same fieldset with `aria-required="true"`
   reports `required: true`. Radios report `invalid: true` but no required state.

## Findings

- M1 (`radio-group-root.tsx`, design 5.1): probe B. The topology the late-item fix supports
  breaks on a click on an already hydrated radio: uncaught react-dom error, stale `data-checked`
  on the dehydrated item after it hydrates. Document as a React limitation ("no Suspense boundary
  between Root and Items that can stay dehydrated while the user interacts"), or mitigate the
  stale attribute; add a test pinning the behaviour. Record a repo issue for the upstream report.
- L1 test gap: probe A. Add "two synchronous resets while a reset to null is pending -> one
  dispatch" (fails with `??`).
- L2 `use-native-group-reconciliation.ts:13` doc comment shows `latestInFlight()?.next ??
  optimistic`; rule 1 forbids it. Developer's note confirmed.
- L3 a11y: `required` is not exposed on the radiogroup (probe H). APG puts `aria-required` on
  the radiogroup; Root could emit it as an owned key. Needs a design call.
- L4 probe F: controlled reset target with client-added Items is not "the mount-time value";
  document.
- L5 design status line still "proposed" (`radio-group.md:3`).

## Design / conventions text proven wrong (as of 267a9a6)

- radio-group.md 5.1 and conventions 3.8 rule 3 "Accepted limitation" (programmatic change
  misread as a user change): not reproduced in React 19.3.1 (B2/B3). React holds transitions
  and client-renders on urgent updates. Rewrite or back with a repro.
- Neither mentions probe B (click on a hydrated member while others are dehydrated).
