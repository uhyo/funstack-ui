# #170 NavigationMenu, developer notes

Branch `feat/170-navigation-menu`. Design: `design/components/navigation-menu.md` (accepted de1ccd4d).

## Test-plan step 1: a Link's close vs a router navigation in a transition

Probe: the example app's NavigationMenu demo (`packages/example/src/navigation-menu-demo.tsx`) with
FUNSTACK Router 1.6.0 (`<Router routes>`, plain `<a href>` links intercepted through the
Navigation API, route component suspending 800 ms with `use()` and no Suspense boundary). A
Playwright script sampled `:popover-open`, the route heading and `useIsPending()` every frame and
wrapped `document.startViewTransition` to log each view transition and its types.

Result (Chromium and Firefox, same in every run; WebKit not runnable on this machine):

- **The panel does not wait for the route.** Following a Link in a library-mode panel closes it
  in its own commit about 50-100 ms after the click (as soon as `openChangeAction(false)`
  settles); the new route commits about 800 ms later, when its content resolves. Two commits.
- With `transition` on the Popup, the close runs its own view transition (types
  `fsui-navigation-menu`, `fsui-navigation-menu-close`); the route's commit runs a second one.
  Not the same view transition.
- Side effect: the router adds its transition type (`navigation`) inside its outer async
  transition, before `await wait`; the entry change itself is a nested `startTransition` after
  the await. The close commit that lands in between sometimes picks up `navigation` (Chromium:
  both runs; Firefox: one of two), and the router's own commit then has **no** types. A
  consumer's `:active-view-transition-type(navigation)` CSS can then animate the panel close
  instead of the page change.
- JS-free mode: `hidePopover()` in the click, the panel is gone in the next frame, the route
  commits later. Expected.

Why: the router's entry change is a new transition started after an `await`, so it is not in
the lane of the close request; once the close's async action has settled nothing entangles the
two, and the suspended route lane does not hold the close lane. (A close action that is still
pending when the router calls its inner `startTransition` would be entangled by React's async
action scope; not tested.)

Reported for design 9 walkthrough 3: the docs say the panel closes when the link is followed
(right away), not "together with the new page". SendMessage was not available in this session,
so the result went to the caller's report instead of directly to `arch-170`.
