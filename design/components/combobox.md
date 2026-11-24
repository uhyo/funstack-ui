# Combobox

Status: **accepted**, implemented. History (decisions, review revisions, amendments,
implementation notes, the test plan): `design/CHANGELOG.md`, parts "combobox.md". Follows
`design/conventions.md`
(accepted); where this document and the conventions disagree, the conventions win. **Read
`design/components/popover.md` and `design/components/menu.md` first**: Combobox is built on
the same internal hooks (`usePopoverRoot`, `usePopoverPopup`, `useActionTrigger`), the same
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
| 3 | Two library-owned states, two lanes | `value` (`string \| null`): `value` / `defaultValue` / `valueChangeAction`, a transition with `useOptimistic`, as every other value. `inputValue` (`string`): `inputValue` / `defaultInputValue` / `onInputValueChange`, the **urgent** state the vision reserved for this component (section 4). Same `x` / `defaultX` pair, different lane, and a **handler** instead of an action: `onInputValueChange` is the library's one `on*` prop, named as a handler because it is called synchronously in the event and never wrapped in a transition (conventions 2.1, 2.6). `fooAction` keeps meaning "a transition" everywhere. |
| 4 | Results | The library filters nothing. `query` is `useDeferredValue(inputValue)`; `Combobox.List`'s function `children` (and Root's) receive `{ query }` and render the `Option`s for it, under a consumer-owned `<Suspense>` for async search. While `inputValue !== query` the Popup and List carry `data-stale`; the List is `aria-busy="true"` while stale **or loading** (a `Status` mounted inside it, 6.3); the previous results stay visible. No out-of-order results: React renders only the latest deferred value (section 6). |
| 5 | Active option | `aria-activedescendant` on the input, never DOM focus on options (research). The active option is **urgent library state** (it is focus; focus is never a transition anywhere in the library), exposed as `data-active` on the Option, revalidated whenever the mounted options change; ids are derived from the value so an option keeps its id across result sets. Typing, Home, End, Left and Right clear it (APG: visual focus returns to the textbox), so Enter never accepts an option the user has typed past; `autoHighlight` (default `false`) activates the first option only once results settle (not stale, not loading; 6.5). |
| 6 | Open | Always library mode (`usePopoverRoot({ mode: "library" })`, Menu's configuration): no JS-free mode. Open by typing, ArrowDown / ArrowUp, Alt+ArrowDown, the Trigger, optionally a click on the input (`openOnClick`); opened with `showPopover({ source: input })` in the apply effect. Closes: an accepted option and a Trigger click while open (library-owned, after the action settles; the Trigger is an invoker of the popup after hydration, so its press is not a light dismiss), Escape, light dismiss and a Clear click while open (browser-owned, notified `"dismiss"`), focus leaving the input and popup (immediate `hidePopover()`, Menu's Tab rule, `"dismiss"`). Keys are judged against `:popover-open`, what the user sees (section 8). A press on the input while open is **not** a close: `source` is no light-dismiss exemption, so the Input captures the pointer to the Popup at `pointerdown` while the listbox is shown. A press on a **foreign invoker** of the popup (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names it) is not focus leaving either: the Popup prevents its primary `mousedown` while shown, the input keeps focus and the click's native toggle closes the listbox as `"activate"`. |
| 7 | Accepting an option | Enter or click on an option: the input text becomes the option's label **at once** (urgent), the option shows `data-pending`, `valueChangeAction` is awaited inside the Root's transition, and the listbox closes in the commit that ends it (Menu decision 3). A rejection rolls the text and `data-selected` back and leaves the listbox open; a controlled parent that does not adopt the value gets the same rollback but the listbox closes (5.5); typing while the action is pending drops its close (5.2). Tab does **not** accept (manual selection; question 5). |
| 8 | Free text | `allowCustomValue`: Enter with no active option, or focus leaving, commits the text as the value (`details.custom: true`). Without it the text reverts on focus loss to the committed value's label (React Aria's rule). |
| 9 | Form | `name` / `form` on Root render `<input type="hidden" name value={optimistic ?? ""}>`; `required` goes on `Combobox.Input` and is native (empty text is `valueMissing`). No `setCustomValidity` (conventions 3.6). Form reset dispatches `"platform"` for both states, with reset targets computed in JS (a hidden input has no reset behaviour, 11.1); a pre-hydration typed text is reconciled at mount for `inputValue`. |
| 10 | Positioning | Inline `position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)` on Popup (`self-*` logical keywords: the listbox follows the popup's own inherited direction, so a `dir="rtl"` container flips it as a page-level `dir="rtl"` does, 7.2; v1 used the plain `block-end span-inline-end`, which resolves against the root). No `side` / `align`: a listbox goes below or above its input. No `data-side`. `style` overrides. |
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
| `Root` | none, or `input[type=hidden]` when `name` is given | | `state` in `children(state)` | Owns `useId`, both state hooks, the deferred query, the active option, the open state (`usePopoverRoot`), the Option and Status registries, the label cache, the form-reset listener. No `ref`, `className`, `style`. |
| `Label` | `label` | | | `htmlFor` → the Input's id (owned); `id` → the List's `aria-labelledby`. |
| `Input` | `input` | `combobox` | **urgent** text, optimistic `value` for `data-selected`, optimistic open for `data-open`, shown open (the Root's `shown` mirror) for `aria-expanded` | `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`, `autocomplete="off"`, `data-open`, `data-pending`, `data-selected`, `data-disabled`. The Root's `pending` lands here (the owner renders no element). |
| `Trigger` | `button` | button | optimistic open (`data-open`); no `aria-expanded` on a `<button>` (the browser exposes the listbox's state once `popovertarget` is written) | Optional. `tabindex="-1"` (APG: not in the Tab sequence), `aria-controls`; click toggles and focuses the input. `popovertarget` written through the ref after hydration, never server-rendered, every click cancelled (section 1, 3.3). |
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
- **`Trigger` renders no invoker attribute, and becomes an invoker after hydration (`popovertarget`).** A
  declarative invoker in the server HTML would act before hydration: a click would open an
  empty popup anchored to the button, with the button's `anchor-size(width)`. So the server HTML
  has none. After hydration the Trigger writes `popovertarget` (the Popup's id)
  through its ref and cancels every click, so the activation never runs
  (the popup is always opened by the library with `source: input`) and, because the button names
  the shown popover, a press on it is **not a light dismiss** (HTML's "topmost clicked popover";
  conventions 3.5). Without the attributes the browser hid the listbox at `pointerup`, before
  the click's `openChangeAction(false)` could run (section 3.3).
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
| `open` | Root (`usePopoverRoot`, library mode) | the listbox is shown | transition | Library-owned for opens and for the close after an accepted option; browser-owned for Escape and light dismiss (facts, `onOpenChange`); library-performed immediate close on focus loss (Menu's Tab rule; a fact too). 5.6. |
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
(conventions 2.6). The yield is then followed by the rethrow, so the error still
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
  /** As Popover, requests only: awaited for opens and for the close after an accepted option. Never called for a dismissal. */
  openChangeAction?: ChangeAction<boolean, ComboboxOpenChangeDetails>;
  /** As Popover, facts only: a dismissal (Escape, focus leaving, light dismiss, a foreign invoker). Always `false`; synchronous, not awaited (5.6). */
  onOpenChange?: UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>;

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
`disabled`, the handlers listed in the `Omit` (`onPointerDown`: a primary-button
press while the listbox is shown captures the pointer to the Popup, so the release is not a light
dismiss, 5.4; `onFocus`: it starts the press watch that `onBlur` relies on, so the
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
is not, because after hydration the Trigger is an invoker of the popup (next paragraph).

Trigger: `aria-controls`, `data-open`, `data-pending`, and **no `aria-expanded` on a `<button>`**
(once `popovertarget` is written every engine exposes the listbox's shown state from the
popover itself; before hydration the button has no state, and the Input, the widget's primary
control, keeps its explicit `aria-expanded`; a non-button `render` renders `aria-expanded` from
`popover.shown`); click toggles the
listbox and focuses the input. After hydration the Trigger writes `popovertarget` (the Popup's id)
through its ref callback (`setAttribute("popovertarget", id)`, lowercase), onto a `<button>` only (HTML defines
the invoker exemption below for buttons; a `render` that produces another element gets a dev
warning and keeps a browser-shaped close) **and only while it is an invoker under the shared rule**
(not while it is disabled and focusable, that is `aria-disabled` on a component `render`,
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
same path. An icon-only Trigger needs an `aria-label` from the consumer (dev warning when it has no
accessible name, as Popover's Popup).

Clear: click writes `""` (urgent) and dispatches `valueChangeAction(null, { reason: "activate",
custom: false })` unless the optimistic value is already `null`. While the listbox is open the
press is a light dismiss: the listbox closes as a `"dismiss"` fact and is **not
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
   `void`, documented as synchronous and not awaited). It is a **fact** (conventions 2.1): the
   browser has written the keystroke before the library hears of it. `fooAction` always means
   "the component runs this in a transition", so a callback that the component must *not* run
   in a transition cannot carry the suffix. Not chosen: `inputValueAction` (reads as a pure
   trigger); and `onInputChange` without `Value` (the state name must be exactly the controlled
   prop's name, conventions 2.1).
2. **The library calls it synchronously, outside any transition**, from the `input` event
   handler and from its own writes (2.2), after it has set its own `useState` for the text.
   The consumer's body runs in the event, so a controlled parent's `setInputValue(next)` is an
   urgent update, which is what React requires for the value prop of a text input.
3. **Not awaited, no pending, no optimistic.** The text is already in the DOM when the action
   runs; there is nothing to wait for and nothing to roll back. A returned promise is allowed
   and not awaited: its rejection, and a synchronous throw, go to `reportError` (the handler
   rule, conventions 2.1). Development does not warn for a returned promise.
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

`usePopoverRoot({ component: "combobox", mode: "library", details: popoverDetails })`: always
library mode. The popup is
shown by the apply effect with `showPopover({ source: inputRef.current })`, which (research §6
probe table) keeps focus in the input, lets typing continue, nests the popup under the input's
popover ancestor, and creates the implicit anchor the inline `position-area` and
`anchor-size(width)` use. It does **not** exempt a press on the input from light dismiss: `source`
plays no part in HTML's "topmost clicked popover", and the research's claim that it did came from
a synthesised click. The Input keeps the listbox open across its own presses with pointer
capture (5.4).

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
| Accepted option (after its action settles), Trigger click while open, controlled `open={false}` | library | `requestClose`; `hidePopover()` in the apply effect of the close commit; `<ViewTransition>` if set. The Trigger's press does not light-dismiss first (it is an invoker of the popup after hydration, 3.3): the listbox stays shown, input focused, Trigger `data-pending`, until `openChangeAction(false)` settles; a refusing controlled parent keeps it shown (5.5) | `"activate"` (controlled: no dispatch) |
| Escape while open | browser (the auto popover's close watcher) | hidden at once; focus stays in the input (research); `toggle` → the fact (`onOpenChange`). The library does **not** intercept Escape: a second Escape therefore reaches an enclosing Dialog or Popover, which is the nesting behaviour a user expects | `"dismiss"` |
| Light dismiss, another `auto` popover or modal dialog opening outside | browser | a fact; focus wherever the platform left it; text reverted on the `focusout` that preceded it, if any | `"dismiss"` |
| Focus leaving the input to anything outside the popup (Tab, Shift+Tab, a click elsewhere, script) | library-performed, browser-shaped | the Input's `focusout` with `relatedTarget` outside the input and the popup → `popup.hidePopover()` at once (Menu 2.2: a listbox must not linger over a page whose focus moved on), then the text revert or the custom-value commit of 5.3; `toggle` → the fact. `relatedTarget === null` closes nothing synchronously. If a pointer is down (the blur came from a `mousedown`), the check runs one task after that press is released (`pointerup` or `pointercancel`); a `<label for>` (Combobox.Label, Field.Label) refocuses the input in the release's click, so a label press of any length keeps the text. Without a press (script blur) it runs a task later. In both cases, if `document.hasFocus()` and the active element is outside the input and the popup, the revert or custom commit runs; the light dismiss has already closed the listbox (a label press closes it too, the label being outside the popup); a window blur stays a no-op. Nothing runs while `disabled` | `"dismiss"` |
| Clear click while open | browser (light dismiss: the button is outside the popup) | a fact; the listbox is not re-opened; the text is emptied and `null` dispatched as 3.3 | `"dismiss"` |
| Foreign invoker click while open (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names the popup) | browser | the Popup prevents the button's primary `mousedown` while shown, so the input keeps focus and the focus-leaving row above cannot pre-empt the click; the press is light-dismiss exempt (conventions 3.5); the click's native toggle (or `hide-popover`) hides the listbox; the text is untouched; notified from `toggle` with the `ToggleEvent` (the `CommandEvent` for `commandfor`) whose `source` is the button | `"activate"` |
| Alt+ArrowUp while open | library | the active option, if any, is accepted (APG optional behaviour); else `requestClose` | `"activate"` |

A click on an option or anywhere in the popup is not focus loss: `pointerdown` and `mousedown`
are prevented on the Popup (3.4), so the input never blurs and `focusout` never fires. A
`focusout` whose `relatedTarget` is the Trigger or Clear cannot happen for the same reason, nor
one whose `relatedTarget` is a foreign invoker of the popup pressed with a pointer (the
Popup's document capture `mousedown` listener, alive while shown, prevents the default for the
primary button when the target's closest `<button>` is outside the popup and
`popoverTargetElement === popup`, or `commandForElement === popup` with a `*-popover` command).
A Tab onto such a button is still focus leaving, and a plain foreign button's press too.

A press on the **input** is not a close either, although the input is outside the popup and can
name no popover. Light dismiss compares the popover under the press with the popover under
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
listbox open (a real veto); one that refuses a dismissal gets it re-opened at once, with the
input still focused (not a veto; conventions 3.9.4). Overlapping
value dispatches follow latest intent; `data-pending` and `data-selected` move to the latest
option; the close waits for the latest. A rejected `openChangeAction(true)` leaves the listbox
closed with the typed text intact.

A controlled **`value`** parent that does not adopt an accepted option (an "update on success"
parent whose save failed and was caught) gets the rollback of 2.2, text and `data-selected`
revert with no error, and the listbox **closes**. Non-adoption is only visible in the commit
that ends the action, which is the commit that closes; deferring the close until the library
knows would split it from that commit and from its view transition. Only a rejection keeps the
listbox open.

### 5.6 Requests and facts: which cause goes where

The Root has three states in three shapes, each for a stated reason: `value` (requests only,
`valueChangeAction`: nothing but the library changes it), `inputValue` (facts only,
`onInputValueChange`: the browser writes every keystroke), `open` (both: parts ask, the browser
dismisses; conventions 3.9).

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Typing; ArrowDown / ArrowUp / Alt+ArrowDown while closed; Trigger click while closed; a pointer click in the input with `openOnClick`; a foreign open | `openChangeAction` | `true` | `"activate"` |
| Found open at mount (only script can cause it here) | `openChangeAction` | `true` | `"platform"` |
| The close after an accepted option (after `valueChangeAction` settled); re-accepting the selected option; Trigger click while open; Alt+ArrowUp | `openChangeAction` | `false` | `"activate"` |
| Escape while open | **`onOpenChange`** | `false` | `"dismiss"` |
| Focus leaving the input to outside the popup (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside; a `Clear` click while open (the button is outside the popup) | **`onOpenChange`** | `false` | `"dismiss"` |
| A foreign invoker button closing the listbox | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |

- What a close *also does* stays on its own channel: the text revert or the custom-value commit
  after focus leaves (`valueChangeAction`, 5.3), the `Clear` dispatch of `null`.
- **An accepted option's `valueChangeAction` is pending and the user presses Escape.** The fact
  closes the listbox at once. The value action is a different state: it is not superseded,
  keeps `data-pending` and commits or rolls back; its continuation requests no close (nothing
  is open; open-generation guard).
- `aria-expanded` on the Input is the `shown` mirror; `data-open` on Input and Trigger is
  optimistic (conventions 3.9.7).
- Controlled `open` with a refusing parent: the listbox re-opens at once after Escape, with the
  input still focused. Controlled `open` on a Combobox is rare; it needs
  `onOpenChange={setOpen}` (development warns without it).
- `onInputValueChange` follows the handler rule (conventions 2.1): it may return a promise,
  which is not awaited and not warned about; a rejection and a synchronous throw go to
  `reportError`, and the text write and everything after it still happen.

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

Implementation rule: the announcement effect reads the option count **and the
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
Right "move visual focus to the textbox"): `aria-activedescendant` leaves the option
the moment the user edits, so a screen reader is not held on an option the text no longer
matches, and Enter never accepts an option the user has typed past. With `autoHighlight`, the
first enabled option becomes active whenever none is **and the results are settled** (not
stale, not loading): a fast Enter after a keystroke therefore commits the typed text (with
`allowCustomValue`) or does nothing, never a stale option. This is an urgent write
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
input, aligned to the input's inline-start edge. **The `self-*` group.**
A plain logical keyword (`block-end span-inline-end`) resolves against the containing
block of the top-layer popup, which is the root, so it would follow a `dir="rtl"` document and
not a `dir="rtl"` *container* (verified: Chromium 156 keeps the left edges aligned).
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
(the fact) is still queued, and Enter in that window must reach the form instead of being
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
| Escape | open | **platform**: the auto popover's close watcher closes it; focus stays in the input; a `"dismiss"` fact. The active option is forgotten; the text is kept | no (the platform cancels the close request itself) |
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
| Input | `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` (shown: the listbox is in the top layer), `aria-controls` → List id, `aria-activedescendant` → the active Option id or absent, `autocomplete="off"`, `id` (the Label's `for`), `required` / `aria-describedby` pass through |
| Label | `for` → Input id, `id` |
| Trigger | `tabindex="-1"`, `popovertarget` after hydration and **no `aria-expanded`** on a `<button>` (a non-button `render` renders it from `shown`), `aria-controls` → List id, `aria-label` from the consumer (dev warning without a name) |
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
text prop (2.2); `open` without `onOpenChange` (a promise returned from `onInputValueChange`
does not warn, conventions 2.1); a Trigger with
no accessible name; a List with no `Label` and no `aria-label`; a `render` element of the wrong
kind (section 1); `transition` toggled between `undefined` and a value (conventions 5.1).

---

## 10. Async walkthroughs

Notation: `T` = input text (urgent), `Q` = deferred query, `V` = committed value, `O` =
optimistic value, `A` = active value, `P` = Root pending. Uncontrolled, `defaultValue={null}`,
`defaultInputValue=""`, async search under a Suspense boundary inside the List.

1. **Type "j", results load.** `input` event → `T="j"` (urgent), `onInputValueChange("j",
   { reason: "activate" })`, `requestOpen` (transition). Sync flush: the input shows "j",
   `data-open`, `data-pending` (`aria-expanded` flips to `"true"` with the `toggle` of `showPopover()`). Open commit: children mount, the
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
   `data-pending` (`aria-expanded="false"`) and no popup until then (React entanglement; Menu walkthrough 11; documented).
7. **Escape, then Tab.** Escape → the close watcher hides the popup; focus stays in the input;
   `toggle` → `onOpenChange(false, { reason: "dismiss" })`; `A=null`; `T` unchanged
   ("Jamaicax"). Tab → `focusout` with `relatedTarget` the next field → the popup is already
   hidden; without `allowCustomValue` the text reverts to the committed value's label
   ("Jamaica"); with it, `valueChangeAction("Jamaicax", { custom: true })` is dispatched with
   the `focusout` event.
8. **Clear.** Click → `pointerdown` prevented, the input keeps focus; `T=""`;
   `valueChangeAction(null)`; `data-selected` leaves the Input; hidden input `value=""`.
9. **Overlap: accept A, then accept B before A settles.** `O="a"` then `O="b"`; `data-pending`
   moves to B; A's resolution is superseded (no close from it: not the latest); B's resolution
   closes. `T` is B's label throughout after the second accept. A superseded rejection (A's) is
   passed to `reportError` by the shared hook, not to the boundary; B's outcome is unaffected
   (conventions 2.4).
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
    (`toggle` → `onOpenChange(false, { reason: "dismiss" })`); `click` → `T=""`,
    `valueChangeAction(null)`; the listbox is not re-opened (3.3). The Trigger, by contrast, is
    never light-dismissed by its own press (it is an invoker of the popup, 3.3): its click closes
    through `requestClose` and the listbox stays shown until the action settles (walkthrough 17).
15. **Escape, then Enter at once (single-field search form, `allowCustomValue`).** Escape → the
    close watcher hides the popup; the `toggle` (the fact) is queued. Enter before it runs:
    the key handler sees `:popover-open` false (section 8), commits the text in `flushSync` and
    lets the form submit with it. Judged against `intended()` it would have been prevented.
16. **A synchronously throwing `valueChangeAction`.** A plain function validates and throws.
    The wrapper's `catch` runs inside the `startTransition` callback; it yields (`await
    undefined`), then writes the rollback text (urgent, outside the transition: a controlled
    `onInputValueChange` parent's `setText` stays an urgent update) and rethrows to the
    boundary (2.2).

17. **Trigger click while open, slow close.** The listbox is open, `openChangeAction(false)`
    takes 300 ms. `pointerdown` / `mousedown` prevented (focus stays in the input); the Trigger
    carries `popovertarget` → the press is not a light dismiss, nothing hides at `pointerup`;
    `click` → `preventDefault()` (no command), `requestClose(click, "activate")`,
    `data-pending` and no `data-open` on the Trigger (exposed as expanded while shown), the
    listbox still shown with its options. 300 ms later the close commits: `hidePopover()` in the apply effect, the
    `<ViewTransition>` exit if set. A controlled parent that leaves `open={true}` instead: the
    optimistic `false` snaps back, the apply effect finds the popup shown and does nothing, no
    flicker.

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
/* With `transition` on the Popup no extra rule: the library cuts this transition around its own show / hide during a view transition (11.4). */
@media (prefers-reduced-motion: reduce) { .listbox { transition: none; } }
```

Hover styling of options is `:hover`, but since `pointermove` makes the hovered option active,
styling `[data-active]` alone keeps keyboard and pointer in one visual state (Menu 9).

### 11.4 ViewTransition

`transition` on `Combobox.Popup` wraps the `<div popover>` itself (conventions 5.1 top-layer
rule). Library-driven opens (typing, arrows, Trigger) and closes (accepted option, Trigger,
controlled) animate in every engine (the Trigger's close included: it is an invoker of the
popup, so its press is not a light dismiss, 3.3). Three things specific to this component:

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
- **The CSS exit of 11.3 is cut by the library while a view transition runs** (Popover 10.2,
  Dialog 10.3, conventions 5.1). The library-driven closes (an accepted option, the
  Trigger, a controlled close) hide the listbox with `hidePopover()` in the layout effect of a
  transition commit, the same path as Popover's; with the `display` / `overlay` transition on the
  popup Chromium would keep the closing box rendered through its fade, so the close's view
  transition would capture it as a live `::view-transition-new(…)` next to the `old` image (a
  double image). `usePopoverPopup` cuts the popup's CSS
  transition around that call and around the open; no consumer rule is needed. The hide on focus leaving the
  input and the popup (5.4) is a dismissal and keeps its CSS fade.

---

## 12. Test plan

Moved to `design/CHANGELOG.md` (part "combobox.md"). Not part of the contract: the code and the tests are the reference.

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
- **Container-level `dir="rtl"` in Firefox** (7.2): the `self-*` keywords follow a direction
  island in Chromium and WebKit; Firefox misplaces the listbox there (Mozilla 2019601).
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

Moved to `design/CHANGELOG.md` (part "combobox.md"). Not part of the contract: the code and the tests are the reference.
