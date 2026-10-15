# FUNSTACK UI — product vision (gathered from user 2026-10-15)

## Family context
FUNSTACK = family of libraries by uhyo aiming to be "the world's most modern React stack".
Existing: FUNSTACK Router (Navigation API router), FUNSTACK Static (RSC framework without a server).

## Positioning
**FUNSTACK UI = the first UI library that is Async React-native.**
Headless UI library for React. Builds on React's "Async React" direction.

## Decisions so far
- First iteration scope: simple primitives (Toggle, Tabs, Accordion, Tooltip) to settle API conventions.
- Tooling: conventional stack, aligned with family conventions (see family-conventions.md).
- Workflow: fully autonomous; interrupt user only for blockers / key decisions.

## What "Async React-native" means (from user)
1. **Suspense-native.** Components must work correctly when content suspends.
2. **"Everything is transition" principle** (React team member's phrase). Conceptually almost all state updates
   can be transitions. Transitions are opt-in today only for backwards compatibility; if React were
   recreated, transitions would be the default and users would opt *out* for urgent updates
   (e.g. keyboard input into `<input>`). FUNSTACK UI builds "transition by default" into the library.
3. **Action props pattern** (from React official docs). Props named `action` / `fooAction`
   (e.g. `clickAction`) are like event handlers but the component wraps them in a transition
   (`startTransition`). This is how transition-by-default becomes built-in.
   - User is even interested in **not providing traditional `onClick`-style handlers at all**, in favor
     of action props. (Bold API decision; implications: pending state exposure, urgent opt-out mechanism.)

4. **`useOptimistic` for quick feedback.** Confirmed by user: transition-first components must use
   `useOptimistic` so the UI responds immediately while the action is pending.
5. **`<ViewTransition>` built in.** React 19.3 stabilized `<ViewTransition>`; it integrates with
   transitions. Components should build it in to allow nice animations.
6. **Greedy adoption of modern HTML/CSS.** Research modern platform features thoroughly and adopt
   anything useful. Example bet (needs research first): HTML Popover API + CSS Anchor Positioning
   could realize a Tooltip with no JS running at all.
   (Also: Dialog element, `inert`, `:has()`, `@starting-style`, `interestfor`/`interesttarget`,
   `popover=hint`, CSS `anchor()`, scroll-driven animations, `field-sizing`, `hidden=until-found`, customizable `<select>`... — to be researched.)

## Decided
- Package name: `@funstack/ui`.
- Browser support: **latest stable of each major engine**, no fallbacks. Being modern is the competitive point.
  Features not yet in all major engines may be used behind an **experimental flag**.
- Non-goals: none specific. Experimental now, but the ultimate goal is a **competitive UI library with
  a full feature set and great accessibility**.
- Urgent opt-out strategy: defer; design when the first component that needs it (e.g. Combobox) arrives.

## Implications to keep in mind (PO notes)
- Need a **platform research** workstream (agent) producing a living document of modern HTML/CSS
  features, browser support, and relevance to each component. Research precedes implementation bets.
- Every interactive primitive needs: action props wrapped in startTransition, exposure of pending state
  (useTransition's isPending / useActionState / useOptimistic), and a story for urgent opt-out.
- Async actions (returning promises) should be first-class: pending UI, optimistic updates.
- Tests must exercise suspending children and async actions, not just sync happy paths.

## Open questions
- Whether `onClick` survives at all — user leaning to drop.
