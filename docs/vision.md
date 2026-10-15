# FUNSTACK UI — Vision & Principles

FUNSTACK UI (`@funstack/ui`) is a headless UI component library for React and a member of the
**FUNSTACK** family (alongside [FUNSTACK Router](https://github.com/uhyo/funstack-router) and
[FUNSTACK Static](https://github.com/uhyo/funstack-static)). The FUNSTACK family aims to be the
world's most modern React stack.

**FUNSTACK UI is the first UI library that is Async React-native.**

It is experimental today, but the ultimate goal is a competitive UI library with a full feature set
and great accessibility.

## Principles

### 1. Suspense-native

Components must behave correctly when their content suspends. Suspending children are a normal
situation, not an edge case.

### 2. Transition by default ("everything is transition")

Conceptually, almost every state update can be a transition. React keeps transitions opt-in only
for backwards compatibility; if React were designed today, transitions would be the default and
urgent updates would be the opt-out. FUNSTACK UI builds this principle in: state updates triggered
through the library are transitions unless there is a specific reason for urgency.

(The urgent opt-out mechanism is intentionally undesigned until a component genuinely needs it,
e.g. text input in a Combobox.)

### 3. Action props instead of event handlers

Following the "action props" pattern from the React docs, interactive props are named `action` or
`fooAction` (e.g. `clickAction`, `changeAction`). They behave like event handlers, but the component
wraps them in a transition. Actions may be async (return a promise). The library's preferred API
offers action props, **not** traditional `onClick`-style handlers.

Consequences:

- Components expose **pending state** (e.g. a `data-pending` attribute or render-prop value) while an
  action is in flight.
- Components use **`useOptimistic`** so the UI responds immediately while the action is pending.

### 4. `<ViewTransition>` built in

React 19.3 stabilized `<ViewTransition>`, which integrates with transitions. Components build it in so
that state changes can be animated nicely.

### 5. Greedy adoption of modern HTML/CSS

Research modern platform features thoroughly and adopt anything useful to UI components: Popover
API, CSS Anchor Positioning, `<dialog>`, `inert`, `@starting-style`, `hidden=until-found`,
customizable `<select>`, and so on. Where the platform can do the job, prefer it over JavaScript —
a primitive that needs no JS can even be a Server Component.

Bets on platform features are made **after** research confirms them, not before.

### 6. Accessibility is not optional

Being modern does not excuse being inaccessible. Components follow the WAI-ARIA Authoring Practices
and are tested for keyboard and assistive-technology behavior.

## Browser support policy

**Latest stable version of each major engine (Blink, WebKit, Gecko). No fallbacks.**
Being modern is the competitive point of FUNSTACK UI.

Features not yet shipped in all major engines may still be used **behind an experimental flag**.

## Initial scope

Settle API conventions with simple primitives first — Toggle, Tabs, Accordion, Tooltip — then grow
toward a full component set.
