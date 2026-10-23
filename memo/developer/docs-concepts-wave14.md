# Wave 14: conceptual concept pages (#97), static 1.3.4 (#94)

- `packages/docs/src/components/Concept.tsx`: `ConceptExample` (boxed "Example: X" block),
  `Term`/`Terms` (`<dfn id>` definitions, linkable), `BehaviourSummary` (the
  "Async and platform behaviour" section, id `async-and-platform`, fixed rows: Transition types,
  Optimistic and pending, Suspense, Browser-owned state, Before hydration; row labels link to the
  concept pages). Placed as the last section of every component page (23 pages).
- Term homes: part, Root -> /getting-started#part, #root; state owner, trigger, pure trigger,
  content region (panel), committed, optimistic, pending, rollback -> /concepts/pending-and-optimistic;
  action, dispatch -> /concepts/action-props; commit, view transition, transition type ->
  /concepts/transitions; library-owned, browser-owned, dismissal, invoker command, JS-free mode ->
  /concepts/browser-owned-state; hydration -> /concepts/server-components.
- Left untouched for #96: the "The urgent lane" section text and its heading (no id added). The
  Action props naming table (which named inputValueChangeAction / UrgentChangeAction in a row) was
  removed: if #96 edits that row, the merge conflict resolves by keeping the deletion.
- useActionState claim verified in jsdom (temporary test, deleted): controlled Toggle with
  `pressedChangeAction={(next) => dispatch(next)}`; two clicks -> calls run sequentially, second gets
  the first's result, Toggle stays data-pending with latest optimistic value until the queue drains.
- Docs pages have no auto heading ids: in-page anchors need explicit `id` on the h3.
