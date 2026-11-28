# #206: a pending action holds unrelated opens (dogfood F12)

Architect analysis, 2026-11-28. Design only; no library code changed. Probes are in
`memo/architect/probes-206/` (React 19.3.1, jsdom and Chromium), run in a scratch worktree.

## Summary

- The wait is React's async action scope, not a library bug: while any async action is pending,
  every transition update in the app gets the scope's lane and cannot commit until the last
  action settles. The library commits every open and every Tabs switch with a transition
  update, so they wait.
- The time beyond the save itself (about 500 ms in the dogfood numbers) is the app's
  `refresh()`: it is called inside the action, so its update joins the same lane, and that
  lane's render then suspends on the refetch. Verified.
- Three kinds of update are not held: urgent updates, `useOptimistic` updates, and the
  background render of `useDeferredValue`. The third one keeps old content when the new
  content suspends, shows no fallback, and runs a view transition. Verified.
- Recommendation: **option (d)**, "urgent write, deferred content", for dispatches with no
  action prop on an uncontrolled owner, after a spike in the library; plus **option (a)**, the
  docs section, now. Controlled owners and owners with an action stay transitions, and stay
  entangled; only React can lift that.

## 1. Why each open waits

### 1.1 The library side

Every state owner goes through `useControllableAction`
(`packages/ui/src/internal/action/use-controllable-action.ts`). One dispatch does this, with
or without an action prop:

```ts
startOwnTransition(async () => {
  setOptimistic(next);            // sync lane: triggers flip at once
  await action?.(next, details);  // nothing to await when the prop is absent
  startTransition(() => setInternal(next)); // uncontrolled commit: a transition update
});
```

Content regions render `committed` (conventions 3.2): `Menu.Popup` and the other popups call
`showPopover()` / `showModal()` from an effect of the committed value, `Tabs.Panel` mounts the
committed tab, and a library-mode `<details>` gets `open` from it. Trigger parts render
`optimistic`.

So for an uncontrolled `Menu.Root` with no `openChangeAction`, the only thing between the click
and the popup is the `setInternal` transition update. The three reasons the design has for the
transition are:

| Reason | Applies to the dogfood Menu | Applies to the dogfood Tabs |
| --- | --- | --- |
| The open awaits `openChangeAction` / `valueChangeAction` | no (no action) | no (no action) |
| Content that suspends must hold the old UI instead of showing a fallback | no (static items) | **yes** (`TaskList` reads `use(loadView())`) |
| Optimistic state needs a pending transition to exist | only as a consequence of the first two | same |

Library probe (`probes-206/library.probe.test.tsx`), all owners uncontrolled, no action, an
unrelated `useTransition` action pending:

| Owner | While the unrelated action is pending | After it settles |
| --- | --- | --- |
| `Menu.Root` | Trigger `data-open` and `data-pending`; popup **not shown** | shown |
| `Popover.Root defaultOpen={false}` (library mode) | popup not shown | shown |
| `Dialog.Root defaultOpen={false}` (library mode) | `<dialog>` not open | open |
| `Tabs.Root defaultValue` | Tab `aria-selected="true"`, Root `data-pending`; **old panel** | new panel |
| `Accordion.Root defaultValue={[]}` (library mode) | `<details>` closed | open |
| `Collapsible.Root defaultOpen={false}` (library mode) | closed | open |
| `Toggle`, `Checkbox` | pressed / checked at once (optimistic) | same |

Not held today, because the browser performs the change and React holds no state for it:
JS-free mode of Popover, Dialog, AlertDialog, Drawer, `NavigationMenu.Item`, Accordion and
Collapsible (no `open` / `defaultOpen` / `value` / `defaultValue` / action / `onOpenChange`
props), Tooltip, a native Select, and every dismissal (a fact, conventions 3.9).

Held, and with no JS-free mode to fall back to: Menu (and Menubar, context menus, submenus),
Tabs, Combobox and MultiSelect `open`, HoverCard, and any overlay that has `defaultOpen` or
only `onOpenChange`.

Also held, and outside the library's reach: a controlled owner whose parent sets state inside
the action (`openChangeAction={setOpen}`), and consumer state set from another part's action
(the dogfood row's `Menu.Item action={() => setEditOpen(true)}`, which opens the Edit dialog).
Those `setState` calls are the consumer's own transition updates.

### 1.2 The React side

Read from the shipped `react-dom-client.development.js` 19.3.1, and unchanged on React `main`
today:

- `entangleAsyncAction` opens one **async action scope** for all concurrent async actions and
  claims one lane for it (`currentEntangledLane`).
- `requestTransitionLane` returns that lane for **every** transition update made while the
  scope is open, from any component, with `startTransition` or any `useTransition`.
- A render that reads a state update on that lane throws the scope's thenable, so the lane
  cannot commit until the last action in the scope has settled.
- Parallel transitions (19.3, `enableParallelTransitions`) do not change this. They separate
  transitions started in different events while **no** action is pending.
- The source comment gives the reason: "The ideal behavior would be to treat each async
  function as an independent action. However, without a mechanism like AsyncContext, we can't
  tell which action an update corresponds to. So instead, we entangle them all into one."

Raw React probe (`probes-206/react.probe.test.tsx`, output in `jsdom-probes.output.txt`):

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Save pending; then a standalone `startTransition`, an own `useTransition` with `useOptimistic`, an urgent `setState`, and an urgent `setState` read through `useDeferredValue` | Both transitions **held** until the save settles. Optimistic value, urgent state and the deferred value all commit at once. |
| 2 | The save's action calls `startTransition(() => setVersion(v + 1))` after its `await` (the app's `refresh()`), and a component suspends on the new version | The save has settled, but the opens started during it are **still held**, until the refetch resolves. They share the lane of the refresh. |
| 3 | As 2, but the open is started after the save settled, while the refresh is still suspended | Commits at once. The hold is the action scope, not Suspense. |
| 4 | Urgent write plus `useDeferredValue`, content suspends, a save is pending | Old UI stays, **no fallback**, the content appears when its own data resolves, while the save is still pending. |

So the dogfood numbers decompose as: save (300 to 1200 ms) plus the refetch that the save's
own action put on the same lane. Both parts are React's scope; the second part is triggered by
app code that is the pattern our docs teach (refresh after a successful save).

### 1.3 What React offers

- No opt-out. There is no per-transition lane inside an action scope, no flag on `main`
  (`ReactFeatureFlags.js` has none for it), and no isolation in `useTransition`.
- The stated precondition for a fix is AsyncContext (TC39 proposal, not shipped in browsers).
  No dated plan was found. The library cannot wait for it.
- The three escapes are the ones in probe 1: urgent, optimistic, deferred.

## 2. Which dispatches could leave the transition lane

The platform's answer: a JS-free Popover, Dialog, Accordion or NavigationMenu opens in the same
task, whatever the app is saving. The library is slower than its own JS-free mode as soon as a
`defaultOpen` is added.

| Dispatch | Needs to be held by its own action | Content may suspend | Can leave the transition lane |
| --- | --- | --- | --- |
| Uncontrolled, no action prop (Menu, Tabs, library-mode overlays, Accordion, Collapsible, HoverCard, Combobox open) | no | yes, the library cannot know | yes, **if** suspending content still keeps the old UI |
| Uncontrolled, with an action | yes | yes | no: the action's own `setState` calls are transition updates, and the library's commit must land with them |
| Controlled | the parent decides | yes | no: the value is the parent's state |
| Checkable controls, Toggle | already optimistic, visible at once | no content region | not needed |

"Urgent when the content cannot suspend" is not a rule the library can apply: it does not know
what the children will do. The dogfood Tabs is the example: no action, and the panel suspends.
A plain urgent write there shows the fallback of the boundary **above `Tabs.Root`**, which
replaces the whole tab list. That is the behaviour vision principle 1 exists to prevent, and
the one the dogfood agent praised (F16, "Tabs + Suspense").

`useDeferredValue` removes the conflict: the write is urgent, and the content region follows in
a background render that behaves like a transition for Suspense (probe 4).

## 3. Options

### (a) Docs only

A section "A pending action holds other transitions" on the Action props page and in the
skill, with the dogfood numbers, the list of what waits and what does not, and recipes:

- await only what the UI must wait for (already conventions 2.3 item 5);
- keep the refresh out of the awaited scope when the control can show the result itself;
- use JS-free mode where it exists;
- open a controlled overlay with an urgent `setState` from your own handler (the F12
  workaround, 72 ms).

Pros: no code, no risk, needed in every option. Cons: the default experience stays as measured.
Menu and Tabs have no workaround at all, and the last recipe shows a fallback if the content
suspends. Breaking changes: none.

### (b) Urgent dispatch when there is no action

Pros: simplest code; matches Radix and Base UI timing. Cons: suspending content shows the
nearest fallback and hides visible UI (the dogfood Tabs would lose its tab list on every
switch); no view transition on those commits; breaks vision principle 1 for the most common
call site. Breaking: every action-less owner with suspending content regresses.
Not recommended.

### (c) Opt-in prop or global setting

`<Menu.Root urgent>` or a provider. Pros: nothing changes by default. Cons: the user must first
diagnose an effect that has no visible cause at the call site (the dogfood agent needed
Playwright timings); every owner grows a prop; and the opt-in has the same fallback problem as
(b) unless it is built as (d), in which case it should not be an opt-in. Breaking: none.
Not recommended as the answer; acceptable as a fallback if the spike for (d) fails.

### (d) Urgent write, deferred content (recommended)

Rule: **a dispatch on an uncontrolled owner with no action prop starts no transition.** It
writes the internal value with an urgent `setState`. Content regions render
`useDeferredValue(committed)` in every mode.

```tsx
// Unchanged call sites. Both now open while a save elsewhere is pending.
<Menu.Root>…</Menu.Root>
<Tabs.Root defaultValue="all">…</Tabs.Root>

// Unchanged behaviour: an action makes the change a request, a transition, awaited.
<Tabs.Root defaultValue="all" valueChangeAction={saveTab}>…</Tabs.Root>
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>…</Dialog.Root>
```

What it keeps:

- Suspending content keeps the old UI and shows no fallback (probe 4).
- The trigger flips at once (it reads the urgent value; no optimistic step is needed).
- `data-pending`: redefined as "an action is in flight, or the content region has not caught
  up" (`committed !== deferred`). The dogfood CSS rule `.tabs[data-pending] .tab-panel` keeps
  working.
- View transitions: a deferred commit runs one, during a pending action (Chromium probe,
  `probes-206/vt.browser.test.tsx`).
- Rapid changes: the deferred render is interruptible and the latest value wins.
- A transition render passes through `useDeferredValue` unchanged, so controlled and
  with-action owners behave exactly as today.

What it adds for controlled owners: because content regions always read the deferred value, an
**urgent** controlled write (the F12 workaround) no longer shows a fallback. That recipe
becomes safe to document.

Precedent in the library: Slider starts no step transition when `valueChangeAction` is absent
(CHANGELOG, Slider M2), and Combobox already renders its results from
`useDeferredValue(inputValue)`.

Costs and open points:

- **A behaviour cliff.** Adding an action prop (even a synchronous `track(v)`) turns the
  dispatch back into a transition that a pending save can hold. The rule is explainable ("an
  action makes it a request"), but it must be documented.
- **Not covered.** Controlled owners and consumer state set inside an action (the dogfood
  "Edit…" item opening a controlled dialog). Docs recipe only. A later design could let a
  `Menu.Item` be the trigger of an uncontrolled Dialog (detached triggers), which would cover
  the most common case; out of scope here.
- **Transition types** (`fsui-tabs-next` and the rest, conventions 5.3) need a transition to
  be attached. In the Chromium probe a companion `startTransition(() => { addTransitionType(t);
  setTick() })` in the same event put the type on the deferred commit's view transition, idle
  and busy. That relies on React queueing types per root and must be confirmed in the spike on
  all three engines, with overlapping dispatches.
- One extra render pass per dispatch (urgent, then deferred).
- Test churn: rows that assert an action-less open is held by an unrelated action flip; rows
  that assert `data-pending` while content suspends should survive.
- Verified in raw React only. Not yet prototyped in `useControllableAction`, with the fact
  path (`adoptFact`), mount reconciliation, `keepMounted`, or the popup apply effects.

Breaking changes: no API change. Timing changes for action-less uncontrolled owners: content
commits in its own deferred render, no longer in the same commit as other transition updates
of the same event. `pending` on those owners no longer covers unrelated entangled actions
(an improvement: today a Menu trigger shows `data-pending` for someone else's save).

### (e) Considered and rejected: do not await the consumer's promise inside the transition

Track the promise outside React, rebuild optimistic state with `useState`. This is what the
non-async libraries effectively do. It removes the cause, but the optimistic value would drop
before the consumer's post-`await` state lands (a flicker back to the old value), and errors
would no longer take React's route to the boundary. It gives up what "Async React-native"
means.

## 4. What each option changes in the documents

| | `docs/vision.md` | `design/conventions.md` |
| --- | --- | --- |
| (a) | nothing | nothing (2.3 item 5 already states it); docs site and skill only |
| (b) | principle 2 loses "by default" for action-less owners; principle 1 gains an exception | 2.3, 3.2, 3.3, 6 (fallbacks appear), 5.1 (no view transition) |
| (c) | principle 2 names the opt-out | 3.1 (a new prop on every owner), 2.6 |
| (d) | principle 2 gains one sentence: an update with no action to await is written urgently and its content follows in a deferred render, so it still never blocks and never shows a fallback over visible content | 2.3 (the contract applies when an action prop is present), 2.3 item 5 (what is and is not held), 3.2 (a `deferred` row; content regions read it), 3.3 (the action-less commit), 3.4 and `internal-hooks.md`, 4.3 (`pending`), 5.1 and 5.3 (types on a deferred commit), 6 |

## 5. Recommendation

1. Do (a) now. It is needed whatever else is decided, because controlled and with-action
   owners stay entangled.
2. Approve (d) in principle, gated on a spike: prototype it in `useControllableAction` on a
   branch, run the full suite on three engines, and settle the transition-types question. If
   the spike fails on types only, ship (d) with types dropped on action-less commits only if
   the user accepts that; otherwise fall back to (c) built on the deferred read.
3. Record in a repo issue that React's async action scope entangles unrelated transitions and
   that the source names AsyncContext as the fix, for a human to raise upstream if wanted.

Decisions for the user:

- Is "no action prop means no transition" acceptable under principle 2, given the deferred
  render keeps the Suspense behaviour?
- Is the cliff acceptable (adding a synchronous action makes the open entangle-able again)?
- If transition types cannot be attached reliably, which gives way: the types on action-less
  commits, or the fix?

## 6. Probe results in full

`probes-206/jsdom-probes.output.txt` has the jsdom output. The Chromium view transition probe
(`document.startViewTransition` spied, the content mounted inside an entering
`<ViewTransition>`):

| Unrelated action pending | Types added | Content shown while pending | `startViewTransition` calls before the action settles |
| --- | --- | --- | --- |
| yes | no | yes | 1, no types |
| yes | yes (companion transition update) | yes | 1, `["fsui-probe"]` |
| no | no | yes | 1, no types |
| no | yes (companion transition update) | yes | 1, `["fsui-probe"]` |

With an empty companion transition (`addTransitionType` and no state update) the type was
attached only when an action was pending, so the companion update is required. When the
unrelated action settles, its own commit runs one more view transition with no types; that
happens today as well.
