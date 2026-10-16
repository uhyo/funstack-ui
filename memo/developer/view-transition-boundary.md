# Conditional ViewTransition boundary (issue #35)

Date: 2026-10-16. Branch `worktree-agent-aa29c1d6a29bcf2a9`.

## What changed

- `packages/ui/src/internal/transition-boundary.tsx`:
  - `transitionBoundary(transition, node)`: pure function. Returns `node` unchanged when
    `transition === undefined`, otherwise `<ViewTransition default={transition}>{node}</ViewTransition>`.
    It is a function rather than a component, so no extra fiber sits between the boundary and the
    element.
  - `useTransitionBoundary(part, transition, node)`: the same, plus a dev warning (once per instance,
    from an effect) when `transition` changes between undefined and a value after mount. The hook
    lives in the part component above the boundary, so its refs survive the remount it warns about.
- Every part that rendered `<ViewTransition default={transition ?? "none"}>` now ends with
  `return useTransitionBoundary("<Part>", transition, element)`. The parts are Toggle, Switch,
  Checkbox, RadioGroup.Item, Tabs.Tab, Tabs.Panel, Accordion.Item/Trigger/Panel and Dialog.Popup.
  Accordion and Dialog pass `isLibrary ? transition : undefined`, so static mode renders no
  boundary. The existing static-mode `useDevWarning` calls still fire.
- Each part's `transition` JSDoc now says "Default: no boundary". It also has a paragraph
  explaining that the prop is static and that any value makes mounts and reveals run the page
  cross-fade.
- `packages/example/src/tabs-demo.css` has the opt-in page-policy CSS as a commented block.

## Findings (jsdom stub + browser measurements)

- jsdom: stub `document.startViewTransition` with a function that records the call and throws.
  react-dom catches the throw and commits synchronously, so the count equals what a real engine
  would start. Use `Object.defineProperty` and `Reflect.deleteProperty`, because lib.dom already
  declares the method.
- `addTransitionType` inside a transition with no boundary anywhere: zero calls. The start
  decision depends only on the boundary fibers; types are not part of it.
- **Accordion expand does not mount anything.** Item, Trigger and Panel are always mounted under
  `<details>`, so expanding with `transition="none"` starts no view transition (measured 0 calls,
  3 ms / 7 ms). The research doc's "Accordion.Panel expanding mounts or reveals it" row is wrong.
  Accordion only pays when an Item mounts in a transition (a list grown in an action).
- **A plain Dialog open with `transition="none"` starts no view transition either.** This holds for
  `keepMounted` both false and true. The `<dialog>` is always mounted, and the content mounts
  under that existing host element, which clears the subtree flag. The cost comes from a
  boundary *inside* the content, such as a nested Dialog's Popup (the issue's case) or any part
  at the top of the content. The design's Dialog 13.2 row ("with `transition="none"` it is called
  once per open") does not match this. My tests assert the nested case.
- `Tabs.Panel` with `keepMounted` false or true: each switch with `"none"` starts one (2 calls
  for 2 switches). `"until-found"` starts none.

Timings (second transition commit right after the first, in-page `click()`, ms):

| Scenario | Chromium | Firefox |
| --- | --- | --- |
| Tabs keepMounted=false, no transition | 6 | 15 |
| Tabs keepMounted=true, no transition | 9 | 10 |
| Tabs keepMounted=false, "none" | 282 | 281 |
| Tabs keepMounted=true, "none" | 300 | 284 |
| Accordion, no transition | 2 | 9 |
| Accordion, "none" | 3 | 7 |
| Nested Dialog, no transition | 5 | 7 |
| Nested Dialog, "none" | 281 | 260 |

WebKit fails to launch on this machine (`browserType.launch` error), as noted in the research.
The browser test should still pass there, since it branches on nothing engine-specific.

## Test notes

- Browser timing tests turn `IS_REACT_ACT_ENVIRONMENT` off and click in-page, outside `act`,
  because `act` would flush React's queue and hide the scheduling delay. `afterEach` waits for
  `document.__reactViewTransition.finished` so that a "none" row cannot hold the next test.
- Under a full parallel run (jsdom and two browsers), a single measurement occasionally reached
  51 ms. `bestOf` re-mounts and measures up to 3 times. A held commit is about 250 ms on every
  attempt, so a real regression still fails.
- In the full parallel run, pre-existing jsdom tests in accordion.test.tsx and tabs.test.tsx
  failed intermittently under load ("multiple mode accumulates open items", "a value matching no
  tab ..."). They pass when run alone, 3 of 3.
