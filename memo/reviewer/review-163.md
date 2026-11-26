# Review: #163 Collapsible (feat/163-collapsible @ 0a339ae2)

Verdict: **merge after minor fixes**. None of the fixes blocks the merge, and any of them can go to a follow-up instead.

Ran:
- jsdom suite: 83 files / 4025 tests pass. `directives.test.ts` needs `pnpm build` first.
- Browser tests for Collapsible and Accordion: pass on Chromium and Firefox. WebKit is not
  installed locally; branch CI was green on all three engines.
- `pnpm lint` and the ui typecheck: pass.
- Production bundle (esbuild, NODE_ENV=production): contains no element-check text, so point 6
  is confirmed.

## Conformance summary

- Design sections 1-8 are all implemented as designed:
  - anatomy, and the mode fixed at mount (useMountFixed);
  - useControllableAction with no reducer;
  - optimistic `data-open` on Root and Trigger; the committed `open` attribute and the Panel's
    state; `data-pending` from the Root's transition;
  - the platform path: the toggle handler reads `details.open`, dispatches are deduplicated
    against the intended value, mount reconciliation runs again on an Activity reveal, and
    committed state is re-applied once nothing is in flight;
  - `disabled`; `experimental_interpolateSize` (the consumer's style wins); the transition types;
  - JS-free mode owns `open` as `false`, plus `suppressHydrationWarning`.
- Effect order matters and is correct: the reconcile layout effect comes before the re-apply
  effect. At mount the re-apply effect therefore sees `latestInFlight() !== null` and does not
  close a `<details>` the user opened before hydration.
- Accordion refactor: a pure move of NESTED_INTERACTIVE, SELF_ACTIVATING, nestedInteractive and
  the two element checks.
  - The messages are identical; the part name is now a parameter.
  - The disabled / JS-free branch order in the Trigger handler is unchanged.
  - The Accordion tests are untouched and pass.
- Accessibility:
  - native details/summary only, with `aria-disabled` on the summary;
  - no `aria-expanded` (HTML forbids it on a summary);
  - a disabled Trigger stays focusable;
  - nested interactive content does not toggle.
- The docs props tables match the TypeScript types: props of all three parts, state shapes,
  owned keys and data attributes.
- The skill line is accurate.
- Decision 4 is recorded in accordion.md section 1 and in the docs.

## Findings

1. Low. `packages/ui/src/internal/details-summary.ts:394`: the details-check message says
   "(toggle, find-in-page, exclusive groups)" for Collapsible.Root as well.
   - Problem: Collapsible owns `name` and has no exclusive groups (design 3.1), so the dev text
     is misleading.
   - Fix: take the reason as a second argument, or use "toggle, find-in-page, ::details-content"
     for Collapsible. Keep the Accordion text byte-identical.
2. Low. `packages/docs/src/pages/CollapsiblePage.tsx:311-313` says a rejected reveal is "closed
   again". The design 2.2 bullet and the Root JSDoc (`collapsible-root.tsx:86-88`) say the same.
   - Problem: when the latest dispatch rejects, the error reaches the Error Boundary and the Root
     is unmounted, so nothing is closed again. Only a superseded rejection (reportError) leaves
     the Root mounted.
   - The test at `collapsible.test.tsx:704` therefore asserts only the Error Boundary.
   - Fix: reword to "if a controlled parent does not adopt it, it is closed again; a rejection
     goes to the Error Boundary". Or add a test for a superseded reveal rejection: reveal, click,
     the reveal rejects, reportError, and the DOM follows the later dispatch.
3. Low; a design-level rule shared with Accordion. `collapsible-root.tsx:220`: the echo rule
   drops a browser re-open while a close is pending.
   - Problem: the DOM closes, then re-opens. The re-open equals committed, so it is taken as an
     echo, and the pending close then hides content the user just revealed.
   - This needs two platform events inside one pending window, so it is rare.
   - Not a merge blocker. Record a GitHub issue covering Accordion and Collapsible.
   - Possible fix: treat `element.open === committed` as an echo only when it also equals the
     intended value or nothing is in flight. Otherwise dispatch with `reason: "platform"`.
4. Nit. `collapsible-root.tsx:78` and the docs table give `defaultOpen` a default of `false`,
   while leaving the prop out selects JS-free mode. This matches the design table. Consider
   "none (JS-free mode)" in the default column and "false in library mode" in the notes.

## Developer's flagged points

1. Echo rule: follows the design; see finding 3.
2. A rejected reveal is observable only through the Error Boundary: acceptable, but the docs
   wording promises more than happens (finding 2).
3. `::details-content` box-height measurement: acceptable.
   - The transition is 4 s linear and the test asserts a height between the closed height and
     `closed + 190` for a 200 px child.
   - That tells "the transition ran" apart from "the height jumped", and leaves a polling window
     of about 3.8 s, so it should not be flaky.
4. "exclusive groups" text: see finding 1.
5. Decision 4 as a rule in accordion.md section 1: fine; the wording matches the docs note.
6. Element checks as hooks: correct, and verified in a production bundle.
