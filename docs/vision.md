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

(Urgency is used only where the change is a fact the library cannot hold, such as the text of a
controlled text input or a popup the user dismissed; see `on*` handlers in principle 3.)

### 3. Action props instead of event handlers

Following the "action props" pattern from the React docs, interactive props are named `action` or
`fooAction` (e.g. `clickAction`, `changeAction`). They behave like event handlers, but the component
wraps them in a transition. Actions may be async (return a promise). The library's preferred API
offers action props, **not** traditional `onClick`-style handlers.

The name is a contract, and it separates requests from facts:

- A prop named `action` or `fooAction` is a **request**: a change the library can still roll back.
  The component calls it before the change is committed, inside a transition, and awaits it. A
  rejection, or a controlled parent that does not adopt the value, rolls the UI back, so the change
  has pending and optimistic state. Native form controls fit here even when the browser changes the
  DOM first (a click on a checkbox, a form reset): the DOM is the optimistic state and is restored
  on failure.
- A prop named `onFoo` reports a **fact**: a change that had already happened when the library heard
  of it and that it could not hold, such as the text of a controlled input (React requires it to
  update synchronously) or a popup the user dismissed with Escape. Every `on*` handler the library
  defines follows one rule: it is called synchronously, outside any transition, and is not awaited,
  so there is no pending state. It may return a promise; a rejected promise or a thrown error goes
  to `reportError`.

Most state has only an action. Where both kinds of change exist (an overlay's `open`), a component
offers both props, `openChangeAction` and `onOpenChange`.

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
