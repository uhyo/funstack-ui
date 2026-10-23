# Wave 14 docs audit: non-concept pages

Audit only (no edits). Scope: every page in `packages/docs/src/pages` on master except the six
concept pages a developer is reworking on `wave14-docs` (Action props, Pending & optimistic,
Transitions, Suspense, Server Components, Browser-owned state). Those were read only to find where
terms are defined. Pages audited: Home, Getting started, Experimental features, Content Security
Policy, Roadmap, and the 23 component pages. Sidebar: `src/navigation.ts`.

Rules referenced are the editorial rules in `.claude/agents/technical-writer.md` (R1 concept pages
conceptual, R2 reference pages own component facts with the same sections, R3 define every term,
R4 separate explanation from example, R5 accuracy, R6 plain prose), from #95 and #97.

Sections: 1 findings (severity-ordered), 2 glossary draft, 3 component-page template, 4 sidebar
proposal, 5 items for the product owner.

## 1. Findings

### High

**H1. No two component pages use the same sections or order (R2).**
Location: every component page. The same fact lives under a different heading on each page:

| Fact                   | Heading used                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending / optimistic   | "Async walkthrough" (Toggle, Tabs, RadioGroup, CheckboxGroup, Select, Switch), "Async walkthrough (library mode)" (Accordion, Dialog, Popover), "Async behaviour" (Checkbox), "Pending and re-entry" (Button), "Items, actions and closing" (Menu), "Accepting an option" (Combobox), "Two actions: steps and commits" (Slider, NumberField), none (ToggleGroup, Toolbar, Tooltip, Toast, Field) |
| Data attributes        | "Data attributes", "Data attributes and pseudo-classes", "Data attributes and CSS" (NumberField), "Data attributes and custom properties" (Progress, Meter); Toast has it as an h4 under Props                                   |
| Keyboard               | "Keyboard and ARIA", "Keyboard" (Toolbar, Combobox), "Keyboard, focus and ARIA" (Popover, Menu, Toast), "Keyboard, pointer and ARIA" (Tooltip), "Keyboard, buttons and wheel" + "Accessibility" (NumberField), "Accessibility" (Meter), "Accessibility and announcements" (Combobox) |
| Server / hydration     | "Server Components" (Button, Toast, Progress), "Server Functions" (Dialog), "Server Functions and forms" (Switch, RadioGroup, CheckboxGroup, Select), "From a Server Component" (Field, Progress), "The platform paths" (Switch, Dialog, Popover), "Before hydration" (Toolbar), "Forms and hydration" (Slider, NumberField), "Plain HTML" (six pages) |
| Styling                | "Styling", "Styling and animation" (Menu, Toast), "Styling and ViewTransition" (Combobox), "Styling the picker" (Select), or only a CodeBlock under Data attributes                                                               |
| Transition types       | stated under Styling (ToggleGroup, Button, Menu), under "Server Functions and forms" (CheckboxGroup, Select), in the Root props paragraph (NumberField), in the walkthrough (Tabs, partially), or not at all (see H2)             |

Order also differs: Combobox, Slider, NumberField, ToggleGroup, Toolbar and Field put one to three
explanatory sections before Anatomy; the others start with Anatomy then Props. Fix: adopt the
template in section 3 and give the standard sections fixed `id`s so concept pages can deep-link.

**H2. Standard facts are missing from component pages (R2; #97 item 3).**
The facts the concept pages are about to drop must exist on each component page. Today:

| Page          | Transition type(s)                              | Suspense                                      | Before hydration / no JS                               | Owner of state (browser vs library)      |
| ------------- | ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Button        | "adds no types" (Styling)                       | one clause in the `data-pending` row          | "Server Components" section                            | n/a                                      |
| Toggle        | **missing** (`fsui-toggle-press/-release` only on Transitions page) | "must not suspend" in a props row     | **missing** (only on Server Components page)           | n/a                                      |
| ToggleGroup   | Styling                                         | **missing**                                   | one bullet under Keyboard and ARIA                     | n/a                                      |
| Toolbar       | "adds no types"                                 | n/a                                           | own section                                            | n/a                                      |
| Tabs          | `fsui-tabs-next` in walkthrough step 2 only; `-prev` **missing** | intro + hero example, no section     | **missing** (only `until-found` in a props row)        | n/a                                      |
| Accordion     | **missing** (`fsui-accordion-expand/-collapse`) | walkthrough steps                             | one row of the Two modes table                         | Two modes table                          |
| Tooltip       | "no transitions" (good)                         | callout in Recipes                            | Two mechanisms table                                   | own section                              |
| Dialog        | ViewTransition section                          | walkthrough + `keepMounted` row               | "The platform paths"                                   | Two modes table + paragraph              |
| Popover       | ViewTransition section                          | walkthrough + `keepMounted` row               | "The platform paths"                                   | Two modes table + paragraph              |
| Menu          | Styling and animation + per item                | own section                                   | one bullet under Anatomy                               | "Always library mode" bullet             |
| Context menu  | "as Menu"                                       | one bullet under Opening                      | one bullet under Opening                               | n/a                                      |
| Switch        | **missing** (`fsui-switch-on/-off`)             | n/a                                           | "The platform paths"                                   | callout "Why the DOM shows…"             |
| Checkbox      | **missing** (`fsui-checkbox-check/-uncheck`)    | n/a                                           | bullets under Forms and Indeterminate                  | one sentence in Async behaviour          |
| RadioGroup    | **missing** (`fsui-radio-group`)                | n/a                                           | bullet under Forms                                     | callout                                  |
| CheckboxGroup | last paragraph of "Server Functions and forms"  | n/a                                           | bullets under Forms                                    | implicit                                 |
| Select        | last paragraph of "Server Functions and forms"  | "Options that load later"                     | bullets under Forms + Browser support                  | Anatomy bullet (`:open` is browser-owned) + callout |
| Combobox      | Styling and ViewTransition                      | inside "Typing is urgent…"                    | Anatomy bullet + Forms bullet                          | one row in Data attributes (`:popover-open`) |
| Toast         | "no part takes `transition`"                    | own section                                   | "Server Components" section                            | n/a                                      |
| Slider        | "no `transition` prop" but **types not stated** (verify in source whether any `fsui-slider*` type is added) | n/a | "Forms and hydration" + Plain HTML                 | n/a                                      |
| NumberField   | Root props paragraph                            | n/a                                           | "Forms and hydration" + Plain HTML                     | n/a                                      |
| Field & Form  | "no Field part takes `transition`"              | "must not suspend" (Error)                    | "From a Server Component"                              | `:user-invalid` is the platform's (good) |
| Progress      | "Not in this version"                           | "works as a Suspense fallback" (one clause)   | "Server Components" section                            | n/a                                      |
| Meter         | defers to Progress                              | defers to Progress                            | hero caption                                           | n/a                                      |

Fix: every page gets the four standard sections (Async behaviour, Suspense, Transitions, Server
Components and hydration) from the template; where a section does not apply, one sentence saying so
("Tooltip has no transitions: its open state is the browser's") rather than omitting it.

**H3. Component pages re-explain general rules at length instead of linking (R1/R2, the reverse
direction of #97).** The rule belongs on the concept page; the component page keeps the
component-specific consequence and a link.

- "Why the DOM shows the optimistic value" is a full callout on Switch, RadioGroup and Select, and a
  summary on Checkbox and CheckboxGroup. Rule home: Browser-owned state, "Native inputs". Keep one
  sentence + link.
- "`preventDefault()` is not a veto" callout on Switch, repeated on Checkbox and RadioGroup.
- The two channels (per-control change action vs React's form channel): a table or paragraph on
  Switch, Checkbox, RadioGroup, CheckboxGroup, Select, Slider, NumberField, Field, Button, Dialog.
  Rule home: Action props, "Form actions are a separate channel". The per-component table (what
  runs, what is pending, what is received) is fine; the surrounding explanation is not.
- "A slow awaited action holds every transition in the app" is explained again on ToggleGroup,
  Slider, NumberField, Combobox, Menu, Dialog (callout), Button, Progress. Rule home: Action props,
  "Await only what the UI must wait for". The `void save()` recipe may stay as one line with a link.
- The ViewTransition mount cost (issue #35) is explained twice each on Dialog (props + Recipes
  callout) and Popover (props + ViewTransition list), and on Transitions. Rule home: Transitions.
- "`data-side` is where the popup **is**" paragraph is near-verbatim on Tooltip and Popover, and
  again in Menu's Popup paragraph. The Firefox direction-island bug (Mozilla 2019601, #89) is
  explained in full on Tooltip, Popover, Menu, Combobox and Context menu. There is no concept page
  for placement; propose a short "Placement" section pattern (template, Browser notes) with one
  sentence and the #89 link, and make Tooltip's "Right-to-left" the one full explanation.
- "Parts vs dismissals" is explained on Dialog, Popover and Browser-owned state. Keep the Two modes
  tables (component facts); replace the identical "In library mode the line is drawn between…"
  paragraphs with a link.

**H4. Getting started is inaccurate in two places (R5).**

- "What every component shares" table, `transition` row: "Default `"none"`". Wrong: without the
  prop no `<ViewTransition>` is rendered (`packages/ui/src/toggle/toggle.tsx:58`,
  `src/internal/transition-boundary.tsx:8`; the Transitions page says the same). Fix: "Default:
  none rendered."
- The same table says `transition` is shared by every component. Tooltip, Select, Slider,
  NumberField, Field, Form, Toast, Progress and Meter have no `transition` prop. Fix: "on parts
  whose content is driven by library state".

**H5. Home page is stale and overstates (R5).**

- "Components" paragraph lists the first four primitives and the "second wave" only. Missing:
  Button, ToggleGroup, Toolbar, Popover, Menu, Context menu, Slider, NumberField, Progress, Meter.
  Fix: drop the enumeration (the sidebar has it) or generate it from `componentNavItems`.
- Principles, "`<ViewTransition>` built in": "Every part whose content is driven by library state
  wraps itself in `<ViewTransition>`." Since #35 a boundary is rendered only when `transition` is
  passed. Fix: "Parts whose content is driven by library state take a `transition` prop; pass it and
  the change animates."
- "Suspense-native" principle uses "Panels" without definition (R3; see glossary).

**H6. Checkbox page is stale (R5).** "Indeterminate" section: "A `CheckboxGroup` that packages this
pattern is being designed in issue #33." CheckboxGroup shipped and #33 is closed. Fix: "For a
group with a select-all parent, use [CheckboxGroup](/components/checkbox-group)."

**H7. Undefined or inconsistently used terms on reference pages (R3).** Full list in section 2;
the ones a first-time reader hits first:

- "state owner" (Accordion intro, Menu) is defined nowhere; the Pending page says "the owner".
- "library mode" / "JS-free mode" are defined on Browser-owned state (Accordion section) and
  redefined by every Two modes table; "JS-free" is also defined on Server Components ("What
  'JS-free' means"), so there are two homes. Menu says "Always library mode" with no link; Slider
  and NumberField call a plain `<input>` "the JS-free slider", a third meaning.
- "platform path(s)" is a section title on Switch, Dialog and Popover and a word on Checkbox,
  Slider and NumberField; never defined (it means: a state change the browser makes on its own,
  reported with `reason: "platform"`).
- "pure trigger" is defined mid-list on Action props and used bare on Toast ("a pure-trigger action
  part") and Roadmap.
- "commit" has two meanings on Slider and NumberField in the same section: React's render commit
  ("the Root's commit transition") and the gesture's save (`valueCommitAction`, "one commit per
  gesture", "the commit uses the release position"). Combobox adds a third ("commits free text").
- "channel", "dismissal", "notification", "adopt" (a controlled parent adopts a value), "foreign
  invoker / foreign close command", "virtual event", "roving focus", "entangled", "urgent lane /
  urgent state / urgent by design / your lane" are used on 5 to 12 pages each without a definition
  or link on the page.
- "the Async React half" appears on Home, Dialog, Popover, Menu, Slider, NumberField, Field (R6:
  marketing phrasing; "Async React" itself is only defined by the Home tagline).

**H8. Explanation and example are fused (R4).**

- The "Async walkthrough" lists on Tabs, Dialog, Popover, Accordion, RadioGroup, CheckboxGroup and
  Select are written as rules but step through the example's labels ("Select Billing", "Click
  Details", "Click Ham", "Click Dark", "Pick Banana"). A reader cannot tell which parts are the
  contract. Fix: a generic rule paragraph (or link to Pending & optimistic), then "In the example
  above:" with the steps.
- Toolbar: the page opens with the hero example, then four callouts of explanation, then a second
  example ("Vertical toolbar"), and Anatomy comes fifth. ToggleGroup: "Exclusive mode" and
  "Controlled, saved on the server" are examples with concept-sounding headings before Anatomy.
  Context menu: two examples back to back before Anatomy, no caption saying what each shows.
  Slider and NumberField: "A live filter" / "Locales and formats" are examples with no explanation
  separate from the demo. Menu "Checkbox and radio items": example first, explanation after;
  Button "Forms": the same; most other pages explain first. Pick one order (template: explanation
  first, one example, one caption) and apply it.
- Button "Server Components" shows the same example twice (an `<Example>` plus a `<CodeBlock>` of
  another file) and explains both in one paragraph.

### Medium

**M1. Experimental features page enumerates every flagged component with its full effect (R1).**
The "Effect when on" column repeats the prop descriptions that already live on Tabs, Toolbar,
ToggleGroup, Accordion, Tooltip and Dialog, and will drift. Fix: keep the conceptual sections
(the prefix, the rules, the subpath) and reduce the table to an index: prop, platform feature,
engines today, link to the component page section.

**M2. Roadmap "Done" is a prose changelog that re-documents components (R2).** Each bullet
re-describes features at paragraph length (Combobox, Toast, Slider, Context menu…). Fix: one line
per item with a link; a separate "Behaviour changes" list for the breaking notes (Toolbar.Button,
re-entry, `aria-disabled` on links, `data-side` resolution), which readers upgrading need and today
have to find inside feature bullets. "in this release" (Toolbar callout, Roadmap) should name the
version.

**M3. Toolbar page opens with a migration callout** ("Toolbar.Button was removed") before a
first-time reader knows what Toolbar.Button was. Move to the Roadmap behaviour-changes list; keep
one line at the end of the Toolbar page.

**M4. Props-table conventions differ.** State type given as "`ToggleState` is `{…}`",
"`TabsRootState`: `{…}`", or a separate "State" table (Progress, Meter). Owned props given as
"owns", "are the library's and are not props", "Owned keys", "Owned:". Multi-part tables use ad
hoc name suffixes ("label (Group)", "index (Value)", "name / form"). Four pages (Switch, Checkbox,
RadioGroup.Item, CheckboxGroup) spell out the `className` / `style` / `render` rows by hand with
three different descriptions instead of `shared-props.ts`. Fix: after every part's table, two fixed
lines, "State: `{…}`" and "Owned: …"; one table per part; the shared rows always from
`shared-props.ts`, or replaced by one line "plus the shared `className`, `style`, `children` and
`render` props ([Getting started](/getting-started#render))", which would shorten every page.

**M5. Section anchors are ad hoc.** Only skip-delay, arrow, plain-html, inside-a-field, dialog-form,
server-components and content-security-policy have ids; concept pages cannot link to "the Tabs
transition types". The template's standard ids fix this.

**M6. Sidebar: "Context menu" is listed as a component** but is `Menu.ContextTrigger`, a part of
Menu. Either label it "Menu: context menu" and place it directly after Menu (it is), or make it a
section of the Menu page. "Field & Form" (sidebar) vs "Field and Form" (page title).

**M7. Sidebar: Experimental features and Content Security Policy sit under Concepts** but are a
reference list and a how-to (the CSP page even has a `PropsTable`). Proposal in section 4.

**M8. `PageHead` descriptions use jargon (R6).** "correct in every lane" (Progress), "the display of
someone else's action", "a transition-driven state owner with optimistic data-open" (Accordion),
"library-owned closes with a ViewTransition exit" (Popover). These are the search-result snippets.
Fix: plain one-sentence descriptions.

**M9. "Recipes" exists on six pages only** (Toggle, Tabs, Accordion, Tooltip, Dialog, Popover); the
others put recipes under "Server Functions and forms", "Plain HTML" or in prose. Template fixes.

**M10. Select "Styling the picker" (a 40-line CSS recipe) comes before Props**, and Tooltip's
"Data attributes" section carries a 12-line paragraph of placement caveats. Both are Styling /
Recipes content under the wrong heading.

**M11. Dialog and Popover duplicate each other** (Two modes, ViewTransition section, platform
paths, data-side paragraph, Title/Description tables). Allowed for reference pages, but the
shared conceptual paragraphs should be links (see H3), and the shared facts should use identical
wording so a diff between the two pages shows only real differences.

### Low

- **L1.** Spelling is British on the site ("behaviour", "colour", "serialisable") and American in
  `docs/vision.md` and CLAUDE.md. Keep British on the site; note it in the template.
- **L2.** Meter defers Track/Indicator/Label/Value to Progress ("documents the shared parts"). Fine
  with the template's "shared with Progress" wording, but the Meter props table should still list
  the parts with one-line descriptions.
- **L3.** Getting started's import example and "Shared types live in the root entry" are accurate
  (`packages/ui/src/index.ts:331-336`). No change.
- **L4.** Toggle "Recipes" opens with a paragraph pointing at ToggleGroup before its first h4; put
  it in a "See also" line or make it the first h4.
- **L5.** Tables whose first header cell is empty ("Two modes", "Two actions") are fine but should
  all use the same shape (row label column first).

## 2. Glossary draft

Conceptual terms the docs use, where they are defined today, where the definition should live, and
synonyms to collapse. "Home" is the page that should carry the definition; every other use links
there on first use per page. Definitions are drafts in the site's register; the developer and PO
should check them against `design/conventions.md`.

| Term                       | Draft definition                                                                                                                                                                   | Defined today                                                   | Proposed home                        | Synonyms / inconsistencies to collapse                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| action (action prop)       | A prop named `action` or `fooAction`: a callback the component runs inside a transition and awaits. Sync or async; a Server Function works directly.                               | Action props intro                                              | Action props                         | "handler", "callback". Per #95/#96 an action is never urgent; see "urgent handler".                                        |
| change action              | `xChangeAction`: the action of a controllable state `x`, called with the next value and `details`.                                                                                 | Action props, Naming                                            | Action props                         |                                                                                                                            |
| urgent handler             | The one non-action prop: a synchronous handler for the text of a controlled text input (`Combobox.Root onInputValueChange`, typed `UrgentChangeHandler`). Not awaited, never pending. | Action props, "The urgent lane" (as `inputValueChangeAction` / `UrgentChangeAction`) | Action props            | Pending rename, #96: Combobox, Action props, Server Components, Roadmap and `examples/ComboboxDrink.tsx` still use the old names. |
| urgent / urgent lane       | A React update that renders synchronously, outside any transition. The library uses it only where React requires it (controlled text) or where a transition would be held behind the action it reports on (Toast queue, Progress value, the thumb under the pointer). | Action props, "The urgent lane"; Toast; Progress callout       | Action props                         | "urgent state", "urgent by design", "urgent queue", "your lane", "every lane" (Progress meta). Use "urgent" + link.          |
| transition                 | A React transition: the lane every library state change runs in, so old content can stay on screen and `<ViewTransition>` can animate the change.                                 | Transitions intro                                               | Transitions                          | Also the `transition` prop and CSS `transition`; always qualify: "a React transition", "the `transition` prop", "a CSS transition". |
| transition type            | A string the library adds with `addTransitionType` to the commit that ends an action: `fsui-<component>` plus `fsui-<component>-<change>`.                                        | Transitions, "Transition types"                                 | Transitions (concept) + each component page (its own list) |                                                                                                                  |
| committed state            | The value the component has settled on: the controlled prop, or internal state written after the action resolved. Content regions render it.                                        | Pending & optimistic, "Three values"                            | Pending & optimistic                 | "committed open", "committed selection", "DOM truth" (Dialog/Popover for `:open`). Link on first use per page.             |
| optimistic state           | `useOptimistic` over the committed value: the value the user asked for, shown at once by triggers. Rolls back if the action rejects or a controlled parent does not adopt it.      | Pending & optimistic                                            | Pending & optimistic                 | "the optimistic flip"; for native inputs "the DOM is the optimistic state" (Browser-owned state).                           |
| pending                    | An action dispatched through the component is in flight, until the commit that ends it (including a Suspense wait). Exposed as `data-pending` and `state.pending`.                 | Pending & optimistic                                            | Pending & optimistic                 | "in flight", "the Root is pending". Fine as synonyms once defined.                                                        |
| settle                     | An action's promise resolves or rejects.                                                                                                                                           | nowhere                                                         | Action props, Signature              | "resolves", "ends".                                                                                                        |
| adopt                      | A controlled parent accepts a dispatched value by setting its controlled prop to it; not adopting is the veto.                                                                     | nowhere (used on 12 pages)                                      | Action props, "After an await…" or Pending "Rollback" | "accept", "keep", "veto by not adopting".                                                                     |
| veto                       | A controlled parent's refusal of a change: it does not adopt the value, and the optimistic state snaps back. Only possible for library-owned changes, never for dismissals.         | Browser-owned state (Dialog/Popover table)                      | Pending & optimistic, Rollback       | "refuse", "snap-back".                                                                                                     |
| latest intent wins         | Overlapping dispatches: the optimistic state follows the newest click and only the most recent dispatch commits; there is no queue.                                                 | Action props, "Overlapping actions"                             | Action props                         | "the latest wins", "the latest dispatch commits".                                                                           |
| rollback                   | The optimistic value falling back to the committed one after a rejection or a veto.                                                                                                | Pending & optimistic, "Rollback"                                | Pending & optimistic                 | "reverts", "snaps back".                                                                                                   |
| part                       | One component of a compound namespace (`Tabs.Tab`), rendering one element (or none, for a Root with no DOM). Every part accepts `className`, `style`, `children` and `render`.    | Getting started, "Imports" (one sentence)                       | Getting started, new "Parts" paragraph | "element", "component". Single-element components (Toggle, Button) are "a component with no parts".                      |
| Root                       | The part that owns a compound component's state and transition; it may render no DOM.                                                                                              | implicit                                                        | Getting started, "Parts"             | "the owner".                                                                                                               |
| state owner                | A part that keeps a controllable state (Toggle, `Tabs.Root`, `Menu.CheckboxItem`): it takes every click and shows `data-pending`.                                                   | nowhere (Accordion, Menu use it)                                | Pending & optimistic                 | "owner", "a part that owns state", "a regular FUNSTACK UI state owner".                                                    |
| pure trigger               | A button whose action has no state of its own (Button, `Dialog.Close`, `Popover.Close`, `Menu.Item`, `Toast.Action`): it ignores a second activation while pending, with `aria-disabled`. | Action props (mid-list), Pending & optimistic (mid-paragraph)   | Pending & optimistic, own h4         | "pure-trigger action part", "every pure trigger".                                                                           |
| trigger                    | The part the user acts on to change a state (a Tab, a Toggle, `Dialog.Trigger`). Triggers render optimistic state and must not suspend.                                            | Pending & optimistic (as a role)                                | Pending & optimistic                 | Also a part name (`*.Trigger`). Use lower case for the role.                                                               |
| content region / panel     | The part that shows the committed state's content (`Tabs.Panel`, `Accordion.Panel`, a Popup's children). Never `data-pending`; it is the committed one or not.                     | Pending & optimistic (user flagged "panel" as undefined, #95)  | Pending & optimistic                 | "panel" (generic, also a part name), "content". Popover uses "panel" in the UI sense ("A panel that must survive stray clicks"): avoid. |
| details                    | The second argument of an action: `{ event, reason, … }`. `event` is the native DOM event, served by a proxy so Server Functions serialise.                                         | Action props, Signature                                         | Action props                         | "virtual event" (the proxy; Action props callout). Component pages say "the virtual `event`" without a link.               |
| reason                     | `details.reason`: `"activate"`, `"platform"`, `"dismiss"`, `"timeout"`.                                                                                                             | Action props                                                    | Action props                         |                                                                                                                            |
| platform path              | A state change the browser makes on its own (form reset, a click before hydration, find-in-page), dispatched with `reason: "platform"`.                                            | nowhere (section title on three pages)                          | Browser-owned state                  | "the platform paths", "platform dispatch", "mount reconciliation".                                                         |
| dismissal                  | The user closing an overlay without one of its parts: Escape, a click outside, Android back, an AT dismiss. The browser closes it at once; the action is a notification.           | Browser-owned state, "Dialog and Popover"                       | Browser-owned state                  | "light dismiss" is the platform mechanism (`popover="auto"`), not the same word.                                            |
| a part's close             | A close the user asks a part for (Close, Trigger, a Form submit): library-owned, awaited, vetoable, animatable.                                                                     | Browser-owned state                                             | Browser-owned state                  | "library-driven close", "library-owned close", "part-initiated close". Pick one: "a part's close".                          |
| notification               | An action called after the fact, for a change the browser already made; its result is not awaited.                                                                                 | Browser-owned state (table cell)                                | Browser-owned state                  |                                                                                                                            |
| foreign invoker            | A `<button commandfor command>` outside the library's parts that targets a library dialog or popover.                                                                              | nowhere (Dialog, Popover)                                       | Dialog page (component fact)         | "foreign close command", "a script `showPopover()`".                                                                       |
| browser-owned state        | State the browser changes before React hears about it (`:popover-open`, `<details open>`, `:open`, a native input's `checked`). Styled with pseudo-classes, animated with CSS.    | Browser-owned state                                             | Browser-owned state                  | "platform-owned", "the DOM truth".                                                                                         |
| library mode / JS-free mode| The two modes of Accordion, Dialog and Popover. JS-free: no value / open props, the browser owns the state. Library mode: any of them present, the library owns it in a transition.  | Browser-owned state (Accordion section); every Two modes table  | Browser-owned state                  | Menu: "always library mode". Slider/NumberField: "the JS-free slider" for a plain `<input>` (use "plain HTML" there).       |
| JS-free                    | No behaviour JavaScript runs for the interaction, and the server HTML works before and without hydration. Not "no client bundle".                                                   | Server Components, "What 'JS-free' means"; also Browser-owned state | Server Components (keep one home) | "without JavaScript", "directive-free" (Meter, Roadmap: means no `"use client"`; say that).                                |
| before hydration           | The window between the server HTML painting and React attaching; what works there is the platform's.                                                                               | Server Components, "Before hydration" table                     | Server Components (concept) + each component page | "pre-hydration", "works before hydration".                                                                      |
| channel (form channel)     | React's `<form action>`, `useFormStatus` and automatic reset, as opposed to a control's own change action. The two are independent.                                                 | Action props, "Form actions are a separate channel"             | Action props                         | "two channels", "the form's", "independent channels".                                                                      |
| gesture / step / commit    | Slider and NumberField: a step is one value change (a move, a key); a gesture is one press-to-release or one key; the gesture ends with one `valueCommitAction`.                   | Slider, NumberField ("Two actions")                             | Slider and NumberField pages         | "commit" collides with React's render commit on the same pages. Say "the gesture's save (`valueCommitAction`)" and "React's commit". |
| hero / Async React         | "Async React": React 19's transitions, actions, `useOptimistic`, Suspense for data and `<ViewTransition>` used together.                                                            | Home tagline only                                               | Home, "What it is"                   | "the Async React half" (seven pages): replace with "what the library adds".                                                |
| headless                   | Renders accessible HTML with data attributes and no styles.                                                                                                                        | Home                                                            | Home / Getting started               |                                                                                                                            |
| experimental_\* prop       | A per-call-site opt-in to a platform feature not yet in every engine; off by default; removed when the feature lands everywhere.                                                   | Experimental features                                           | Experimental features                | "flag", "the native path".                                                                                                 |
| top layer, light dismiss, Invoker Commands, anchor positioning, `@starting-style` | Platform terms.                                                                                                                                         | assumed                                                         | first use per page links MDN         |                                                                                                                            |
| hoisted `<style>`          | React 19's `<style href precedence>` element that React moves into `<head>` once per page.                                                                                          | CSP page (used, not defined)                                    | CSP page, with a React docs link     |                                                                                                                            |
| roving focus / roving tabindex | The APG technique: one Tab stop for a group, arrow keys move focus and `tabindex` between items.                                                                               | nowhere (Tabs, ToggleGroup, Menu, Toolbar)                      | Toolbar or Tabs page, with an APG link |                                                                                                                          |
| entangled                  | React commits two pending transitions together. Internal jargon.                                                                                                                   | Action props (used)                                             | drop; say "React commits them together" |                                                                                                                        |

## 3. Proposed component-page template

One template for every component page. Sections in this order, with these names and ids. A section
that does not apply is kept as one sentence ("Toast never uses `<ViewTransition>`: every Toast commit
is urgent."), never omitted, so a reader who knows the template finds the answer where they expect
it. British spelling. Explanation first, then one example with a one-paragraph caption.

```
h2  <Component>
    intro, 2–4 sentences: the APG pattern or HTML element, what the platform does, what the
    library adds. No "the Async React half"; name the additions.
    <Example> hero + caption: what to try and what to watch (data-pending, the flip, the rollback).

h3  Anatomy                      #anatomy
    import + JSX skeleton with element comments; bullets for structure rules (what must be first
    child, what renders no DOM, what render must keep).

h3  How it works                 #model          (optional, at most one h3)
    Component-specific model the props depend on: Two modes (Accordion, Dialog, Popover),
    Two actions: steps and commits (Slider, NumberField), The value is a set (CheckboxGroup,
    ToggleGroup), Two states (Combobox), Items, actions and closing (Menu). h4 per sub-topic.
    Component facts only; general rules are links.

h3  Props                        #props
    h4 per part, in anatomy order. After each PropsTable, two fixed lines:
      State: `XState` is `{ … }` (which fields are optimistic, which committed).
      Owned: the props the part sets itself and a `render` element cannot override; everything
      else passes through.
    Shared rows from shared-props.ts, or the one-line "plus the shared className, style, children
    and render props" with a link to Getting started.

h3  Data attributes              #data-attributes
    One table: Hook | On | Meaning. Includes pseudo-classes and custom properties (no separate
    "and pseudo-classes" / "and custom properties" headings). Which attribute is optimistic and
    which is committed is stated per row.

h3  Keyboard and ARIA            #keyboard
    Key table (Key | Behaviour [| Who]), then bullets: roles, names, what the library does and
    does not set, focus rules, development warnings. Pointer and touch rows go in the same table.

h3  Async behaviour              #async
    The component's instance of the general rule, as statements: which parts show optimistic
    state, which show committed state, where data-pending lands, what a second activation does
    (state owner: latest intent wins; pure trigger: ignored), rollback, where errors surface.
    Then h4 "Walkthrough" pinned to one named example ("In the example above: 1 … 4").

h3  Suspense                     #suspense
    What may suspend (content regions, keepMounted behaviour, items), what must not (trigger
    children), what holds the commit, where to put a boundary for a fallback instead.

h3  Transitions                  #transitions
    Which parts take `transition`, what it animates (the commit that ends an action, never the
    optimistic flip), the component's transition types as a list, and what animates with CSS
    instead (optimistic flips, dismissals). Link to Transitions for the prop's contract and cost.

h3  Browser-owned state          #browser-owned-state   (overlays, Accordion, native inputs, Select)
    Which state the browser owns, how it is styled (pseudo-class) and animated (CSS), and how the
    library hears about it (reason: "platform" / "dismiss"). Dialog/Popover: the Two modes table
    may live here instead of "How it works".

h3  Server Components and hydration   #server-components
    Serialisable props and Server Functions; what works before hydration and without JavaScript;
    what hydration reconciles (one dispatch, reason "platform"); h4 "Plain HTML" where a native
    element is an alternative, with what it gives up.

h3  Forms                        #forms           (form controls, Button, Dialog)
    name / value / required / reset; the two channels as a table with component facts only.

h3  Styling                      #styling
    One CSS recipe, Tailwind line, reduced-motion block when the component can animate.

h3  Recipes                      #recipes
    h4 per recipe; code first, one sentence after.

h3  Browser notes                #browser-notes
    Engine differences and bugs with issue links (Firefox direction islands #89, WebKit 302008…),
    one line each; placement and RTL notes for anchored popups.
```

Mapping of current headings to the template (to speed up the rewrite):

- "Async walkthrough(…)", "Async behaviour", "Pending and re-entry", "Accepting an option" → Async
  behaviour (+ Walkthrough h4).
- "Two modes", "Two actions: steps and commits", "The value is a set", "Items, actions and closing",
  "Typing is urgent…", "Checkbox and radio items", "Indeterminate", "Regions", "Exclusive mode" →
  How it works (h4s).
- "The platform paths", "Before hydration", "Forms and hydration" (hydration half), "Server
  Functions", "Server Functions and forms" (server half), "From a Server Component", "Plain HTML" →
  Server Components and hydration.
- "Server Functions and forms" (forms half), "Forms: action, then close" → Forms.
- "ViewTransition: an exit in every engine", "Styling and animation", "Styling and ViewTransition"
  (transition half), transition-type paragraphs → Transitions.
- "Open state belongs to the browser" (Tooltip), "Styling the picker" (Select; the opt-in part) →
  Browser-owned state; the CSS → Styling.
- "Keyboard", "Keyboard, focus and ARIA", "Keyboard, pointer and ARIA", "Keyboard, buttons and
  wheel", "Accessibility", "Accessibility and announcements", "Labelling", "What assistive
  technology hears" → Keyboard and ARIA.
- "Two mechanisms", "Browser support", "Placement, nesting and browser notes", "Right-to-left",
  "Top layer and modal dialogs", "Timers", "Scrolling" → Browser notes, or How it works when the
  content is the component's own model (Toast timers, Context menu scrolling).
- "Skip-delay", "Arrow", "Context menus", "Sharing items with a Menu button", "Inside a Field",
  "Next to a Field's control", "Options that load later", "Busy while a form submits" → Recipes
  (or Suspense for "Options that load later").

## 4. Sidebar proposal (`src/navigation.ts`)

Current: Introduction (Overview, Getting started), Concepts (8, including Experimental and CSP),
Components (23, roughly in shipping order), Resources.

Proposed:

```
Introduction   Overview · Getting started
Concepts       Action props · Pending & optimistic state · Transitions & ViewTransition ·
               Suspense · Browser-owned state · Server Components
Guides         Experimental features · Content Security Policy
Components     Buttons:     Button · Toggle · ToggleGroup · Toolbar
               Disclosure:  Tabs · Accordion
               Overlays:    Tooltip · Popover · Dialog · Menu · Context menu (Menu) · Toast
               Forms:       Field & Form · Checkbox · CheckboxGroup · RadioGroup · Switch ·
                            Select · Combobox · Slider · NumberField
               Output:      Progress · Meter
Resources      Roadmap & changelog · GitHub
```

Why: Browser-owned state before Server Components, because the Server Components page's "JS-free"
section depends on the modes that Browser-owned state defines. Experimental and CSP are not
concepts (one is a flag registry, the other a how-to with a props table). Component groups by kind
let a reader who wants "a form control" or "an overlay" scan five names instead of 23; `NavSection`
already supports labelled groups, so this is a data change plus a sub-label style. If sub-groups
are not wanted, at least order the flat list by kind as above instead of by wave.

## 5. For the product owner

- **#96 (rename `inputValueChangeAction` → `onInputValueChange`)** touches five docs files:
  `ComboboxPage.tsx`, `ActionPropsPage.tsx` ("The urgent lane", Naming table), `ServerComponentsPage.tsx`
  (Before hydration row), `RoadmapPage.tsx` (Combobox bullet), `examples/ComboboxDrink.tsx`. The
  glossary above assumes the new names. `docs/vision.md` is already updated in the working tree.
- **Getting started claims `transition` defaults to `"none"`** and is shared by every component
  (H4). Both contradict the library (`transition-boundary.tsx`) and the Transitions page. Needs a
  decision only on wording; the facts are clear.
- **Home "Principles" claims every part wraps itself in `<ViewTransition>`** (H5); false since #35.
- **"commit" naming collision** (H7): `valueCommitAction` is API, so the docs can only disambiguate
  by wording ("the gesture's save"). If the PO prefers, the glossary entry can define "commit" as
  the Slider/NumberField term and the docs say "React's commit" elsewhere; today both are bare.
- **Two homes for "JS-free"** (Server Components and Browser-owned state). The rework on
  `wave14-docs` should pick one; I suggest Server Components keeps "What JS-free means" and
  Browser-owned state keeps the two modes, linking to it.
- No disagreement between the docs and `design/conventions.md` was found in the pages audited
  beyond the three accuracy items above; I did not re-verify every props table against
  `packages/ui` (out of scope for this pass; recommended as a follow-up once the template lands).

## Method

Read every non-concept page in full on master (commit `0396e48`), skimmed the six concept pages
for definitions, grepped term usage across `src/pages` (counts in the glossary notes), and checked
the three accuracy claims against `packages/ui/src` and GitHub issues #33, #35, #95, #96, #97.

## Addendum (2026-10-24): template as implemented on `wave14-writer` (#98)

The section names adopted for every component page, in order, with their ids: Anatomy
(`anatomy`), How it works (`how-it-works`, optional, h4 per sub-topic), Props (`props`), Data
attributes (`data-attributes`, pseudo-classes and custom properties included), Keyboard and ARIA
(`keyboard-and-aria`), Transition types (`transition-types`), Optimistic and pending
(`optimistic-and-pending`, with a Walkthrough h4 pinned to one example), Suspense (`suspense`),
Browser-owned state (`browser-owned-state`), Before hydration (`before-hydration`, with a Plain
HTML h4 where a native element is an alternative), Forms (`forms`), Styling (`styling`), Recipes
(`recipes`), Browser notes (`browser-notes`). The five behaviour sections are `BehaviourSection`
(fixed heading, "Concept:" link, summary paragraph, optional longer content); a one-line
`BehaviourIndex` with `id="async-and-platform"` sits after the hero example. Pre-existing ids that
other pages link to stay on the demoted h4s (`arrow`, `skip-delay`, `inside-a-field`,
`plain-html`, `dialog-form`, `server-components`, `two-modes`). Term homes added: settle, adopt,
veto, form channel (Action props, `#terms`); platform path, notification, a part's close
(Browser-owned state). Still open from the audit: the "State:" / "Owned:" lines after each props
table (M4) and replacing hand-written shared prop rows with `shared-props.ts`.
