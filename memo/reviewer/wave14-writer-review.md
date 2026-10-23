# Review: branch wave14-writer (#98, docs restructure), head eaeb3c4

Scope: 4dc357c, 390edfe, 80a60de, eaeb3c4 (`git log master..wave14-writer`). Docs only.
Checked against design/conventions.md, design/components/*.md, packages/ui/src and git history.

Verdict: **acceptable with minor fixes**. Nothing substantive was lost in the restructure. Two
medium findings (one new factual error, one incomplete index), the rest low.

## Method

- "Nothing lost": exported master and branch versions of all 37 changed files; a script
  stripped JSX to sentences and listed every master sentence (>= 5 words) whose normalised text
  appears nowhere in the branch's docs sources; every hit read by hand. Separately,
  `git diff --color-moved` to isolate non-moved deletions (~800 lines, all read), and a
  structural comparison of every props-table `name:` and every table-row key per page: no props
  row, data-attribute row or keyboard row was removed on any component page (Menu gained a
  data-attributes table).
- Built `pnpm --filter @funstack/ui build && pnpm --filter docs build` in the worktree; checked
  every internal href and fragment against ids in the 35 built pages: 0 missing pages, 0 missing
  ids, 0 duplicate ids. Every component page has the same h3 sequence (anatomy, [how-it-works],
  props, data-attributes, keyboard-and-aria, the five behaviour sections, then forms / styling /
  recipes / browser-notes as applicable).
- Terms checked against conventions 2.4, 3.5 (residual browser paths, parts vs dismissals) and
  the popover / dialog designs; Experimental index against every `experimental_*` prop in
  packages/ui/src; Roadmap "Behaviour changes" against commit dates, tags and BREAKING CHANGE
  footers since 0.1.0-alpha.0.

## Findings

### M1. Popover: "a foreign invoker ... in library mode it goes through the library too"
packages/docs/src/pages/PopoverPage.tsx:65-66. True for opens (cancelled at `beforetoggle` and
dispatched) but not for closes: a foreign `hide-popover` closes the popover natively and is
notified as `"activate"` (design popover.md:46, :157, :278; the same page says so at
PopoverPage.tsx:639-640). The sentence contradicts the page's own platform-paths list. Fix: "a
foreign invoker's open goes through the library too; its close is the browser's and is reported
as `"activate"`". (The Dialog sentence, DialogPage.tsx:68-69, is correct: dialog.md:279, foreign
`request-close` / `close` are cancelled and dispatched.)

### M2. Experimental index omits `Menu.Popup experimental_focusgroup`
packages/docs/src/pages/ExperimentalPage.tsx:30-64 says "this is the index", but
menu/menu-popup.tsx:131 has `experimental_focusgroup` (documented on MenuPage.tsx:326, listed in
conventions 8 "First customers"). Pre-existing omission in the old table, but the page is now
explicitly the index. Add a row: `focusgroup`, Chromium 150+, [Menu.Popup](/components/menu#props)
(and add Menu to the Tabs/Toolbar/ToggleGroup cell, or a separate row).

### L1. Roadmap: the #20 / #53 entry is a breaking change but is not marked
RoadmapPage.tsx:43-47. Commit d3d0359 is `feat(ui)!` with a BREAKING CHANGE footer:
data-side / data-align / state.side / state.align report the resolved side; align start/end
mirror under RTL; the submenu opens on the left in RTL; `TooltipSide` / `PopoverSide` /
`MenuSide` gain `inline-start` / `inline-end` (an exhaustive switch stops compiling). The three
`!` commits since alpha.0 are b81c4f9 (#96), d3d0359 (#20/#53/#88), d8136b4 (#79); only two are
marked. Mark it Breaking and mention the type widening and the RTL submenu side.

### L2. Roadmap: list order and a pre-release entry
- "Newest first" is not quite: the Menu entry (#45, 27c6c11, 10-22 21:13) is listed above #20/#53
  (10-23 01:02) and #21 (10-23 01:55). The wheel half is #88 (e357d85, 10-23 01:55), so the
  combined entry can stay, but it belongs below #21/#20.
- #35 (9c6ea3c) is an ancestor of tag 0.1.0-alpha.0, so no npm user can notice it on upgrade;
  either drop it from "Behaviour changes" or say it predates the first alpha.
- Pre-existing, but on a rewritten page: "its first alpha is on npm" / "The first alpha,
  0.1.0-alpha.0, is published" (RoadmapPage.tsx:15, :21) while package.json is 0.1.0-alpha.10
  and tags alpha.0 to alpha.10 exist. Say "alpha releases are published under the `alpha`
  dist-tag".

### L3. Literal backticks in Server Components
ServerComponentsPage.tsx:120: `(where the engine implements \`interestfor\`)` is JSX text, not an
`inline()` string, so the built page shows the backticks (verified in
dist/public/concepts/server-components.html). Use `<code>interestfor</code>`.
Pre-existing, same class: link text inside `inline()` strings is not code-formatted
(browser-owned-state table shows "\`useOptimistic\`" inside a link) and CSP table headers
("\`href\`", "\`style-src\` source").

### L4. New Menu data-attributes table: two rows slightly off
MenuPage.tsx:510-560.
- "`aria-expanded`, `data-open` on Trigger, SubmenuTrigger, ContextTrigger": the ContextTrigger
  region renders `data-open` but no `aria-expanded` (menu-context-trigger.tsx:551-553; correct by
  design, it is not a button).
- "`data-typeahead` on Item, SubmenuTrigger": CheckboxItem and RadioItem also emit it (both go
  through `useMenuItem`, use-menu-item.ts:82, with their `label`).
- Optional: Menu.Trigger's `aria-disabled` for a link / component render (#83) is not listed.

### L5. Facts dropped when the Experimental table became an index
The old "Effect when on" column carried details the props rows do not:
- Toolbar.Root: the native path keeps Tab-stop **memory** and the library writes **no
  `tabindex`** (ToolbarPage.tsx:101-110 says neither).
- ToggleGroup.Root: ignored inside a Toolbar **with a development warning**
  (toggle-group-root.tsx:226-228); "so Tab enters on the pressed Item". ToggleGroupPage.tsx:160
  says only "Ignored inside a Toolbar."
Move these into the two props rows.

### L6. Home page count
HomePage.tsx:128 renders "23 components so far: ..., Menu, Context menu (Menu), ..., Field and
Form, ...". The count is of sidebar pages, not components (Context menu is a Menu part; Field and
Form are two). Drop the number or say "23 component pages".

### L7. Sidebar group labels are hidden from assistive technology
DocsNav.tsx: the "Buttons / Disclosure / Overlays / Forms / Output" labels are
`<li aria-hidden="true">`, so screen-reader users get one flat list of 23 links with no
grouping (and sighted users see headings AT does not). Prefer a nested list per group
(`<li><span id=...>Forms</span><ul aria-labelledby=...>`) or at least not hiding the labels.

### L8. Terms: two remaining narrow spots (note, no change required)
- Pending (PendingOptimisticPage): "the pending flag of the transition that runs the action: the
  state owner's, or a pure trigger's own." Field / Form.Submit pending is the form channel
  (`useFormStatus`), not a transition flag.
- Root (GettingStartedPage): "holds its state and its transition": Tooltip.Root and
  Toolbar.Root hold no transition. "usually, not always, the outermost" is now right.

## Earlier findings (memo/reviewer/wave14-docs-review.md): all fixed
- M1 Tabs before hydration: fixed in both places (TabsPage props row "in the server HTML as plain
  `hidden`, upgraded after hydration"; before-hydration summary "find-in-page reaches them after
  hydration"). Matches tabs-panel.tsx and tabs.md 5.3.
- L1 library-owned: "usually inside the state owner's transition ... Some library-owned state is
  urgent instead (typed text, a toast queue)". Toast's "Its stack is library-owned" is now
  consistent.
- L2 Root: fixed (see L8 for a nit).
- L3 Two modes: "(today Accordion, Dialog and Popover do)". Correct.
- L4 Combobox focus leaving: "closed by the library but reported the same way". Correct
  (combobox.md:694).
- L5 "one dispatch (for a continuous control, one step and one commit)". Correct.
- L6 Tabs types: "when the order cannot be determined (no committed tab, or a value with no
  rendered Tab)". Correct (tabs-root.tsx:119-126; next === prev also yields bare `fsui-tabs`,
  acceptable to leave implicit).
- L7: Pending broadened to pure triggers; Dismissal adds "another top-layer element opening";
  Server Components qualifies interest with `interestfor` support (but see L3); `urgent-lane` id
  exists (ActionPropsPage.tsx:339) and Combobox links resolve.

## New terms (all accurate except as noted)
- Settle, Adopt (sync part or `startTransition` after `await`), Veto (non-adoption, snap back;
  dismissals cannot be vetoed), Form channel: match conventions 2.4 and the react.dev rules.
- Platform path: matches conventions 3.5 "Residual browser path" (dispatch with
  `reason: "platform"`, re-apply committed state after settle).
- Notification: matches the conventions 3.5 table ("dispatched ... after the fact").
- A part's close: matches conventions 3.5 (cancelable step, awaited, vetoable, animatable).
- Foreign invoker: Dialog correct; Popover wrong for closes (M1).
- Slider / NumberField "a commit here is the gesture's save through `valueCommitAction`, not
  React's render commit" and transition rows "A gesture's save (`valueCommitAction`)": accurate,
  and the disambiguation from React's commit (linked to /concepts/transitions#commit) is good.
- GettingStarted `transition` row ("Without it the part renders no `<ViewTransition>`"): matches
  internal/transition-boundary.tsx.

## Nothing lost: what moved or was replaced (all acceptable)
- Every BehaviourSummary row became a BehaviourSection summary verbatim (only the in-page
  "([Async walkthrough](#...))" back-links dropped, since the walkthrough now sits under it).
- Per-page "X never reads `useFormStatus`" / "Two independent channels" -> links to
  /concepts/action-props#form-channel, whose section states the rule (and the `form:has` / own
  className advice).
- Switch / RadioGroup / Select / Checkbox "react-dom restores ..." explanations -> one sentence
  plus link to /concepts/browser-owned-state#native-inputs, which keeps the full argument.
- Mozilla bug 2019601 now only on Tooltip (and ContextMenu); Popover, Menu, Combobox link to
  /components/tooltip#browser-notes, which keeps it.
- Popover's data-side mechanism and render-cost paragraph -> link to the Tooltip data-attributes
  section, which has the same text.
- Dialog "ViewTransition cost on open": "a Switch, a Checkbox, a RadioGroup item" became "a
  control with `transition` set" and the 250 ms figure moved to the Transitions page. This is a
  correction: since #35 controls render a `<ViewTransition>` only with `transition`.
- Toolbar.Button removal callout -> Roadmap "Breaking" entry; the Toolbar page still points to
  Button.
- Roadmap "Done" list trimmed of per-component feature summaries (intentional; component pages
  carry them) and of the #19 rationale sentence.
- Experimental "Effect when on" column -> props rows (see L5 for the two details that did not
  make it).
