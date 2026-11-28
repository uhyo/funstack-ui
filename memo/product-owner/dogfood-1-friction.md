# Friction log: building "Teamboard" with @funstack/ui 0.1.0-alpha.29

Written as I went. Severity: blocker / bug / docs / DX / nit.

## Onboarding

### F1. The skill is dense to the point of being hard to act on (docs/DX)

- **Doing:** reading `.claude/skills/funstack-ui-knowledge/SKILL.md` before writing code.
- **Expected:** a short mental model plus a "do this, not that" list (like the Radix or React Aria quick starts), with the edge-case detail left to the docs.
- **Happened:** the mental model bullets are single paragraphs of 300 to 500 words (the "Latest intent wins" bullet, line 17, packs set-valued commits, `CheckboxGroup` form resets, `reportError`, controlled-mode races, `whilePending` defaults for eight parts and native `disabled` precedence into one paragraph). The component index line for Drawer (line 56) or TextField (line 73) is a full page of rules. I came away knowing the big ideas (action props, `onOpenChange` for facts, `render` instead of `asChild`), but most of the rest only made sense after reading the component page anyway.
- **Workaround:** read the bundled Markdown docs per component, which are good (each page starts with a working example plus CSS).
- **Suggestion:** split each bullet into a one-line rule plus "see docs page X". Keep the "Things agents get wrong" list, which is the most useful part.

### F2. The docs are 1.1 MB of Markdown (nit)

`combobox.md` is 68 KB, `dialog.md` 49 KB, `menu.md` 49 KB. A coding agent cannot read them all. The "Anatomy" sections plus the first example are the part I actually used; a per-page "Quick reference" at the top would help.

## Building

### F3. Everything type-checked on the first try (pleasant)
- **Doing:** writing ~900 lines across Menubar, Toolbar, Tabs, Menu, AlertDialog, Dialog.Form + Form.Root, Combobox, MultiSelect, Select, NumberField, TextField, Switch, Slider, OTPField, Accordion, Collapsible, Drawer, Toast, Avatar, Progress, Meter from the skill and the docs, before running anything.
- **Happened:** `pnpm exec tsc -b` reported zero errors on the first run, and the first browser run rendered correctly. The `(next, details)` vs `(details)` split between change actions and task actions, `onOpenChange` vs `openChangeAction`, and `render={<Button action=… />}` composition all worked the way the skill described. The skill's "Things agents get wrong" list prevented every mistake it lists (I would have written `onValueChange` on Tabs and `asChild` on Tooltip.Trigger otherwise).

### F4. `MultiSelect.Value placeholder` is silently ignored once `children` is a function (DX / docs)
- **Doing:** a Labels MultiSelect in the New task dialog.
- **Expected:** `placeholder` shown while empty, function `children` for the non-empty summary (Radix `Select.Value placeholder` and Base UI behave this way).
- **Happened:** with `<MultiSelect.Value placeholder="Choose labels">{({ value }) => value.join(", ")}</MultiSelect.Value>` the Trigger rendered an empty string and collapsed to a few pixels high (screenshot `03-new-task-server-error.png`). The d.ts says "`placeholder`: Rendered by the default content while the selection is empty", so it is technically documented, but:
  - the skill (SKILL.md line 69) shows exactly `{({ value }) => value.map(...).join(", ")}` with no empty case;
  - the docs' Anatomy (`components/multi-select.md` "Anatomy") shows `placeholder="Choose toppings"` together with function children that do not handle empty, i.e. the broken combination;
  - the docs' own live examples work only because they repeat the placeholder text inside the function (`value.length === 0 ? "Choose toppings" : ...`), which is a hint that the API is awkward.
- **Workaround:** handle `value.length === 0` in the function.
- **Suggestion:** render `placeholder` while empty even with function children (or pass `placeholder` into the state), or warn in development when both are given.

### F5. A NumberField inside a Field gets the label twice (nit)
- **Doing:** `Field.Label` + `NumberField.Root` (the docs' "Inside a Field" recipe), then `getByLabel("Estimate (points)")` in Playwright.
- **Happened:** "strict mode violation: getByLabel('Estimate (points)') resolved to 2 elements": the `role=group` Root and the text input are both named by the same label. Probably intended (React Aria does the same), but it means a screen reader announces "Estimate (points), group, Estimate (points), edit text". Not mentioned on the page.
- **Workaround:** `getByRole("textbox", { name })` in tests.

### F6. "Show a toast and roll back" needs controlled state per row (DX / docs)
- **Doing:** per-task Checkbox saved optimistically; on failure, roll back and show an error toast (not replace the row with an Error Boundary fallback).
- **Expected:** something like `checkedChangeAction` rejecting = rollback, and a place to handle the error locally (React Aria and Base UI leave this to you, but they also have no built-in rollback).
- **Happened:** in uncontrolled mode the only rollback is a rejection, and a rejection must go to an Error Boundary (which unmounts the row). The skill does say "A rejection or a parent that does not adopt shows the saved text again" for TextField, and the docs describe "a controlled parent vetoes by not adopting", but nowhere is it framed as *the* recipe for the very common "toast on failure" case. I had to convert every row to `useState` + `checked` + `startTransition(() => setDone(next))` after the await, and `catch` + `toast()` + `return` on failure. Same for the settings Switches, TextFields and the Slider (`src/TaskRow.tsx`, `src/SettingsPage.tsx`).
- **Workaround:** controlled + "resolve without adopting". It works well once you know it.
- **Suggestion:** a short "Handling a failed save without an Error Boundary" recipe on the Action props page, linked from the skill.

### F7. A server error routed to a field blocks retrying the same value (mistake the skill did not prevent; docs)
- **Doing:** Edit task dialog and New task dialog with `Dialog.Form render={<Form.Root errors={...} />}`. For a transient failure ("Server error while trying to rename the task") I put the message on the `title` field, because `errors` is the only error channel shown in the docs.
- **Expected:** fixing nothing and pressing Save again retries.
- **Happened:** the second Save did nothing at all: no request, no message, dialog stays open. The field page says (in the middle of a paragraph) that a server error is "written into the control's custom validity (a resubmission of the same value is blocked, with the usual focus)". Right for "title already taken", wrong for "network hiccup", and there is no guidance for form-level errors anywhere in `field.md` or `dialog.md`.
- **Workaround:** put transient errors under a key that matches no field (`errors._form`) and render it myself in a `role="alert"` box. A non-empty entry still keeps the dialog open (`src/TaskRow.tsx` EditDialog, `src/NewTaskDialog.tsx`). This is a guess that happens to work; I did not find it documented.
- **Suggestion:** document form-level errors (a reserved key, or a `Form.Error` part with no field), and say explicitly "do not put transient errors on a field".

### F8. Toast Undo failure: the documented Error Boundary placement removes the whole toast region (docs, borderline bug)
- **Doing:** Undo on the delete toast, with the restore request failing.
- **Docs:** `components/toast.md` "Undo and onClose": "A rejection keeps the toast and reaches the nearest Error Boundary **above the Viewport**: put one around the list." and later "Rethrow after the update (the toast stays; the boundary above the Viewport gets the error)".
- **Happened:** with `<ErrorBoundary><Toast.Viewport>…</Toast.Viewport></ErrorBoundary>` the boundary unmounts the entire Viewport, so every toast disappears and my fallback rendered in normal flow at the bottom of the page (screenshot `13-undo-failed.png`). "The toast stays" is not what the user sees. "Above the Viewport" and "around the list" also contradict each other (the list is inside the Viewport's children function).
- **Workaround:** one Error Boundary per toast inside the Viewport's children (`src/App.tsx` `renderToast`). Only the failed toast is replaced, the region stays, and the fallback's "Try again" brings the toast and its Undo back (screenshot `13b-undo-failed-inner-boundary.png`).
- **Suggestion:** recommend the per-toast boundary in the docs, or give `Toast.Root` an error state (`data-error`, `state.error`) so no boundary is needed.

### F9. `useActionState` outside the Dialog shows stale server errors on the next open (docs)
- **Doing:** New task dialog, following `field.md#dialog-form`: `const [state, dispatch] = useActionState(...)` then `<Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />}>`.
- **Happened:** submit a duplicate title (server error), Cancel, open again: the empty Title field shows "A task with this title already exists." (the docs do say errors present at mount are shown, but the recipe sets you up for it).
- **Workaround:** move the form and its `useActionState` into a component rendered inside `Dialog.Popup`; the Popup content unmounts while closed, so the state resets (`src/NewTaskDialog.tsx` `NewTaskForm`).
- **Suggestion:** write the recipe that way, or mention the trap next to it.

### F10. The toast region moves into an open modal dialog (nit)
- Documented and sensible (toasts stay interactive above a modal), but a test that reads `alertdialog.textContent` suddenly contains "Task renamed×". On a phone the toasts also cover the Drawer's bottom "Done" button (my CSS positions them bottom-right; worth a styling note in the Drawer or Toast page).

### F11. An Error Boundary "inside the Popup" also eats the Cancel button (docs nit)
- AlertDialog docs: "a rejection keeps it open (place an Error Boundary inside the Popup to show it)". I wrapped the actions row, so on a failed delete both Cancel and Delete were replaced by my fallback; only Escape remained (screenshot `12-delete-failed.png`). An example showing the boundary around just the Action (or around an error slot) would help.

### F12. One pending save makes every menu, tab and dialog in the app wait for it (DX, the biggest practical problem)
- **Doing:** checking a task (an awaited `checkedChangeAction`, 300 to 1200 ms) and then, while it saves, opening a row's Menu, switching Tabs, or pressing my `N` shortcut for the New task dialog.
- **Expected:** popups open instantly; the save is local to one checkbox. In Radix / Base UI / React Aria opening a menu never depends on unrelated network work.
- **Happened (measured with Playwright, `scripts/debug-interplay.mjs`):**
  - row menu open while another row's checkbox saves: **1326 to 1831 ms**;
  - tab switch: **1354 to 1856 ms**;
  - New task dialog via `startTransition(() => setOpen(true))`: **795 to 2306 ms**;
  - typing in a plain `<input>` (urgent): 20 ms.
  The extra time beyond the save itself is my `refresh()` transition after the save (its fetch suspends), which the held transitions get entangled with.
- **Why:** React holds every transition while an async action is pending, and in this library *every* open is a transition, even an uncontrolled `Menu.Root` with no `openChangeAction` and no suspending content. The skill says it in "Things agents get wrong" #3 ("A pending async action holds every other transition in the app (including router navigations)"), but the consequence "your menus will not open while a checkbox is saving" is not spelled out, and the library's headline feature (awaited actions with optimistic state and rollback) is exactly what triggers it. The only documented way out (`void save()`, do not return the promise) gives up the pending state and the rollback the library is built around.
- **Workaround:** for my own shortcut I set the controlled `open` urgently (no `startTransition`): the dialog then opens in **72 ms** even while a save is pending (`src/App.tsx` `Shortcuts`). For library-owned opens (menus, tabs) I found no workaround short of not awaiting saves.
- **Suggestion:** open uncontrolled overlays without a transition when there is no `openChangeAction` (or give them an `urgent` option), and add a prominent "pending actions hold other transitions" section to the Action props page with numbers like the above.

### F13. Combobox listbox is as wide as the `<input>`, not the input-plus-buttons group (nit)
- The Clear and Trigger buttons sit next to the input, so the listbox came out narrower than the visible field (screenshot `04-combobox.png`). The fix (`anchor-name` on the group, `style={{ positionAnchor, minWidth: "anchor-size(--group width)" }}` on the Popup) is in the docs, but only as a bullet in "Browser notes" near the end of a 68 KB page; the first example's CSS does not do it. Worth putting into the main example since nearly everyone renders Clear / Trigger.

### F14. Library development warnings are clear and appear as `console.error` (pleasant)
- The finished app produces **no** console output at all in Chromium (dev and preview). To confirm warnings were live I removed `defaultValue` from `Tabs.Root` and got: `Tabs.Root: neither \`value\` nor \`defaultValue\` was passed, so no tab is selected and no panel is shown. Pass \`defaultValue\`, or \`defaultValue={null}\` to start with no selection.` That is exactly what I needed to read.

### F15. Combobox: type then Enter does nothing by default (nit)
- Typing "ken" and pressing Enter left the text "ken" and no value; ArrowDown + Enter picked "Ken Thompson". This is the APG default and `autoHighlight` exists, but most comboboxes users meet (Downshift, MUI Autocomplete) pick the first match. The skill's Combobox line does not mention `autoHighlight`; I found it in the props table. Unmatched text reverting on blur, and Escape closing first the listbox and then the dialog, both behaved well.

### F16. Things that worked better than in other libraries (pleasant)
- **Opening a Dialog / AlertDialog from a `Menu.Item`** with a controlled `open` just worked, and focus returned to the row's `Menu.Trigger` after the dialog closed (Radix needs `modal={false}` or `onCloseAutoFocus` tricks for this).
- **`AlertDialog.Action action={...}`**: pending label, the dialog stays open while deleting and closes on success, focus starts on Cancel; nothing to wire.
- **`Dialog.Form` + `Form.Root errors`**: the server-error round trip (field error focused, dialog kept open, values kept, closed and reset on success) needed no state of my own beyond `useActionState`.
- **Toasts** with an Undo that is an action prop (pending "Undoing…" label for free) and `toast()` callable from inside actions without the toast waiting for the transition.
- **Tabs + Suspense**: the old panel stays with `data-pending` on the Root while the new one loads; I wrote one `.tabs[data-pending] .tab-panel { opacity }` rule and no loading state.
- **Drawer** swipe-to-dismiss worked first time with the docs' CSS; **Avatar** fallback, **Progress** and **Meter** (`data-region`) were trivial.
- **Menubar** keyboard (ArrowRight between File and View, hover switching) needed nothing beyond wrapping `Menu.Root`s.

### F17. A `required` TextField saves an empty value (docs: skill silent)
- **Doing:** inline-saving "Display name" inside `<Field.Root name="displayName" required>` (the TextField page's own Field example uses `required` too).
- **Expected:** an invalid draft is not committed, or at least the commit action is told it is invalid.
- **Happened:** clearing the field and pressing Enter showed the Field's "Please fill out this field." **and** my "Saved display name" toast: `valueCommitAction("")` ran and the empty name was saved. `components/text-field.md` says so in one bullet ("The commit does not look at validity: text that fails `required` or `pattern` is committed like any other. An action that must not save such text checks it."), but the skill's long TextField line does not, and `details` carries no `valid` flag.
- **Workaround:** `if (next.trim() === "") return;` at the top of the action; resolving without adopting rolls the field back to the saved name (`src/SettingsPage.tsx`).
- **Suggestion:** pass `details.valid` (or skip the commit while the control is invalid inside a Field), and add one sentence to the skill.

## Library JS read

I never had to read the compiled JS in `node_modules`. Everything I needed was in the skill, the bundled Markdown docs, or a `.d.mts` doc comment (F4 was confirmed from `dist/multi-select/multi-select-value.d.mts`, whose comments are good).

## Verification

- `pnpm exec tsc -b`: passes. `pnpm build`: passes (one Vite chunk-size warning, 512 kB minified, 157 kB gzipped, mostly React).
- `node scripts/verify.mjs` (dev server on :5199) and `node scripts/verify.mjs http://localhost:5299/` (`vite preview`): 33 checks, all pass, **no console output** (no React warnings, no library dev warnings, no errors). Covers: optimistic check, failed check with rollback + toast, Tabs suspending, New task dialog (client `required` error, server error on the title, Combobox async search, MultiSelect, Select, NumberField stepping, date), delete via row Menu + AlertDialog, Undo from the toast, Move to submenu, Menubar keyboard and View > Compact, the `N`, `,` and `t` shortcuts, Settings (TextField Enter commit, Switch, Slider keys, read-only field, Accordion + Collapsible, OTP wrong then right code), and the mobile filter Drawer.
- `scripts/explore.mjs`, `scripts/debug-interplay.mjs`, `scripts/debug-combo.mjs`, `scripts/debug-drawer.mjs`, `scripts/debug-textfield.mjs`: failure paths, focus return, timing and keyboard probes behind F7, F8, F11, F12, F15, F17.
- Screenshots in `screenshots/`.

## What was pleasant

- The mental model holds up: once "actions are requests, `on*` are facts, triggers optimistic, panels committed" clicked, I could predict behaviour without reading every page.
- Types were precise and the examples compiled as written (F3). Discriminated props (`ToggleGroup exclusive`, `Combobox multiple`) inferred `next` correctly with no annotations.
- Pending UI came for free everywhere: `data-pending` on checkboxes, tabs, menu items, AlertDialog Action, toast Undo, TextField, Switch, Slider thumb, OTP. My CSS is the only "loading state" code in the app.
- The docs pages are excellent references: each starts with a real example plus its CSS, and the CSS for Drawer, Slider, Progress, Meter, Avatar and Toast could be pasted almost as is. Being headless was not a burden because of that.
- Platform-first pieces (native `<select>` with `base-select`, `<dialog>`, popovers, `<details>` accordions, native checkboxes) behaved like the platform, so Playwright's role locators found everything by its natural role and name.
- Dev warnings are specific and actionable (F14); the finished app logs nothing.

## Top 5 changes I'd want before a beta

1. **Stop unrelated opens from waiting on pending actions (F12).** A menu, tab or dialog that has no `openChangeAction` should not queue behind another component's save. At minimum, document the effect prominently with a recipe.
2. **A first-class story for "failed save, show a message, roll back" without an Error Boundary (F6, F8, F11).** Either an error state on parts (`state.error`, `data-error`) or a documented recipe; and fix the Toast docs' "Error Boundary above the Viewport" advice, which removes all toasts.
3. **Form-level errors (F7).** Document (or add) a way to report a non-field server error from `Form.Root` / `Dialog.Form`, and warn that a field error blocks resubmitting the same value.
4. **Remove placeholder / validity footguns:** `MultiSelect.Value placeholder` with function children (F4), `required` TextField committing empty text (F17), the `useActionState`-outside-the-dialog stale error trap (F9).
5. **A shorter skill (F1, F2).** One-line rules plus links; put the many edge cases on the pages. Add the specific traps above to "Things agents get wrong".

## Components I didn't get to

Popover, HoverCard, NavigationMenu, context menus (`Menu.ContextTrigger`), `Combobox multiple` with chips, the standalone `Button` beyond nav links and Tooltip composition, `CheckboxGroup` select-all beyond a quick use in the Drawer, `CSPProvider`, and the scroll-area recipe. I also did not test Firefox or WebKit, RTL, or a screen reader.
