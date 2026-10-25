# Wave 18 docs and example audit

Scope: packages/docs (pages, examples, site code) and packages/example, against alpha.12-alpha.14
(#102, #105, #108, #110-#113, #115, #116, #118, #120, #121, #123, #125-#127). Read-only.
Auditor: technical writer. Date: 2026-10-25. Baseline: master 8ae57fb.

## What is already fine (no action)

- No `[aria-expanded="true"]` selector is left anywhere in docs examples or the playground. Every
  overlay Trigger style uses `[data-open]` (popover.css:123, dialog.css:144, menu-demo.css:85,
  popover-demo.css:122, dialog-demo.css:102). The only `aria-expanded` hits are comments that
  say a `<button>` Trigger has none, which is correct.
- Props tables for the changed parts match the declarations: `MenuTriggerProps` (no
  `onMouseDown`), `ComboboxTriggerProps` (no `commandfor`/`command`/`popoverTarget*`, has
  `onPointerCancel` through pass-through), `Combobox.Input` owns `onPointerDown`,
  `ToggleGroupItemState.value`, `MenuRadioItemState.value`, Tabs/Accordion `ChangeReason`.
- #108, #105, #111, #113 (announcements), #120: no docs text depends on the old behaviour.
- Wave 16 site-code items are done: `examples/sources.ts`, flat App routes, `checkLinks.ts`,
  `.docs-nav-group`, `site.ts`, shared playground `fake-backend` / `DemoErrorBoundary` /
  `Spinner` / `demo.css`, App order. A scripted check finds no unused class in
  docs/src/styles, docs/src/examples/*.css or example/src/**/*.css.
- The five behaviour sections are present and in the same order on all 23 component pages.

Ranking: value first (reader impact x how wrong), effort S/M/L.

---------------------------------------------------------------------------------------------------

## D1 (high, M) The overlay-Trigger facts are a patch log repeated on three pages: give them one concept section

What: #110, #112, #115, #118, #121, #125 and #126 each added a sentence to every overlay page, so
the same five facts now appear 4-8 times per page, phrased differently each time:
(a) a `<button>` Trigger is a `popovertarget` invoker, the browser exposes its expanded state,
so it renders no `aria-expanded`; (b) a non-button Trigger renders `aria-expanded` from the
shown popup; (c) `data-open` is optimistic, so style with it; (d) a non-button Trigger is
light-dismissed at the press (not awaited, no veto, no exit transition); (e) a foreign invoker
opens through the library and closes as an `"activate"` notification, and pressing it moves no
focus. Plus (f) "one Trigger per Root".

Occurrences:
- PopoverPage.tsx: 56-60 (e), 117-120 (a,b), 164 (a), 205-207 (f), 230 (owned), 233 (a,b,d),
  385-388 (a,b), 408-416 (a,c), 505-508 (a,b), 572 (a,b,c), 582-583 (a), 660-670 (e).
- MenuPage.tsx: 142 (a), 218-220 (e), 263-266 (f), 283 + 286 (a,b), 506 (a,b), 515-527 (a,b,c),
  620-629 (d), 640-645 (a).
- ComboboxPage.tsx: 80-86 (a), 136 (b for the Input), 226 (e), 373 + 376 (a,d), 508 (a,b,c).
- PendingOptimisticPage.tsx:183-194 and BrowserOwnedStatePage.tsx:97-103 (a,b,c) (see D6).

Proposed change: one concept section that teaches the idea once, then short facts per page.
- New section "Triggers of a popup" on Browser-owned state (`/concepts/browser-owned-state#popup-triggers`),
  after "Parts vs dismissals". Content, general terms only:
  1. Invoker: a `<button>` with `popovertarget` (or `commandfor` + `command`) is the popup's
     invoker. The browser opens it before hydration, spares a press on it from light dismiss,
     and exposes the popup's expanded/collapsed state on it. So a `<button>` Trigger renders no
     `aria-expanded` (ARIA in HTML forbids it there).
  2. Another element is no invoker: it renders `aria-expanded` from whether the popup is shown,
     and a press on it while open light-dismisses the popup before the click, so that close is
     not awaited, cannot be vetoed and has no exit transition. Render a `<button>`.
  3. Exposed state vs optimistic state: what assistive technology hears follows the shown popup;
     `data-open` is optimistic, so style click feedback with `[data-open]` / `[data-pending]`.
     Without JavaScript, select on the popup: `:has(+ :popover-open)`.
  4. Foreign invokers (define the term, see D4): an open through one is routed through the
     library; a close through one happens natively and is reported as an `"activate"`
     notification; pressing one does not move focus out of a popup that holds focus.
  5. One Trigger per Root, and why (anchor, focus return).
  One ConceptExample block (Popover) with the CSS from PopoverPage.tsx:414-416.
- Component pages then keep one line each, linking to it: in PartFacts.note
  ("A `popovertarget` invoker: see [Triggers of a popup](...)") and in the data-attributes row for
  `aria-expanded`. Remove (a)-(f) from: Popover 117-120 (drop the row), 233, 408-412 (keep the CSS),
  505-508, 572 (reduce to "`data-open` is optimistic"); Menu 283/286 note, 515-527 row text,
  640-645; Combobox 80-86 (keep the "written after hydration" fact, which is Combobox-specific),
  508.
- Keep on component pages only what differs per component: Combobox writes `popovertarget`
  after hydration and cancels every click; Menu.Trigger keeps focus on the current item on press;
  the Combobox Input's `aria-expanded`.
Effort M (one new section, edits on 3 pages, D6 folds in).

## D2 (high, S) Roadmap "Behaviour changes" stops at #121; alpha.12-alpha.14 breaking and behaviour changes are missing

What: RoadmapPage.tsx:24-75 says "Changes an upgrade may notice, newest first", but lists only
#121 from the last three releases. Missing, by release notes:
- Breaking: `TabsValueChangeDetails.reason` / `AccordionValueChangeDetails.reason` are
  `ChangeReason` (#102); `MenuTriggerProps` drops `onMouseDown` (#110); `ComboboxTriggerProps`
  drops `commandfor`/`command` (#112); `Combobox.Input` owns `onPointerDown` (#123).
- Behaviour: Trigger click while open of Menu/Combobox is a library-owned close on every engine
  (#110, #112); overlay `aria-expanded` reports the shown popup, `defaultOpen` server HTML has
  `aria-expanded="false"` (#118); non-modal `lightDismiss` Dialog Trigger click dismisses (#116);
  non-button Popover/Menu Triggers render no `commandfor`/`command` and warn (#115); the fallback
  live region is gone (#113); a foreign `popovertarget` close is `"activate"` (#125); pressing a
  foreign invoker moves no focus (#126); lost interest hides an interest-opened Popover (#127).
Proposed change: add the four Breaking items as one bullet each, and one bullet per behaviour
change (newest first, one sentence, issue links), in the existing style. The #121 bullet
(lines 30-42) can drop its last clause: "A link ... keeps `aria-expanded`" is reference detail.
Effort S.

## D3 (high, S, needs developer confirmation) Menu and Combobox examples miss the "cut the CSS exit during a view transition" rule

What: design/conventions.md:1533-1538 makes it a general rule: a CSS exit kept next to
`transition` must be cut while a view transition runs, or Chromium shows a double image. The
Popover and Dialog pages teach it (PopoverPage.tsx:538-555, DialogPage.tsx:~563-600, nearly
word-for-word duplicates) and their example CSS applies it (popover.css:61, dialog.css:73).
Menu and Combobox use both a CSS exit and `transition`, but neither the page nor the example
has the guard: docs/src/examples/menu.css:17-31 + 106-131, combobox.css:59 + 103-128,
example/src/menu-demo.css:99 + 113, combobox-demo.css:61 + 137-158. MenuPage.tsx "Styling"
(~690-700) and ComboboxPage.tsx "Styling" (~640-660) do not mention it.
Proposed change: (1) Ask the developer whether Menu/Combobox are affected (they hide the
popover in the same commit pattern, so they should be). (2) If yes: move the rule and its
explanation to TransitionsPage.tsx "What animates when" as a general rule with Dialog as the
worked example; on Popover/Dialog/Menu/Combobox keep the one-line CSS and a link. Add
`html:active-view-transition .demo-menu { transition: none; }` (and `.demo-combobox-popup`) to
the docs examples and the playground equivalents. Effort S (M with the Transitions move).

## D4 (medium, S) "Foreign invoker" and "invoker command" are used inconsistently and defined in the wrong place

What:
- PopoverPage.tsx:58 and DialogPage.tsx:59 define *foreign invoker* inline in an Anatomy
  bullet. MenuPage.tsx:218 and ComboboxPage.tsx:226 say "a `popovertarget` or `commandfor`
  button of your own" instead. Readers of Menu cannot find the term; readers of Popover cannot
  reuse it.
- BrowserOwnedStatePage.tsx:40-45 defines the term "Invoker command" as covering both
  `commandfor`/`command` and `popovertarget`. `popovertarget` is not an Invoker Command (that is
  the spec name of `commandfor`/`command`); the capitalised spec name and the lowercase term
  look the same. Since #121 the overlay Triggers use only `popovertarget`, so the term now
  mostly names something that is not an Invoker Command.
Proposed change: rename the term to **Invoker** ("a button whose `popovertarget`, or
`commandfor` and `command` (Invoker Commands), make the browser open or close a popover or
dialog on click, without JavaScript"), id `invoker` (keep the `invoker-command` id as an
alias span so old links work, or update the 0-2 links). Add **Foreign invoker** ("an invoker of
yours that targets a component's popup; it is not one of the component's parts"). Link both
terms from Popover, Dialog, Menu, Combobox. Effort S.

## D5 (medium, S) Menu: a disabled SubmenuTrigger renders `aria-expanded`, the docs say it cannot

What: `Menu.SubmenuTrigger` uses `disabledAs: "aria"` (menu-submenu-trigger.tsx:140), so a
disabled one is never an invoker (render-element.ts `invoker: !(focusable && disabled)`): a
disabled `<button>` SubmenuTrigger renders no `popovertarget` and `aria-expanded="false"`
(use-popover-trigger.ts:188,199). MenuPage.tsx:519-522 says `aria-expanded` is on "Trigger,
SubmenuTrigger (a link or other non-button element, or a disabled component `render`, only)",
and 642-644 says the SubmenuTrigger renders none. The owned list (506, "rendered only without
`popoverTarget`") is correct.
Proposed change: data-attributes row "On": "Trigger, SubmenuTrigger, when not an invoker: a
link or other non-button element, a disabled component `render`, or a disabled SubmenuTrigger".
Drop "(the SubmenuTrigger alike)" at 644 or add "unless disabled". If D1 lands, state the
general rule there ("a Trigger that is not an invoker renders `aria-expanded`") and list the
cases once. Effort S.

## D6 (medium, S) Concept pages list overlay components for completeness (rule 1)

What:
- BrowserOwnedStatePage.tsx:97-103: "One read is mirrored: ... for the `aria-expanded` of the
  Combobox input and of a trigger rendered as something other than a `<button>` ..." This is a
  per-component fact inside the general explanation of "never mirror browser-owned state".
- PendingOptimisticPage.tsx:188-194 ("Assistive technology"): "The same holds for a popup's
  trigger (Popover, Menu, Combobox): ..." names three components and two attribute cases.
Proposed change: keep the general rule in both places ("an exception: whether a popup is shown
is mirrored where no native element exposes it"), then link to the new section from D1. If D1
is not done, move these sentences into a ConceptExample block (Popover) so the rule and the
instance are visibly separate (rule 4). Effort S.

## D7 (medium, M) PartFacts "Owned" lists for the four Triggers carry explanations and drift apart

What: the Owned line is meant to be a list of keys (Tables.tsx:84-88). For the overlay Triggers
it has grown reasons and four different phrasings of the same fact:
- Popover 230: "`popoverTarget` (not on a host element other than a `<button>`),
  `popoverTargetAction` (never written), `aria-expanded` (rendered only without `popoverTarget`)
  ... `commandfor` and `command` are owned too (never written: an Invoker Command would take
  precedence over `popovertarget`) and omitted from the props type."
- Menu 283: the same, plus `onMouseDown` with a reason in parentheses.
- SubmenuTrigger 506: "`popoverTargetAction`" without "(never written)", then "`commandfor` and
  `command`, never written".
- Combobox 373: "`aria-expanded` (rendered only for a non-button `render`), `aria-controls`,
  `popoverTarget` and `popoverTargetAction` (`popovertarget` is written after hydration on a
  `<button>`) ... `commandfor` and `command` (never written) are owned too".
"Not on a host element other than a `<button>`" is a double negative that most readers will
parse as "only on a button", which is what it means.
Proposed change: one shape for every part: "Owned: <keys>. Owned and never written: <keys>
(omitted from the props type)." Reasons go to the note or to the D1 section. Use "only on a
`<button>`" wording. Optionally add `ownedNeverWritten` to PartFacts so the second sentence is
rendered the same everywhere (Tables.tsx, ~6 lines). Effort M (4 parts, plus Dialog/Popover
Close which have the same "(not on a host element other than a `<button>`)" phrase at
PopoverPage.tsx:343 and DialogPage.tsx:222).

## D8 (medium, S) Popover page: foreign invokers and the hover card sit under "Before hydration"

What: PopoverPage.tsx:633-686, BehaviourSection `before-hydration`, h4 "The platform paths",
contains "Foreign invokers and scripts" (#125) and "Hover card (Chromium)" (#127). Neither is
about hydration. The section summary (636) does not mention them, so a reader scanning "How it
works" or "Browser-owned state" will not find them.
Proposed change: move both bullets to a new h4 "Other ways to open and close" under "How it
works" (after the Two modes table), or into the `browser-owned-state` BehaviourSection body.
With D1, "Foreign invokers" shrinks to the Popover-specific events (`CommandEvent`,
`ToggleEvent.source`) and a link. Keep "Before hydration" to the two hydration bullets.
Effort S.

## D9 (medium, S) Popover intro and description still say "Invoker Commands"

What: PopoverPage.tsx:15 ("A non-modal popover on the Popover API and Invoker Commands") and 18
("Built on `popover="auto"`, a `<dialog>` element and Invoker Commands"). Since #121 the Trigger
is a `popovertarget` invoker; only Close still uses an Invoker Command. Not false, but it points
readers at the wrong mechanism for the main part.
Proposed change: description "A non-modal popover on the Popover API: ..."; intro "Built on
`popover="auto"`, a `<dialog>` element, a `popovertarget` Trigger and an Invoker Command Close."
HomePage.tsx:27 ("<dialog> with Invoker Commands") stays correct (Dialog). Effort S.

## D10 (low-medium, S) Dialog: "never JS-free" contradicts "in both modes"

What: DialogPage.tsx:176 (`modal` row): "A non-modal dialog has no command to open it, so its
Trigger always uses a click handler: it is never JS-free." DialogPage.tsx:266 (`lightDismiss`):
"... the click does not re-open it, in both modes." The source has a "non-modal JS-free mode"
(dialog-trigger.tsx:53,105-112): the Root is in JS-free mode, but the Trigger needs JavaScript.
"JS-free" is used for two things here: the mode, and "works without JavaScript".
Proposed change: `modal` row: "A non-modal dialog has no command to open it, so its Trigger
always uses a click handler: even in JS-free mode it needs JavaScript to open." Keep "in both
modes" at 266 but say "in JS-free and library mode", since "modes" next to modal/non-modal is
ambiguous. Effort S.

## D11 (low, S) Data-attributes table headers differ across component pages (rule 2)

What: the first column is "Hook" (Accordion, Dialog, Menu, Popover, Tooltip), "Attribute"
(13 pages), "Name" (Meter, Progress) or "Where/What" (ContextMenuPage.tsx, columns reordered);
the part column is "On" everywhere except Toast ("Part"). Pages that list pseudo-classes use
either a separate "Pseudo-class" column (Checkbox, CheckboxGroup, RadioGroup, Select, Switch) or
rows in the first column (Popover, Menu, Combobox).
Proposed change: ["Hook", "On", "Meaning"] everywhere ("Hook" covers `data-*`, `aria-*` and
pseudo-classes); drop "On" only for single-part components (Button, Toggle, Checkbox, Switch),
as today. Keep the extra "Pseudo-class" column where a data attribute has a native twin. Effort S.

## D12 (low, M) Popover page has no "Styling" or "Browser notes" section

What: Menu, Combobox, ContextMenu, Select and Toast end with "Styling" and/or "Browser notes".
Popover puts its styling CSS (PopoverPage.tsx:408-439), an h4 "Right-to-left" (448-456) and
engine notes (457-462: Firefox hides instantly, WebKit bug 317926) under "Data attributes".
Proposed change: split into h3 "Styling" (the CSS blocks and the data-side paragraph) and h3
"Browser notes" (RTL/Firefox #89, Firefox exit, WebKit 317926, and the WebKit 302008 note now
inside the Nested popovers recipe at 731-733), placed in the same order as Menu. Effort M
(moves only, no new text).

## D13 (low, S) Popover/Dialog duplicate the ViewTransition "exit in every engine" block

What: PopoverPage.tsx:526-566 and DialogPage.tsx (transition-types section, ~548-600) share the
same h4 title, the same explanation of layout-effect show/hide and capture, and an identical
"Dismissals ... double image ... The cost: an unrelated view transition ..." bullet.
Proposed change: fold into D3's general section on the Transitions page; each page keeps its
type names, its `transition` map and the parts that differ (Dialog's `::backdrop` note). Effort
S if done with D3.

## D14 (low, S) ContextMenu "rule 1" / "rule 2" refer forward to a callout without a link

What: ContextMenuPage.tsx:75 "(rule 2)" and 385 "rule 1" refer to the callout "Three rules for
an accessible context menu" at 471. A reader at line 75 has not seen the rules yet (rule 3).
Proposed change: give the Callout an id (`id="accessibility-rules"`, Callout.tsx needs an
optional `id` prop) and link: "(see [rule 2](#accessibility-rules))". Effort S.

## D15 (low, S) Small leftovers

- docs/src/examples/PopoverShare.tsx:2-4: the comment is re-wrapped mid-sentence ("The
  browser" / "opens the popup ...") after the #121 edit; reflow it. It is shown to readers.
- RoadmapPage.tsx:39-40: "move `[commandfor]` selectors on these Triggers to `[popovertarget]`"
  is not true for Combobox.Trigger, which has `popovertarget` only after hydration. Add "(the
  Combobox Trigger gets it after hydration)" or recommend `[data-open]`/a class instead.
- MenuPage.tsx:218-220 / ComboboxPage.tsx:226 (foreign invoker in `openChangeAction`): #126
  limits "moves no focus" to real invokers (not disabled buttons, not submit buttons in a form;
  `<input type=button|reset>` included). Either say "an invoker" and link D4's definition, or
  drop the clause from the props row and keep it in the D1 section.

## D16 (low, S) Playground: nothing exercises foreign invokers or a hover card

What: #125-#127 changed behaviour that can only be checked by hand in a browser (a foreign
`popovertarget` button closing a Popover/Menu/Combobox as `"activate"`, pressing it with focus
inside a Menu, an `interestfor` hover card on Popover in Chromium). packages/example has no
such case (tooltip-demo.tsx:239 has a plain `popoverTarget` button for a raw popover only). The
playground logs `openChangeAction` details to the console, so it is the natural place.
Proposed change: in popover-demo.tsx add a "Foreign invokers" section: a Popover with
`defaultOpen={false}` plus an external `<button popoverTarget>` and a `<button interestfor>`
(Chromium note), logging `details.reason`; in menu-demo.tsx one external `popovertarget` button
for an open menu. Effort S.

---------------------------------------------------------------------------------------------------

## Suggested order

D2 and D9 (quick, user-visible facts), then D1 with D4, D6 and D7 as one change (the concept
section makes the other three mostly deletions), then D3 + D13 after the developer confirms the
Menu/Combobox double image, then D5, D8, D10, and the low items when touching those pages.
