# Combobox

Status: **accepted** (2026-10-17, wave 4, GitHub issue #50; the product owner accepted questions
1 to 5 and 7 to 11 as recommended and the user overrode question 6: a default English
announcement ships, see "Decisions recorded" at the end). **Revised after review** (2026-10-17,
`memo/reviewer/combobox.md` and `memo/developer/combobox.md`; the product owner's decisions are
in "Review revisions" at the end: the loading state and `aria-busy`, the active option cleared by
typing, the rollback outside the transition, and the accepted implementation deviations).
**Amended 2026-10-23 (#96, user decision)**: the urgent lane is a handler, `onInputValueChange:
UrgentChangeHandler`, no longer `inputValueChangeAction: UrgentChangeAction`; edited in place
(decision 3, 2.2, 3, 3.1, 3.6, 4, 6.2, 9, 10, 11.2, 12.1, 14), migration and implementation
checklist in the amendment at the end; the historical sections keep the old names.
Follows `design/conventions.md`
(accepted); where this document and the conventions disagree, the conventions win. **Read
`design/components/popover.md` and `design/components/menu.md` first**: Combobox is built on
the same internal hooks (`useOverlayRoot`, `usePopoverPopup`, `useActionTrigger`), the same
ownership split (library-owned open and part-initiated closes, browser-owned dismissals), the
same apply effect, close intents and `<ViewTransition>` wiring around the top-layer element, and
Menu's "stay open with `data-pending` on the item, close in the commit that ends the action"
rule. Then `design/components/select.md` for the boundary between the two components. This
document repeats only what differs and adds what a combobox is: a text input whose typing is
**urgent**, a listbox whose results render from a **deferred** query inside Suspense, virtual
focus through `aria-activedescendant`, and a selection that is a library-owned value with a
hidden form field.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/select-combobox.md` §6 and §7
(binding: the APG markup, the `showPopover({ source: input })` probe table, the urgent-input
rule, `useDeferredValue` for results, `ariaNotify`, no `<datalist>`, no Open UI combobox),
`docs/research/popover-menu.md` (stacking, `aria-activedescendant` set aside for Combobox),
`docs/research/react-async-apis.md` ("Transition updates can't be used to control text inputs";
`useDeferredValue` inside a Transition), `design/components/select.md` (accepted boundary),
`design/components/popover.md`, `design/components/menu.md`, the WAI-ARIA APG Combobox pattern
(editable combobox with list autocomplete), prior art (React Aria `ComboBox`, Base UI `Combobox`
and `Autocomplete`, Ark UI `Combobox`, Headless UI `Combobox`, Radix has none), and working
notes in `memo/architect/combobox-notes.md`.

Combobox is what Select cannot be: search, free text, custom and asynchronous filtering, loading
options on open, a controlled open state, and a listbox the library owns (`select-combobox.md`
§5). The platform gives the top layer, light dismiss, Escape, nesting under Dialog and Popover,
the implicit anchor from `showPopover({ source: input })` and the listbox width from
`anchor-size(width)`; the library owns the APG half (active option, keys, closing on focus loss)
and the Async React half: **typing is the library's first urgent update**, results come from
`useDeferredValue` so a slow search never blocks a keystroke and never flashes a fallback over
the previous results, and picking an option is a transition with `data-pending` on the option
and a hidden input that follows the optimistic value.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | One component | **One `Combobox` with `allowCustomValue`**, not a separate Autocomplete (recommendation; question 1). Markup, keyboard, popover, async results and virtual focus are identical; the two differ only in what an unmatched text means on commit (reverted, or dispatched as the value). React Aria and Ark take this shape; Base UI splits. |
| 2 | Anatomy | `Combobox.Root` (no DOM, except one `<input type="hidden">` when `name` is given), `Combobox.Label` (`label[for]`), `Combobox.Input` (`input[role=combobox]`), `Combobox.Trigger` (`button`, optional), `Combobox.Clear` (`button`, optional), `Combobox.Popup` (`div[popover=auto]`), `Combobox.List` (`div[role=listbox]`), `Combobox.Option` (`div[role=option]`), `Combobox.Group` / `Combobox.GroupLabel`, `Combobox.Empty`, `Combobox.Status` (`div`: `role="status"` in the Popup; inside the List it is the loading fallback and has no role, 6.3). No Portal, Positioner, Arrow, Chips. |
| 3 | Two library-owned states, two lanes | `value` (`string \| null`): `value` / `defaultValue` / `valueChangeAction`, a transition with `useOptimistic`, as every other value. `inputValue` (`string`): `inputValue` / `defaultInputValue` / `onInputValueChange`, the **urgent** state the vision reserved for this component (section 4). Same `x` / `defaultX` pair, different lane, and a **handler** instead of an action: `onInputValueChange` is the library's one `on*` prop, named as a handler because it is called synchronously in the event and never wrapped in a transition (conventions 2.1, 2.6; #96, replacing v1's `inputValueChangeAction: UrgentChangeAction`). `fooAction` keeps meaning "a transition" everywhere. |
| 4 | Results | The library filters nothing. `query` is `useDeferredValue(inputValue)`; `Combobox.List`'s function `children` (and Root's) receive `{ query }` and render the `Option`s for it, under a consumer-owned `<Suspense>` for async search. While `inputValue !== query` the Popup and List carry `data-stale`; the List is `aria-busy="true"` while stale **or loading** (a `Status` mounted inside it, 6.3); the previous results stay visible. No out-of-order results: React renders only the latest deferred value (section 6). |
| 5 | Active option | `aria-activedescendant` on the input, never DOM focus on options (research). The active option is **urgent library state** (it is focus; focus is never a transition anywhere in the library), exposed as `data-active` on the Option, revalidated whenever the mounted options change; ids are derived from the value so an option keeps its id across result sets. Typing, Home, End, Left and Right clear it (APG: visual focus returns to the textbox), so Enter never accepts an option the user has typed past; `autoHighlight` (default `false`) activates the first option only once results settle (not stale, not loading; 6.5). |
| 6 | Open | Always library mode (`useOverlayRoot({ mode: "library" })`, Menu's configuration): no JS-free mode. Open by typing, ArrowDown / ArrowUp, Alt+ArrowDown, the Trigger, optionally a click on the input (`openOnClick`); opened with `showPopover({ source: input })` in the apply effect. Closes: an accepted option and a Trigger click while open (library-owned, after the action settles; the Trigger is an invoker of the popup after hydration, so its press is not a light dismiss, #112), Escape, light dismiss and a Clear click while open (browser-owned, notified `"dismiss"`), focus leaving the input and popup (immediate `hidePopover()`, Menu's Tab rule, `"dismiss"`). Keys are judged against `:popover-open`, what the user sees (section 8). A press on the input while open is **not** a close: `source` is no light-dismiss exemption, so the Input captures the pointer to the Popup at `pointerdown` while the listbox is shown (#123). A press on a **foreign invoker** of the popup (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names it) is not focus leaving either: the Popup prevents its primary `mousedown` while shown, the input keeps focus and the click's native toggle closes the listbox as `"activate"` (#125, #126). |
| 7 | Accepting an option | Enter or click on an option: the input text becomes the option's label **at once** (urgent), the option shows `data-pending`, `valueChangeAction` is awaited inside the Root's transition, and the listbox closes in the commit that ends it (Menu decision 3). A rejection rolls the text and `data-selected` back and leaves the listbox open; a controlled parent that does not adopt the value gets the same rollback but the listbox closes (5.5); typing while the action is pending drops its close (5.2). Tab does **not** accept (manual selection; question 5). |
| 8 | Free text | `allowCustomValue`: Enter with no active option, or focus leaving, commits the text as the value (`details.custom: true`). Without it the text reverts on focus loss to the committed value's label (React Aria's rule). |
| 9 | Form | `name` / `form` on Root render `<input type="hidden" name value={optimistic ?? ""}>`; `required` goes on `Combobox.Input` and is native (empty text is `valueMissing`). No `setCustomValidity` (conventions 3.6). Form reset dispatches `"platform"` for both states, with reset targets computed in JS (a hidden input has no reset behaviour, 11.1); a pre-hydration typed text is reconciled at mount for `inputValue`. |
| 10 | Positioning | Inline `position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)` on Popup (`self-*` logical keywords since wave 11, #53: the listbox follows the popup's own inherited direction, so a `dir="rtl"` container flips it as a page-level `dir="rtl"` does, 7.2; v1 used the plain `block-end span-inline-end`, which resolves against the root). No `side` / `align`: a listbox goes below or above its input. No `data-side`. `style` overrides. |
| 11 | Announcements | `ariaNotify()` on the List when results settle (not while stale or loading; the counts are read through refs, 6.4); no live region. **A default English message ships** (`"No results"`, `"1 result"`, `"N results"`; user decision on question 6), overridable through `announce(count, state)` for localisation. The library's first built-in UI string; the convention it sets (built-in strings are English defaults, always overridable) is in conventions 11. |
| 12 | Pending and state exposure | `data-pending` on Input (value or open in flight), Trigger (open in flight), the optimistic target Option; `data-open` on Input and Trigger; `data-selected`, `data-active`, `data-disabled` on Option; `data-stale` on Popup and List; `aria-busy` on the List while stale or loading; `data-empty` on List. |
| 13 | ViewTransition | `transition` on `Combobox.Popup`, wrapping the `<div popover>` itself (conventions 5.1): library-driven opens and closes animate in every engine. A deferred results render also activates the boundary (React rule), so the docs recommend a type map with `default: "none"`. Types `fsui-combobox`, `fsui-combobox-open` / `-close`, `fsui-combobox-select`. |
| 14 | Not in v1 | `multiple` (chips), inline autocompletion (`aria-autocomplete="both"`), virtualization, a built-in filter, `Separator`, `Combobox.Input` inside the popup (searchable select), context-menu-style anchors. Section 13. |
| 15 | Files | Every part file is `"use client"`. Before hydration the Input is a plain text field (typing works and is adopted at mount); nothing opens. |

---

## 1. Anatomy

```tsx
import { Combobox } from "@funstack/ui/combobox";

<Combobox.Root name="country" defaultValue={null} valueChangeAction={saveCountry} announce={(n) => `${n} countries`}>
  <Combobox.Label>Country</Combobox.Label>
  <Combobox.Input placeholder="Type to search" required />
  <Combobox.Trigger aria-label="Show all countries" />
  <Combobox.Clear aria-label="Clear" />
  <Combobox.Popup className="listbox" transition={{ "fsui-combobox-open": "pop", "fsui-combobox-close": "pop", default: "none" }}>
    <Combobox.List>
      {({ query }) => (
        <Suspense fallback={<Combobox.Status>Searching…</Combobox.Status>}>
          <CountryOptions query={query} />   {/* use(searchCountries(query)) → <Combobox.Option> list */}
        </Suspense>
      )}
    </Combobox.List>
    <Combobox.Empty>No country matches.</Combobox.Empty>
  </Combobox.Popup>
</Combobox.Root>
```

Rendered HTML (closed, `value` is `"jp"`, text "Japan"; ids come from one `useId` in Root):

```html
<input type="hidden" name="country" value="jp">
<label for="_r_1_-input">Country</label>
<input id="_r_1_-input" type="text" role="combobox" autocomplete="off" required
       aria-autocomplete="list" aria-expanded="false" aria-controls="_r_1_-list"
       value="Japan" data-selected="">
<button type="button" tabindex="-1" aria-label="Show all countries" aria-expanded="false" aria-controls="_r_1_-list"></button>
<button type="button" tabindex="-1" aria-label="Clear"></button>
<div id="_r_1_-popup" popover="auto"
     style="position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)">
  <!-- children render while open; shown as they will be, with "ja" typed -->
  <div id="_r_1_-list" role="listbox" aria-labelledby="_r_1_-label">
    <div id="_r_1_-option-jp" role="option" aria-selected="true" data-selected="" data-active="">Japan</div>
    <div id="_r_1_-option-jm" role="option" aria-selected="false">Jamaica</div>
  </div>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none, or `input[type=hidden]` when `name` is given | | `state` in `children(state)` | Owns `useId`, both state hooks, the deferred query, the active option, the open state (`useOverlayRoot`), the Option and Status registries, the label cache, the form-reset listener. No `ref`, `className`, `style`. |
| `Label` | `label` | | | `htmlFor` → the Input's id (owned); `id` → the List's `aria-labelledby`. |
| `Input` | `input` | `combobox` | **urgent** text, optimistic `value` for `data-selected`, optimistic open for `data-open`, shown open (the Root's `shown` mirror) for `aria-expanded` (#118) | `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`, `autocomplete="off"`, `data-open`, `data-pending`, `data-selected`, `data-disabled`. The Root's `pending` lands here (the owner renders no element). |
| `Trigger` | `button` | button | optimistic open (`data-open`); no `aria-expanded` on a `<button>` (#121: the browser exposes the listbox's state once `popovertarget` is written) | Optional. `tabindex="-1"` (APG: not in the Tab sequence), `aria-controls`; click toggles and focuses the input. `popovertarget` written through the ref after hydration, never server-rendered, every click cancelled (section 1, 3.3, #112 / #121). |
| `Clear` | `button` | button | | Optional. `tabindex="-1"`; click empties the text (urgent) and dispatches `valueChangeAction(null)`. Rendered only while there is text or a value? No: always rendered; consumers hide it with `:has(input[data-selected])` or `state`. |
| `Popup` | `div` | none (a container) | committed open | `popover="auto"`, `id`, inline placement, `data-stale`, `data-open` never (`:popover-open`). The content region; children render from committed open. Must be a DOM sibling of the Input where possible (section 7). |
| `List` | `div` | `listbox` | `query` (deferred) | `id`, `aria-labelledby` → Label while one is mounted (token-merged), `data-stale` while stale, `aria-busy="true"` while stale or loading, `data-empty`. Function `children` receive `{ query }`. Its accessibility children are `Option`s and `Group`s only (ARIA content model): `Empty` lives in the Popup, outside it, and a `Status` rendered inside it (the Suspense fallback) is role-less and marks the List as loading (6.3). |
| `Option` | `div` | `option` | optimistic `value`, urgent active | `value` required; `label` optional (the text written into the input; default the element's `textContent` at the time of the pick); `disabled` → `aria-disabled`. `id` derived from `value`. `aria-selected`, `data-selected`, `data-active`, `data-pending`, `data-disabled`. `pointerdown` is `preventDefault()`ed so the input keeps focus. |
| `Group` / `GroupLabel` | `div[role=group]` / `div` | group | | `aria-labelledby` → the `GroupLabel` id, as Menu. |
| `Empty` | `div` | none | mounted-option count, stale, loading | Renders its children only when the List has **no mounted options and the results are neither stale nor loading** (section 6.3); nothing otherwise. |
| `Status` | `div` | `status` in the Popup; none inside the List | | In the Popup: a hint with `role="status"`. Inside the List: the Suspense fallback; it renders with `role="none"` (a listbox may own only options and groups) and its presence tells the Root the results are **loading** (6.3). Announcements are `ariaNotify` (6.4), never a live region. |

Why this shape:

- **`Root` renders no element, but may render the hidden input.** The owner of two states and a
  popover has no natural element (Popover's Root renders none), and the form value must live in
  a form-associated element that is not the visible input, whose text is a *label*, not the
  value. One `<input type="hidden">` is the smallest honest answer (research §6: "form
  participation needs a hidden input"), and conventions 1.1's "at most one DOM element" holds.
  A wrapper `<div>` was rejected: it is an element the consumer did not ask for, and it would
  make the Popup's anchoring depend on the wrapper's box rather than the input's.
- **`Popup` and `List` are separate.** The research's single `role="listbox" popover="auto"`
  element cannot hold a "No results" row: a listbox's accessibility children are options and
  groups only. Base UI draws the same line (Popup > Status, Empty, List). The popover is the
  Popup; the listbox is the List; `aria-controls` points at the List. The "Loading…" row is the
  one exception: a Suspense fallback must sit where the suspending options mount, inside the
  List, so that the popup opens at once and the results land later; a `Status` there is
  role-less, and the busy listbox (`aria-busy="true"`, which also exempts it from the
  required-children rule while it has no options) carries the meaning (6.3).
- **`Label` is a part** because the APG combobox is named by a visible label and the List
  should be named by the same text; the part wires `for` and `aria-labelledby` from one id.
  It is the conventions' `Label` ("names the owner"): here the owner's name belongs on the
  Input.
- **`Trigger` renders no invoker attribute, and becomes an invoker after hydration (#112; `popovertarget` since #121).** A
  declarative invoker in the server HTML would act before hydration: a click would open an
  empty popup anchored to the button, with the button's `anchor-size(width)`. So the server HTML
  has none. After hydration the Trigger writes `popovertarget` (the Popup's id)
  through its ref and cancels every click, so the activation never runs
  (the popup is always opened by the library with `source: input`) and, because the button names
  the shown popover, a press on it is **not a light dismiss** (HTML's "topmost clicked popover";
  conventions 3.5). Without the attributes the browser hid the listbox at `pointerup`, before
  the click's `openChangeAction(false)` could run (section 3.3, the #112 amendment).
- **`Clear` exists** because "clear the selection" has no keyboard-free spelling otherwise
  (Escape closes; it does not clear, section 8), and prior art agrees (Base UI, Ark).
- **No `Separator`** in v1: `role="separator"` is not in a listbox's content model; a visual
  divider is a `Group` boundary styled in CSS.

Every part renders exactly one element; only `Popup` renders a `<ViewTransition>` (decision 13),
as the outermost node around the `<div popover>` and only when `transition` is given.

Element constraints for `render`: `Input` must stay an `<input>` whose `type` is text-like
(`text`, `search`; dev warning otherwise: `role="combobox"`, `aria-activedescendant` and the
caret keys depend on it); `Popup` a `<div>` (a `<dialog>` would run the dialog focusing steps and
pull focus out of the input); `Option` any element (it is never focused); `Trigger` / `Clear` a
`<button>`. The library's `role`, `aria-*` wiring, ids and `data-*` go on whichever element
renders (owned keys, conventions 1.2).

---

## 2. States and lanes

| State | Owner | Kind | Lane | Library-owned or browser-owned |
| --- | --- | --- | --- | --- |
| `value` | Root (`useControllableAction<string \| null>`) | the selection | **transition** (optimistic through `useOptimistic`) | Library-owned; residual browser path: form reset (`"platform"`). `null` is a real empty state (conventions 3.1), unlike Select's `""`. |
| `inputValue` | Root (`useState`, plus an optional controlled prop) | the text in the input | **urgent** (section 4) | Library-owned through a controlled `<input value>`; residual browser paths: typing before hydration (mount reconciliation), form reset, Firefox form-state restoration, all `"platform"`. |
| `query` | Root, derived: `useDeferredValue(inputValue)` | what the results are for | deferred | Derived; never set. `stale = inputValue !== query`. |
| `activeValue` | Root (`useState`) | the option `aria-activedescendant` points at, `null` for none | **urgent** | Library-owned virtual focus. Not controllable in v1. Cleared (`null`) when the active option unmounts and by typing, Home, End, Left and Right (6.5); with `autoHighlight`, set to the first option when results settle. |
| `open` | Root (`useOverlayRoot`, library mode) | the listbox is shown | transition | Library-owned for opens and for the close after an accepted option; browser-owned for Escape and light dismiss (notified); library-performed immediate close on focus loss (Menu's Tab rule). |
| `pending` | Root | `value` transition or `open` transition in flight | | On the Input (owner surface), the Trigger (open only), the target Option (value only). |
| `loading` | Root, derived from the Status registry | a `Status` is mounted inside the List (the Suspense fallback) | n/a | Internal, not in `state` in v1: drives `aria-busy` on the List, hides `Empty`, gates the announcement (6.3, 6.4). Read through a ref in effects, never through render state (6.4). |
| mounted options, labels, Status parts | Root (refs) | registration from `Option` and `Status` layout effects | n/a | Internal: the active-option revalidation, `Empty`, `loading`, `ariaNotify`, and the value→label cache (2.2). |
| focus, caret, selection in the input | DOM | | | Browser-owned. The library never calls `focus()` except from the Trigger and Clear clicks (which focus the input), and never touches the caret. |

### 2.1 Why two lanes, and why the two states are separate props

"Transition updates can't be used to control text inputs" (React docs; `react-async-apis.md`
"Controlled text inputs"). A keystroke must land in the DOM in the same event, and a
transition-lane state is restored to the old prop at the end of the event, exactly as a
transition-only controlled `<select>` snaps back (Select 4.1). So the text is urgent, full stop.
Everything downstream of the text is not: the results render from `useDeferredValue`, the open
is a transition, the selection is a transition. That is the vision's "everything is transition"
with the one documented opt-out, placed where the docs put it.

`value` and `inputValue` are two props, not one, because they are two things: what is chosen and
what is typed. Headless UI's `displayValue` and Base UI's `itemToStringLabel` exist to derive
the second from the first; the library instead keeps both explicit and writes the text itself
only at well-defined moments (2.2). A consumer who wants the Autocomplete shape ("the text is
the value") sets `allowCustomValue` and reads `value`, which then equals the committed text.

### 2.2 When the library writes the input text

The library writes `inputValue` (as an urgent update, through `onInputValueChange` with the
reason given) in exactly these cases, and nowhere else:

| Moment | New text | `reason` | `details.event` |
| --- | --- | --- | --- |
| Typing, cut, paste, IME composition, browser autofill | the input's DOM value | `"activate"` | the `input` event |
| An option is accepted (Enter, click) | the option's `label` prop, else its `textContent` trimmed, read **at that moment** from the DOM | `"activate"` | the `keydown` / `click` |
| The accepted option's action rejects, or a controlled parent does not adopt the value | the text of the previous committed value (the label cache, 2.3) | `"dismiss"` | `undefined` |
| Focus leaves with unmatched text and `allowCustomValue` is off | the committed value's label (cache), or `""` when `value` is `null` | `"dismiss"` | the `focusout` |
| `Clear` | `""` | `"activate"` | the `click` |
| Form reset | the Input's `defaultValue` (the mirror of `defaultInputValue` / the mount-time `inputValue`, written into the attribute in the `reset` event itself, 11.1) | `"platform"` | the `reset` event |
| Mount reconciliation (typed before hydration; Firefox restoration) | the DOM value | `"platform"` | `undefined` |

The rollback write (third row) runs **after `await undefined`** in the wrapped action's `catch`:
a `valueChangeAction` that throws synchronously (a plain function, a sync validation) otherwise
makes the `catch` run inside `useControllableAction`'s `startTransition` callback, and the
urgent write, a controlled parent's `setText` included, becomes a transition update
(conventions 2.6; review M2). The yield is then followed by the rethrow, so the error still
reaches the boundary.

The library never writes the text because the **`value` prop changed** (a controlled parent
set a new value, `defaultValue` at mount). Then the text is what the consumer passes as
`defaultInputValue` / `inputValue`; development warns once when `value` / `defaultValue` is
non-null at mount and neither text prop is given, because the input would show nothing for a
selection. This keeps the Root free of an `itemToString` function (which a Server Component
could not pass anyway) at the cost of one extra prop at the call site for a preselected value:

```tsx
<Combobox.Root defaultValue={user.countryCode} defaultInputValue={user.countryName}>
```

### 2.3 The label cache

Every mounted `Option` registers `value → label` (its `label` prop, else `textContent`) in a Root
ref map that is never cleared on unmount. Reverting the text to "the committed value's label"
(2.2) reads the cache; when the committed value's option was never mounted (a preselected
value whose popup never opened), the revert target is the **last text the library or the
consumer set for that value**: at mount `defaultInputValue` / `inputValue`, afterwards the text
written at the last settled selection. So a revert is always to a text the user has seen for
the selection, never to the raw value.

---

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts` (conventions 2.2, 9.4), plus one
new one for the urgent lane (section 4):

```ts
// packages/ui/src/internal/types.ts
/**
 * A change handler the library calls synchronously, outside any Transition, and does not await:
 * the urgent lane (conventions 2.6; first used by Combobox's `onInputValueChange`). Not an
 * action: nothing is pending or optimistic for it. The sync body is an urgent update, so
 * `(next) => setText(next)` controls a text input correctly.
 */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> =
  (next: T, details: Details) => void;
```

### 3.1 `Combobox.Root`

```ts
export interface ComboboxValueChangeDetails extends ActionDetails {
  /**
   * "activate": the user accepted an option (Enter, click; `details.event` is the `keydown` or
   * `click`), committed free text with `allowCustomValue` (Enter: the `keydown`; focus leaving:
   * the `focusout`), or pressed Clear (`click`).
   * "platform": a form reset (`details.event` is the `reset` event).
   */
  readonly reason: ChangeReason;
  /** `true` when `next` is free text committed under `allowCustomValue`, not an option's value. */
  readonly custom: boolean;
}

export interface ComboboxInputValueChangeDetails extends ActionDetails {
  /**
   * "activate": typing (the `input` event), an accepted option's label, Clear.
   * "dismiss": a revert: focus left with unmatched text, or the selection rolled back.
   * "platform": form reset (the `reset` event), or text found in the input at mount (`undefined`).
   */
  readonly reason: ChangeReason;
}

export interface ComboboxOpenChangeDetails extends ActionDetails {
  /**
   * "activate": typing, ArrowDown / ArrowUp / Alt+ArrowDown, the Trigger, a click on the input
   * with `openOnClick`, an accepted option (close), a foreign `showPopover()`.
   * "dismiss": Escape, light dismiss, focus leaving the combobox, another top-layer element.
   * "platform": the popup was found open on mount (never, unless script opened it before hydration).
   */
  readonly reason: ChangeReason;
}

export interface ComboboxRootState {
  /** Optimistic selection. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** The text in the input (urgent). */
  readonly inputValue: string;
  /** The deferred text the mounted results are for. */
  readonly query: string;
  /** `inputValue !== query`: the results shown are for an older text. */
  readonly stale: boolean;
  /** The value of the option `aria-activedescendant` points at, or `null`. */
  readonly activeValue: string | null;
  /** Optimistic open state. */
  readonly open: boolean;
  /** A `valueChangeAction` or `openChangeAction` dispatched through this Combobox is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ComboboxRootProps {
  /** Controlled selection. `null`: nothing selected. `undefined`: uncontrolled. */
  value?: string | null;
  /** Initial selection in uncontrolled mode. Default `null`. */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition when the user accepts an option, commits free text
   * (`allowCustomValue`), presses Clear, or the form resets. Awaited; the listbox closes in the
   * commit that ends it; a rejection rolls the input text and `data-selected` back and leaves
   * the listbox open (a controlled parent that does not adopt the value gets the same rollback,
   * and the listbox closes, 5.5). May be a Server Function. A `setState` after your own `await`
   * needs `startTransition`.
   */
  valueChangeAction?: ChangeAction<string | null, ComboboxValueChangeDetails>;

  /** Controlled input text. `undefined`: uncontrolled. */
  inputValue?: string;
  /** Initial input text. Default `""`. Pass the selected value's label when `defaultValue` is set. */
  defaultInputValue?: string;
  /**
   * The urgent lane, a handler and not an action: called synchronously, outside any Transition,
   * on every change of the text (typing; and the library's own writes, section 2.2). Not
   * awaited; nothing is pending for it. A controlled parent updates its state in the body (an
   * urgent update, which is what a controlled text input needs). A returned promise is ignored
   * (development warns once: a fetch belongs in a transition, see 6.2).
   */
  onInputValueChange?: UrgentChangeHandler<string, ComboboxInputValueChangeDetails>;

  open?: boolean;
  defaultOpen?: boolean;
  /** As Popover: awaited for opens and for the close after an accepted option; a notification for dismissals. */
  openChangeAction?: ChangeAction<boolean, ComboboxOpenChangeDetails>;

  /**
   * Free text is a value: Enter with no active option, or focus leaving with text that is not
   * the selected option's label, dispatches the text with `details.custom: true`. Default
   * `false`: unmatched text reverts to the selection's label when focus leaves.
   */
  allowCustomValue?: boolean;
  /**
   * Make the first option active whenever the results settle (not while stale or loading;
   * typing clears the highlight until then). APG "automatic selection". Default `false`.
   */
  autoHighlight?: boolean;
  /** Open the listbox on a pointer click in the input (not on focus). Default `false`. */
  openOnClick?: boolean;
  /** Wrap from the last option to the first and back with the arrow keys. Default `false` (APG default; Menu wraps). */
  loop?: boolean;
  /**
   * The message `ariaNotify()` announces on the List when the results settle, from the number
   * of mounted options. Default (English): `"No results"`, `"1 result"`, `"N results"`.
   * Override for localisation or a richer message; return `null` to announce nothing.
   * Nothing is announced while the results are stale or loading. Ignored where `ariaNotify` is
   * missing.
   */
  announce?: (count: number, state: ComboboxRootState) => string | null;

  /** Form participation through a hidden input with this name (value `""` for `null`). */
  name?: string;
  form?: string;
  /** Disables the Input, Trigger and Clear; nothing dispatches. */
  disabled?: boolean;
  children?: StateValue<ReactNode, ComboboxRootState>;
}
```

No `ref`, `className`, `style` (no element of its own); no `required` (it is the Input's, native);
no `filter` / `items` (section 6.1); no `multiple` (section 13).

### 3.2 `Combobox.Input`

```ts
export interface ComboboxInputState {
  readonly value: string | null;     // optimistic selection
  readonly inputValue: string;
  readonly open: boolean;            // optimistic
  readonly pending: boolean;         // Root pending
  readonly stale: boolean;
  readonly disabled: boolean;
}

export interface ComboboxInputProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "value" | "defaultValue" | "onChange" | "onInput" | "onKeyDown" | "onFocus" | "onBlur" | "onClick"
    | "onPointerDown"
    | "role" | "aria-autocomplete" | "aria-expanded" | "aria-controls" | "aria-activedescendant"
    | "autoComplete" | "disabled" | "className" | "style" | "children"
  > {
  /** Native `required`: empty text is `valueMissing`. Pass-through, documented here because it is where validation lives. */
  required?: boolean;
  className?: StateValue<string | undefined, ComboboxInputState>;
  style?: StateValue<CSSProperties | undefined, ComboboxInputState>;
  render?: RenderProp<ComponentPropsWithRef<"input">, ComboboxInputState>;
}
```

A void element: no `children`. Owned keys: `id`, `type` (`"text"` unless the `render` element
says `"search"`), `role`, `value` (the urgent text), `autoComplete` (`"off"`: the browser's own
suggestion list would sit over the listbox), `aria-autocomplete` (`"list"`), `aria-expanded`
(optimistic open), `aria-controls` (the List id, token-merged), `aria-activedescendant`,
`disabled`, the handlers listed in the `Omit` (`onPointerDown` since #123: a primary-button
press while the listbox is shown captures the pointer to the Popup, so the release is not a light
dismiss, 5.4; `onFocus` since #132: it starts the #111 press watch that `onBlur` relies on, so the
pair is owned together, conventions 1.5), `data-open`, `data-pending`, `data-selected`
(optimistic `value !== null`), `data-stale`, `data-disabled`. `name` passes through (a second,
visible field for the raw text; the selection's `name` is the Root's). `placeholder`,
`aria-describedby`, `inputMode`, `onCompositionStart`, the capture-phase handlers
(`onFocusCapture`, `onBlurCapture`) and the rest pass through; a consumer who needs to react to
focus (select the text on focus, say) uses `onFocusCapture` or the function form of `render`.

### 3.3 `Combobox.Trigger`, `Combobox.Clear`

```ts
export interface ComboboxTriggerState { readonly open: boolean; readonly pending: boolean; readonly disabled: boolean; }
export interface ComboboxTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "onPointerDown" | "onMouseDown" | "commandfor" | "command" | "popoverTarget" | "popoverTargetAction" | "tabIndex" | "aria-expanded" | "aria-controls" | "disabled" | "className" | "style" | "children"> {
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxTriggerState>;
  style?: StateValue<CSSProperties | undefined, ComboboxTriggerState>;
  children?: StateValue<ReactNode, ComboboxTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ComboboxTriggerState>;
}

export interface ComboboxClearState { readonly value: string | null; readonly inputValue: string; readonly disabled: boolean; }
export interface ComboboxClearProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "onPointerDown" | "onMouseDown" | "tabIndex" | "disabled" | "className" | "style" | "children"> { … }
```

Both: `type="button"`, `tabindex="-1"` (owned: the APG keeps the combobox's trigger out of the
Tab sequence; the input is the one stop), `pointerdown` **and** `mousedown` prevented so the
input is not blurred (engines differ in which of the two moves focus), `disabled` owned (own
prop or Root's). Both buttons sit outside the popup. A press on **Clear** while the listbox is
open is a **light dismiss** that the browser runs before the `click`; a press on the **Trigger**
is not, because after hydration the Trigger is an invoker of the popup (next paragraph, #112).

Trigger: `aria-controls`, `data-open`, `data-pending`, and **no `aria-expanded` on a `<button>`**
(#121: once `popovertarget` is written every engine exposes the listbox's shown state from the
popover itself; before hydration the button has no state, and the Input, the widget's primary
control, keeps its explicit `aria-expanded`; a non-button `render` renders `aria-expanded` from
`popover.shown`, #118); click toggles the
listbox and focuses the input. After hydration the Trigger writes `popovertarget` (the Popup's id)
through its ref callback (`setAttribute("popovertarget", id)`, lowercase), onto a `<button>` only (HTML defines
the invoker exemption below for buttons; a `render` that produces another element gets a dev
warning and keeps a browser-shaped close) **and only while it is an invoker under the shared rule**
(#132: not while it is disabled and focusable, that is `aria-disabled` on a component `render`,
`disabledButton(...).invoker` as `Popover.Trigger` and `Menu.Trigger`; a disabled Trigger is
inert, so a press on it while the listbox is shown is a press on the page, a light dismiss, for
both disabled flavours, and it renders `aria-expanded` from `popover.shown` like any
non-invoker), and **every click is cancelled** (`preventDefault()`),
so the activation never runs: the listbox is still opened by the library with `source: input` and
keeps the input's anchor and width. The attribute is never in the server HTML (a
pre-hydration activation would open an empty, button-anchored popup, 11.2); `popoverTarget` /
`popoverTargetAction` are owned keys and `commandfor` / `command` stay omitted as reserved. A press on a button that names the shown popover is **not a light
dismiss** (HTML "topmost clicked popover": the invoker's popover is the clicked popover;
Chromium, Firefox and WebKit all consult `commandfor` and `popovertarget` there), so the state
at `click` is the state the user saw and the toggle is judged against `intended()`, as Popover's
Trigger: open → `requestClose(click, "activate")`, awaited, `hidePopover()` in the apply effect
of the close commit (5.4), the `<ViewTransition>` exit when `transition` is set, and a refusing
controlled parent keeps the listbox shown with nothing to re-open (5.5); closed → `requestOpen`.
A click with no press (`event.detail === 0`: assistive technology, `element.click()`) takes the
same path. Before #112 the toggle was judged against a snapshot taken at `pointerdown`, because
the press light-dismissed the listbox before the click; the snapshot and `onPointerCancel` are
gone. An icon-only Trigger needs an `aria-label` from the consumer (dev warning when it has no
accessible name, as Popover's Popup).

Clear: click writes `""` (urgent) and dispatches `valueChangeAction(null, { reason: "activate",
custom: false })` unless the optimistic value is already `null`. While the listbox is open the
press is a light dismiss: the listbox closes with a `"dismiss"` notification and is **not
re-opened** (re-opening would flash and run an open transition; the Trigger is one click away).

### 3.4 `Combobox.Popup`

```ts
export interface ComboboxPopupState { readonly open: boolean; /* committed */ readonly stale: boolean; readonly query: string; }

export interface ComboboxPopupProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "popover" | "onToggle" | "onBeforeToggle" | "onPointerDown" | "onMouseDown" | "className" | "style" | "children"> {
  /** As Popover: `false` (default) unmounts the children while closed; `true` keeps them in a hidden `<Activity>`. */
  keepMounted?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popover element itself. Animates
   * library-driven opens and closes (typing-open, Trigger, accepted option) in every engine;
   * dismissals are the browser's (CSS only). **A deferred results render also activates the
   * boundary** (React: updates from `useDeferredValue` animate), so use a type map with
   * `default: "none"` unless every result change should cross-fade. Static (conventions 5.1).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ComboboxPopupState>;
  style?: StateValue<CSSProperties | undefined, ComboboxPopupState>;
  children?: StateValue<ReactNode, ComboboxPopupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxPopupState>;
}
```

Owned keys: `id`, `popover` (`"auto"`), `data-stale`, `onPointerDown` and `onMouseDown` (both
prevented: the input's blur for a press anywhere in the popup, options, Empty, scrollbar;
section 7.1). Inline style
from the library (`position-area`, `position-try-fallbacks`, `min-width: anchor-size(width)`),
consumer `style` wins per property. No `role` (a container; the List has the role), no
`aria-modal`, no `side` / `align`, no `initialFocus` (focus never enters the popup).

### 3.5 `Combobox.List`, `Combobox.Option`, `Combobox.Group`, `Combobox.GroupLabel`, `Combobox.Empty`, `Combobox.Status`

```ts
export interface ComboboxListState {
  readonly query: string;
  readonly stale: boolean;
  /** No mounted options, not stale and not loading: the condition under which `Empty` renders. */
  readonly empty: boolean;
}
export interface ComboboxListProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "role" | "aria-busy" | "className" | "style" | "children"> {
  // `aria-labelledby` stays a consumer prop: token-merged with the Label id (section 9).
  className?: StateValue<string | undefined, ComboboxListState>;
  style?: StateValue<CSSProperties | undefined, ComboboxListState>;
  /** Usually a function of `{ query }` rendering the Options for it. */
  children?: StateValue<ReactNode, ComboboxListState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxListState>;
}

export interface ComboboxOptionState {
  readonly value: string;
  /** Optimistic: this option's value is the (optimistic) selection. */
  readonly selected: boolean;
  /** `aria-activedescendant` points here (urgent). */
  readonly active: boolean;
  /** The Root is pending and this option is the optimistic target. */
  readonly pending: boolean;
  readonly disabled: boolean;
}
export interface ComboboxOptionProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "role" | "aria-selected" | "aria-disabled" | "onClick" | "onPointerDown" | "onMouseDown" | "onPointerMove" | "className" | "style" | "children"> {
  value: string;
  /** The text written into the input when this option is accepted. Default: the element's trimmed `textContent` at that moment. Not used for matching: the library filters nothing. */
  label?: string;
  /** `aria-disabled`: shown, skippable by arrows, never accepted. */
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxOptionState>;
  style?: StateValue<CSSProperties | undefined, ComboboxOptionState>;
  children?: StateValue<ReactNode, ComboboxOptionState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxOptionState>;
}

export interface ComboboxGroupProps extends Omit<ComponentPropsWithRef<"div">, "role" | …> { … } // `aria-labelledby` token-merged
export interface ComboboxGroupLabelProps extends Omit<ComponentPropsWithRef<"div">, "id" | …> { … }
export interface ComboboxEmptyProps extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children"> { children?: StateValue<ReactNode, ComboboxListState>; … }
export interface ComboboxStatusProps extends Omit<ComponentPropsWithRef<"div">, "role" | …> { … }
```

`Option` owned keys: `id` (`${rootId}-option-${encodeURIComponent(value)}`: stable across result
sets, valid without whitespace), `role`, `aria-selected` (optimistic), `aria-disabled`,
`data-selected`, `data-active`, `data-pending`, `data-disabled`, `onClick`, `onPointerDown` and
`onMouseDown` (both `preventDefault()`), `onPointerMove` (makes the option active, as Menu's pointer-follows rule,
so arrows continue from the hovered option). Never `tabindex`, never focused. `label` renders
nothing (it goes into the Root's cache). Two Options with the same `value` under one Root is a
dev warning (duplicate ids).

`Empty` renders `<div>` with its children only when `state.empty` (no mounted options, not
stale, not loading); otherwise `null`. `Status` renders `<div role="status">` in the Popup and
`<div role="none">` inside the List, where it is the loading fallback (6.3); `role` is owned.

### 3.6 Namespace

```ts
export const Combobox = {
  Root: ComboboxRoot, Label: ComboboxLabel, Input: ComboboxInput, Trigger: ComboboxTrigger, Clear: ComboboxClear,
  Popup: ComboboxPopup, List: ComboboxList, Option: ComboboxOption, Group: ComboboxGroup, GroupLabel: ComboboxGroupLabel,
  Empty: ComboboxEmpty, Status: ComboboxStatus,
} as const;
```

Exports: every `Combobox<Part>Props` / `State` above, `ComboboxValueChangeDetails`,
`ComboboxInputValueChangeDetails`, `ComboboxOpenChangeDetails`; `UrgentChangeHandler` from the
root entry.

---

## 4. The urgent lane: `inputValue`

The vision left the urgent opt-out "undesigned until a component genuinely needs it, e.g. text
input in a Combobox". This is that design, kept as small as possible:

1. **The name says it is a handler, not an action.** `inputValue` / `defaultInputValue` /
   `onInputValueChange`: the `x` / `defaultX` pair as for every other state, and the ordinary
   React handler form for the callback, typed `UrgentChangeHandler<T, Details>` (returns
   `void`, documented as synchronous and not awaited). This is the library's **one `on*`
   prop**, and it is one by the user's decision (#96, conventions 2.1 and resolved question 39):
   `fooAction` must always mean "the component runs this in a transition", so a callback that
   the component must *not* run in a transition cannot carry the suffix. v1 had chosen
   `inputValueChangeAction: UrgentChangeAction` so that the no-`on*` rule had no exception;
   that bought the rule's purity at the price of the suffix's meaning, and the suffix matters
   more at the call site. Rejected then and still: `inputValueAction` (reads as a pure
   trigger); and `onInputChange` without `Value` (the state name must be exactly the controlled
   prop's name, conventions 2.1).
2. **The library calls it synchronously, outside any transition**, from the `input` event
   handler and from its own writes (2.2), after it has set its own `useState` for the text.
   The consumer's body runs in the event, so a controlled parent's `setInputValue(next)` is an
   urgent update, which is what React requires for the value prop of a text input.
3. **Not awaited, no pending, no optimistic.** The text is already in the DOM when the action
   runs; there is nothing to wait for and nothing to roll back. A returned promise is ignored
   (development warns once when a thenable comes back, because the author probably wanted
   `valueChangeAction`).
4. **Controlled `inputValue` follows the DOM, it does not gate it.** If the parent does not
   adopt a keystroke, React restores the old prop at the end of the event (the usual controlled
   input behaviour); the library's own `useState` is bypassed in controlled mode, so there is
   no disagreement between the two.
5. **What the text drives is not urgent.** The deferred `query` (section 6), the open dispatch
   (a transition, 5.1) and the selection (a transition) all leave the urgent lane immediately.
   This is the whole point: the keystroke commits now, everything it causes is interruptible.

Entanglement caveat, documented on the component page: while any async action is pending in the
app (a slow `valueChangeAction` of this combobox included), transitions are held (conventions
2.3 item 5). Typing is urgent and unaffected, and a **deferred render is not a transition**:
React still re-renders the results for the new `query` while a save is pending. **Verified**
during implementation (jsdom, Chromium 156, Firefox 157, browser row "typing while a save is
pending"; React 19.3.1's `requestDeferredLane` claims a deferred lane directly, not through
`requestTransitionLane`, which is where async-action entanglement happens). The listbox
*opening* while a save is pending is a transition and waits for the save; walkthrough 10.6.

---

## 5. Open, accept, close

### 5.1 Opening

`useOverlayRoot({ component: "combobox", mode: "library", details: popoverDetails })`: always
library mode. The popup is
shown by the apply effect with `showPopover({ source: inputRef.current })`, which (research §6
probe table) keeps focus in the input, lets typing continue, nests the popup under the input's
popover ancestor, and creates the implicit anchor the inline `position-area` and
`anchor-size(width)` use. It does **not** exempt a press on the input from light dismiss: `source`
plays no part in HTML's "topmost clicked popover", and the research's claim that it did came from
a synthesised click (#123). The Input keeps the listbox open across its own presses with pointer
capture (5.4, amendment #123).

| Open cause | What happens | `reason` |
| --- | --- | --- |
| Typing (the `input` event, any change including to `""`) | urgent text write; `requestOpen(event, "activate")` (a no-op while already intended open) | `"activate"` |
| ArrowDown / ArrowUp while closed | `requestOpen`; after the open commit the first / last enabled option becomes active (ArrowDown with `autoHighlight`: the first is already active) | `"activate"` |
| Alt+ArrowDown while closed | `requestOpen`; no option becomes active | `"activate"` |
| Trigger click | toggle against `intended()` (3.3: the press is not a light dismiss, so nothing changed since the user looked); the input is focused | `"activate"` |
| Pointer click in the input with `openOnClick` | `requestOpen` | `"activate"` |
| Focus arriving in the input | nothing (APG; `openOnClick` is the pointer-only variant) | |
| Foreign `showPopover()` / invoker | cancelled at `beforetoggle`, routed through `requestOpen` (Popover 2.2) | `"activate"` |
| Mount with the popup already open | `"platform"` (Popover 2.4; only script can cause it here) | `"platform"` |

The Popup's children mount in the open commit. If they suspend (an async search with the
boundary *outside* the List), React holds the open with `data-pending` on the Input and
Trigger until the results are ready; with the boundary inside the List (the anatomy example),
the popup opens at once showing `Status`, the List is `aria-busy` and `Empty` stays hidden
until the results land in a later deferred render (6.3). Both are the consumer's layout choice
(conventions 6).

Open with **no options** (the first keystroke matched nothing, or `Empty` is the only child):
the popup still opens and shows `Empty`. An empty listbox is `aria-expanded="true"` with no
`aria-activedescendant`; the APG allows it and it is the only way "No results" can be seen.

### 5.2 Accepting an option

Enter with an active option, or a click on an option:

```ts
// inside the Root, called by Option's onClick and the Input's Enter handler
function accept(option: { value: string; label: string }, event: Event): void {
  setInputText(option.label, { reason: "activate", event });          // urgent, section 2.2
  if (option.value === optimisticValue) { requestClose(event, "activate"); return; } // no-op dispatch, still closes
  dispatch(option.value, createActionDetails(event, { reason: "activate", custom: false }));
  // the Root wraps `valueChangeAction` so that, once it resolves, if this dispatch is still the
  // latest, the open generation is unchanged and the text is still what this accept wrote:
  // requestClose(event, "activate")
}
```

Sequence (Menu decision 3 applied to a listbox): the text changes at once; the option gets
`data-selected` (optimistic `aria-selected="true"`) and `data-pending`; the previous selection
loses `data-selected`; the hidden input's `value` follows the optimistic value in the same sync
render; `valueChangeAction` is awaited inside the Root's transition; when it resolves the Root
requests the library-owned close, so the popup hides in the commit that ends the action (view
transition if `transition` is set). A sync action closes in the same tick, indistinguishable
from "close at once". A slow Server Function shows progress on the option the user picked,
which is the vision's "pending state exposed", and a rejection leaves the listbox open with
the text and `data-selected` rolled back (2.2; the rollback write leaves the transition first)
and the error in the nearest boundary.

The open-generation guard (Popover 3.4) applies: if the user dismissed (Escape) and re-opened
the listbox by typing while the action ran, the close belongs to the earlier open and is
dropped; the value still commits. **Typing while the action is pending** drops the close in
the same way: if, when the action settles, the text is no longer what the accept wrote, the
user is searching again and the listbox stays open with the results for the new text; the value
still commits. Re-accepting the already-selected option dispatches nothing (conventions 2.3
item 8) and closes.

A **disabled** option is never accepted: Enter on it does nothing, a click does nothing (it
is still `preventDefault()`ed on `pointerdown` so focus stays).

### 5.3 Free text (`allowCustomValue`)

With `allowCustomValue`:

- **Enter with no active option** and text different from the committed value's label (or from
  `""` when `value` is `null`) dispatches `valueChangeAction(text, { reason: "activate", custom:
  true, event })`, then closes as 5.2. The `keydown` is **not** `preventDefault()`ed when the
  listbox is closed, so a single-field search form still submits. The hidden input must hold
  the optimistic text before the implicit submission, and engines differ (Chromium flushes
  React's scheduled render first, Firefox submits before it), so this one commit runs in
  `flushSync` (browser row "Enter submits with the new value"). While the listbox is open
  (`:popover-open`, section 8), Enter is prevented (an open listbox means the user is choosing).
  Enter with no active option while the results are stale or loading commits the typed text as
  well: the active option is cleared by typing (6.5), so a stale option is never accepted.
- **Focus leaving** with such text dispatches the same with the `focusout` event, after the
  immediate close (5.4). Empty text with a non-null value dispatches `null`.
- `Clear` is unchanged.

Without `allowCustomValue`, Enter with no active option does nothing while the listbox is open
(prevented) and is not handled while closed (the form submits with the selection's hidden
value); focus leaving reverts the text (2.2).

### 5.4 Closing

| Close | Owner | What happens | `reason` |
| --- | --- | --- | --- |
| Accepted option (after its action settles), Trigger click while open, controlled `open={false}` | library | `requestClose`; `hidePopover()` in the apply effect of the close commit; `<ViewTransition>` if set. The Trigger's press does not light-dismiss first (it is an invoker of the popup after hydration, 3.3, #112): the listbox stays shown, input focused, Trigger `data-pending`, until `openChangeAction(false)` settles; a refusing controlled parent keeps it shown (5.5) | `"activate"` (controlled: no dispatch) |
| Escape while open | browser (the auto popover's close watcher) | hidden at once; focus stays in the input (research); `toggle` → notification. The library does **not** intercept Escape: a second Escape therefore reaches an enclosing Dialog or Popover, which is the nesting behaviour a user expects | `"dismiss"` |
| Light dismiss, another `auto` popover or modal dialog opening outside | browser | notification; focus wherever the platform left it; text reverted on the `focusout` that preceded it, if any | `"dismiss"` |
| Focus leaving the input to anything outside the popup (Tab, Shift+Tab, a click elsewhere, script) | library-performed, browser-shaped | the Input's `focusout` with `relatedTarget` outside the input and the popup → `popup.hidePopover()` at once (Menu 2.2: a listbox must not linger over a page whose focus moved on), then the text revert or the custom-value commit of 5.3; `toggle` → notification. `relatedTarget === null` closes nothing synchronously. If a pointer is down (the blur came from a `mousedown`), the check runs one task after that press is released (`pointerup` or `pointercancel`); a `<label for>` (Combobox.Label, Field.Label) refocuses the input in the release's click, so a label press of any length keeps the text (#111). Without a press (script blur) it runs a task later. In both cases, if `document.hasFocus()` and the active element is outside the input and the popup, the revert or custom commit runs; the light dismiss has already closed the listbox (a label press closes it too, the label being outside the popup); a window blur stays a no-op. Nothing runs while `disabled` | `"dismiss"` |
| Clear click while open | browser (light dismiss: the button is outside the popup) | notification; the listbox is not re-opened; the text is emptied and `null` dispatched as 3.3 | `"dismiss"` |
| Foreign invoker click while open (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names the popup) | browser | the Popup prevents the button's primary `mousedown` while shown, so the input keeps focus and the focus-leaving row above cannot pre-empt the click (#126); the press is light-dismiss exempt (conventions 3.5); the click's native toggle (or `hide-popover`) hides the listbox; the text is untouched; notified from `toggle` with the `ToggleEvent` (the `CommandEvent` for `commandfor`) whose `source` is the button (#125) | `"activate"` |
| Alt+ArrowUp while open | library | the active option, if any, is accepted (APG optional behaviour); else `requestClose` | `"activate"` |

A click on an option or anywhere in the popup is not focus loss: `pointerdown` and `mousedown`
are prevented on the Popup (3.4), so the input never blurs and `focusout` never fires. A
`focusout` whose `relatedTarget` is the Trigger or Clear cannot happen for the same reason, nor
one whose `relatedTarget` is a foreign invoker of the popup pressed with a pointer (#126: the
Popup's document capture `mousedown` listener, alive while shown, prevents the default for the
primary button when the target's closest `<button>` is outside the popup and
`popoverTargetElement === popup`, or `commandForElement === popup` with a `*-popover` command).
A Tab onto such a button is still focus leaving, and a plain foreign button's press too.

A press on the **input** is not a close either, although the input is outside the popup and can
name no popover (#123). Light dismiss compares the popover under the press with the popover under
the release (the `pointerup` target; in Chromium's click-based variant the `pointerup` target
recorded for the `click`), and pointer capture retargets the release: the Input's `pointerdown`
(primary button, listbox shown) calls `popup.setPointerCapture(pointerId)`, so the `pointerup`,
`mouseup` and `click` land on the Popup and nothing hides, with a mouse, a pen or a finger, nested
in a Popover or not, and whether the release happens on the input or elsewhere. One engine hole
(#124, upstream): in Chromium, a **touch tap** on the field inside a **same-origin iframe** still
light-dismisses (the click-time comparison misses the captured `pointerup` there); top-level
documents, mouse presses in a frame, and Firefox are fine. Until Chromium changes, a Combobox in
an iframe (a Storybook or sandbox preview) closes its listbox on a tap of the field in Chromium. The compat
`mousedown` is not retargeted, so the caret still lands where the user pressed and a double click
still selects a word. Right- and middle-button presses are not captured (the engine's own context
menu and paste; in Firefox and WebKit such a press light-dismisses as before, in Chromium it never
did). Firefox routes the mouse drag to the capturing element, so a drag-to-select in the field does
not extend while the listbox is open there (Chromium's selection drag ignores capture; WebKit is
decided by CI); Shift+click, Shift+arrows and the double click still select.

### 5.5 Controlled `open`, overlap, errors

As Popover 2.5 / 4.3 with the combobox's words: a controlled parent that refuses an open gets a
snap-back of `aria-expanded`; one that refuses the close after an accepted option keeps the
listbox open (a real veto); one that refuses a dismissal re-opens it (not a veto). Overlapping
value dispatches follow latest intent; `data-pending` and `data-selected` move to the latest
option; the close waits for the latest. A rejected `openChangeAction(true)` leaves the listbox
closed with the typed text intact.

A controlled **`value`** parent that does not adopt an accepted option (an "update on success"
parent whose save failed and was caught) gets the rollback of 2.2, text and `data-selected`
revert with no error, and the listbox **closes**. Non-adoption is only visible in the commit
that ends the action, which is the commit that closes; deferring the close until the library
knows would split it from that commit and from its view transition. Only a rejection keeps the
listbox open (deviation 4, accepted at review).

---

## 6. Results: deferred query, Suspense, Empty, announcements

### 6.1 The library filters nothing

`Combobox.List`'s children are the results. The consumer decides what they are for a given
`query`: a synchronous filter over a static array, a cached `use(search(query))`, a router
loader, anything. There is no `items`, `filter`, `itemToString` or built-in matching, for three
reasons: a built-in filter needs the option labels before the options render (an `items` array
plus a string function, which a Server Component cannot pass and which duplicates what the
Options already say); the Suspense-native case (results that load) has nothing to filter
client-side; and the headless rule is that the library renders what it is given. A small
`matches(text, query)` helper (diacritics-insensitive prefix / substring) is a possible later
export, not a Root prop.

```tsx
// Static list, synchronous filter: the common case.
<Combobox.List>
  {({ query }) => countries
    .filter((c) => c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .map((c) => <Combobox.Option key={c.code} value={c.code} label={c.name}>{c.name}</Combobox.Option>)}
</Combobox.List>

// Async search: a cache keyed by query, read with use() inside a Suspense boundary.
function CountryOptions({ query }: { query: string }) {
  const results = use(searchCountries(query));   // cached per query; earlier promises are harmless
  return results.map((c) => <Combobox.Option key={c.code} value={c.code} label={c.name}>{c.name}</Combobox.Option>);
}
```

### 6.2 `query`, `stale`, and why nothing arrives out of order

`query = useDeferredValue(inputValue)` in Root. React renders the List's children for the new
query at deferred priority; if that render suspends, the previous results stay on screen (no
fallback for an already-visible boundary under a deferred update), and `inputValue !== query`
stays true until the new results commit, which the Popup and List expose as `data-stale` and
the List as `aria-busy="true"`. Only the latest deferred value is ever rendered, so a slow
response for "ja" can never overwrite the results for "jap": React skipped the "ja" render or
threw it away, and a cache keyed by query makes the earlier promise harmless (research §6). The
docs say explicitly what not to do: `await fetch(...)` then `setResults(...)` inside
`onInputValueChange` (completion order, no stale marker, an urgent handler that is not awaited
and should not be async anyway; the name without `Action` is the hint).

`stale` also covers the first keystrokes after a selection: the user types over "Japan", the
results for "Japan" are shown as stale until the results for the new text land.

### 6.3 `Empty`

"No results" is a fact about the List's **mounted** options, which the library knows from the
Option registry, and about staleness, which the library also knows. So `Combobox.Empty` renders
its children exactly when the List has zero mounted options, the results are not stale and
nothing is loading, and nothing otherwise. The consumer's Suspense fallback (`Status`) covers
the first load; `Empty` covers settled emptiness; stale old results cover everything in between.
No condition at the call site, and no "No results" flashing while a search is in flight.

The List carries `data-empty` under the same condition.

**Loading** is a fact the library learns from a `Combobox.Status` mounted inside the List. The
anatomy's `<Suspense fallback={<Combobox.Status>…</Combobox.Status>}>` sits inside the List
because the options it guards mount there, and React cannot tell the library a boundary is
showing its fallback; the Status can. A Status registers with the Root from a layout effect
(as Options do). While one is registered inside the List the results are *loading*: `Empty` and
`data-empty` stay off, the List is `aria-busy="true"`, nothing is announced (6.4), and the Status
renders with `role="none"`: a listbox may own only options and groups, so a `role="status"` live
region there fails the required-children rule, while a busy listbox is exempt from it and
carries the meaning itself (the count is announced on settle). A Status in the Popup, outside
the List, is a plain hint with `role="status"` and means nothing to the library. A fallback
that is not a Status (a plain `<div>Searching…</div>`) is invisible to the library and `Empty`
would show under it; the docs say to use `Status` for the fallback.

### 6.4 Announcements: `ariaNotify`

When the results settle (a commit in which `stale` went from `true` to `false`, or the mounted
option count changed while not stale), the Root calls `list.ariaNotify(announce(count, state))`
if `announce` is given and the method exists (Chrome 141, Firefox 150, Safari 27; Baseline
since September 2026). No live region: `ariaNotify` is what the platform now offers for exactly
this, and a live region inside a popover is unreliable when the popover mounts and unmounts.
Debounced by construction: a deferred render settles once per query. Nothing is announced while
stale, while loading, or for an unchanged count. The active option itself is announced by the
screen reader through `aria-activedescendant`.

Implementation rule (review H1): the announcement effect reads the option count **and the
loading count through refs** written by the registration layout effects, never through render
state. The Status and the Options register in the open commit's layout phase; the synchronous
re-render that registration causes flushes the open commit's passive effects first, so an effect
reading `loading` from state sees `false` with zero options and announces "No results" on every
open of an async combobox, the one thing this section promises away.

`announce` has a **default English message** (`"No results"`, `"1 result"`, `"N results"`;
user decision on question 6, overriding the recommendation of no default): accessibility works
out of the box, and a localised app passes its own function (`null` to announce nothing). This
is the library's first built-in UI string; conventions 11 records the rule it sets: built-in
strings are English defaults and are always overridable through a prop.

### 6.5 Active-option revalidation

After every commit the Root checks the active option against the registry: if `activeValue`
names an option that is no longer mounted, it becomes `null`. **Typing, Home, End, Left and
Right clear it as well** (APG, listbox-popup keys: printable characters, Home, End, Left and
Right "move visual focus to the textbox"; review M1): `aria-activedescendant` leaves the option
the moment the user edits, so a screen reader is not held on an option the text no longer
matches, and Enter never accepts an option the user has typed past. With `autoHighlight`, the
first enabled option becomes active whenever none is **and the results are settled** (not
stale, not loading): a fast Enter after a keystroke therefore commits the typed text (with
`allowCustomValue`) or does nothing, never a stale option (review L5). This is an urgent write
in a layout effect (it is virtual focus; see 2) and it never dispatches anything.
`aria-activedescendant` is never left pointing at a missing id.

**Accepted side effect of `autoHighlight`.** The auto-highlight is armed once per open and once
per edit (typing re-arms it; Home, End, Left and Right clear the active option *without*
re-arming, so the caret keys really return visual focus to the input), and it fires once when
the results for that edit settle. If the active option later unmounts for a reason other than an
input edit (the results change from outside: a live data source re-renders the list, a
`<Suspense>` boundary swaps content), the active option is cleared (never a dangling id) but
nothing is re-highlighted until the next open or edit. Re-arming on every unmount would make the
caret keys' clearing undone by any unrelated re-render, and auto-highlighting a list the user
did not ask for moves virtual focus under them; a list that changes on its own while the user
reads it is the rarer case. Accepted for v1; revisit if real result sources turn out to churn
while settled.

---

## 7. Focus, positioning, nesting

### 7.1 Focus never leaves the input

The APG editable combobox keeps DOM focus in the textbox and moves virtual focus with
`aria-activedescendant`. The library keeps that in three places: options are never focusable
(no `tabindex`); `pointerdown` on the Popup is `preventDefault()`ed (research: without it a
click on an option moves focus to `<body>` in every engine); the Trigger and Clear are
`tabindex="-1"`, prevent `pointerdown`, and focus the input in their click handlers so a
pointer user ends up where the keyboard works. Focus arriving in the input does not open the
listbox; focus leaving closes it (5.4).

Nested popover focus return (Popover 6.2) does not apply: focus is in the input before, during
and after. The Popup hook's `renderContent` is still used (the hook requires it), and its probe
never fires because nothing inside the popup ever holds focus.

### 7.2 Positioning

The Popup renders, inline:

```css
position-area: self-block-end span-self-inline-end;
position-try-fallbacks: flip-block;
min-width: anchor-size(width);
```

The implicit anchor is the input (`showPopover({ source: input })`). Logical keywords, not the
`side` / `align` matrix of Popover and Menu: a listbox is always below (or, flipped, above) its
input, aligned to the input's inline-start edge. **The `self-*` group, since wave 11 (#53).**
A plain logical keyword (`block-end span-inline-end`, v1) resolves against the containing
block of the top-layer popup, which is the root, so it followed a `dir="rtl"` document and not
a `dir="rtl"` *container* (deviation 1; verified: Chromium 156 kept the left edges aligned).
The `self-*` keywords resolve against the popup's **own** direction, inherited from its DOM
parent, so the container case works with no JS and no stale value (conventions 13.1). v1's
note that "Firefox lacks `span-self-inline-end`" was a grammar trap, not an engine gap: `block-end
span-self-inline-end` mixes keyword groups and is invalid everywhere; the valid spelling is
`self-block-end span-self-inline-end`, supported in Chrome 129+, Firefox 147+, Safari 26+. The
alternative the follow-up issue proposed (read the input's computed `direction` at open and emit
`span-left` / `span-right`) is rejected: it needs JS, is wrong before hydration, goes stale
when `dir` changes, and gains nothing in Firefox, whose bug is independent of the keywords:
**Firefox** misplaces any `position-area` popup along the inline axis when the popup's parent
box has a direction different from the root's (Mozilla 2019601, conventions 13.3); the listbox
in an RTL island is misplaced there, physical keywords would be too, and no workaround ships. A
consumer `style={{ positionArea }}` still wins per property. `min-width: anchor-size(width)`
makes the listbox at least as wide as the input in every engine (research: verified in Chromium
and Firefox, width = input width + border). A consumer who wants the listbox as wide as an
input-plus-trigger group sets `anchor-name` on the group and `position-anchor` plus
`min-width: anchor-size(--group width)` through `style`; consumer `style` wins per property.
No `data-side` / `data-align`: the Popup does not use the resolved-placement hook of
conventions 13.2 (a listbox has no arrow and no `side`); a `data-side` of `top` / `bottom` for
styling a flipped listbox's corners is a possible follow-up if a consumer asks.

The Popup should be rendered as a sibling right after the Input (or after the Trigger / Clear).
It need not be; `showPopover({ source })` links them by reference. But Safari 27.0 inserts a far
popover into the sequential focus order only when DOM-adjacent (Popover section 1), and that
matters for nothing here (nothing inside is focusable), so adjacency is a recommendation for
readers of the DOM, not a requirement.

### 7.3 Inside Dialog, Popover, Menu

The popup is an auto popover nested under the input's popover ancestor (research §6 and §7:
verified inside a modal `<dialog>` and inside an auto popover). Opening it keeps the outer open;
Escape closes only the listbox and the next Escape the outer, because the library does not
intercept Escape (5.4); an outside click closes the stack; a combobox *outside* an open auto
popover closes that popover when its listbox opens (unrelated auto popovers). No portal, ever
(inside a modal Dialog a portalled listbox would be inert).

Inside a `Menu.Popup` the combobox's input would be a non-item in a menu; not a supported
composition (Menu's `focusout` would close the menu when the input is clicked, and its typeahead
would eat keystrokes). Documented as unsupported.

**WebKit 302008** (`position-try-fallbacks` on a nested popover hangs or spins): the Popup's
`flip-block` fallback inside a Popover or Dialog is the exposure. Menu's and Select's rows under
the same bug passed on WebKit CI, so the default keeps the fallback; the browser suite carries a
dedicated WebKit row (12.2), and the consumer escape hatch is `style={{ positionTryFallbacks:
"none" }}`.

---

## 8. Keyboard

Per APG "Editable Combobox With List Autocomplete", manual selection. Handled in the Input's
`onKeyDown`; keys not listed are the input's own (Backspace, Delete, selection keys). Events
with `ctrlKey` / `metaKey` are ignored; `altKey` is read for the two Alt combinations only.

Whether the listbox is open is judged against the popup's **`:popover-open`**, what the user
sees, not against `intended()`: right after Escape the popup is already hidden but its `toggle`
notification is still queued, and Enter in that window must reach the form instead of being
prevented (an Escape-then-Enter race found in the docs smoke). The corollary runs the other way
and is accepted: Enter during an open that has not committed yet submits a form while
`aria-expanded="true"` is already shown.

| Key | Listbox | Behaviour | `preventDefault` |
| --- | --- | --- | --- |
| Printable, Backspace, paste, cut, IME commit | any | the text changes (urgent); the listbox opens if closed (5.1); the active option is cleared (6.5; with `autoHighlight` the first option is re-highlighted once the results settle) | no (the input's own editing) |
| ArrowDown | closed | open; after the open commit the first enabled option is active | yes |
| ArrowDown | open | next enabled option; from the last: stays (or the first with `loop`); from none: the first | yes |
| ArrowUp | closed | open; the last enabled option active | yes |
| ArrowUp | open | previous enabled option; from the first: stays (or the last with `loop`); from none: the last | yes |
| Alt+ArrowDown | closed | open, no option active | yes |
| Alt+ArrowUp | open | accept the active option if any (5.2), else close | yes |
| Home / End / ArrowLeft / ArrowRight | any | the input's caret (APG); the active option is cleared (6.5); **not** first / last option | no |
| PageUp / PageDown | open | not handled in v1 (no virtualization) | no |
| Enter | open, active option | accept (5.2) | yes |
| Enter | open, no active option | `allowCustomValue`: commit the text (5.3) and close; else nothing | yes |
| Enter | closed | `allowCustomValue`: commit the text if it changed (in `flushSync`, 5.3); the form may submit | no |
| Escape | open | **platform**: the auto popover's close watcher closes it; focus stays in the input; notified `"dismiss"`. The active option is forgotten; the text is kept | no (the platform cancels the close request itself) |
| Escape | closed | nothing; reaches an enclosing Dialog / Popover | no |
| Tab / Shift+Tab | open | focus moves on; `focusout` closes the listbox (5.4); the text reverts or, with `allowCustomValue`, commits. **Tab does not accept the active option** (question 5) | no |
| Space | any | a character (the input's own) | no |

Disabled options are skipped by ArrowDown / ArrowUp (APG: "disabled options are not focusable"
in a listbox), unlike Menu's focusable disabled items; they remain visible and `pointermove`
does not activate them.

Typeahead does not exist (the input *is* the typeahead).

---

## 9. ARIA summary

| Part | Attributes |
| --- | --- |
| Input | `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` (shown: the listbox is in the top layer, #118), `aria-controls` → List id, `aria-activedescendant` → the active Option id or absent, `autocomplete="off"`, `id` (the Label's `for`), `required` / `aria-describedby` pass through |
| Label | `for` → Input id, `id` |
| Trigger | `tabindex="-1"`, `popovertarget` after hydration and **no `aria-expanded`** on a `<button>` (#121; a non-button `render` renders it from `shown`, #118), `aria-controls` → List id, `aria-label` from the consumer (dev warning without a name) |
| Clear | `tabindex="-1"`, `aria-label` from the consumer |
| Popup | `popover="auto"`, `id`; no role |
| List | `role="listbox"`, `id`, `aria-labelledby` → Label id while a `Label` is mounted (the Label registers with the Root; token-merged with the consumer's; never a dangling IDREF), otherwise the consumer's `aria-label` on the List names it (pass-through; dev warning when it has neither), `aria-busy="true"` while stale or loading; no `aria-multiselectable` in v1 |
| Option | `role="option"`, `id`, `aria-selected` (optimistic; `"true"` on the selected option only, not on the active one: the APG distinguishes selected from focused, and `aria-activedescendant` conveys focus), `aria-disabled` |
| Group / GroupLabel | `role="group"` + `aria-labelledby`; the label has the `id` |
| Status | `role="status"` in the Popup; `role="none"` inside the List, where the busy listbox carries the meaning (6.3) |

`Element.ariaActiveDescendantElement` is not used: the attribute form serialises, works with
ids across a popover, and Safari 27.0 fixed the one known forwarding bug for it (research).
Chromium's accessibility tree for this markup (research §6): `combobox autocomplete=list
hasPopup=listbox expanded activedescendant controls`; the active option is reported as
focused. Screen-reader pass (NVDA, JAWS, VoiceOver) in the example app before leaving
"proposed": option navigation announced from `aria-activedescendant`, result counts from
`ariaNotify`, the selected state, nested in a Dialog.

Development warnings: an Option outside a List; a List outside a Popup; a part outside a Root
(throws, as every component); two Options with one value; `value` / `defaultValue` set with no
text prop (2.2); a thenable returned from `onInputValueChange` (section 4); a Trigger with
no accessible name; a List with no `Label` and no `aria-label`; a `render` element of the wrong
kind (section 1); `transition` toggled between `undefined` and a value (conventions 5.1).

---

## 10. Async walkthroughs

Notation: `T` = input text (urgent), `Q` = deferred query, `V` = committed value, `O` =
optimistic value, `A` = active value, `P` = Root pending. Uncontrolled, `defaultValue={null}`,
`defaultInputValue=""`, async search under a Suspense boundary inside the List.

1. **Type "j", results load.** `input` event → `T="j"` (urgent), `onInputValueChange("j",
   { reason: "activate" })`, `requestOpen` (transition). Sync flush: the input shows "j",
   `data-open`, `data-pending` (`aria-expanded` flips to `"true"` with the `toggle` of `showPopover()`, #118). Open commit: children mount, the
   boundary mounts and shows `Status` ("Searching…") at once (a new boundary shows its
   fallback); the Status registers in the layout phase: the List is `aria-busy`, `Empty` is
   hidden, and the announcement effect of this commit stays silent because it reads the loading
   count through the ref (6.4); apply effect `showPopover({ source: input })`; focus still in
   the input; `P=false`. The open commit already rendered `Q="j"` (the deferred value catches up in the
   same render when there is nothing on screen to keep).
   Results resolve → options mount; `Empty` stays hidden (count > 0); `ariaNotify("3
   countries")`.
2. **Type "a" while "j" results are shown.** `T="ja"` at once; `Q="j"` → `data-stale` and
   `aria-busy` on the List, old options stay; the deferred render suspends on `search("ja")`;
   when it resolves, the new options commit, `Q="ja"`, stale off, `ariaNotify("2 countries")`;
   `A` was `null` (typing clears it in any case, 6.5) and stays `null` (`autoHighlight` off).
3. **ArrowDown, ArrowDown, Enter with a slow `valueChangeAction`.** `A="jp"` then `A="jm"`
   (urgent; `aria-activedescendant`, `data-active`). Enter → `T="Jamaica"` (urgent, from the
   option's `label`), dispatch `"jm"`: `O="jm"`, `data-selected` and `aria-selected` on
   Jamaica, `data-pending` on it and on the Input, hidden input `value="jm"`; listbox open;
   `await save("jm")`. Resolves → `requestClose`: `openChangeAction(false)` (none) → close
   commit: with `transition` the popup's box is captured as `old`; `hidePopover()`; `V="jm"`,
   `P=false`. Focus never moved.
4. **Same, the save rejects.** The error reaches the boundary above `Combobox.Root`; `O`
   reverts to `null`; the library writes `T=""` (the previous committed value's text; `reason:
   "dismiss"`); `data-selected` leaves Jamaica; the listbox is still open with the "ja"
   results, `A` still `"jm"`; the user can retry. The rollback write ran after `await
   undefined`, outside the transition (2.2). (In a controlled "update on success" parent that
   does not adopt, the same revert without the error, but the listbox **closes**: 5.5.)
5. **Click an option with the mouse.** `pointerdown` on the Popup prevented → no blur;
   `pointermove` had made the option active; `click` → as 3 with the `click` event in
   `details`.
6. **Type while a save is pending.** As 3, before `save` resolves, type "x": `T="Jamaicax"`
   at once (urgent); `A=null`; the deferred results render runs (deferred lane, not held); the
   listbox is already open so no open dispatch. When `save` resolves the close is dropped: the
   text is no longer "Jamaica", the user is searching again (5.2); the value still commits and
   `data-selected` moves to Jamaica. If the listbox had been closed, the open dispatch would be
   a transition held until `save` settles: the input shows `data-open` /
   `data-pending` (`aria-expanded="false"`, #118) and no popup until then (React entanglement; Menu walkthrough 11; documented).
7. **Escape, then Tab.** Escape → the close watcher hides the popup; focus stays in the input;
   `toggle` → `openChangeAction(false, { reason: "dismiss" })`; `A=null`; `T` unchanged
   ("Jamaicax"). Tab → `focusout` with `relatedTarget` the next field → the popup is already
   hidden; without `allowCustomValue` the text reverts to the committed value's label
   ("Jamaica"); with it, `valueChangeAction("Jamaicax", { custom: true })` is dispatched with
   the `focusout` event.
8. **Clear.** Click → `pointerdown` prevented, the input keeps focus; `T=""`;
   `valueChangeAction(null)`; `data-selected` leaves the Input; hidden input `value=""`.
9. **Overlap: accept A, then accept B before A settles.** `O="a"` then `O="b"`; `data-pending`
   moves to B; A's resolution is superseded (no close from it: not the latest); B's resolution
   closes. `T` is B's label throughout after the second accept. A superseded rejection surfaces
   through the shared hook.
10. **Form reset.** `<form>` with `name="country"`, `V="jm"`, `T="Jamaica"`. `form.reset()`:
    the `reset` event fires before the reset algorithm, and the library writes the text mirror
    (`defaultInputValue`, `""`) into the visible input's `defaultValue` attribute right there
    (11.1); the algorithm then restores the visible input to it and leaves the hidden input
    alone (a hidden input has no reset behaviour); the microtask listener dispatches
    `valueChangeAction(null, { reason: "platform", event })` with the reset target computed in
    JS (uncontrolled: the latest `defaultValue ?? null`; controlled: the mount-time `value`) and
    writes `T` from the DOM with `"platform"`; the hidden input follows the optimistic value as
    always. React's automatic reset after a successful `<form action>` arrives the same way.
11. **Typed before hydration.** Server HTML: the plain input. The user types "jap" and nothing
    opens. Hydration: react-dom keeps the DOM value of a text input it hydrates and fires no
    `onChange`; the Root's mount layout effect reads `input.value !== defaultInputValue` → `T
    ="jap"`, `onInputValueChange("jap", { reason: "platform", event: undefined })`. The
    listbox does not open by itself (no user gesture after hydration); the next keystroke or
    ArrowDown opens it with results for "jap". `Q` catches up on the first render after mount.
12. **Controlled `value` changes from outside (a "Use my location" button).** The parent sets
    `value="fr"` and `inputValue="France"` together (both props); the library writes nothing
    itself (2.2); `data-selected` follows `O` once the transition commits. A parent that sets
    only `value` gets the dev warning of 2.2 at mount only; later it is the parent's
    responsibility, documented.
13. **`autoHighlight` with a fast local filter.** Each keystroke: `A=null` (typing clears the
    highlight, 6.5), `T` and `Q` update (a synchronous filter never suspends, so `Q` catches up
    in the deferred render of the same frame); the layout effect of the settled commit activates
    the first option; Enter accepts it. With a slow search, Enter between the keystroke and the
    settled commit accepts nothing (or commits the typed text with `allowCustomValue`): the
    first option of the stale list is never active. Typing a letter that matches nothing:
    `A=null`, `Empty` shows.
14. **Clear while open.** The listbox is open; the user clicks Clear. `pointerdown` prevented
    (focus stays); the press is outside the popup, so the browser light-dismisses the listbox
    (`toggle` → `openChangeAction(false, { reason: "dismiss" })`); `click` → `T=""`,
    `valueChangeAction(null)`; the listbox is not re-opened (3.3). The Trigger, by contrast, is
    never light-dismissed by its own press (it is an invoker of the popup, 3.3): its click closes
    through `requestClose` and the listbox stays shown until the action settles (walkthrough 17).
15. **Escape, then Enter at once (single-field search form, `allowCustomValue`).** Escape → the
    close watcher hides the popup; the `toggle` notification is queued. Enter before it runs:
    the key handler sees `:popover-open` false (section 8), commits the text in `flushSync` and
    lets the form submit with it. Judged against `intended()` it would have been prevented.
16. **A synchronously throwing `valueChangeAction`.** A plain function validates and throws.
    The wrapper's `catch` runs inside the `startTransition` callback; it yields (`await
    undefined`), then writes the rollback text (urgent, outside the transition: a controlled
    `onInputValueChange` parent's `setText` stays an urgent update) and rethrows to the
    boundary (2.2).

17. **Trigger click while open, slow close (#112).** The listbox is open, `openChangeAction(false)`
    takes 300 ms. `pointerdown` / `mousedown` prevented (focus stays in the input); the Trigger
    carries `popovertarget` (#121) → the press is not a light dismiss, nothing hides at `pointerup`;
    `click` → `preventDefault()` (no command), `requestClose(click, "activate")`,
    `data-pending` and no `data-open` on the Trigger (exposed as expanded while shown, #121), the
    listbox still shown with its options. 300 ms later the close commits: `hidePopover()` in the apply effect, the
    `<ViewTransition>` exit if set. A controlled parent that leaves `open={true}` instead: the
    optimistic `false` snaps back, the apply effect finds the popup shown and does nothing, no
    flicker. Before #112 every engine hid the listbox at `pointerup` (light dismiss), the action
    ran against a popup already gone, and a refusing parent re-opened it 300 ms later.

---

## 11. Form, server rendering, styling

### 11.1 Form participation

- `name` on Root → `<input type="hidden" name value={optimistic ?? ""}>` as the Root's single
  element, rendered before the children. `form` passes through to it. **No `defaultValue`
  mirror**: a hidden input is in the value mode "default" (its `.value` *is* the `value`
  attribute, which React keeps equal to the optimistic value) and the reset algorithm does not
  touch it, so the reset target is **computed in JS** (uncontrolled: the latest `defaultValue ??
  null`; controlled: the mount-time `value`, conventions 3.8 rule 6) and dispatched by the
  `reset` listener; the hidden input then follows the settled value as always.
- The visible input's `defaultValue` attribute is mirrored from `defaultInputValue`
  (uncontrolled) or the mount-time `inputValue` (controlled) **synchronously in the `reset`
  event**, before the reset algorithm runs (`useFormReset`'s third argument, `onResetEvent`):
  react-dom syncs a text input's `defaultValue` attribute to its value after every keystroke, so
  a mirror written in a layout effect does not survive. The algorithm then restores the text
  the browser way and the microtask listener reads it.
- `required` is the Input's native attribute: empty text is `valueMissing`, the browser's
  localised message appears on submit, `:user-invalid` matches after interaction. "The text must
  be one of the options" needs no constraint: without `allowCustomValue` the text is always a
  selection's label or empty when focus is elsewhere. No `setCustomValidity` (conventions 3.6).
- `useFormStatus` is not folded into `pending` (conventions 2.7).
- `disabled` on Root disables the Input (so it is not submitted? No: a disabled *visible*
  input is not submitted, but the hidden input is not disabled, so the selection still posts;
  consumers who want the field dropped from submission wrap the whole thing in a `<fieldset
  disabled>`). Never disabled while pending.

### 11.2 Server rendering and before hydration

Every part file is `"use client"` (context, hooks, DOM listeners); Server Components may render
every part and pass Server Functions to `valueChangeAction` and `openChangeAction`
(`onInputValueChange` too, but an urgent handler that is a network call makes no sense and
is documented against). What the server HTML contains: the hidden input with the default value,
the Label, the Input with `defaultInputValue` as its `value`, the Trigger and Clear (inert until
hydration: the Trigger's `popovertarget` is written after hydration, 3.3, so a
pre-hydration click on it opens nothing), the empty `<div popover>`. Before hydration the user can type, and the text is
adopted at mount (walkthrough 11); nothing opens, nothing is selectable. A form submitted before
hydration posts the default selection (and, with a `name` on the Input, the raw text). This is
progressive enhancement, not a JS-free mode, as Menu (conventions 7.3).

### 11.3 Styling

```css
.listbox { margin: 0; inset: auto; max-block-size: 20rem; overflow: auto; padding: 4px; border: 0; border-radius: 8px; box-shadow: 0 8px 32px rgb(0 0 0 / .2); }
.listbox[data-stale] [role="listbox"] { opacity: .6; }           /* old results while a search runs */
.listbox [role="option"] { padding: 6px 10px; border-radius: 4px; }
.listbox [role="option"][data-active] { background: var(--accent-weak); }   /* virtual focus */
.listbox [role="option"][data-selected]::after { content: "✓"; margin-inline-start: auto; }
.listbox [role="option"][data-pending] { cursor: progress; }
.listbox [role="option"][aria-disabled="true"] { opacity: .4; }
.combobox-input[data-pending] { background-image: var(--spinner); }
.combobox-input:user-invalid { border-color: var(--danger); }
/* Hide Clear while there is nothing to clear: */
.combobox:has(input:placeholder-shown) .combobox-clear { display: none; }

/* Enter / exit (CSS, both for library opens and dismissals): as Popover 10.1. */
.listbox { opacity: 0; translate: 0 -4px; transition: opacity 120ms, translate 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.listbox:popover-open { opacity: 1; translate: 0 0; }
@starting-style { .listbox:popover-open { opacity: 0; translate: 0 -4px; } }
/* With `transition` on the Popup: keep the exit for dismissals, cut it while a view transition runs (11.4). */
html:active-view-transition .listbox { transition: none; }
@media (prefers-reduced-motion: reduce) { .listbox { transition: none; } }
```

Hover styling of options is `:hover`, but since `pointermove` makes the hovered option active,
styling `[data-active]` alone keeps keyboard and pointer in one visual state (Menu 9).

### 11.4 ViewTransition

`transition` on `Combobox.Popup` wraps the `<div popover>` itself (conventions 5.1 top-layer
rule). Library-driven opens (typing, arrows, Trigger) and closes (accepted option, Trigger,
controlled) animate in every engine (the Trigger's close only since #112: a light dismiss at the
press used to hide the popup before the close commit, so there was no exit to capture). Three things specific to this component:

- **Deferred results renders activate the boundary.** React starts a view transition for an
  update from `useDeferredValue` as it does for a transition; every result change inside an
  open popup with `transition` set would run one, and the page receives no pointer events while
  it runs. The documented form is a type map with `default: "none"`:
  `transition={{ "fsui-combobox-open": "pop", "fsui-combobox-close": "pop", default: "none" }}`.
  A consumer who wants result changes to cross-fade sets a class on `default` and accepts the
  cost.
- The open commit is a mount of the popup's children under the always-mounted popover element
  (shielded, no page cross-fade) and `showPopover()` in its layout effect (the box as `new`).
- Types: every value dispatch adds `fsui-combobox` and `fsui-combobox-select`; the open and
  close dispatches add `fsui-combobox-open` / `fsui-combobox-close`. The accept-then-close path
  contributes `fsui-combobox-select` and `fsui-combobox-close` to the one commit that ends it.
- **The CSS exit of 11.3 must be cut while a view transition runs** (Popover 10.2, Dialog 10.3,
  conventions 5.1; #132). The library-driven closes (an accepted option, the Trigger, a controlled
  close) hide the listbox with `hidePopover()` in the layout effect of a transition commit, the
  same path as Popover's; with the `display` / `overlay` transition on the popup Chromium keeps the
  closing box rendered through its fade, so the close's view transition captures it as a live
  `::view-transition-new(…)` next to the `old` image (a double image). Probed for this component
  in Chromium (accepted option, the docs' exit CSS): without the rule the box is still displayed
  at `ready` with a `new` image; with `html:active-view-transition .listbox { transition: none; }`
  it is `display: none` with the `old` image only. Firefox animates no popover exit and shows the
  `old` image either way. The selector is untyped on purpose (a controlled close carries no
  types); the cost is that an unrelated page view transition also cuts a dismissal's fade.

---

## 12. Test plan

`packages/ui/src/combobox/combobox.test.tsx` (jsdom) and `combobox.browser.test.tsx` (Chromium,
Firefox, WebKit). "both" = `describe.each` over uncontrolled and "update on success" controlled
wrappers for `value`; `inputValue` rows run controlled and uncontrolled as well. jsdom: the
popover shim (with `source` recording), `user.type` for the urgent path, `createSuspender` for
async results, fake timers where needed. jsdom has no anchor positioning, no `ariaNotify`
(stubbed onto `Element.prototype` for the announcement rows), no close watcher (Escape rows are
browser-mode; the dismiss path is driven with `hidePopover()`).

### 12.1 jsdom

| Area | Tests |
| --- | --- |
| Roles and ARIA | The section 1 HTML: Input `role=combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls` = List id, `autocomplete=off`, `id` = Label `for`; List `role=listbox`, `aria-labelledby` = Label id, consumer tokens merged; Option `role=option`, derived `id`, `aria-selected` only on the selected one, `aria-disabled`; Trigger / Clear `tabindex=-1`, `type=button`; Popup `popover=auto`, inline placement string; Status `role=status` in the Popup and `role=none` inside the List; List `aria-labelledby` absent (and a dev warning without `aria-label`) when no Label is rendered; hidden input present only with `name`, value `""` for `null`; `required` lands on the Input; duplicate option values warn. |
| Urgent text (both for `inputValue`) | `user.type("ja")`: the DOM value is updated per keystroke, `onInputValueChange` called synchronously per keystroke with the `input` event and `"activate"`, **not** inside a transition (a `useTransition` spy / `isPending` probe in the parent stays false); a controlled parent that sets state in the body keeps the input in sync; a parent that does not adopt sees the DOM restored; a thenable returned warns once. |
| Deferred query | A List children function receives `query`; a suspending result for the new query keeps the old options mounted with `data-stale` / `aria-busy` on the List; on resolve the new options and no stale; a slow earlier query resolved after a later one never shows (cache keyed by query). |
| Open | Typing opens (`openChangeAction(true, "activate")` with the `input` event; `showPopover` called once with `{ source: input }` after the open commit); ArrowDown / ArrowUp / Alt+ArrowDown open; focus alone does not; `openOnClick` makes a click open; Trigger click toggles and focuses the input; `disabled` opens nothing. |
| Keyboard | The section 8 table: ArrowDown / ArrowUp move `aria-activedescendant` and `data-active`, skip disabled, stop or wrap with `loop`; Alt+ArrowUp accepts or closes; Enter accepts the active option (keydown prevented), does nothing with none (prevented while open, not prevented while closed), commits custom text with `allowCustomValue`; typing, Home, End, ArrowLeft and ArrowRight clear `aria-activedescendant` and are not prevented; Enter right after typing (results stale) accepts nothing stale, with or without `autoHighlight`; open-ness judged against `:popover-open` (a hidden popup with a queued `toggle`: Enter is not prevented); Escape is browser-mode. |
| Accept (both) | Enter / click: the text becomes `label` (or `textContent`) at once; `valueChangeAction(value, { reason: "activate", custom: false })` with the `keydown` / `click`; `data-selected` / `aria-selected` move optimistically; hidden input value follows; with a deferred action `data-pending` on the Option and Input while the listbox stays open, `hidePopover` not yet called; on resolve `hidePopover` once and committed / parent updated; typing while the action is pending keeps the listbox open (`hidePopover` not called on resolve, value committed). Re-accepting the selected option closes without dispatching. Disabled options never accept. |
| Rejection (both) | The catcher above Root receives it; `O` reverts; the input text reverts to the previous label with `onInputValueChange(prev, { reason: "dismiss", event: undefined })`; the listbox still open; hidden input back; a **synchronously throwing** action: the rollback write runs outside any transition (a `useTransition` probe or React's transition slot, review M2). Caught-inside variants commit. Controlled refusal: same revert without the error, and the listbox closes. |
| Overlap, superseded rejection (both) | Two accepts out of order: text and `data-pending` follow the latest, `hidePopover` once after the latest; the older's rejection reaches the catcher after and while the newer is pending. |
| Custom value | `allowCustomValue`: Enter with no active option dispatches `{ custom: true }`; `focusout` with changed text dispatches with the `focusout` event; empty text with a value dispatches `null`; without the flag `focusout` reverts the text (`"dismiss"`) and dispatches nothing. |
| Focus loss | `focusout` with `relatedTarget` outside → `hidePopover` at once, notification `"dismiss"`; `relatedTarget: null` → nothing synchronously (with a pointer down, nothing until one task after its `pointerup`/`pointercancel`; a label press keeps the text), then (fake timers) with `document.hasFocus()` and focus outside → the revert / custom commit, with focus still in the input (window blur) → nothing, while `disabled` → nothing; `pointerdown` and `mousedown` on an Option / the Popup are `defaultPrevented` and the input keeps focus. A `mousedown` on a foreign `<button popovertarget={popupId}>` while open is `defaultPrevented` and the input keeps focus (no revert); on a plain button or while closed it is not (#126). |
| Active-option revalidation | The active option unmounts (results change) → `aria-activedescendant` removed; with `autoHighlight` → the first enabled option once not stale and not loading, and not before (the stale list's first option is never active); never a dangling id. |
| Empty and Status | `Empty` renders only with zero mounted options, not stale and not loading: hidden during the Suspense fallback (a `Status` inside the List) and while stale old results show; `data-empty` on the List likewise; the List is `aria-busy="true"` while loading and while stale; a Status in the Popup is `role=status` and does not count as loading. |
| Announcements | With `ariaNotify` stubbed: called on the List once per settled result set with the default message (`"No results"` / `"1 result"` / `"3 results"`) or the consumer's `announce(count)`; not while stale; **with a `Status` fallback inside the List: zero calls until the results resolve, then one** (review H1); not for an unchanged count; never when `announce` returns `null`. |
| Clear | Writes `""`, dispatches `null` (`"activate"`, the `click`), no dispatch when already `null`, input keeps focus; while open, the light dismiss (shim) closes the listbox and it is not re-opened. |
| Trigger | Toggles against `intended()`; every click is `defaultPrevented`; after mount a `<button>` Trigger carries `popovertarget` equal to the Popup's `id` and no `aria-expanded` (#121), `renderToString` output carries no `popovertarget`, a non-button `render` gets none, renders `aria-expanded` from `shown` and gets a dev warning; a `disabled` component `render` (`aria-disabled="true"`, #132) carries no `popovertarget` and renders `aria-expanded="false"`, the attribute appears when `disabled` flips to `false` in a re-render and goes when it flips back, and a native-`disabled` host button keeps it (it is an invoker; the browser's own disabled check makes it non-exempt); a controlled `open={true}` parent whose action leaves `open` alone keeps the listbox shown with one `(false, "activate")` dispatch (#112). |
| Platform path (both) | Mount reconciliation: `renderToString`, set `input.value = "jap"` before `hydrateRoot` → one `onInputValueChange("jap", { reason: "platform", event: undefined })`, no open, StrictMode still one; no `valueChangeAction`. Form reset: `form.reset()`, `<button type=reset>`, automatic reset after `<form action>` → one `valueChangeAction(resetTarget, "platform")` with the `reset` event and one text write; the reset target is the JS-computed one (uncontrolled: latest `defaultValue`; controlled: mount-time); the visible input's `defaultValue` attribute is the mirror at the time of the `reset` event (uncontrolled: latest `defaultInputValue`; controlled: mount-time); the hidden input carries no `defaultValue`. |
| Suspending content (both) | Dependent content keyed on `value` suspends on accept: old content stays, Input `data-pending`, no fallback above; then new content. Results boundary outside the List: the open waits with `data-pending` on Input and Trigger, `showPopover` not called until resolve. |
| Function props / `render` | Every part's documented state; `render={<input type="search" />}` keeps the role and handlers; a `render={<button />}` Input warns; Popup `render={<div className />}` merges. |
| Post-await rule | Controlled `value` parent updating after `await` inside `startTransition`; controlled `inputValue` parent with a plain `setState`. |
| `transition` smoke | Popup renders with and without; a close after accept unmounts children in the close commit with `transition`, holds without. |
| Directive | Every file under `src/combobox/` except `index.ts` begins with `"use client"`. |
| Types | `UrgentChangeHandler` is exported (and `UrgentChangeAction` is not: no alias, #96); `onInputValueChange` accepts any `(next, details) => void` (the thenable check is a runtime warning); `inputValueChangeAction` is not a prop; `multiple` is not a prop (type test). The library-wide "Action naming" guard (conventions 10.1, `src/__tests__/action-naming.test.ts`) lists `onInputValueChange` as the one allowed `on*` key. |

### 12.2 Browser mode (`combobox.browser.test.tsx`)

Feature checks added to `src/__tests__/engine.ts`: `supportsAriaNotify = "ariaNotify" in
Element.prototype` (all three stable engines; asserted true, branch kept for Playwright builds).

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Placement and width | After typing: the popup's top edge equals the input's bottom edge, its left (inline-start) edge the input's, and `getBoundingClientRect().width >= input width` (`anchor-size`). Under `dir="rtl"` on the **document** (`document.documentElement.dir`) the inline-start edges still coincide (the right edges). **Container RTL (wave 11):** with `dir="rtl"` on a wrapper around the Combobox in an LTR document, the right edges coincide. Near the viewport bottom the popup flips above (`flip-block`). | Container row: `anchorPositionHonoursParentDirection` (`engine.ts`, conventions 13.3) true: right edges coincide; false (Firefox, Mozilla 2019601): the listbox's inline edges coincide with neither input edge, asserted with the bug named, never skipped. Page row: none. |
| Focus stays | Click an option with the real pointer: `document.activeElement` is the input before, during and after; the selection dispatched; the popup closed after the action. Click the Trigger: input focused, popup open. Click Clear: input focused. | none |
| Escape | Escape closes the popup, `openChangeAction(false, "dismiss")`, focus in the input, text kept; a second Escape inside a `Dialog.Popup` closes the Dialog; inside a `Popover.Popup` closes the Popover. | none |
| Tab closes | Tab from the input: focus on the next field, popup hidden, text reverted (or custom value committed); Shift+Tab likewise. | none |
| Typing while a save is pending | Deferred results re-render during a pending `valueChangeAction` (walkthrough 6): new options appear before the save resolves. **Verifies the lane claim of section 4**; if it fails, the design's statement is corrected to "results wait for a pending save". | none |
| Enter submits with the new value | `allowCustomValue` inside a `<form>` with a submit spy: Enter while closed posts the typed text in `FormData` (hidden input updated before the implicit submission). | all three; document any engine where the sync flush lands after submission |
| Nested in Popover / Dialog | Opening the listbox keeps the outer open; light dismiss closes the stack; **WebKit 302008 row**: `browserName === "webkit"`, open the listbox inside an open `Popover.Popup` twice with the default `flip-block` under a 15 s timeout so a hang fails instead of stalling. | WebKit row runs regardless |
| Announcements | `ariaNotify` spied on the List: one call per settled result set with the default or the `announce` string; none while stale. | `supportsAriaNotify`; otherwise assert no throw |
| Trigger close (#112) | Real mouse (`mouse.down` / `mouse.up`) on the Trigger of an open listbox with `openChangeAction` resolving after 300 ms: at `pointerup` + 20 ms the popup still matches `:popover-open`, `document.activeElement` is the input, the Trigger has `data-pending`, no `data-open` and no `aria-expanded` (#121; the Chromium branch asserts the Trigger's AX `expanded=true` through `getAXNodes()` at the same sample); after the action: hidden, exactly one dispatch `(false, { reason: "activate" })` whose `event` is the `click`. Controlled `open={true}` parent that refuses (async and sync action): `:popover-open` sampled every frame from the press to + 400 ms is never false. With `transition`: `startViewTransition` called once for the Trigger close with a `::view-transition-old` of the popup. A click while closed opens with the popup's inline-start edge on the input's and width `>= input width` (the command never ran; the anchor is still the input). | none: all three engines run the same DOM assertions; the AX assertion is Chromium only. WebKit is checked by its CI job (`FUNSTACK_BROWSERS=webkit`); its `handlePopoverLightDismiss` checks `popoverTargetElement()` (`Document.cpp`, main, #121 evaluation) |
| Input press (#123) | The #117 row, now passing: a real press (`mouse.down` / 20 ms / `mouse.up`) on the input of an open listbox: at the press and 80 ms after the release the popup matches `:popover-open`, `document.activeElement` is the input, the text is unchanged, nothing dispatched; the `click` landed on the Popup (`openOnClick` neither re-opens nor dispatches). Caret: a press after the third character leaves `selectionStart === selectionEnd === 3`. Nested inside an open `Popover.Popup`: both stay open. Touch (a `hasTouch` context, `touchscreen.tap`, or CDP `Input.dispatchTouchEvent`): stays open at top level; under vitest's runner the page is a frame, where Chromium closes it (#124): the row asserts the close in Chromium with the issue named, so it fails the day Chromium changes. It runs in Chromium only: the harness creates no `hasTouch` context, and CDP touch input is Chromium's (as the Menu and NumberField touch rows); Firefox's touch outcome comes from the plain-DOM probe (open, top level and frame). Drag-to-select from the second to the eighth character while open: `[2, 8]` where the engine's selection drag ignores pointer capture; Firefox: `[2, 2]`, asserted as the documented cost, never skipped. | Touch row: `browserName === "chromium"` (CDP), branching on `window === window.top` (the frame is #124's trigger; vitest's runner is always a frame) with #124 named. Drag row: `browserName === "firefox"` with the finding named (conventions 13.3: no feature check fits a drag). WebKit's expectation is `[2, 8]`; if its CI job alone disagrees, record it in the amendment and branch |
| Pre-hydration typing | `renderToString` into an `iframe srcdoc`, type with the real keyboard before `hydrateRoot`: the text survives hydration, one `"platform"` text dispatch, no `valueChangeAction`, nothing opened; the server HTML's Trigger has no `popovertarget`, a real click on it before `hydrateRoot` opens nothing, after hydration it carries `popovertarget` (#112, #121). | The "keyboard did not reach the iframe" fallback is allowed for WebKit only (the engine not probed locally, review L4); Chromium and Firefox must reach it |
| ViewTransition | With `transition={{ …, default: "none" }}`: open calls `startViewTransition` once, accept-close once with a `::view-transition-old` of the popup present, a deferred results change zero times; with `transition="pop"` a results change calls it once (documents the cost); without `transition` zero calls. **CSS exit recipe (#132, as the shared overlay suite's "a CSS exit (recipe=%s)" rows):** the type map plus a `display` / `overlay` exit on the popup, an accepted option: at `ready` the popup is still displayed with a live `::view-transition-new` of it only in Chromium without the recipe (`html:active-view-transition .fade { transition: none; }`); with it, `display: none` and the `old` image only; one view transition, the content not re-mounted. | Recipe row: `browserName === "chromium"` for the displayed-and-`new`-image branch (Firefox: `old` only; WebKit: `display: none` by `ready`, pseudo names unreliable, assert `display` only, as Dialog 13.3). |
| IME | Composition (`compositionstart` … `compositionend` through Playwright's `insertText` / keyboard IME where available): the text updates per composition update, the listbox opens, Enter during composition does not accept. | Chromium (Playwright IME support); others assert the non-composition path |

---

## 13. Not in v1

- **`multiple`** (chips, `aria-multiselectable`, a `Combobox.Chips` / `Chip` area): the value
  becomes `string[]` with `details.added` / `removed` (CheckboxGroup's diff shape); the text
  stays single; the keyboard gains Backspace-removes-last-chip. The anatomy leaves room (a
  `Value` / `Chips` part before the Input). Deferred until a consumer case; question 7.
- **Inline autocompletion** (`aria-autocomplete="both"` / `"inline"`: the input completes the
  active option's text with the completion selected). Needs caret manipulation the library
  would own; Base UI's `mode: "both" | "inline"`. Later.
- **Virtualization** and PageUp / PageDown.
- **A built-in filter / `items`** (6.1); a `matches()` helper export is the most that fits.
- **`Combobox.Input` inside the Popup** (the "searchable select" where a button is the anchor
  and the input lives in the popup): a different focus model (focus moves into the popup).
  Could be a Select-like variant later.
- **`Separator`** (not in a listbox's content model).
- ~~**Container-level `dir="rtl"`** (7.2): the listbox follows the document direction only;
  a repo issue tracks reading the input's direction at open.~~ Done in wave 11 (#53) with
  `self-*` keywords; Firefox remains misplaced in direction islands (Mozilla 2019601).
- **`loading` in `state` / `data-loading`**: the library knows the loading state (6.3) but
  exposes it only as `aria-busy` on the List (style with `[aria-busy="true"]`) until a consumer
  asks for more.
- **Controlled `activeValue`**, `onHighlightChange`-style exposure: the active option is
  observable through `data-active` and `state.activeValue`; a prop to set it is not needed
  until a consumer asks.
- **The Open UI customizable combobox** (`<input list>` + `<datalist>` with `appearance:
  base`, `beforefilter`): Chromium `experimental` only, no other-vendor signals. When it ships,
  it could become an `experimental_` rendering of the same parts; the vocabulary here (author
  filtering, active option) is compatible on purpose.

---

## 14. Implementation notes

```
packages/ui/src/combobox/
  index.ts                  # no directive; namespace + types; imports platform-attributes
  combobox-context.ts       # "use client": ComboboxContext (root value + text + active + registry), ComboboxListContext
  combobox-root.tsx         # "use client": useOverlayRoot({ component: "combobox", mode: "library", details: popoverDetails }), useControllableAction<string | null>, useState text + useDeferredValue, active option, useOptionRegistry, label cache, accept(), useComboboxForm (form reset, mount reconciliation, hidden input), keyboard model
  use-option-registry.ts    # "use client": useOptionRegistry(labels): the Option registry (a Map in a ref plus a count state) and its DOM-ordered read
  use-combobox-form.ts      # "use client": useComboboxForm(options): form reset of text and value, the DOM re-sync for a controlled parent, the mount reconciliation of pre-hydration text (11.1)
  combobox-label.tsx        # "use client"
  combobox-input.tsx        # "use client": the controlled <input>, onInput / onKeyDown / onBlur / onClick
  combobox-trigger.tsx      # "use client"
  combobox-clear.tsx        # "use client"
  combobox-popup.tsx        # "use client": usePopoverPopup, inline placement, onPointerDown
  combobox-list.tsx         # "use client": role=listbox, aria-busy, data-stale/empty, children({ query })
  combobox-option.tsx       # "use client": registration, pointer handlers, accept on click
  combobox-group.tsx        # "use client": Group, GroupLabel, Empty, Status
  combobox.test.tsx, combobox.browser.test.tsx
packages/ui/src/internal/
  types.ts                  # + UrgentChangeHandler
  use-form-reset.ts         # widen FormAssociatedElement with HTMLInputElement (already) — the hidden input is the subscription element
```

- **Root.** `useOverlayRoot` as Menu (always library mode; the shared `popoverDetails` builder). `useControllableAction<string | null, ComboboxValueChangeDetails>({
  initialValue: null, transitionTypes: () => ["fsui-combobox", "fsui-combobox-select"] })`. The
  wrapped action: `async (next, details) => { try { await valueChangeAction?.(next, details); }
  catch (e) { await undefined; writeText(previousLabel, "dismiss"); throw e; } if (latest &&
  openGeneration() === recorded && text === writtenText) requestClose(details.event,
  "activate"); }`, with `recorded` and `writtenText` captured at dispatch (per-dispatch metadata
  in a `WeakMap` keyed by the `details` object); the `await undefined` keeps a synchronous
  throw's rollback outside the transition (2.2). Text: `const [internalText, setInternalText] =
  useState(defaultInputValue ?? "")`, `text = inputValue ?? internalText`, `query =
  useDeferredValue(text)`; `writeText(next, reason, event)` sets internal state (uncontrolled)
  and calls `onInputValueChange` synchronously; never inside `startTransition`. Active:
  `useState<string | null>(null)`. Registry: `useOptionRegistry(labels)` (`use-option-registry.ts`): `Map<value, { element,
  label }>` in a ref plus a `useState` count for `Empty` / `data-empty` (updated in Option
  layout effects, batched by React), with the DOM-ordered read the keyboard model uses. Status registry: `Combobox.Status` registers from a layout effect when rendered under
  the List context; `loading = statusCount > 0`, kept both in state (for `aria-busy`, `Empty`)
  and in a ref (for effects). Label cache: a ref map, write-only on registration and on accept.
- **Revalidation effect** (6.5): a layout effect after every commit reading the registry;
  `typed()` and the caret keys call `setActive(null)` directly.
- **Announcement effect**: a passive effect keyed on `[stale, count, query]` that reads the
  option count and the loading count **from the refs** (6.4, review H1); speaks through
  `internal/announce.ts`'s `announce(list, message)` and composes the consumer's `announce` prop
  only where `canAnnounce(list)` (#129; the Root's own `ariaNotify` call before).
- **Form reset** (`useComboboxForm`, `use-combobox-form.ts`): `useFormReset(hiddenInputRef or
  inputRef, onReset, onResetEvent)`;
  `onResetEvent` (synchronous, before the reset algorithm) writes the text mirror into the
  visible input's `defaultValue`; the microtask `onReset` dispatches the JS-computed value reset
  target and writes the text from the DOM (11.1).
- **Mount reconciliation** (also `useComboboxForm`): layout effect at mount reading `input.value`; compare with
  `defaultInputValue ?? inputValue ?? ""`.
- **Input handlers.** `onInput` → `setActive(null)`, `writeText(target.value, "activate",
  nativeEvent)`, then `requestOpen(nativeEvent, "activate")`. `onKeyDown` per section 8, open-ness
  from `popup.matches(":popover-open")`, reading options from the registry in DOM order
  (`compareDocumentPosition`), skipping `aria-disabled`; Home / End / ArrowLeft / ArrowRight →
  `setActive(null)` without `preventDefault`; Enter while closed with `allowCustomValue` →
  `flushSync` around the commit. `onFocus` → start the #111 press watch (an owned key since
  #132, as the `onBlur` it serves). `onBlur` (React's `focusout`): nothing while `disabled`; if
  `relatedTarget` is outside the input and the popup → `popup.hidePopover()` with a recorded
  `"dismiss"` intent, then the revert / custom commit (`leave()`); if `relatedTarget === null` →
  `setTimeout(0)` (while a pointer is pressed, one task after the last release instead; see 5.4,
  #111), then `leave()` only if `document.hasFocus()` and `document.activeElement` is outside the
  input and the popup. `onClick` → `openOnClick`. `onPointerDown` → while
  `popup.matches(":popover-open")` and `button === 0`, `capturePointer(popup, pointerId)` (#123;
  the helper moves from `menu/menu-dom.ts` to `internal/pointer-capture.ts`). **Foreign invokers**
  (#126): `Combobox.Popup` passes a `whileShown` installer to `usePopoverPopup` (#129; an
  `onToggle` before) that starts
  `listenInvokerPresses(popup)` (`internal/invokers.ts`, `invoker-press.ts` before #129, shared with Menu: a document capture
  `mousedown` listener preventing the primary button's default on a `<button>` outside the popup
  whose `popoverTargetElement` / `commandForElement` with a `*-popover` command is the popup) when
  shown and stops it when closed. Composition: ignore
  Enter / arrows while `event.nativeEvent.isComposing`.
- **Popup.** `usePopoverPopup(ctx, { part, initialFocus: undefined, keepMounted, transition })`;
  `libraryProps`: `id`, `popover: "auto"`, `onPointerDown` and `onMouseDown` →
  `preventDefault()`, `data-stale`, inline `style` (consumer wins per property); content through
  `renderContent` as Popover 14.4.
- **Trigger.** `onPointerDown` and `onMouseDown` → `preventDefault()` (focus stays in the
  input); ref callback → when `element.tagName === "BUTTON"` and `invoker` (from
  `disabledButton(render, disabled)`, a dependency of the `useCallback`, so React re-runs the
  cleanup and the ref when it flips, #132), `setAttribute("popovertarget",
  ids.popup)` (#121; `commandfor` + `command` at #112), removed in the cleanup
  (otherwise a dev warning); `onClick` → `preventDefault()` first (the command never runs), then
  `disabled` check, toggle against `intended()`, focus the input. No `onPointerCancel`, no
  `pointerdown` snapshot (#112).
- **Option.** Mount layout effect registers `{ element, label: labelProp ?? textContent }` and
  unregisters on cleanup; `onPointerMove` → set active if not disabled; `onClick` →
  `ctx.accept(value, event)`; `onPointerDown` and `onMouseDown` → `preventDefault()`.
- **Status.** Reads the List context: inside a List, `role="none"` and a layout-effect
  registration that increments the Root's status count; outside, `role="status"` and no
  registration.
- **Label.** Registers its id with the Root from a layout effect so the List's `aria-labelledby`
  is emitted only while a Label is mounted.
- **Dev warnings** per section 9.
- **Docs site and example app.** Playground: a country picker with a fake 400 ms search
  (`createSuspender`-style cache), a slow Server-Function-like save, `allowCustomValue` tag
  input, a combobox inside a Dialog, and the "typed before hydration" note. Docs page: props
  tables from the declarations, the urgent-lane explanation (section 4) as the page's first
  concept, the `default: "none"` transition recipe, the keyboard table, the `announce`
  one-liner.

---

## Conventions feedback (applied to `design/conventions.md` at acceptance, 2026-10-17)

1. **2.6 Urgent updates.** Replace "not provided in v0" with the urgent lane as designed in
   section 4: an urgent state keeps the `x` / `defaultX` / `xChangeAction` triple; its action
   is typed `UrgentChangeAction<T, Details>` (sync, called outside any transition, not awaited,
   no pending, no optimistic); the library uses it only where React requires urgency
   (controlled text input). Still no `on*` props. Resolved question 2 updated accordingly.
2. **2.2 shared types / 9.4.** Add `UrgentChangeAction` to `internal/types.ts` and the root
   entry's public types.
3. **3.2 three values.** Add a fourth row for the urgent lane: `text` / `activeValue`-style
   states, source `useState`, lane sync, shown by the input and the virtual focus. And a rule:
   **virtual focus (`aria-activedescendant`) is urgent library state**, as DOM focus is
   browser-owned and immediate; it is never a transition and never dispatches.
4. **3.5 residual paths.** Add "text typed into a controlled text input before hydration is
   reconciled at mount with `reason: "platform"` through the urgent action"; and "form
   participation through a hidden input mirroring the optimistic value, with `defaultValue`
   mirrored as the reset target" as a named pattern (Combobox; a future multi-select).
   *Corrected after review (deviation 2):* a hidden input has no reset behaviour, so the pattern
   is "a hidden input mirroring the optimistic value, with the reset target computed in JS";
   conventions 3.5 and 3.8 rule 6 carry the corrected wording.
5. **1.1 part vocabulary.** `Label` gains "`label[for]` naming an `Input` part"; add `Input`
   (the text field of a combobox), `List` (an ARIA `listbox` inside a `Popup`; the Popup is the
   container because a listbox may contain only options and groups), `Option` (Combobox:
   `div[role=option]`, never focused), `Clear`, `Empty` (rendered by the library only when the
   list has no options and is not stale), `Status` (`div[role=status]`), and the rule that a
   Root may render exactly one hidden form element when it owns a form value but no visible
   element.
6. **4.1 vocabulary.** Add `active` (virtual focus on an Option, urgent), `stale` (the shown
   results are for an older text; `aria-busy` equivalent on the listbox), `empty` (the list
   has no options), `selected` row gains `Combobox.Option` and `Combobox.Input`
   (`data-selected` = a non-null optimistic value), `open` row gains `Combobox.Input` /
   `Trigger` (optimistic `data-open`; no `aria-expanded` on a `<button>` since #121, the browser exposes the state; Popup none).
7. **5.1 ViewTransition.** Note that updates from `useDeferredValue` activate a boundary like
   transitions do, so a part whose content re-renders from a deferred value (Combobox.Popup)
   documents the `default: "none"` type-map form as the recommended spelling.
8. **5.3 types.** `Combobox`: `fsui-combobox`, `fsui-combobox-open`, `fsui-combobox-close`,
   `fsui-combobox-select`.
9. **7.3.** Combobox joins Menu as an always-library-mode component; its progressive
   enhancement is "the text input works before hydration and is adopted at mount".
10. **8 experimental table.** No new flag. Record `ariaNotify` as adopted without a flag (all
    three stable engines) and the Open UI customizable combobox as a future `experimental_`
    rendering candidate.
11. **10.1 test rows.** Add "Urgent action (both)" as a required row for any component with an
    urgent state: called synchronously per DOM event, outside a transition, DOM in sync for a
    controlled parent.
12. **New section 11, built-in strings** (from the user's decision on question 6): a built-in
    UI string is an English default, exists only where accessibility needs text the consumer
    might forget, and is always overridable through a prop that takes a function (so the
    message can depend on state); the library never ships a locale mechanism.

---

## Questions for the product owner

1. **One Combobox with `allowCustomValue`** (decision 1) rather than `Combobox` + `Autocomplete`
   as Base UI does. Recommendation: one component. The two share everything but the meaning of
   unmatched text on commit; a second namespace would duplicate twelve parts and the whole test
   plan for one boolean's worth of behaviour, and React Aria / Ark show the single shape reads
   fine (`allowsCustomValue` / `allowCustomValue`). Cost: a consumer building a pure search box
   still sees `value` / `valueChangeAction` and must learn that with `allowCustomValue` the
   value is the committed text. Alternative: ship `Autocomplete` later as a thin preset over the
   same parts if the docs show confusion.
2. **The urgent lane is `inputValueChangeAction: UrgentChangeAction`** (section 4), keeping the
   triple and the no-`on*` rule, with urgency expressed by the type and the docs. Alternatives:
   a one-off `onInputChange` handler (an `on*` exception), or `inputValueAction`. Recommendation:
   as designed; this becomes the library-wide urgent convention (feedback 1).
3. **`value` and `inputValue` are two explicit states; the library never derives the text from
   the value** (2.2), so a preselected value needs `defaultInputValue` / `inputValue` at the
   call site (dev warning otherwise). Alternative: an `itemToString` / `displayValue` function
   on Root (Headless UI, Base UI), which a Server Component cannot pass and which duplicates the
   Options' labels. Recommendation: as designed.
4. **Accepting an option keeps the listbox open with `data-pending` on the option until
   `valueChangeAction` settles** (5.2, Menu decision 3), the input text changing at once.
   Alternative: close at once and run the action detached (prior art everywhere; no pending
   surface, no rollback the user can see). Recommendation: as designed; sync actions are
   indistinguishable.
5. **Tab does not accept the active option** (section 8; manual selection). Many
   implementations (React Aria with `autoHighlight`-like modes, Chrome's own address bar) accept
   on Tab. Recommendation: no, because Tab is "leave" everywhere else in the library (Menu
   closes on Tab), and `autoHighlight` + Enter covers the "accept the first match" flow. Could
   become a prop (`selectOnTab`) if asked for.
6. **`announce` has no default string** (6.4). Alternative: a default English `"${n} results"`
   with override. Recommendation: no default, matching "the library ships no text"; the docs
   show the one-liner next to every example. Flagging because it is an accessibility default
   that is off until the consumer acts.
7. **`multiple` deferred** (section 13) with the anatomy leaving room for `Chips`. Confirm.
8. **No JS-free mode; the Trigger server-renders no invoker attribute** (section 1, 2.4): a pre-hydration
   Trigger click does nothing, a pre-hydration keystroke is adopted at mount. Alternative:
   a server-rendered invoker attribute on the Trigger for a pre-hydration open of an empty, button-anchored popup
   (Menu's shape), at the cost of wrong anchoring and width after hydration unless the library
   re-opens with `source: input`. Recommendation: as designed.
9. **Escape is left to the platform** (5.4): the library never intercepts it, so Escape when the
   listbox is closed reaches an enclosing Dialog / Popover, and there is no "second Escape clears
   the text" (APG optional behaviour). Confirm.
10. **The WebKit 302008 row and the `style={{ positionTryFallbacks: "none" }}` escape hatch**
    (7.3), keeping `flip-block` by default (Menu / Select precedent). Confirm.
11. **Conventions feedback 1 to 11** to apply on acceptance by whoever holds `conventions.md`.

---

## Decisions recorded (product owner, 2026-10-17)

Questions 1 to 5 and 7 to 11 accepted as recommended: one component with `allowCustomValue`;
`inputValueChangeAction: UrgentChangeAction` as the library-wide urgent convention; two explicit
states and no `itemToString`; stay open with `data-pending` on the option and close on settle
(consistent with Menu); Tab does not accept; `multiple` deferred; no server-rendered invoker attribute on the Trigger
and no JS-free mode; Escape not intercepted; the WebKit 302008 row with the
`positionTryFallbacks` escape hatch; the conventions changes applied (feedback 1 to 12).

**Question 6, overridden by the user:** `announce` ships a default English message
(`"No results"`, `"1 result"`, `"N results"`), overridable for i18n, so the result count is
announced out of the box. Recorded as a convention (conventions 11): built-in strings are
English defaults and always overridable. Sections 6.4, 3.1 and the decisions table are updated;
the test rows assert the default.

---

## Review revisions (product owner, 2026-10-17)

From `memo/reviewer/combobox.md` (review of 08e1d23 … 3f61f1f, verdict "acceptable with fixes")
and the developer's deviations in `memo/developer/combobox.md`. The architecture held (urgent
lane, deferred results, accept-then-close, open-generation guard, form reset, hydration path);
the items below are corrections to this document and the code fixes it now requires.

| Item | Decision | Where |
| --- | --- | --- |
| H1 (announces "No results" on every open of an async combobox) | Nothing is announced while loading; the announcement effect reads the Status count through a ref, as it already did for the option count. | 6.4, 14; test row "Announcements" |
| M1 (the active option survives typing) | Follow the APG: typing, Home, End, Left and Right clear the active option; `autoHighlight` re-highlights the first option only once the results settle (never a stale list). Resolves L5: a fast Enter while stale never accepts a stale option; it commits the typed text with `allowCustomValue`, or does nothing. | 2, 5.3, 6.5, 8, walkthrough 13 |
| M2 (a synchronous throw runs the rollback inside the transition) | The urgent rollback write runs after `await undefined`, outside the transition; then the rethrow. | 2.2, 14, walkthrough 16; conventions 2.6 |
| M3 (`role="status"` inside the listbox, no `aria-busy` while loading) | The List is `aria-busy="true"` while loading (a Status inside the List) as well as while stale. A Status inside the List has no status role or live region (`role="none"`); a Status outside the List is `role="status"`. A Status inside the List means "loading" (deviation 5 of the developer memo, the reviewer's 3: accepted). | 1, 3.5, 6.3, 9 |
| L1 | The List's `aria-labelledby` is emitted only while a Label is mounted; otherwise the consumer's `aria-label`; dev warning with neither. | 9 |
| L2, L3 | Trigger snapshot dropped on `pointercancel`, `detail === 0` falls back to `intended()`; `leave()` is a no-op while `disabled`. | 3.3, 5.4 |
| L4 | Test-only: the iframe keyboard fallback is WebKit-only. | 12.2 |
| L6 | The design corrections listed by the reviewer are applied: 3.3 (Clear closes; the Trigger decides at `pointerdown`), 5.2 (typing drops the pending close), 5.4 (deferred `relatedTarget === null` check), 5.5 and walkthrough 4 (controlled refusal closes), 6.3 and the anatomy (Status inside the List means loading), 7.2 and 12.2 (container RTL does not flip), 8 (keys judged against `:popover-open`), 11.1 and conventions feedback 4 (no hidden-input `defaultValue` mirror; JS reset target; the visible input's mirror written in the `reset` event). | as listed |
| Deviation 1 (RTL page-level only) | Accepted for v1; a follow-up repo issue reads the input's direction at open. | 7.2, 13 |
| Deviation 2 (no hidden-input `defaultValue` mirror) | Accepted; the reset target is computed in JS. | 11.1; conventions 3.5, 3.8 |
| Deviation 4 (a controlled refusal closes) | Accepted. | 5.5, walkthrough 4 |
| Deviation 5 (Clear while open closes through light dismiss) | Accepted. | 3.3, 5.4, walkthrough 14 |
| Added behaviours | Accepted: keys judged against `:popover-open`; the Trigger snapshots its state at `pointerdown`; `focusout` with `relatedTarget === null` is deferred and checked with `document.hasFocus()`; typing cancels the pending close while the value still commits; `mousedown` prevented alongside `pointerdown`; the closed-Enter custom commit in `flushSync`. | 3.3, 3.4, 5.2, 5.3, 5.4, 8 |
| Section 4 lane claim | **Verified**: a `useDeferredValue` re-render is not entangled with a pending action. | 4 |

Repo issue to record (human): "Combobox: container-level `dir=rtl` does not flip the listbox
(logical `position-area` keywords resolve against the top-layer containing block; Firefox lacks
`span-self-inline-end`)", the follow-up for deviation 1. Filed as #53; resolved by the wave 11
amendment below (the Firefox claim was wrong, see 7.2).

---

## Amendment: container direction (wave 11, 2026-10-23, issue #53)

Status: **accepted** (product owner, 2026-10-23: `self-*` keywords; no `data-side` now,
recorded as a possible follow-up; Firefox 2019601 is #89); the cross-component rules are
conventions 13. Edited in place: decision 10, the section 1 HTML, 7.2, 12.2, 13.

| | v1 (as accepted) | Wave 11 |
| --- | --- | --- |
| Inline `position-area` | `block-end span-inline-end` (plain logical: the root's direction) | `self-block-end span-self-inline-end` (the popup's own direction) |
| `dir="rtl"` container | left edges aligned (Chromium), documented | right edges aligned (Chromium, WebKit); Firefox misplaced (Mozilla 2019601), asserted in the browser row |
| Follow-up "read the input's direction at open" | planned | rejected (JS, pre-hydration, staleness; no gain in Firefox) |
| `data-side` | none | none (a possible follow-up, 7.2) |

Migration: an RTL island's listbox moves to the correct side in Chromium and WebKit; a consumer
who compensated with `style={{ positionArea: "block-end span-left" }}` can drop it. Nothing
else changes.

Questions for the product owner: none beyond Tooltip's amendment question 5 (Firefox
unworked-around). The absence of `data-side` on `Combobox.Popup` is a choice (7.2), not an
omission; say so if a `data-side` for the flipped listbox is wanted now.

---

## Amendment: the urgent lane is a handler (#96, 2026-10-23)

Status: **user decision** (2026-10-23, from the docs feedback in #95: "`action` should always
mean a handler automatically wrapped with a transition"). Cross-component rules: `docs/vision.md`
principle 3 and conventions 2.1, 2.6, 10.1, resolved question 39. Edited in place above:
decision 3, 2.2, 3, 3.1, 3.6, 4, 6.2, 9, 10, 11.2, 12.1, 14. The historical sections ("Conventions
feedback", "Questions for the product owner", "Decisions recorded", "Review revisions") keep the
v1 names: they record what was decided on 2026-10-17, and question 2 there is the decision this
amendment reverses.

| | v1 (as accepted, #50) | #96 |
| --- | --- | --- |
| Urgent prop on `Combobox.Root` | `inputValueChangeAction` | **`onInputValueChange`** |
| Its type (root entry export) | `UrgentChangeAction<T, Details>` | **`UrgentChangeHandler<T, Details>`**, same signature `(next: T, details: Details) => void` |
| Details type | `ComboboxInputValueChangeDetails` | unchanged (it describes the change, not the lane; conventions 9.4) |
| `inputValue` / `defaultInputValue` | unchanged | unchanged |
| Behaviour | sync, in the event, outside any transition, not awaited, thenable warns once | unchanged, warning text names the new prop |
| Deprecated alias | | **none** (alpha); passing `inputValueChangeAction` is a type error and, at runtime, an unknown prop on `Root` (no DOM element receives it, so no React warning either: the type is the guard) |
| What `fooAction` means | a transition, except this one prop | **a transition, always** |
| `on*` props the library defines | none | **exactly one**, this one; any other needs a React-imposed urgency and a conventions amendment (2.1) |

Call site, after:

```tsx
const [text, setText] = useState("");
<Combobox.Root
  value={country}
  valueChangeAction={async (next) => { await save(next); setCountry(next); }}
  inputValue={text}
  onInputValueChange={(next) => setText(next)}
>
```

Read aloud, the two props now say what they do: `valueChangeAction` is awaited inside the
Root's transition and the chosen option is `data-pending` until it settles; `onInputValueChange`
is a React handler, called per keystroke, and the text is in the DOM before it runs.

Why not keep the suffix and rely on the type (v1's argument): a consumer reads
`inputValueChangeAction={async (q) => setResults(await search(q))}` and, trusting the suffix,
expects a pending state and an awaited promise; both are wrong, and the type comment is the
only thing that says so. With `onInputValueChange` the line looks like what it is, a plain
handler that happens to receive `(next, details)`, and the `async` reads as the mistake it is.

### Migration (0.1.0-alpha.11)

Rename the prop and, where imported, the type. Nothing else changes.

```diff
-<Combobox.Root inputValue={text} inputValueChangeAction={(next) => setText(next)}>
+<Combobox.Root inputValue={text} onInputValueChange={(next) => setText(next)}>

-import type { UrgentChangeAction } from "@funstack/ui";
+import type { UrgentChangeHandler } from "@funstack/ui";
```

### Implementation checklist (for the developer)

Grep for both `inputValueChangeAction` and `UrgentChangeAction` after the change; the only
hits left must be in `design/` and `memo/` history. Occurrence counts are as of this amendment.

**`packages/ui`**

- `src/internal/types.ts` (2): rename the type to `UrgentChangeHandler`; doc comment: "A change
  **handler** the library calls synchronously, outside any Transition, and does not await: the
  urgent lane (conventions 2.6; first used by Combobox's `onInputValueChange`). Not an action:
  nothing is pending or optimistic for it."
- `src/internal/types.test.ts` (5): rename the import and the `it` title ("UrgentChangeHandler is
  synchronous: (next, details) => void"); add `// @ts-expect-error` on a `UrgentChangeAction`
  import from `../index.js` so the alias cannot come back (plus
  `expectTypeOf<UrgentChangeAction>().toBeAny()` so the import is used).
- `src/index.ts` (1, line ~336): export `UrgentChangeHandler` instead of `UrgentChangeAction`.
- `src/combobox/combobox-root.tsx` (8): the prop (line ~116) and its JSDoc (section 3.1 above),
  the `ComboboxInputValueChangeDetails` comment (~48), the module doc (~215), `writeText`
  (~293 to 305: `latest.onInputValueChange`; warning text
  "Combobox.Root: `onInputValueChange` returned a promise. It is the urgent lane: it is not
  awaited. Fetch in a transition instead (`valueChangeAction`, or `useDeferredValue` of
  `inputValue`)."), the comment at ~344.
- `src/combobox/index.ts` (1, line ~23): the doc comment.
- `src/combobox/combobox.test.tsx` (21): the type import (line 26), the two `it` titles (~493,
  ~558), the type test at ~2383 ("types: UrgentChangeHandler is exported, UrgentChangeAction and
  inputValueChangeAction are not, multiple is not a prop"), every `inputValueChangeAction:` /
  `inputValueChangeAction=` in wrappers and assertions. (The file has no top-of-file row list;
  the urgent rows are the `renderBoth("urgent text")` describe, which keeps its name.)
- `src/combobox/combobox.browser.test.tsx` (2, lines ~356 and ~546).
- `src/toast/toast.test.tsx` (line 10), `src/field/field.test.tsx` (line 13),
  `src/form/form.test.tsx` (line 9): the N/A row is now called "Urgent handler"
  (`UrgentChangeHandler` in the Toast comment).
- **New** `src/__tests__/action-naming.test.ts` (conventions 10.1 "Action naming"), jsdom
  project, type-level with `expectTypeOf` plus one runtime completeness check. The load-bearing
  types, as implemented (two corrections to the first draft of this checklist are marked):

  ```ts
  import type {
    ButtonHTMLAttributes,
    DialogHTMLAttributes,
    DOMAttributes,
    InputHTMLAttributes,
  } from "react";
  import type * as UI from "../index.js";

  /**
   * Keys a part passes through from `ComponentPropsWithRef<...>` to its DOM element. React's
   * names, not the library's; they cannot be told apart from library props by type, so they
   * are excluded by name from both checks. (Correction 1: `DOMAttributes` alone misses
   * `<dialog>`'s `onCancel` / `onClose`, passed through by Dialog.Popup and Popover.Popup, and
   * `<button>` / `<input>`'s `formAction`, whose function member returns `void`.)
   */
  type DomPassThroughKeys =
    | keyof DOMAttributes<Element>
    | keyof DialogHTMLAttributes<HTMLDialogElement>
    | keyof ButtonHTMLAttributes<HTMLButtonElement>
    | keyof InputHTMLAttributes<HTMLInputElement>;

  /** The function members of a prop's type. (Correction 2: `Form.Root`'s `action` is `string | fn`.) */
  type FunctionPart<T> = Extract<NonNullable<T>, (...args: never[]) => unknown>;

  type ActionKeys<P> = Exclude<Extract<keyof P, "action" | `${string}Action`>, DomPassThroughKeys>;

  /** Action-named keys whose function part is missing or does not return `unknown`. */
  type NonTransitionActionKeys<P> = {
    [K in ActionKeys<P>]-?: [FunctionPart<P[K]>] extends [never]
      ? K
      : FunctionPart<P[K]> extends (...args: never[]) => infer R
        ? unknown extends R ? never : K
        : K;
  }[ActionKeys<P>];

  /** `on*` keys that are not DOM pass-throughs, i.e. the library's own. */
  type OwnHandlerKeys<P> = Exclude<Extract<keyof P, `on${string}`>, DomPassThroughKeys>;

  type PublicProps = {
    ToggleProps: UI.ToggleProps;
    ComboboxRootProps: UI.ComboboxRootProps;
    // … every `*Props` exported from src/index.ts, one line each
  };

  type Offenders = { [K in keyof PublicProps]: NonTransitionActionKeys<PublicProps[K]> }[keyof PublicProps];
  type OwnHandlers = { [K in keyof PublicProps]: OwnHandlerKeys<PublicProps[K]> }[keyof PublicProps];

  // Self-test of the helpers: a planted urgent handler with the suffix, and a string, are caught;
  // the form channel and the DOM pass-throughs are not.
  expectTypeOf<NonTransitionActionKeys<{
    inputValueChangeAction?: UI.UrgentChangeHandler<string>;
    valueChangeAction?: UI.ChangeAction<string>;
    action?: string | ((formData: FormData) => unknown);
    formAction?: string | ((formData: FormData) => void);
    labelAction?: string;
  }>>().toEqualTypeOf<"inputValueChangeAction" | "labelAction">();
  expectTypeOf<OwnHandlerKeys<{ onValueChange?: () => void; onClick?: () => void; onClose?: () => void }>>()
    .toEqualTypeOf<"onValueChange">();

  expectTypeOf<Offenders>().toEqualTypeOf<never>();
  expectTypeOf<OwnHandlers>().toEqualTypeOf<"onInputValueChange">(); // the allow-list
  expectTypeOf<UI.ComboboxRootProps["onInputValueChange"]>().toEqualTypeOf<
    UI.UrgentChangeHandler<string, UI.ComboboxInputValueChangeDetails> | undefined
  >();
  ```

  Completeness: keep `const listed = [...] as const` of the `PublicProps` keys, assert
  `Exclude<keyof PublicProps, (typeof listed)[number]>` is `never`, and at runtime read
  `src/index.ts` (`readFileSync`, as `directives.test.ts` reads `dist`) and `expect` the set of
  `/\b\w+Props\b/g` matches to equal `listed` (as sets), so a newly exported Props type fails the
  test until it is listed. `Form.Root`'s `action` is React's form channel, a URL string or
  `(formData) => unknown`: the check is on the function member only, which returns `unknown` and
  passes, as it should (the first draft checked the whole type with `NonNullable<P[K]> extends
  fn`, which the `string` member fails; the claim that it "passes" was wrong until the check was
  narrowed). Why exclude by name rather than by type: `formAction`'s function member is
  `(formData: FormData) => void | Promise<void>`, indistinguishable from an urgent handler
  mis-named as an action, so only the fact that React owns the name tells them apart.

**`packages/example`**

- `src/combobox-demo.tsx` (2, lines ~176 and ~182): the prose ("`setState` in
  `onInputValueChange`, the urgent lane") and the prop.

**`packages/docs`** (props tables are written by hand; update them with the types)

- `src/pages/ActionPropsPage.tsx` (3): the intro (line ~17, "has no `onClick`, `onChange` or
  `onValueChange`": add "with one exception, below"), the triple table's Combobox row (~53 to 54:
  "`valueChangeAction`; `onInputValueChange` (a handler, not an action: the urgent lane);
  `openChangeAction`"), and "The urgent lane" (~290 to 307): rename, retitle the type, and replace
  the closing sentence "It is still not an `on*` handler: there are none" with the rule: "It is
  the library's one `on*` prop, and it is one on purpose: `fooAction` always means a handler the
  component runs in a transition, so a callback that must not run in one is named like the
  plain React handler it is. Nothing else in the library is an `on*` prop."
- `src/pages/ComboboxPage.tsx` (8): "Typing is urgent" (~38 to 49, the sample
  `<Combobox.Root inputValue={text} onInputValueChange={(next) => setText(next)}>`), the Callout
  (~67 to 71, "Do not fetch in onInputValueChange"), the props table row (~207 to 210, type
  `UrgentChangeHandler<string, ComboboxInputValueChangeDetails>`, description starting "A
  handler, not an action: the urgent lane, called synchronously…"), ~532, ~636.
- `src/pages/RoadmapPage.tsx` (2, lines ~83 to 84) and a new release entry, following the
  `Toolbar.Button` precedent at ~137: "**Breaking:** `Combobox.Root`'s `inputValueChangeAction`
  is renamed `onInputValueChange` and the type `UrgentChangeAction` is renamed
  `UrgentChangeHandler`; an action prop always means a transition (#96)".
- `src/pages/ServerComponentsPage.tsx` (1, line ~148): "reported once through
  `onInputValueChange`".
- `src/examples/ComboboxDrink.tsx` (2, lines ~9 and ~25).
- `src/pages/HomePage.tsx` ~68 needs no change (it describes other libraries).

**Release**: alpha, breaking, no alias; the Roadmap entry is the changelog. Version bump is the
release skill's job, not this change's.

## Amendment: a Trigger click while open closes through the action (#112, 2026-10-24)

Status: architect decision; no API change, no new prop, no new `reason`. Edited in place:
decision 6, the anatomy table, section 1 (the `commandfor` bullet), 3.3 (props type and prose),
5.1, 5.4 row 1, walkthroughs 14 and 17, 11.2, 11.4, 12.1, 12.2, 14. The cross-component rule is
in conventions 3.5 (the light-dismiss trap under "a part's library-owned close is the single
source of that close") and the attribute mechanism in conventions 7.4.

Finding (wave 17 audit C1 / D1): the Trigger named no popover, so a press on it while the
listbox was open was a **light dismiss** (being the `source` would not have helped either, #123): the
platform hid the listbox at `pointerup`, in the task before the `click`, on every engine. The
click's `requestClose(click, "activate")` then ran against a popup already gone: the reason was
right, but nothing was awaited (5.4 row 1 and the docs said it was), a controlled parent that
refused the close saw the listbox hide and re-open (300 ms apart with an async action, one frame
with a sync one), and the `<ViewTransition>` exit never ran for this close. The `pointerdown`
snapshot existed only to make the click toggle in the right direction after that dismissal.

| | Before (every engine) | After (every engine) |
| --- | --- | --- |
| Press on the Trigger of an open listbox | light dismiss hides the popup at `pointerup` | not a light dismiss: the Trigger names the popup (`popovertarget` since #121, `commandfor` + `command="toggle-popover"` at #112; written after hydration) |
| Dispatch | `(false, "activate")` from the click, the hide's `toggle` an echo; the toggle direction from the `pointerdown` snapshot | `(false, "activate")` from the click, judged against `intended()` |
| While `openChangeAction(false)` runs | listbox gone; Trigger `data-pending` | listbox shown, options visible, input focused; Trigger `data-pending`, no `data-open` (exposed as expanded while shown, #121) |
| Controlled parent keeps `open={true}` | hidden, then re-shown when the action settles (a blink; exit and entry animations replay) | snap-back, nothing hidden (Popover 2.3's veto) |
| Rejection | listbox already gone, re-opened by the apply effect | listbox stays shown |
| `transition` exit | none (the popup was hidden before the close commit) | view transition |
| Before hydration | the Trigger is inert | unchanged: no invoker attribute in the server HTML; it arrives with the hydration commit |

Why the invoker attributes and not the other way round (accept the browser shape and correct 5.4
and the docs): conventions 3.5 says a part's library-owned close is the single source of that
close, and Menu's Trigger was just moved onto that rule (#110) for the focus-move trap; this is
the same class with a different trigger (light dismiss) and the fix is as contained. The
"pending state exposed" argument that chose the awaited close for Menu items and Triggers holds
here too: the Trigger is the one part that can show `data-pending` for the close, and the user
should see the listbox it is closing until the close has happened. The alternative would also
have left this the only overlay Trigger whose controlled close is not a veto.

Why written through the ref rather than rendered: product-owner decision 8 (no `commandfor` in
the server HTML; a pre-hydration click must not open an empty, button-anchored popup) stands.
The invoker relationship is only needed for light dismiss, which only exists once the library
has opened the popup, which only happens after hydration. The precedent is conventions 7.4's
`hidden="until-found"` upgrade and the JS-free Popover Trigger's `toggle`-driven DOM write. The
click is cancelled before anything else in the handler, so the command never runs, no matter
what the handler does afterwards; a consumer cannot pass `commandfor` / `command` (owned keys).

**Superseded by #121 (2026-10-24): the Trigger now writes `popovertarget`, the attribute every
other overlay Trigger renders; the exemption is the same, as this paragraph established.** Why
`commandfor` + `command="toggle-popover"` rather than `popovertarget`, at #112: it was the attribute
pair every other overlay Trigger rendered (`usePopoverTrigger`) and the one conventions 7.4
types. Both are exempt from light dismiss: HTML's "topmost clicked popover" takes the invoker's
popover from the button's popover target (`popovertarget`, or `commandfor` with a popover
command), and WebKit's `handlePopoverLightDismiss` checks `commandForElement()` and
`popoverTargetElement()` in that order (`Source/WebCore/dom/Document.cpp`, main, 2026-10-24).
The reviewer's probe verified Chromium and Firefox (`none` → closed, `commandfor` → stays open,
`popovertarget` → stays open). WebKit is verified by the CI job (12.2): the "Trigger close"
rows passed on WebKit with `commandfor` (branch CI run 40089882553), so the `popovertarget`
fallback was not needed.

By the spec only a popover command is exempt (HTML "get the target popover" returns null
unless the command is `toggle-popover`, `show-popover` or `hide-popover`). Chromium and Firefox
(Playwright builds, 2026-10) exempt any `commandfor` that names the popover, whatever the
command (a custom `--x`, none, or `close`). So the behaviour rows cannot tell the command apart,
and the jsdom and hydration attribute assertions are what pin `command="toggle-popover"`. We
write the spec's form so the exemption holds on a conformant engine; the click must always be
cancelled so that the command never runs. A disabled button is never exempt (step 2 of the same
algorithm; probed on Chromium and Firefox).

Disabled flavours differed while open (review F7, recorded behaviour then, no code change): a
native-`disabled` Trigger is not exempt, so a press on it light-dismisses the open listbox
(`"dismiss"`, as before #112); an `aria-disabled` `<button>` (component `render`) was exempt and
its cancelled click returned early, so a press on it did nothing and the listbox stayed open.
**Superseded by #132:** the ref writes `popovertarget` only while the Trigger is an invoker under
the shared rule (not disabled-and-focusable), so both flavours light-dismiss.

Chromium and WebKit expose an invoker relationship to accessibility: an implicit `aria-expanded`
derived from the popover, which the explicit attribute does **not** override (#118,
`docs/research/invoker-aria-expanded.md`; the next amendment renders the committed state so
every engine agrees), and `aria-details` when the popover is not DOM-adjacent. `aria-controls`
is unaffected; `Popover.Trigger` and `Menu.Trigger` have lived with the same relationship since
v0.

Considered and left alone:

- **Clear** stays a light dismiss (3.3, accepted deviation 5). Its close is browser-owned by
  design (nothing awaits it; the listbox is not re-opened), so the 3.5 rule, which protects
  library-owned closes, does not apply, and it behaves the same on every engine. Making Clear an
  invoker would change the designed outcome (the listbox would stay open after clearing), a
  separate product question, not a bug.
- **Other overlays with a Trigger.** Popover and Menu Triggers render `popovertarget` (#121; `commandfor` before): exempt
  through it (they are also the popover's `source`, which is no exemption, #123; popover.md's
  "Click on the Trigger" row; #110 was the focus trap, not this one). Dialog's Trigger is the dialog's invoker (`commandfor`,
  cancelled click), and the audit confirmed a non-modal light dismiss excludes it. Select's
  Trigger is the native picker's button inside the `<select>`: the picker is browser-owned
  throughout. Tooltip and Toast have no closing Trigger. A second Trigger in one Root (audit
  API3) is not supported and is out of scope here. Combobox was the only one.
- **Writing the attributes only while open.** Simpler to write them once at mount: a cancelled
  click on an invoker of a hidden popover does nothing either, and the AT relationship is then
  stable.
- **Keeping the `pointerdown` snapshot for non-button renders.** A Trigger that is not a
  `<button>` is already outside the part's contract ("should render a `<button>`"); a dev
  warning is enough, and the snapshot code would otherwise be dead on the supported path.

Implementation (developer), `packages/ui/src/combobox/combobox-trigger.tsx`:

1. Remove `openAtPress`, `onPointerCancel` and the `detail === 0` branch; `onClick` becomes
   `event.preventDefault()` first, then the `disabled` return, then
   `popover.intended() ? requestClose(native, "activate") : requestOpen(native, "activate")`,
   then focus the input. Remove `"onPointerCancel"` from the `Omit` list, add `"commandfor" |
   "command"`.
2. A ref callback composed with `useNameWarning`'s ref (or a layout effect reading it): when
   `element.tagName === "BUTTON"`, `element.setAttribute("commandfor", popover.ids.popup)` and
   `element.setAttribute("command", "toggle-popover")`; remove both in the cleanup. Otherwise,
   in development, warn once: "Combobox.Trigger: rendered a <x>. Only a <button> can name the
   listbox as its invoker; a press on this element while the listbox is open light-dismisses it
   before the click." Follow `useElementCheck` from `internal/use-element-check.ts`.
3. Update the part's doc comment (owned keys gain `commandfor`, `command`; lose
   `onPointerCancel`; drop the "No `commandfor`" sentence) and
   `packages/docs/src/pages/ComboboxPage.tsx`: the overview sentence at line 77 ("The Trigger
   has no `commandfor`"), the owned keys at 361, the `openChangeAction` row at 218 is now true
   as written, and the Trigger/Clear behaviour text at 364 may add "a Trigger click while open
   keeps the listbox shown until `openChangeAction(false)` settles".
4. Tests: the 12.1 Trigger row (jsdom: attributes present after mount and absent in
   `renderToString`, click `defaultPrevented`, refusing controlled parent, non-button warning)
   and the 12.2 "Trigger close" row plus the pre-hydration extension (browser, all three
   engines, unbranched). The jsdom popover shim does not light-dismiss, so the browser row is
   the one that proves the fix (conventions 3.5: "a browser row that asserts the reason and
   `document.activeElement` across the click is required").

## Amendment: `aria-expanded` renders the shown state (#118, 2026-10-24)

Status: architect decision; no API change. Edited in place: the anatomy table (Input and
Trigger), the 9 ARIA table, walkthroughs 1, 6 and 17, 12.2's Trigger-close row, conventions
feedback 6, and the #112 amendment's table and its "Chromium exposes an invoker relationship"
paragraph. The grounds and the engine table are in popover.md's amendment of the same name; the
rule is conventions 3.2 and decision 40.

For Combobox: `Combobox.Trigger` (an invoker after hydration, #112) and `Combobox.Input` (no
invoker, but the same listbox) both render `aria-expanded` from the Root's `shown` mirror of the Popup's `toggle` (revised
after review M1, below; `committed` for a day), the listbox being in the top layer; `data-open`, `state.open` on both parts and `children(state).open` stay
optimistic. The Input is included deliberately: it is the primary control, its explicit
attribute wins in every engine, and after the Trigger change it would otherwise say "collapsed"
during a pending close while the Trigger, the listbox and the other two engines said "expanded".
The APG's combobox pattern ties the attribute to the popup being visible, which is committed
state here. The #112 Trigger close therefore reads `aria-expanded="true"` with `data-pending`
and no `data-open` on the Trigger while the close is awaited with the listbox shown; a pending
open from typing (walkthrough 1) reads `"false"` on the input with `data-open` and `data-pending`
until the open commits, which for a sync `openChangeAction` is the same task.

Implementation: `combobox-trigger.tsx` and `combobox-input.tsx`, `"aria-expanded":
popover.shown` (was `popover.optimistic`, then `popover.committed` on the #118 branch); the doc comments' attribute lists say
"committed". Tests: `combobox.test.tsx`, the controlled refused Trigger close (`"true"` while
pending and after), the pending open on the input (`"false"` while pending, `"true"` after the
commit); `combobox.browser.test.tsx`, the #112 Trigger-close row (`"true"` at `pointerup` +
20 ms). `ComboboxPage.tsx`: the pending sentence and the `data-open` row's `aria-expanded`
aside. The Trigger's `commandfor` write (#112) is unchanged (it became a `popovertarget` write with #121).

Revision (review M1, 2026-10-24): `committed` was wrong for the Input. It is no invoker, so every
engine reads its attribute, and after Escape or a light dismiss it said "expanded" over the
hidden listbox, on the focused element, until the `"dismiss"` notification and anything entangled
with it (a pending save) settled: a regression from the optimistic `"false"` in Chromium and
WebKit too. Both parts now render the Root's **`shown`** mirror of the Popup's `toggle` (an
urgent `useState` in `useOverlayRoot`, written by `usePopoverPopup`, which `Combobox.Popup`
uses); see popover.md's revision of the same name for the mechanism and the phase table. For the
Combobox: Escape → listbox hidden, `aria-expanded="false"` on the Input and the Trigger one task
later while `data-pending` lasts; typing "j" → `"false"` until the `toggle` of `showPopover()`,
`"true"` then, which with a sync `openChangeAction` is the next task; the #112 Trigger close →
`"true"` until the close commits and hides (unchanged). Implementation: `popover.shown` on both
parts; tests as listed in popover.md's revision (the Escape row with a deferred close action, and
the entangled-save variant, belong here).

## Amendment: a press on the Input while open stays open (#123, 2026-10-24)

Status: architect decision; no API change, no new prop, no new `reason`; `onPointerDown` becomes
an owned key of `Combobox.Input`. Edited in place: decision 6, 3.2, 5.1, 5.4, 12.2, 14, the #112
amendment's two sentences that implied `source` mattered, conventions 3.5 (the `source` clause
and the pointer-capture lever) and the research probe table (`docs/research/select-combobox.md`
§6, with a correction note).

### Finding

Found by the #117 real-mouse rows. With the listbox open, a real press on `Combobox.Input`
light-dismissed it (Chromium at the `click`, Firefox at `pointerup`; WebKit runs the same
algorithm): `openChangeAction(false, { reason: "dismiss", event: <toggle> })`, focus and text
kept, the listbox gone under the user's caret click, and with `openOnClick` re-opened by the
click a task later (a blink and two dispatches).

Three documents said otherwise: 5.1 ("makes clicks on the input not light-dismiss"), the
research probe table ("Clicking the `source` does not light-dismiss") and conventions 3.5 (the
`source` listed among the light-dismiss exemptions). All three rested on one probe, and the
probe used a synthesised click, which has no `pointerdown` / `pointerup` and never runs light
dismiss. Re-probed with a real pointer in plain DOM (no library): an `<input>`, a plain
`<button>` and a `<span>` as `source` are all dismissed; only a `<button commandfor>` /
`popovertarget` survives.

### What the spec and the engines do

HTML "light dismiss open popovers" records, at `pointerdown`, the "topmost clicked popover" of
the event target and, at `pointerup`, hides every popover above the topmost clicked popover of
*that* target if it is the same one. "Topmost clicked popover" is the higher in the stack of two
things: the nearest inclusive **open popover** ancestor of the target in the flat tree, and the
nearest inclusive **target popover**, which comes from a button's `commandfor` (with a popover
command) or `popovertarget`. `showPopover({ source })` sets the popover's trigger (used to place
a nested popover under its invoker's popover in the stack) and the implicit anchor; the
light-dismiss path never reads it.

| Engine | Where it decides | Target used | Reads the `source`? |
| --- | --- | --- | --- |
| Chromium (`LightDismissFromClick`, stable) | at the `click`, comparing `FindTopmostRelatedPopover` of the `pointerdown` and `pointerup` targets it recorded (`PointerEventManager`, `MouseEventManager`) | the pointer events' dispatch targets, so pointer capture counts | no (`NearestOpenPopover`, `NearestTargetPopoverForInvoker`: `commandfor`, `popovertarget`, `interestfor`, select picker, base-appearance combobox) |
| Gecko | `EventStateManager::LightDismissOpenPopovers` at `pointerdown` / `pointerup` | the pointer event's target content | no (`nsINode::GetTopmostClickedPopover`: `GetEffectiveCommandForElement`, `GetEffectivePopoverTargetElement`, select picker) |
| WebKit | `PointerCaptureController::pointerEventWillBeDispatched` → `Document::handlePopoverLightDismiss` at `pointerdown` / `pointerup` | the element the pointer event is dispatched to | no (`commandForElement`, `popoverTargetElement` on buttons and button-type inputs, select picker) |

None of them checks `defaultPrevented`: a prevented `pointerdown`, `pointerup` or `click` changes
nothing (probed in Chromium and Firefox, every combination). An `<input type="text">` cannot be an
invoker by any route: `popovertarget` applies to button-type inputs only and `commandfor` to
`<button>` (and Chromium's `<menuitem>`).

### Options

| Option | Outcome | Verdict |
| --- | --- | --- |
| Accept the browser shape (document "a click in the field closes the listbox") | Engine-consistent and honest, but the user who clicks into the field to move the caret loses the list they were reading; with `openOnClick` the list blinks and dispatches twice. No library does this; APG says nothing because native listboxes never did it | rejected |
| Re-show after the dismissal | Hide, `toggle`, show: a blink, a `"dismiss"` dispatch that was not one, the `<ViewTransition>` exit and entry both run | rejected |
| `popover="manual"` with library light dismiss | Loses the platform's close watcher (Escape, decision 9 reversed), the auto stack (another auto popover opening elsewhere no longer closes the listbox; the listbox no longer closes with an enclosing Popover's stack) and `:popover-open`-driven nesting for free; the library would re-implement outside-press, Escape and stacking. A redesign of the Combobox popup model for one press | rejected |
| An invoker relationship | An `<input>` cannot be one | impossible |
| **Pointer capture to the Popup at the Input's `pointerdown`** | The release (`pointerup`, and the `pointerup` target Chromium records for the `click`) is dispatched to the Popup, whose topmost clicked popover is the listbox itself: nothing above it, nothing hides. One handler, `popover="auto"` and everything it gives stay | **chosen** |

### Verified (plain DOM, Playwright, Chromium 156 and Firefox 157; both engines unless noted)

| Case | Without capture | With `popup.setPointerCapture(pointerId)` at the input's `pointerdown` |
| --- | --- | --- |
| Mouse press and release on the input | hidden (`"dismiss"`) | shown; `pointerup`, `mouseup`, `click` dispatched to the popup; `mousedown` to the input |
| Caret: click after the third character | `selectionStart === 3` | `selectionStart === 3` (the compat `mousedown` is not retargeted) |
| Double click on a word | word selected | word selected |
| Drag from the second to the eighth character | `[2, 8]` | Chromium `[2, 8]`; **Firefox `[2, 2]`** |
| Drag from the input, released outside | Chromium shown (down and up targets differ), Firefox hidden | shown |
| Touch tap (`hasTouch`, `touchscreen.tap`) | hidden | shown (the touch compat `mousedown` / `click` arrive at the input after the release; Chromium's click-time comparison still sees the captured `pointerup`). **Chromium in a same-origin iframe: hidden** (#124, found by the developer; the event order is identical, the comparison misses the captured `pointerup`); Firefox in a frame: shown |
| Capture at `mousedown` instead | | mouse as above; **touch hidden** (its compat `mousedown` comes after `pointerup`): capture must be at `pointerdown` |
| Nested in an open outer auto popover | listbox hidden, outer kept | both kept |
| Right click (button 2, not captured) | Chromium shown, Firefox hidden | unchanged |
| `preventDefault()` on `pointerdown` / `pointerup` / `click` | hidden | n/a |

WebKit could not be run locally; it uses the pointer event's dispatch target, which its
`PointerCaptureController` overrides under capture, so the expectation is Chromium's. Its CI job
decides; if the press row alone fails there, the amendment is wrong about WebKit and the fallback
is to record a browser-shaped close for that engine, not to re-show.

### Decision

`Combobox.Input` owns `onPointerDown`: when `event.button === 0` and the Popup matches
`:popover-open`, `capturePointer(popup, event.pointerId)` (the Menu helper, moved to
`internal/pointer-capture.ts`: swallows the `NotFoundError` of a pointer the engine no longer
tracks, returns whether the capture was taken). Nothing else changes: no `preventDefault` (the
caret, selection and focus behaviour of the field are the platform's), no `pointerup` handler
(the engine releases the capture after `pointerup` / `pointercancel`), no change to the #111
press tracking (its document-level capture-phase `pointerup` listener still sees the release:
the Popup is in the document), no change to the Trigger (#112), Clear (deviation 5) or the Labels
(#111).

Why `:popover-open` and not `intended()`: a press during a pending close (the listbox still
shown, the close in flight) must not dismiss either; the pending close hides it in its commit, as
every key is judged against what the user sees (section 8). A press while the listbox is closed
captures nothing, so the `click` reaches the input and `openOnClick` works as before.

Why only the primary button: a right click on the field wants the field's own context menu
(cut, copy, paste, spelling), which the engines build from the hit test, and a middle click on
Linux pastes; retargeting their `pointerup` buys nothing and, in Chromium, `contextmenu` follows
pointer capture. In Firefox and WebKit a secondary-button press therefore still light-dismisses,
as it does today and as every auto popover does; it is not a case the #117 rows cover.

Consequences, stated:

- For a mouse or pen press on the open field the `click` is dispatched to the Popup, not the input
  (a touch tap's compat `click` comes after the release and is hit-tested: it reaches the input,
  where `openOnClick`'s `requestOpen` while open is a no-op): the Input's
  `onClick` (`openOnClick`) does not run for it (correct: there is nothing to open), and a
  consumer `onClick` on the Popup sees a click whose `pointerdown` was on the input. Options are
  not affected (their `onClick` needs the target inside them).
- **Firefox: drag-to-select in the field does not extend while the listbox is open.** Gecko
  routes the mouse drag to the pointer-capturing element; Chromium's selection drag ignores
  capture. Shift+click, Shift+arrows, the double click and the keyboard still select, and typing,
  the caret click and Escape are unaffected. Accepted as the cost of the lever: the alternative
  (no capture) closes the listbox on every click into the field, in every engine. Recorded in
  5.4, conventions 3.5 and the research note; not a Gecko bug by any spec text (Pointer Events
  does not define selection), so nothing to report upstream, but worth re-checking when Gecko's
  pointer capture changes.
- **Chromium, touch, inside a same-origin iframe: the tap still closes the listbox** (#124,
  upstream, a human reports it). Top-level touch, mouse in a frame and Firefox are unaffected.
  Not worked around: the only levers left are the rejected ones (re-show, `manual`). The docs page
  carries a one-line caveat so a Storybook or sandbox preview on a touch device is not reported as
  a library bug; the browser row asserts the close with #124 named so it fails when Chromium
  changes.
- Pass-through handlers on the Input see a different event set during a primary mouse or pen press
  while the listbox is open: the Input's `onPointerUp`, `onMouseUp` and `onDoubleClick` do not
  fire (those events go to the Popup; `onMouseDown` still fires), and the Input gets
  `pointerleave` / `mouseleave` (and `pointerenter` / `mouseenter` again after the release) as the
  pointer's boundary events cross to the Popup and back. `:hover` is unaffected. Stated in the
  docs page's Input note (#123 review).
- `gotpointercapture` / `lostpointercapture` fire on the Popup for each such press; harmless.
- A consumer who needs `onPointerDown` on the field listens on a wrapper, as for the Popup's
  owned `onPointerDown` (3.4).

### Implementation (developer)

1. `internal/pointer-capture.ts`: move `capturePointer` out of `menu/menu-dom.ts` (re-export or
   update the Menu's imports; the jsdom `pointer-capture-shim.ts` keeps working).
2. `combobox-root.tsx`: `inputPointerDown(event: PointerEvent)`: `if (disabled || event.button
   !== 0) return; const popup = popover.popupRef.current; if (popup !== null &&
   isPopoverOpen(popup)) capturePointer(popup, event.pointerId);`. Expose it on the context.
3. `combobox-input.tsx`: add `"onPointerDown"` to the `Omit`, `onPointerDown: (event) =>
   ctx.inputPointerDown(event.nativeEvent)` to `libraryProps`, list it in the owned keys of the
   doc comment, and correct the ref-callback comment ("makes clicks on it not light-dismiss" is
   wrong: the registration is for the anchor and the nested stacking).
4. Docs (`packages/docs/src/pages/ComboboxPage.tsx`): the overview sentence "clicks on the input
   never light-dismiss it" (line 74 today) becomes "a press on the input keeps the listbox open
   (the Input captures the pointer to the Popup; in Firefox a drag-to-select in the field does
   not extend while the listbox is open)"; the Input's owned keys gain `onPointerDown`.
5. Tests. jsdom (`combobox.test.tsx`): `setPointerCapture` spied through the shim, called once
   with the Popup element and the pointer id for a `pointerdown` with `button: 0` while the
   popup is open (the shim's `:popover-open`), not called while closed, not for `button: 2`, not
   while `disabled`; `openOnClick` still opens from a click while closed. Browser
   (`combobox.browser.test.tsx`): flip the #117 row "the input (the popup's source)" from
   `it.fails` to `it` and rename it ("the input: nothing closes or dispatches; the input keeps
   focus and its text"), then add the 12.2 "Input press" row's extras: caret at 3, nested in
   `Popover.Popup`, touch tap, and the drag-selection row with the Firefox branch. Firefox runs
   browser files serially (#62), so the drag's pointer input is safe there.

## Amendment: `popovertarget` Trigger, no `aria-expanded` (#121, 2026-10-24)

Status: architect decision, user-approved through the product owner. **Breaking (DOM attributes
only; no prop or type change beyond two more omitted keys).** After hydration a `<button>`
`Combobox.Trigger` writes `popovertarget` (the Popup's id) through its ref instead of
`commandfor` + `command="toggle-popover"` (#112's mechanism, same timing, same cleanup), and it
renders **no `aria-expanded`**: once the attribute is there, Chromium, Firefox and WebKit expose
the listbox's shown state from the popover itself (HTML-AAM `popovertarget` mapping; measured in
`memo/architect/probes/121-popovertarget/`), ARIA in HTML #514 forbids the explicit attribute on
such a button, and Firefox ORs an explicit value in. Before hydration the button exposes no
state (it has neither attribute); the **Input keeps its explicit `aria-expanded` from
`popover.shown`** (`role="combobox"` requires it; it is no invoker) and is the widget's primary
control, so the pre-hydration gap on a `tabindex="-1"` button is accepted. A non-button `render`
is no invoker (#112's warning) and renders `aria-expanded` from `popover.shown` (#118) so a
link-shaped Trigger still exposes the state. `ComboboxTriggerProps` omits `popoverTarget` /
`popoverTargetAction` as owned keys next to the reserved `commandfor` / `command`. Grounds and
trade-offs: `memo/architect/eval-121-popovertarget.md`; the cross-component rule is conventions
decision 41; Popover's amendment of the same date carries the full implementation and test plan.
Edited in place: the anatomy table, section 1's Trigger bullet, 3.3 (props type and prose), the
11 walkthroughs' Trigger lines, 12.1's Trigger row, 12.2's Trigger-close and pre-hydration rows,
the deviations list, and the #112 amendment (its table and the "why `commandfor`" paragraph,
marked superseded).

Verified unchanged for `popovertarget` (the #112 guarantee): a press on the Trigger of the open
listbox is not a light dismiss in Chromium and Firefox (real pointer, popup shown with
`source: input`, click cancelled: `:popover-open` at `pointerup` + 20 ms and after) and in WebKit
by source (`handlePopoverLightDismiss` checks `commandForElement()` then
`popoverTargetElement()`); a native-disabled Trigger is still not exempt; a cancelled click never
runs the activation, with a mouse, Enter or Space; the listbox stays anchored to the input.

Combobox-specific implementation: `combobox-trigger.tsx`'s ref callback writes
`element.setAttribute("popovertarget", popupId)` on a `<button>` and removes it in the cleanup
(the `command` write and removal go); `libraryProps` drops `"aria-expanded"` for a button render
and keeps `popover.shown` for a non-button one (`rendersButton(render)`, as `usePopoverTrigger`);
the `Omit` list gains `"popoverTarget" | "popoverTargetAction"`. `combobox-input.tsx` is unchanged.
Tests: `combobox.test.tsx` asserts `popovertarget` after mount, none in `renderToString`, none on a
non-button render (which asserts `aria-expanded` from `shown` instead), and **no `aria-expanded`**
on the button Trigger in the controlled refused-close, pending-open and Escape rows, whose Input
assertions are unchanged (22 attribute sites, about half of them the Input's and kept);
`combobox.browser.test.tsx`'s Trigger-close and pre-hydration rows swap the attribute name and
add the Chromium AX sample. `ComboboxPage.tsx`: the overview sentence, the owned keys and the
`data-open` row's `aria-expanded` aside.

## Amendment: a press on a foreign invoker is not focus leaving (#126, 2026-10-25)

Status: architect decision; no API change, no new prop, no new `reason`. Edited in place:
decision 6, 5.4 (a new "Foreign invoker click while open" row and the paragraph after the table),
12.2's Focus loss row, the 14 Input-handlers bullet. The cross-component rule is in conventions
3.5; Menu's amendment of the same date carries the engine table and the grounds
(`memo/architect/issue-126-foreign-invoker-press.md`, probe in
`memo/architect/probes/126-foreign-invoker-press/`, which includes the Combobox shape: an input
outside the popup as the focus holder, shown with `source: input`).

The case: a consumer's own `<button popoverTarget={popupId}>` (or `commandfor` + `toggle-popover`
/ `hide-popover`) pressed with a real mouse while the listbox is shown. Chromium and Firefox focus
it on `mousedown`; the Input's `focusout` (`relatedTarget` = the button) ran `leave()`: the
listbox hidden as `"dismiss"`, the text reverted (or the custom value committed), and the click's
native toggle then re-showed the hidden listbox with the input blurred. WebKit, which does not
focus a button on click, took the intended path: input focused, the click's toggle hides the
listbox, `"activate"` from `ToggleEvent.source` (#125), text untouched.

Rule: `Combobox.Popup` keeps a document capture `mousedown` listener alive while shown that calls
`preventDefault()` for `button === 0` when the target's closest `<button>` is outside the popup
and names it (`popoverTargetElement === popup`, or `commandForElement === popup` with a
`*-popover` `command`). Every engine then ends as WebKit did: the input keeps focus, no `focusout`,
no revert, the click's native toggle closes the listbox as `"activate"`; a dragged-off press
leaves the listbox shown with the input focused. It is the rule the Combobox's own Trigger and
Clear already follow ("the input must keep focus", 3.3, conventions 3.5), applied to a button the
library does not render but which names its popup. A plain foreign button is unchanged: focus
leaves, the listbox closes as `"dismiss"`, the text reverts or commits (5.4). A Tab onto a foreign
invoker is unchanged too: focus leaving, `"dismiss"`; the guard is a `mousedown` rule.

Rejected (as for Menu): the `focusout` path ignoring an invoker `relatedTarget`. For Combobox it
is worse than for Menu: the input would be blurred with the listbox shown, and `leave()`'s second
duty (the text revert / custom commit) would have to run or not run on a guess.

Implementation (developer): `combobox-popup.tsx` passes an `onToggle` to `usePopoverPopup` that
starts `listenInvokerPresses(popup)` (`internal/invoker-press.ts`, shared with Menu) when
`newState === "open"` and the popup is `:popover-open`, and stops it on `"closed"` and unmount
(since #129: a `whileShown` installer, the hook owning the same lifecycle, and the module is
`internal/invokers.ts`);
`combobox-root.tsx` and `combobox-input.tsx` are unchanged. The docs page's `openChangeAction`
row gains one sentence as Menu's.

Tests. jsdom (`combobox.test.tsx`): with the listbox open, `fireEvent.mouseDown` on a foreign
`<button popovertarget={popupId}>` is `defaultPrevented` and the input stays focused; not on a
plain button, not while closed; the #125 foreign row keeps `foreign.click()`. Browser
(`combobox.browser.test.tsx`, Chromium, Firefox and WebKit, real pointer): type unmatched text
("Jamaicax", `allowCustomValue` off), then `user.click(foreign)`: the listbox is not
`:popover-open`, `openChangeAction` since the open is exactly `[(false, "activate")]` with the
`beforetoggle` `ToggleEvent` whose `source` is the button, **the input text is still "Jamaicax"**
(no `leave()`), `document.activeElement === input`, and no `(true, …)` follows within 100 ms; a
dragged-off press leaves the listbox shown, input focused, nothing dispatched. Mutation check: with
the listener removed, the Chromium and Firefox rows fail (`"dismiss"`, text reverted, re-open on
Firefox), the WebKit row passes.

## Amendment: `Combobox.Input` owns `onFocus`; the CSS exit recipe applies here (#132, 2026-10-25)

Status: architect decision on two wave 18 audit findings (`memo/reviewer/wave18-audit-source.md`
S10, `memo/technical-writer/wave18-docs-audit.md` D3). Edited in place: 3.2 (props type and owned
keys), 11.3, 11.4, 12.2, 14. Notes: `memo/architect/issue-132.md`.

**S10: `onFocus` is omitted from `ComboboxInputProps` and listed as owned.** #111 made the Input
install a prop-form `onFocus` (it starts the press watch that decides whether a `focusout` with
no `relatedTarget` is a leave) without updating 3.2, which still said `onFocus` passes through.
Today a consumer's `onFocus` is chained before the library's (conventions 1.2 merge order), so
nothing breaks at runtime; the type is the inconsistency: `onBlur` refused, `onFocus` accepted.
Conventions 1.5 is a blanket rule, "the library's own prop-form event handlers are omitted from
the type", and every other part follows it (`Tabs.Tab` installs and omits `onFocus`; `Menu.Popup`,
`Tabs.List`, `Toast.Viewport`, `ToggleGroup.Root`, `Toolbar.Root` omit it). The alternative, keep
accepting it and document it as "owned, chained", would create a third category of handler
("installed by the library but passed through") that 1.5 would have to define and every part
would then have to classify its handlers against; a passive handler today can grow a
`preventDefault()` tomorrow. Not worth it for one key. A types-only breaking change, allowed in
alpha; the runtime is unchanged. What a consumer who reacts to focus does instead: `onFocusCapture`
(a DOM event prop the part does not use, 1.5) or the function form of `render`.

Implementation (developer): `combobox-input.tsx`: `"onFocus"` in the `Omit`; the doc comment's
owned-key list gains `onFocus`. `combobox.test.tsx`: a `// @ts-expect-error -- owned key` line
for `onFocus` next to the existing one. Docs (`ComboboxPage.tsx`, the Input's `PartFacts`): add
`onFocus` to the owned list; the note gains "`onFocusCapture` passes through".

**D3: the "cut the CSS exit while a view transition runs" rule applies to Combobox** (and Menu;
see the Menu amendment of the same date). Confirmed two ways: by construction, since
`Combobox.Popup` wraps the popover element in the boundary and `usePopoverPopup` runs
`hidePopover()` in the layout effect of the close commit exactly as `Popover.Popup` does; and by
a Chromium and Firefox probe of the docs' CSS shape (11.4). The docs and the playground must add
the rule: `html:active-view-transition .demo-combobox-popup { transition: none; }`
(`packages/docs/src/examples/combobox.css`) and `html:active-view-transition .cb-popup {
transition: none; }` (`packages/example/src/combobox-demo.css`), with ComboboxPage's Styling
section carrying the one-line CSS and the Chromium double-image reason, or a link to the general
statement if the technical writer moves it to the Transitions page (recommended: the rule is
general, conventions 5.1, and four pages now repeat it). A permanent browser row (12.2) is
recommended so the Combobox gets what the shared overlay suite already gives Popover, Dialog and
Menu.

## Amendment: a disabled, focusable Trigger is no invoker (#132, from the #128 review F1, 2026-10-25)

Status: architect decision; a DOM-attribute change in one narrow case, no prop or type change.
Edited in place: 3.3, the #112 amendment's F7 paragraph (superseded), 12.1's Trigger row, 14's
Trigger bullet; conventions decision 41. Notes: `memo/architect/issue-132.md`.

The gap (`memo/reviewer/issue-128-review.md` F1): `Popover.Trigger` and `Menu.Trigger` render
`popoverTarget` only while `disabledButton(...).invoker` is true, so a Trigger that is disabled
and still focusable (`aria-disabled="true"` on a link or component `render`, button.md 17) is no
invoker (#83 M1, #115), and the docs state that as the rule for every overlay Trigger.
`combobox-trigger.tsx`'s ref wrote `popovertarget` on any `<button>`, so a disabled component
render of `Combobox.Trigger` stayed an invoker after hydration; the #112 amendment had recorded
the consequence (F7: a press on it while the listbox is shown did nothing instead of
light-dismissing) as behaviour, not as a decision.

Decision: follow the shared rule. The ref writes `popovertarget` only when the element is a
`<button>` **and** `disabledButton(render, disabled).invoker` is true; `aria-expanded` follows the
same test (`invoker ? undefined : popover.shown`), as `use-popover-trigger.ts` does. Grounds:
(1) one rule for every overlay Trigger (conventions decision 41 is written as one; the docs page
on browser-owned state teaches it as one); (2) a disabled control is inert, and a press on an
inert element while the listbox is shown is a press on the page, so light dismiss (`"dismiss"`)
is the right outcome, which is what the native-`disabled` flavour already does (F7), so the two
disabled flavours now agree inside Combobox as well; (3) the only thing the invoker relationship
bought a disabled Trigger was the implicit expanded state, which the explicit `aria-expanded` from
`popover.shown` provides equally (#118). The case is narrow (a component `render` with
`disabled`), so the visible change is small; nothing changes for the default `<button>` (native
`disabled`, invoker, non-exempt by the browser's own check) or for an enabled Trigger.

Implementation (developer): `combobox-trigger.tsx`: compute `const { props: disabledProps,
invoker: enabledInvoker } = disabledButton(render, disabled)` once; the ref's guard becomes
`element.tagName !== "BUTTON" || !invoker` with `invoker` in the `useCallback` dependencies (React
runs the cleanup and the new ref on a change, so a flip of `disabled` adds or removes the
attribute); `"aria-expanded": invoker && rendersButton(render) ? undefined : popover.shown`;
the doc comment names the rule. Tests (`combobox.test.tsx`, jsdom): the 12.1 Trigger row's new
clauses: `disabled` with `render={<MyButton />}` has `aria-disabled="true"`, no `popovertarget`,
`aria-expanded="false"` (and `"true"` once the listbox is shown through typing), a cancelled click
that opens nothing; re-render with `disabled={false}`: `popovertarget` present and `aria-expanded`
gone; the native-`disabled` host button keeps `popovertarget`. Optional browser row
(`combobox.browser.test.tsx`): a real press on the disabled component-render Trigger of a shown
listbox light-dismisses it (`(false, "dismiss")`, input keeps focus), on all three engines. Docs:
`BrowserOwnedStatePage.tsx`'s "a disabled Trigger that stays focusable is no invoker either"
becomes true as written; ComboboxPage's Trigger owned-keys note gains "(while enabled, or
natively disabled; not while `aria-disabled`)" next to `popoverTarget`.
