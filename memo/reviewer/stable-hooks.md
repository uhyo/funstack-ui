# Review: stable shared hooks and memoised contexts (f43d9b6, #48)

Verdict: **acceptable with minor fixes** (no blocking defect; the fixes are tests and notes).

## Verified (probes run in a throwaway worktree, not committed)

- Aborted render does not leak: owner switches `valueChangeAction` a -> b inside a transition that
  suspends (old UI kept); clicking a tab calls `a`, never `b`. Insertion effects only run on commit.
- Child layout effect in the same commit: a child mounted in the commit that changed the Root's
  `action` calls `dispatch` from `useLayoutEffect` and gets the new action (all insertion effects of
  the commit run in the mutation phase, before the layout pass).
- StrictMode: Tabs parts still do not re-render on an owner re-render (insertion effects are not
  double-invoked; the memo survives the double render).
- Dialog apply effect ("after every commit") now only runs when the Popup re-renders. Controlled
  `open={true}` with no action and with a sync no-op action: a dismissal still re-opens (pending
  true -> false commits change the context). No regression found.
- Post-await write: `isControlled`, `action`, `transitionTypes`, `prev` destructured once at the
  call (use-controllable-action.ts:160), so the continuation uses the mode the user acted under.
- Memo deps: every memo (Dialog, Tabs, RadioGroup, Select, Select.Group, Accordion,
  Menu.RadioGroup, Menu groups, usePopoverRoot, useControllableAction) lists every captured
  non-ref value; `react/exhaustive-deps` is `error` in .oxlintrc.json, so a miss would fail lint.
- Accordion `rootPending`: pure refactor (`isLibrary && pending` both before and after).

## Findings (by severity)

### Low

1. Test coverage of the stability claim is narrow (internal/context-stability.test.tsx:61-145).
   One part per component, uncontrolled only, Root-level context only. Not covered: Select.Group,
   Menu.Group / Menu.RadioGroup, Menu.Popup listContext (Popup not rendered), controlled mode,
   StrictMode, and the converse (a part DOES update when a memo dep like `modal`, `disabled`,
   `orientation`, `loop`, `name`, `required` changes; lint covers this statically only). The Select
   case passes against the old hook too (its context never held `dispatch`), so it proves only the
   Root's own memo. Suggest: add the sub-context parts and one StrictMode case; add one
   "prop change propagates" assertion per memo.
2. No regression test for the concurrency guarantee that motivated `useLatest` (aborted /
   suspended transition render must not leak its props). Easy to write (probe above); worth
   keeping since a future "simplify to assign during render" would silently break it.
3. Stale window before the Root's insertion effect: anything that calls `dispatch` from a child's
   insertion effect or from a synchronous DOM event fired during the mutation phase (e.g. Chromium's
   `blur`/`focusout` on removal of a focused node, which runs before the parent's insertion effect)
   sees the previous commit's props. Same as the old per-render closures (the handler was the
   previous commit's too), so not a regression; the `useLatest` doc says "before every layout
   effect", which is accurate, but could mention mutation-phase events.
4. Behaviour shift: the Dialog/Popover apply layout effects (dialog-popup.tsx:277,
   use-popover-popup.ts:281) are documented "after every commit" but previously ran after every
   Root render because the context was always new; now only when the Popup re-renders. Every path
   that diverges DOM from state goes through a dispatch that toggles `pending`, so this holds today
   (probed); update the comments to say "after every commit that re-renders the Popup" so nobody
   relies on an unrelated Root render.

### Nits

5. dialog-root.tsx:150-153: `intended` still closes over render-time `optimistic`, unlike
   usePopoverRoot (committed ref). Correct with the memo (the closure and the context change
   together), but it makes `requestOpen`/`notifyClosed` change identity on every optimistic change
   and diverges from the shared hook. Using `useLatest(optimistic)` would align them.
6. Accordion controlled with an inline `value={["a"]}`: `controlledSet` (accordion-root.tsx:227)
   is a new Set per render, so the memo never hits and every part re-renders (probed: 1 extra
   render per owner render). Pre-existing; a content-equality check would make the memo effective.
7. Accordion.Item's `itemContext` (accordion-item.tsx:137) is not memoised, so Trigger/Panel of
   every item re-render whenever the root context changes. Out of scope for #48; a follow-up.
8. use-native-select-value.ts:162-165 (pre-existing): `latest` is written in a Root layout
   effect, which runs AFTER children's layout effects, so `optionMounted` from a late Option's
   layout effect reads the previous commit's options. Now that `useLatest` exists, switching it
   (and use-native-group-reconciliation.ts:79-81) to `useLatest` would close that window.
