# Review: #148 docs (branch `feat/148-on-open-change`, c693886)

Read-only review of `git diff master...origin/feat/148-on-open-change -- packages/docs packages/ui/skills
packages/example`, against `docs/vision.md` principle 3, `design/components/overlay-open-change.md`, the
code on the branch (`use-overlay-root.ts`, `use-popover-popup.ts`, `use-popover-trigger.ts`,
`dialog-popup.tsx`, `combobox-root.tsx`, `combobox-trigger.tsx`, `menu-root.tsx`, `toast.ts`,
`call-urgent-handler.ts`) and the user's feedback in #143 / #148.

Line numbers are on the branch. The docs site was built from the branch (scratch worktree) and the
Markdown edition grepped: the only `closeAction` left in the output is the two places listed below
(Toast props row, Roadmap). No "one exception", "the only on\*", "notification" or
`#parts-vs-dismissals` link is left in pages, SKILL.md or the playground. (`CheckboxGroupPage` "One
exception, in both modes" is about form resets and has nothing to do with this.)

Overall: the four reference pages are accurate against the code, and the examples show the code
that runs (they are `?raw` imports; the SlowOpen and log examples pass `onOpenChange` and log it). The
problems are on the concept pages: a list of every handler (the pattern #143 asked to remove), two
definitions of "request"/"fact" that do not match each other, vision principle 3, or the reference
pages, and a few places where the rule text and the worked example are mixed together.

---

## Must fix

### M1. Action props: "Every handler the library defines" table (rule 1; #143)

`packages/docs/src/pages/ActionPropsPage.tsx:405-420`

The page now lists every `on*` handler and the components that have it. In #143 the user wrote about
the old "It is the library's one `on*` prop": "The fact that it is the only one is not important.
There may be another in the future. It's enough to explain why." A complete list is the same pattern:
it says which components do X and teaches nothing about X. It will also go stale with the next
handler.

Fix: drop the table and the "Every handler the library defines:" line. Keep the rule (the three
bullets) and teach it with one worked example in a `ConceptExample` block. Use the sentence from
vision principle 3, which the page does not have yet:

> Most state has only an action. Where both kinds of change exist, a component offers both props.

```tsx
<ConceptExample component="Popover" href="/components/popover">
  <p>
    An overlay's open state has both kinds of change. Opening, and a close the user asks a part for,
    are requests: <code>openChangeAction</code>. Escape or a click outside is a fact: the browser has
    already hidden the popup, and <code>onOpenChange(false, details)</code> is called from its event.
  </p>
  <CodeBlock>{`const [open, setOpen] = useState(false);
<Popover.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>`}</CodeBlock>
</ConceptExample>
```

Each component page already documents its own handlers, and so does SKILL.md (an agent reference,
where a list is fine).

### M2. "Fact" is defined three different ways, and the glossary entry is narrower than the reference pages (rule 3, accuracy)

- `ActionPropsPage.tsx:17-19` (intro): "A change the library cannot hold, **because the browser already
  made it**".
- `BrowserOwnedStatePage.tsx:64-67` (term "Fact"): "A change **the browser already made** in front of
  the user and the library could not hold".
- `PendingOptimisticPage.tsx:136`: "A change the browser already made".
- `packages/ui/skills/funstack-ui-knowledge/SKILL.md:25`: "report **facts** (changes the browser already
  made)".

Vision principle 3 says: "a change that had already happened when the library heard of it and that it
could not hold". That is wider. The reference pages, correctly, call these facts too: Menu's Tab-out
(`MenuPage.tsx` "Tab closes immediately… It is a fact"), a scroll or a right-click outside a context
menu (`ContextMenuPage.tsx:527`, "the closes the library performs at once and cannot hold"),
Combobox's focus-leaving close (`ComboboxPage.tsx:664`, "closed by the library at once, which it cannot
hold either"). In the code all of them are `recordCloseIntent` + `hidePopover()` from the library, then
`notifyClosed`. `onInputValueChange` is also called for the library's own text writes. A reader who
learns "fact = what the browser did" from the glossary meets a contradiction on the component pages.

Fix: use the vision's wording everywhere, and give the browser as the usual case, not the definition.

- Glossary (`BrowserOwnedStatePage.tsx:67`):
  > A change that had already happened when the library heard of it, and that the library could not
  > hold: usually the browser did it in front of the user (a [dismissal](#dismissal)), sometimes the
  > library itself, because holding it would leave a popup on screen after the user has moved on
  > (focus leaving it). It is reported to an `on*` handler, synchronously, outside any transition,
  > and not awaited.
- Action props intro (`:17-19`): "A change the library could not hold, because it had already
  happened when the library heard of it, is reported to an `on*` handler instead."
- Pending (`:136`) and SKILL.md (`:25`): "a change that had already happened (a popup dismissed with
  Escape)".

### M3. Two glossaries for one concept, and the definitions disagree (rule 3, terminology)

"Request" and "fact" are introduced in bold on Action props (`:391-404`, `#handlers`), with no Terms
entry there, and defined again in Terms on Browser-owned state (`:58-67`). The two texts differ (see
M2; "Request" on Browser-owned also says the request is "**reported to** an action prop", but "report"
is the verb for facts; a request is *asked* / *passed*). The test ("if the callback rejects, or the
parent ignores it…") appears twice too (`ActionPropsPage.tsx:399-401`, `BrowserOwnedStatePage.tsx:187-190`).

Principle 3 is about action props, so Action props should own these words. Fix:

- Add `request`, `fact` and `on* handler` to the Terms list of Action props (`:35-63`). Request:
  "A change the library can still roll back. It is passed to an action prop before it is committed,
  called inside a transition and awaited; a rejection, or a controlled parent that does not adopt it,
  rolls the UI back."
- On Browser-owned state, keep the two Terms entries short and link to them
  (`[Request](/concepts/action-props#request)`), or drop them. State the test once, on Action props.

### M4. Toast props table: implementation history on a reference page (#143)

`packages/docs/src/pages/ToastPage.tsx:301`: "A handler (`closeAction` up to 0.1.0-alpha.16, #148): …"

#143, "Historical Information": this kind of note "is not a good fit for component reference pages".
The rename belongs on the Roadmap, which has it (`RoadmapPage.tsx:95-99`). It also ends up in
`toast.md` and `llms-full.txt`, where agents will read it as current API.

Fix: "A [handler](/concepts/action-props#handlers), not an action: called once when the toast leaves,
synchronously, outside any transition, and not awaited; …" (the rest unchanged).

Same thing in the TSDoc that IDEs show (not a docs file; for the developer):
`packages/ui/src/toast/toast.ts:62` "(#148; `closeAction` before)".

---

## Should fix

### S1. Action props: "The urgent lane" now contradicts the section above it

`ActionPropsPage.tsx:451-465`. "One kind of state cannot be a transition: the text of a controlled text
input". Twenty lines up, the dismissal is a second urgent change. The section also repeats the handler
rule ("A returned promise is allowed (the handler rule above)").

Fix: make it a worked example of a fact, not a special case. Rename it to "Example: the text of a
controlled input" (keep `id="urgent-lane"`, which Combobox links to), put it in a `ConceptExample
component="Combobox"` block, and open with: "React requires a controlled text input to update in the
same event as the keystroke, so typed text is a fact: by the time the library hears of it, the DOM
holds it." Then explain it, and drop the sentence about returned promises (the rule already says it).
"Urgent lane" is only defined by this heading. Either define it in Terms ("an update outside any
transition, which React renders at once") or say "urgent update", which the rule bullets already use.

### S2. Action props: the request/fact contract comes too late

`#handlers` is at `:391`, after Server Functions and form channels. Vision principle 3 opens with "The
name is a contract", but on the page the reader meets `fooAction` first and learns that it means
"request" only near the end. Also, "Here the 'wrap it in `startTransition`' advice above inverts"
(`:447`) points to a section 240 lines up (`:204-221`) without a link.

Fix: move `#handlers` to right after "Naming" (or after "Signature"), and make "above" a link:
"…the [advice for a `setState` after an `await`](#after-await) does not apply here: a handler is not in
a transition, so wrapping would make the update late." (Give the `:204` heading an id.)

### S3. Browser-owned state: Dialog is named as an exception in a concept paragraph (rule 1, "one exception")

`BrowserOwnedStatePage.tsx:270-278`. "A close through it is performed by the browser, so it is a fact
… (Dialog's foreign close commands are the exception: the library cancels and routes them, so they are
requests)." This is a component fact in a concept page. It also makes the general sentence untrue (in
the code, `dialog-popup.tsx` `onCommand` cancels and routes `close`/`request-close` in library mode).

Fix: state the rule that decides, and leave the per-component answer to the pages:

> A close through it is a request when the library can cancel the step and route it (a `command`
> event it can cancel), and a fact when the browser performs it before the library hears of it
> (`popovertarget`, a popover command). Either way `reason` is `"activate"`, because the user acted on
> a button. Each component page says which applies.

### S4. "Refuse" contradicts itself on one page (terminology)

`BrowserOwnedStatePage.tsx:199`: "That re-open is also how a parent **refuses a dismissal** on purpose".
`:250`: "a controlled parent **cannot refuse it**". `ActionPropsPage.tsx:54` (veto): "a dismissal is a
fact and cannot [be vetoed]". The design (2.4) is explicit: "This is still **not a veto**".

Fix (`:198-201`): "A parent that keeps `open={true}` on purpose gets the element shown again: the user
sees it close and come back, so this is not a refusal. A popup that must not be dismissed is set up on
the platform side instead (for example a Dialog without `lightDismiss`)."

### S5. "Close request" (the HTML term) next to "request" (the library term)

`BrowserOwnedStatePage.tsx:185`: "A dismissal goes through a close request instead, whose `cancel` the
browser honours only once per user activation". This is inside the section that has just defined
"request" as a library term, and here the word means the HTML close-request mechanism, which is
the opposite.

Fix: "A dismissal goes through the platform's close watcher (Escape, the back gesture), whose `cancel`
event the browser honours only once per user activation…", or keep the HTML term with a link and a
gloss: "an HTML [close request](https://html.spec.whatwg.org/multipage/interaction.html#close-requests)
(Escape, the back gesture; not a request in the sense above)".

### S6. Browser-owned state: rule text and worked example are mixed (rule 4)

`BrowserOwnedStatePage.tsx:193-209`. The `Dialog.Root` code block is in the rule text, outside the
`ConceptExample component="Dialog"` that follows. The "before hydration" paragraph (`:205-209`) sits
between the two. Move the code block into the Dialog `ConceptExample`, so the rule paragraph is free of
any one component. Same in `ServerComponentsPage.tsx:105-115`: the `Dialog.Root` snippet is bare, and
the sentence lists "(an overlay's `onOpenChange`, a toast's `onClose`)". A toast's `onClose` can't be
passed from a Server Component anyway (`toast()` is called on the client). Make it: "A Server Function
can be passed to an `on*` handler too: …", with the Dialog snippet in a `ConceptExample`.

### S7. When to pass which prop: uncontrolled mode is not covered

The controlled pattern is clear (Browser-owned `:193-204`; every Root's `open` row; Roadmap). The
uncontrolled case is only implicit. A reader can't tell whether an uncontrolled Root needs
`onOpenChange`, or that a function passed to both props is also called with `true` on open. Add, after
"Controlled mode needs both props":

> **Uncontrolled, pass what you need.** `openChangeAction` for work an open or a part's close must
> wait for (loading on open); `onOpenChange` to observe a dismissal (logging, remembering it). To hear
> every close, pass one function to both, and check `next`: the action is also called with `true`
> for an open.

(The `rememberDismissed` / `markAnnouncementSeen` examples, `ServerComponentsPage.tsx:111-115` and
`DialogPage.tsx` "Server Functions", have this trap. They are safe only because those dialogs start
open and have no Trigger. Say so in a comment, or name the function `rememberClosed(open)`.)

### S8. Browser-owned state: "Two modes" paragraph misses `onOpenChange`

`BrowserOwnedStatePage.tsx:140-142`: "Without any controlled value, default value or change action it
runs in JS-free mode … Add any of them". The Terms entry (`:79`) and the Popover/Dialog "Selected when"
rows were updated; this paragraph was not. Code: `use-overlay-root.ts` counts `onOpenChange`. Fix:
"Without any controlled value, default value, change action or `on*` handler…".

### S9. Menu and Combobox `onOpenChange`: `"activate"` misses the non-button Trigger

`MenuPage.tsx:230-245`, `ComboboxPage.tsx:234-238` list `"activate"` only for a foreign invoker. In the
code, a Trigger rendered as a non-button and pressed while open records an `"activate"` intent for the
fact (`use-popover-trigger.ts:175-180`, used by Menu; `combobox-trigger.tsx:167-170`). The Popover row
(`PopoverPage.tsx:215-230`) says it ("a non-button Trigger pressed while open"). Add the same words to
Menu and Combobox, so the three pages match.

### S10. Component pages: the four `onOpenChange` rows are not worded the same way (rule 2)

Popover, Menu and Dialog say "set state directly here (`onOpenChange={setOpen}`), never in
`startTransition` or after an `await`" and "no view transition runs". Combobox (`:238`) leaves out both
the `startTransition`/`await` warning and the view-transition sentence. Use one sentence order for all
four: what it reports, `reason` values, called how, controlled use (with the warning), promise/errors,
mode selection (Popover/Dialog only).

Related: Combobox `openChangeAction` (`:229-232`) no longer documents its `reason` values, and
`ComboboxOpenChangeDetails` is described "as Popover's" (`:315`). Combobox's reasons differ (typing,
ArrowDown and `openOnClick` are `"activate"`; `"platform"` only when script opened it before mount;
see the TSDoc at `combobox-root.tsx:68-72`). List them, as the other three pages do.

### S11. Action props: "its page lists them in the description of its change action"

`ActionPropsPage.tsx:150-151`. On overlays the reasons are now split between `openChangeAction` and
`onOpenChange` (Dialog's action gets only `"activate"`/`"platform"`). Fix: "…in the description of its
change action and of its `on*` handler." Also in the `reason` table (`:138-139`), "On an overlay
these are facts" is too strong. A submenu's hover close and a lost interest during a pending
`interestfor` open stay requests with `"dismiss"` (`menu-hover.ts`, Popover page `:168-169`). Say
"most of these".

### S12. Roadmap: the breaking item is a list of causes, not a rule, and misses what stays

`RoadmapPage.tsx:32-93`.

- The first sub-bullet enumerates causes ("Escape, a click outside, … lost interest") but not all of
  them: scroll and long-press release outside a context menu, Clear while a combobox is open, a
  non-button Trigger pressed while open, a Menu or Combobox foreign invoker ("a consumer's own invoker
  button closing **a popover**", `:41`, reads Popover-only). Lead with the rule, then examples:
  "`openChangeAction` is no longer called for a close the library did not perform on request
  (Escape, a click outside, focus leaving, a foreign invoker, script…). Those go to the new
  `onOpenChange`."
- Add the migration line that code needs: "Code that checks `reason === "dismiss"` inside
  `openChangeAction` must move to `onOpenChange`."
- "Not changing" (`:92-93`) should also name the requests that keep `"dismiss"`: the pointer leaving a
  hover-opened submenu, and lost interest while an `interestfor` open is pending. They are still
  `openChangeAction(false, { reason: "dismiss" })`. Without this, the first bullet says every
  `"dismiss"` moved.
- "A submenu closed by its parent menu reports through `onOpenChange`" (`:84-86`) is a cause like the
  others. Fold it into the first bullet.
- Wording: "a popup opened before hydration is still **reported through**
  `openChangeAction(true, …)`". "Reported" is the fact verb. Write "is still a request:
  `openChangeAction(true, { reason: "platform" })`".

### S13. Tooltip: a promise about the future on a reference page (#143)

`TooltipPage.tsx:445-448`: "if a callback is ever added it will be an `onOpenChange` handler." That is
a design decision (overlay-open-change.md decision 12), not current behaviour. Delete the clause and
keep "every open and close is the browser's or a timer the user drives, so none of it is a request".

---

## Nits

- N1. `PendingOptimisticPage.tsx:136-140` "the popup, `data-open` and the content all change at once".
  With a CSS exit the content stays mounted until the exit ends (`held`). Write "the popup,
  `data-open` and the committed state".
- N2. "Never pends" (`PopoverPage.tsx` Trigger state and `data-pending` rows, `DialogPage.tsx:104,113`,
  Pending page). True for the dismissal itself. But a request that a dismissal superseded keeps
  `data-pending` (without `data-open`) until it settles (design 2.5, "one honest leftover"). A reader
  who presses Escape during a slow close sees a pending Trigger. One clause on the Popover and Dialog
  pending rows: "(a request still running when a dismissal superseded it keeps `data-pending` until it
  settles)".
- N3. Re-open timing is described three ways: "at once" (reference pages), "in the same event"
  (`BrowserOwnedStatePage.tsx:217`), "shown again at once". The design says it happens in the task of
  the `toggle`/`close` event and a frame may paint. Use "at once" everywhere. Note once (Browser-owned)
  that the user may see a blink.
- N4. `ActionPropsPage.tsx:432-433` "the library's own work around the call still happens" is vague.
  Write "a throw does not stop the library from updating the component".
- N5. `ToastUndoWindow.tsx:17` `note` wraps `setLog` in `startTransition`. That was needed when
  `closeAction` ran in a transition. In a handler it is optional, and the example now sits under
  "a `setState` in the body is an urgent update". Either drop the wrapper or comment why it stays
  (after `await sleep`, a log is fine either way).
- N6. `ToastPage.tsx:167-168` "after the toast is already marked as leaving": "marked" is internal.
  Write "after the toast has started to leave (`data-ending`)", if that attribute is what it means.
- N7. `BrowserOwnedStatePage.tsx:99-102` "Callback" row: the `on*` handler is shown only under
  Browser-owned, but `onInputValueChange` reports library-owned urgent state. Write "an action prop
  for a request; an `on*` handler for a fact" across both columns, or drop the row.
- N8. SKILL.md `:25` "whose rejection goes to `reportError`": add "or a throw", as on the pages.
- N9. `ActionPropsPage.tsx` page `description` (meta, `:13`) still only mentions actions. Add "and
  `on*` handlers for changes that already happened". It is the line `llms.txt` shows.

## Checked and fine

- Props tables against the TSDoc on the branch: `onOpenChange` types
  (`UrgentChangeHandler<boolean, <C>OpenChangeDetails>`), `onClose: UrgentHandler<ToastCloseDetails>`,
  `UrgentHandler` exported from the package root. Dialog `returnValue` (`""` for Escape, the argument
  of a script `close(value)`). Dialog `openChangeAction` reasons (`"activate"`/`"platform"` only: the
  code never requests a Dialog close with `"dismiss"`). Dialog foreign close commands as requests.
  The `"dismiss"` fallback for an unrecorded fact (`dialog-popup.tsx:417`, `use-popover-popup.ts:331`).
  JS-free mode selection (`use-overlay-root.ts`). The development warning text matches "Pass
  `onOpenChange` too".
- `onOpenChange` only ever `false`, and the pre-hydration open stays a request, consistent with design
  2.12 on every page.
- The handler rule (sync, not awaited, rejection or throw goes to `reportError`, no warning) matches
  `call-urgent-handler.ts` and vision principle 3 on every page that states it.
- Examples: `PopoverSlowOpen`, `MenuSlowOpen`, `ComboboxSlowOpen` (#122), `PopoverActions`,
  `DialogOrders`, `MenuRowActions`, `ToastUndoWindow` pass and log `onOpenChange` / `onClose`, and the
  page text that describes them matches.
- Playground: controlled demos pass both props, and `TransitionDemo` shows the re-open with "refuse".
- Server Function to `onOpenChange` outside a transition: verified in `memo/developer/issue-148.md`
  probe 4.
