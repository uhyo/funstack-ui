# Architect notes: Collapsible (#163), 2026-11-26

Working notes behind `design/components/collapsible.md`. Not a spec.

## What I read

- #163, #162 (wave 23 plan), vision, conventions (2.1, 2.2, 3.1 to 3.7, 3.9, 4.3, 5, 7.3, 8, 9),
  accordion.md, `packages/ui/src/accordion/*`.
- No new probes. Everything platform-side is Accordion's (memo `accordion-notes.md`).

## Findings in the code

- `Accordion.Item` already works outside a Root as a JS-free disclosure (`root` is null:
  static mode, `defaultOpen` renders `open`). So the JS-free half of Collapsible exists today;
  what Collapsible adds is library mode for one element, and a name.
- `AccordionTrigger` and `AccordionPanel` read only the item context. The click rule
  (`nestedInteractive`, `SELF_ACTIVATING`) is the piece worth moving to `internal/` (flat: no
  hook from `action/`).
- The Root-side platform path in Accordion is set-shaped (`dispatchFromDom`, `intendedValue`,
  the `whole` mount dispatch). For a boolean it collapses to: toggle handler, mount layout
  effect, re-apply layout effect. Not worth a shared hook with Accordion.

## Decisions I went back and forth on

1. **Does `defaultOpen` select library mode?**
   - (a) JS-free, like `Accordion.Item defaultOpen`: then uncontrolled library mode needs
     `openChangeAction`, and `{({ open }) => open && <Lazy />}` without an action is impossible
     (Panel `state.open` is `undefined` in JS-free mode). A dummy action is ugly.
   - (b) library mode, like overlay Roots (3.9.11) and like Accordion's `defaultValue={[]}`.
     HTML identical, native before hydration; after hydration the click goes through a
     transition that commits at once. Nothing a user can see differs. Chose (b).
   - The price: `<Collapsible.Root>` and `<Collapsible.Root defaultOpen={false}>` differ in
     mode. Same as Popover / Dialog today.
2. **`onOpenChange`.** The issue text mentions it. Applied the test of conventions 2.1 ("can
   the library put the UI back without the user noticing?"): yes for every path of a
   `<details>`. Accordion already answered this. No fact channel.
3. **Trigger placement.** `<summary>` must be the first child. Radix users put the trigger
   anywhere. Options: accept the limit (chosen), or a second base with `button[aria-expanded]`
   plus `hidden="until-found"` (Tabs' hook exists). The second is a different component in
   everything but the name (no JS-free toggle, ids, `aria-controls`, `beforematch`). If users
   ask, design it as its own part set, not as a switch on this Root.
   - Worth a browser probe later: `details { display: flex; flex-direction: column-reverse }`
     to put the summary visually under the content ("show more" at the bottom). Needs
     `::details-content` as a flex item in all three engines; unverified, so not in the doc.
   - A collapsed preview (first three lines visible) cannot be done with `<details>`: closed
     content is `content-visibility: hidden`. Out of scope.
4. **pending on the Trigger.** Accordion: `root.pending && optimistic !== committed` because
   several items share one transition. Here one element: plain owner pending (Toggle's rule).
5. **Type names.** `expand` / `collapse` (Accordion) over `open` / `close` (overlays): the task
   says same names as Accordion, and a consumer's CSS for the `-expand` type reads the same in
   both.
6. **`name` on the Root.** Omitted. A JS-free exclusive group of standalone disclosures is
   `Accordion.Root exclusive`.

## For the developer

- `scripts/check-design-refs.mjs` fails on a code span naming a file that does not exist, so
  the doc names no Collapsible source file. Add them to the doc only with the implementation.
- Registry rows to add to the conventions at implementation are listed in the changelog entry.
- Also: the tsdown entry list, the root export, the docs page, the skill's component list.

## Open for the user

In the handback of 2026-11-26: `defaultOpen` and mode; no `onOpenChange`; `<details>` only
(Trigger first child); rootless `Accordion.Item`.
