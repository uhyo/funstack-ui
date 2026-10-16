# `<ViewTransition default="none">` is not free on mount (issue #35)

Date: 2026-10-16. React / react-dom 19.3.1. Measured in Playwright Chromium 156 and Firefox 157
(vitest browser mode). WebKit was not runnable on this machine.

## Summary and verdict

Conventions 5.1 says a `<ViewTransition default="none">` costs nothing. That is true for updates
and unmounts. It is **false for mounts and `<Activity>` reveals**. When such a boundary enters in a
transition-lane commit, react-dom always calls `document.startViewTransition`, whatever `default`,
`enter`, or a type map resolves to. The browser then runs its own default root cross-fade
(`::view-transition-old(root)`, 250 ms). React makes every later transition-lane commit wait for
that view transition's `finished`, so the next tab switch, dialog open, or action settle lands
about 260-280 ms late.

No prop combination avoids it. Global CSS shrinks it to one or two frames but changes the consumer's
whole page. The only clean fix is library-side.

**Verdict: adopt mitigation (d).** A part renders `<ViewTransition>` only when the consumer passes
`transition`. With no `transition`, the part renders no boundary and starts no view transition.
This changes the component API contract slightly (see "API impact").

## What react-dom 19.3.1 does

File: `react-dom/cjs/react-dom-client.development.js` (19.3.1). Line numbers refer to that file.

`shouldStartViewTransition` is reset to `false` at the start of every commit (19571). It becomes
`true` in only two places:

1. **`trackEnterViewTransitions`** (14377-14380):
   ```js
   function trackEnterViewTransitions(placement) {
     if (30 === placement.tag || 0 !== (placement.subtreeFlags & 33554432))
       shouldStartViewTransition = !0;
   }
   ```
   Tag 30 is `ViewTransition`; flag `33554432` marks "a ViewTransition is in this subtree". There is
   no class check. It is called from `commitBeforeMutationEffects` (14915, 14932) for:
   - a newly placed fiber (`alternate === null && flags & Placement`);
   - an `<Activity>` going from hidden to visible.

   Both calls run only when every committed lane is a transition, retry or idle lane (14899,
   mask `335544064`).
2. **`applyViewTransitionToHostInstancesRecursive`** (14423), which runs only after the resolved
   class is checked against `"none"`. Exits (`commitExitViewTransitions`, 14567), updates and
   layout (`commitNestedViewTransitions`, 14604) and shared pairs all go through
   `getViewTransitionClassName(...) !== "none"` first.

The `"none"` check on enter does exist, in `commitEnterViewTransitions` (14492). It runs inside the
`update` callback of the view transition that has already started. It decides only whether the
boundary's DOM gets a `view-transition-name`. The document transition runs either way.

**Host elements shield nested boundaries.** `completeWork` for a host component clears the
ViewTransition subtree flag (`subtreeFlags &= -33554433`, 12990 and 13142). A boundary counts as
entering only when no *new* DOM element sits between the insertion point and the boundary. Function
components and Fragments do not shield. Because conventions 5.1 makes `<ViewTransition>` the
outermost node of every part, the part is always exposed whenever it is itself the top of an
inserted subtree.

**Every later transition commit waits.** In `completeRootWhenReady` (18261; check at 18298-18314), if
`document.__reactViewTransition` is set when a transition-lane commit is ready, the commit is
suspended until that transition's `finished` promise settles. The timeout is
`SUSPENSEY_STYLESHEET_TIMEOUT`, which is 60 s. Sync-lane commits, including optimistic updates, are
not delayed.

Passive effects of the entering subtree are **not** delayed. Measured: `useEffect` ran 4-7 ms after
`startTransition`.

### When a document view transition starts

All rows assume a transition-lane commit. Sync-lane commits never start one.

| Case | Starts `startViewTransition`? |
| --- | --- |
| Boundary with `default="none"` mounts at the top of the inserted subtree | **Yes** |
| Same with `enter="none" exit="none" update="none" share="none"` added | **Yes** |
| Same with `default={{ default: "none" }}` (type map) | **Yes** |
| Boundary inside a function-component wrapper that mounts | **Yes** |
| `<Activity>` hidden to visible with a `"none"` boundary inside | **Yes** |
| Boundary mounts under a newly inserted DOM element | No (flag cleared by the host fiber) |
| `"none"` boundary unmounts | No |
| Content inside a `"none"` boundary updates | No |
| No `default` prop (`"auto"`): mount, unmount or update | Yes (class is `auto`, not `none`) |

## Measurements

Probe: `memo/platform-researcher/probes/09-view-transition-mount-cost/` (test file and raw output).
One `startTransition` mounts the subject. As soon as it commits, a second `startTransition`
updates an unrelated `<p>`. Values are medians of 5 runs in milliseconds.

| Scenario | Starts a view transition | Chromium wait for 2nd commit | Firefox wait for 2nd commit |
| --- | --- | --- | --- |
| No boundary (baseline) | no | 1 | 2-3 |
| Mounts `default="none"` | yes | 263-278 | 279-280 |
| Mounts `default="none"` plus `enter`/`exit`/`update`/`share` `"none"` | yes | 264-280 | 264-280 |
| Mounts `default={{ default: "none" }}` | yes | 281 | 264-280 |
| `default="none"` under a new `<section><div>` | no | 0 | 1-2 |
| `<Activity>` reveal with `"none"` boundary inside | yes | 280-281 | 280 |
| Unmount of a `"none"` boundary | no | 0 | 1 |
| Update inside a `"none"` boundary | no | 0 | 1 |
| Mount plus CSS `animation: none` on `::view-transition-group/old/new(root)` | yes | 31 | 13-14 |
| Mount plus CSS `animation-duration: 0s` on the same | yes | 31 | 12 |
| Mount plus CSS `::view-transition-group/old/new(*) { animation: none }` | yes | 30-31 | 14 |
| Mount plus CSS `:root { view-transition-name: none }` | yes | 31 | 14-15 |
| Boundary not rendered at all, which is mitigation (d) | no | 1 | 2 |

At `ready`, the animations present for a `"none"` mount were the same in both engines:

```
::view-transition-old(root) 250ms
::view-transition-group(root) 0ms
::view-transition 0ms
```

This is the UA default from CSS View Transitions 1 section 5. The UA sheet sets
`:root { view-transition-name: root }` and `::view-transition-group(*) { animation-duration: 0.25s }`.
So the whole page cross-fades for 250 ms even though no component asked for animation.

Real `Tabs` from master, uncontrolled, no action and no `transition` prop. The probe clicks B, waits
until panel B is visible, then clicks C and measures until panel C is visible:

| Tabs.Panel | Chromium click C to panel C | Firefox click C to panel C |
| --- | --- | --- |
| `keepMounted={false}` | 311 | 273 |
| `keepMounted={true}` (`<Activity>`) | 330 | 279 |
| `keepMounted={false}` plus root `animation: none` CSS | 57 | 24 |

Each tab switch started a document view transition: 2 per run.

**Pointer input during the cross-fade.** A real Playwright click was issued 50 ms after a `"none"`
mount.
- **Chromium:** the click reached the button during the transition.
- **Firefox:** Playwright saw the button as not hittable and delivered the click 123 ms *after* the
  transition finished. With `::view-transition { pointer-events: none }`, the click landed during
  the transition.

The spec says that while rendering is suppressed, all pointer hit testing targets the document
element (CSS View Transitions 1, section 7.1.1). In Firefox, a human click during the 250 ms window
can therefore miss its target. This is an inference from Playwright's actionability check and was
not tested with a human pointer.

## Mitigations

| Option | Avoids the delay | Side effects on the consumer | Verdict |
| --- | --- | --- | --- |
| (a) `enter="none" exit="none"` in addition to `default="none"` | **No** (measured). The enter gate never reads props. | none | Reject |
| (b) Ship or document `::view-transition-old/new/group(root) { animation: none }` | Partly. 31 ms in Chromium, 13 ms in Firefox: a document view transition still runs for 1-2 frames. | Global. It removes the page cross-fade for *every* view transition, including the consumer's router transitions. A running view transition also aborts any other active one (spec 6.1.1) and suppresses rendering for a frame. | Reject as a library default. Fine as consumer CSS. |
| (c) `:root { view-transition-name: none }` | Partly. Same 1-2 frames. | Global. The page has no root snapshot for any transition. Measured: the consumer's own `probe-fade` boundary still animated. | Reject as a library default |
| (d) Render `<ViewTransition>` only when `transition` is passed | **Yes.** Baseline timing, no `startViewTransition` call. | Toggling `transition` between undefined and defined changes the element type at the root of the part, so React remounts the part's subtree, losing DOM and state. SSR is unaffected: the decision is a pure function of props on both server and client. | **Adopt** |
| (e) `addTransitionType` plus a class map that resolves to `"none"` | **No** (measured with `{ default: "none" }`). Types are resolved after the gate. | none | Reject |

Cross-engine notes:
- **Firefox:** same-document view transitions shipped in Firefox 144 (Baseline Newly available,
  October 2025). Firefox 157 accepts React's `startViewTransition({ update, types })` call; no
  error was thrown, and timings match Chromium.
- **WebKit:** WebKit supports the API but was not measured here. The cause sits in react-dom and the
  250 ms comes from the spec's UA stylesheet, so the same behavior is expected. This is unverified.
- **Browsers without the API:** react-dom's `try`/`catch` falls back to a synchronous commit with no
  cost.

## Recommendation

### Conventions 5.1

Replace "with `default="none"`. Nothing animates unless the consumer opts in, and when it is
`"none"` React does not even assign a name, so the cost is nil" with a rule along these lines:

> A part renders `<ViewTransition default={transition}>` as the outermost node of its output **only
> when `transition` is not `undefined`**. Without `transition`, it renders no boundary. Reason:
> react-dom 19.3.1 starts a document view transition whenever a boundary mounts or is revealed by
> `<Activity>` in a transition commit, regardless of `"none"`. The browser's 250 ms root cross-fade
> then runs, and every later transition commit waits for it (docs/research/view-transition-mount-cost.md).
> An explicit `transition="none"` keeps the boundary, so a consumer can switch between `"none"` and
> a class without remounting. `transition` should be treated as static. Changing it between
> `undefined` and a value remounts the part.

Also correct these:
- **Consumer docs:** any `transition` value, including a type map whose types do not match the
  commit, makes mounts and reveals of that part start a document view transition. Rollbacks and
  snap-backs that carry no `fsui-*` types are included. Docs for `transition` should show the
  consumer-side CSS:
  ```css
  ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
  ::view-transition { pointer-events: none; }
  ```
  These are opt-in. The first rule keeps the page from cross-fading. The second keeps clicks
  working in Firefox during the transition.
- **Static-mode parts:** "Parts whose visibility is browser-owned render no `<ViewTransition>`"
  should be enforced in code. Accordion Item, Trigger and Panel currently render
  `<ViewTransition default="none">` in static mode. Under (d) they render nothing.
- **Optional dev-only warning:** warn when `transition` flips between `undefined` and defined on a
  mounted part.

### Per component

Each case below only matters in a transition-lane commit where the part is the top of the inserted
or revealed subtree.

| Part | Mount or reveal in a transition today | With (d) |
| --- | --- | --- |
| `Tabs.Panel`, `keepMounted={false}` | Every tab switch mounts the panel, measured at about 300 ms per switch | No cost unless `transition` is set |
| `Tabs.Panel`, `keepMounted={true}` | Every switch reveals an `<Activity>`, same cost (measured) | Same |
| `Tabs.Panel`, `keepMounted="until-found"` | No mount or reveal, update only, so no cost | Unchanged |
| `Accordion.Panel` (library mode) | Expanding mounts or reveals it, same cost as Tabs | No cost unless set |
| `Accordion.Item` / `Trigger` | Only when the item itself is inserted in a transition, for example a list grown in an action | No cost unless set; static mode renders no boundary |
| Dialog `Popup` (worktree branch) | Every library-mode open mounts it. Nested dialogs see the 250 ms as delayed inner opens, as the issue reports | No cost unless set |
| `Toggle`, `Switch`, `Checkbox`, `Tabs.Tab` | Only when the part is conditionally rendered without a new wrapping DOM element, for example `{show && <Toggle/>}` or a route or Suspense reveal whose top node is the part | No cost unless set |

Tests: `tabs.browser.test.tsx` already passes `transition="auto"` when it asserts
`startViewTransition`, so it is unaffected. Implementers should add one browser test per
mount-prone part: with no `transition`, a switch or open does not call `document.startViewTransition`.

### Upstream

The enter gate in `trackEnterViewTransitions` could resolve the class from `memoizedProps` the way
the exit and update paths do. That would make `"none"` free on enter. It may be deliberate, since
nested named pairs are resolved later. Per policy, nothing was filed upstream. Whether to report it
to facebook/react is for a human to decide, and should be tracked in this repo's issue #35.

## References

- react-dom 19.3.1 `cjs/react-dom-client.development.js`: `trackEnterViewTransitions` 14377,
  `applyViewTransitionToHostInstancesRecursive` 14406-14440, `commitEnterViewTransitions` 14492,
  `commitExitViewTransitions` 14567, `commitNestedViewTransitions` 14604,
  `commitBeforeMutationEffects` 14825-14943, host flag clearing 12990/13142, wait on active
  transition 18298-18314, `startViewTransition` host config 24283.
- CSS View Transitions Module Level 1, UA stylesheet (section 5), hit testing during rendering
  suppression (section 7.1.1), and starting a transition skipping the active one (section 6.1.1):
  https://drafts.csswg.org/css-view-transitions-1/
- Same-document view transitions Baseline (Firefox 144):
  https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- React `<ViewTransition>` reference (enter is "the first component inserted in this Transition"):
  https://react.dev/reference/react/ViewTransition
- Prior research: `docs/research/react-async-apis.md` section 5; the finding in the Dialog
  developer memo on branch `worktree-agent-af70e8256a07c12e5`.
