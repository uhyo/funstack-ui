# Review of branch `wave14-docs` (#95, #97, #94)

Read-only review of worktree `/home/uhyo/repos/funstack-ui-wave14-docs`, commits `298ebe7` (static
1.3.4, #94) and `17e3269` (#97). `pnpm typecheck`, `lint`, `format:check` and `build` pass on the
branch. Developer notes: `memo/developer/docs-concepts-wave14.md` (branch).

Verdict: **merge as-is**; the items under "For #98" convert the combined section into the audit's
template afterwards. Two one-line fixes are worth doing before merge (below); nothing on the branch
is wrong for readers.

## Must fix before merge (one line each)

1. **Transitions page `PageHead` description** still says "Parts wrap themselves in
   `<ViewTransition>`", which the page body now contradicts (a boundary is rendered only when
   `transition` is passed). Same false claim as the Home principle (audit H5). Fix: "Parts whose
   content is driven by library state take a `transition` prop and tag changes with `fsui-*`
   transition types."
2. **Action props, "Form actions are a separate channel"**: "A Switch, Checkbox or RadioGroup
   inside `<form action={serverFn}>` needs no change action" is the last three-component
   enumeration on a concept page. Fix: "A native form control (a Switch, for example) inside …".

Both are text-only; neither blocks a merge if the PO prefers to fold them into #98.

## (a) Concept pages against #95

| Page                  | Conceptual wording | Examples (boxed `ConceptExample`)                                  | Terms                                         | Remaining enumerations                                                                 |
| --------------------- | ------------------ | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Action props          | yes                | Toggle ×2 boxed; Toggle `<Example>` (ToggleErrors) and Tabs/Toggle code snippets **unboxed** | `action`, `dispatch` defined; `pure trigger`, `state owner` linked | "A Switch, Checkbox or RadioGroup inside form action" (must-fix 2); `details.reason` table names Dialog and Toast inside definitions (acceptable: they are the only components with those reasons) |
| Pending & optimistic  | yes                | Tabs ×2, Button ×1 (pure trigger: Tabs cannot show it)             | Terms section: state owner, trigger, pure trigger, content region (panel), committed, optimistic, pending, rollback | none                                                                                   |
| Transitions           | yes                | Tabs ×3                                                            | Terms: commit, view transition, transition type; "lane" defined inline | types table cut to Toggle, Tabs, Dialog "a few examples" (as #95 asked)                 |
| Suspense              | yes                | Tabs ×3                                                            | links to Pending terms                        | none                                                                                   |
| Server Components     | yes                | Accordion ×1 (DialogConfirm example removed; it is on the Dialog page) | `hydration` defined; `js-free` id             | the bundle-size measurement names Accordion, Tooltip, Switch, Progress (data, not an explanation; fine) |
| Browser-owned state   | yes                | Tooltip, Accordion, Dialog, Switch, Checkbox: one per sub-section  | Terms: library-owned, browser-owned, dismissal, invoker command, JS-free mode / library mode | the "Examples" row listing every component was removed                                 |

"Panel" (the term the user flagged) is defined as "Content region (panel)" on Pending & optimistic,
and Getting started points there; every other concept-page use of "panel" is inside a Tabs example
or a Tabs code comment. Good.

Judgement calls to tell the user about:

- Browser-owned state uses **five** components, one per sub-concept (browser-owned, two modes,
  parts vs dismissals, native inputs, consumer-owned). Each sub-concept has one boxed example and
  no sub-concept could use the same component. I read #95 as "one component per concept", which
  this satisfies; if the user meant one per page, Tooltip + Accordion could carry the first two and
  the last three would lose their examples.
- Action props mixes boxed examples (Toggle) with unboxed code snippets (Tabs under "After an
  await" and "Await only what the UI must wait for", Toggle under "Server Functions") and one
  unboxed live `<Example>` (ToggleErrors). A reader sees two visual conventions for "an instance".
  Not wrong, but inconsistent with the other five pages; for #98.

## (b) Facts lost?

Spot-checked every removed table against the component pages' new `BehaviourSummary` rows and
existing sections:

- **Server Components "Before hydration" table (12 rows)**: every row is on its component page's
  "Before hydration" cell, including the details (Dialog non-modal needs JS; CheckboxGroup Parent
  "check all" and server `required`; Checkbox/Parent announced unchecked until hydration; Select
  copies into `Select.Value`; Button server HTML has no `aria-disabled`). Combobox's row drops the
  handler name (`inputValueChangeAction`), which suits #96. Nothing lost.
- **Transitions types table (12 rows)**: all on the component pages, plus new rows for Popover,
  Menu, ToggleGroup, Slider, NumberField, Button, Toolbar, Field, Progress, Meter, Context menu
  that master never had. Verified against `packages/ui/src`: Tabs' "only `fsui-tabs` when there is
  no committed tab" (`tabs-root.tsx:121-126`), Slider and NumberField `-change` / `-commit`
  (`slider-root.tsx:178`, `number-field-root.tsx:142`), ToggleGroup `-press` / `-release` from
  `details.added` / `removed` (`toggle-group-root.tsx:284`), Menu `-check` / `-uncheck` / `-select`
  and open/close through `use-popover-root.ts:172`, Combobox `fsui-combobox-select`
  (`combobox-root.tsx:168`). All correct.
- **Pending "Three values" Shown-by column, "Where data-pending lands" examples, the Accordion
  `aria-expanded` callout**: in the Tabs example and the Toggle / Accordion rows; the Accordion
  page's Keyboard and ARIA bullet already had the `aria-expanded` fact.
- **Transitions "What animates when" examples column and the Toggle callout**: in the Tabs example
  and the Toggle, Tooltip, Accordion (`::details-content`) and Dialog ("dismissals animate with CSS
  only") rows.
- **Suspense Accordion / Combobox / Tooltip sections**: in those rows.
- **Browser-owned state Dialog/Popover table (Owner / Which / How / Pending / refuses /
  Animation)**: collapsed to prose + Dialog example; the same facts are in the "Two modes" tables
  on Dialog and Popover, which were not changed.
- **Action props Naming table and the reason-usage sentence**: replaced by "each component page
  lists its own triple / its reasons"; spot-checked Toggle (event only), Tabs, Dialog, Switch,
  Toast: all list them. Nothing lost.
- **Progress / Meter "Known limitation" (#94) and the Roadmap Upstream row**: removed on the basis
  that `@funstack/static` 1.3.4 fixes the id collision; one general line kept on Server Components.
  Issue #94 is still open: the PO should close it (or verify the fix) so the docs and the tracker
  agree.

## (c) Term homes versus the audit glossary

Matches the glossary: part and Root (Getting started), state owner / trigger / pure trigger /
content region / committed / optimistic / pending / rollback (Pending & optimistic), transition
type (Transitions), browser-owned / dismissal / JS-free mode (Browser-owned state), "JS-free" the
property on Server Components with the mode on Browser-owned state (the split the audit suggested).
New and good: `action`, `dispatch`, `hydration`, `invoker command`, `view transition`, and "lane"
explained inline on Transitions.

Conflicts and gaps:

- **"Commit"** is now defined on Transitions as React's render commit, but the Slider and
  NumberField summary rows say "A commit: `fsui-slider` plus `fsui-slider-commit`" in the other
  sense (the gesture's save) right under a label that links to that definition. For #98: "A
  gesture's save (`valueCommitAction`): …".
- **"platform path(s)"** is still undefined; the Switch and Popover headings got ids and the
  summary rows link to them, but no page says what the phrase means. The glossary puts the
  definition on Browser-owned state ("a state change the browser makes on its own, dispatched with
  `reason: "platform"`"), where the "Mount reconciliation" and "Form reset" bullets already
  describe it without the name.
- Not defined as terms, used across the pages: **adopt**, **veto**, **channel** (form channel),
  **settle**, **notification**, **latest intent wins**, **foreign invoker**. Glossary homes: Action
  props (adopt, settle, channel), Pending (veto, latest intent wins), Browser-owned state
  (notification), Dialog page (foreign invoker).
- "Dismissal" says a click outside is "also called light dismiss". MDN uses light dismiss for both
  Escape and outside clicks on `popover="auto"`; the parenthesis is harmless but slightly off.
  Optional rewording for #98: "(light dismiss, in the Popover API's words)".
- "The urgent lane" section and the Combobox summary row keep `inputValueChangeAction` /
  `UrgentChangeAction` for #96, as the developer notes. The Combobox row links to
  `/concepts/action-props` with no anchor; #96 should add `id="urgent"` to that heading.

## (d) One combined "Async and platform behaviour" section

What the branch does: `BehaviourSummary` renders a 2-column table (Concept | Component) with five
fixed rows (Transition types, Optimistic and pending, Suspense, Browser-owned state, Before
hydration), row labels linking to the concept page, placed as the **last** section of every
component page with `id="async-and-platform"`. Cells are prose, from one sentence (Toolbar) to
about 90 words (Dialog "Before hydration"). Row text links back into the page where a longer
section exists (`#two-modes`, `#the-platform-paths`, `#suspense`).

Merge as-is: the rows are correct (checked above), identical in order and naming on all 23 pages,
and every concept page now says "see the X row of the component's Async and platform behaviour
section", so the contract between concept and reference pages holds. Nothing here misleads a
reader.

Why it should still become the template's sections in #98:

- A 90-word paragraph in a table cell next to a 12rem label is hard to read on a phone, and the
  `table-scroll` wrapper may put the prose behind a horizontal scroll (worth checking at 360px).
- The section is a *summary*: on Dialog the same facts now live in three places (Two modes table,
  The platform paths, the summary), so they will drift. Sections are the home of the facts; a
  summary that repeats them is a second copy.
- It sits at the bottom, after Recipes and Browser notes. The ids make deep links work, but a
  reader scanning headings for "before hydration" passes the whole page first.

Conversion in #98 that keeps the developer's work: keep the five row names as the template's
section names ("Transition types", "Optimistic and pending", "Suspense", "Browser-owned state",
"Before hydration"; the audit template's "Async behaviour" and "Transitions" become these), move
each cell's text into an h3 of that name placed after Keyboard and ARIA, fold the page's existing
duplicates into them (Dialog "The platform paths" → "Before hydration"; "ViewTransition: an exit in
every engine" → "Transition types"), and keep `BehaviourSummary` only if it becomes a short index of
links to those sections near the top. The `id="async-and-platform"` anchor should then redirect
to the first of them or be kept on a one-line index so the concept pages' links do not break.

## Unchanged items from the audit (still open after this branch)

Getting started `transition` "Default `"none"`" (H4), Home "wraps itself in `<ViewTransition>`" and
the stale component list (H5), Checkbox "being designed in issue #33" (H6), the duplicated
rule-explanations on component pages (H3), section naming beyond the new summary (H1), sidebar
grouping (M6, M7). All go to #98 (or a small accuracy commit for H4–H6, which are one line each).
