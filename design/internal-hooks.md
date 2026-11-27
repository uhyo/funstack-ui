# @funstack/ui conventions: the shared internal hooks

Part of the API conventions: sections 3.4 and 3.8 of `design/conventions.md`, which keeps their
headings as stubs, and the index of `packages/ui/src/internal/` that section 9.1 points to.
Same status and rank as that document (accepted and binding; `docs/vision.md` wins over it, it
wins over a component design), and the same rule for history (`design/CHANGELOG.md`).

This is the implementer's half of the state model: what the shared hooks guarantee, which
parts call them, and the numbered rules the source cites ("conventions 3.8 rule 6"). Each
hook's doc comment is its contract; where this document and the code disagree, one of them has
a bug.

The sections keep their numbers, so "conventions 3.8" is section 3.8 here. A section number in
the text that is not a heading of this document (2.3, 2.4, 2.5.1, 3.3, 3.5, 3.6, 3.9.5, 7.4) is
a section of `design/conventions.md`.

## 3.4 The shared hook

All of section 3 lives in one internal hook, `useControllableAction`
(`internal/action/use-controllable-action.ts`), so that every component behaves identically. The code
and its comments are the reference for the algorithm; what the hook guarantees:

```ts
const { committed, optimistic, pending, dispatch, latestInFlight, adopt, adoptFact, epoch } =
  useControllableAction({ controlled, defaultValue, initialValue, action, transitionTypes, reducer, warn });
```

- `committed` is `controlled` when it is not `undefined`, else the internal state (never `??`:
  a controlled `null` is a value); `optimistic` is `useOptimistic(committed, …)`,
  always in its reducer form so that stacked optimistic updates are re-based onto a changed
  `committed`; `pending` is the hook's own `useTransition`.
- `dispatch(next, details)` is the execution contract of 2.3 in the owner's transition: the
  transition types, the optimistic update, the awaited action, then the uncontrolled commit of
  3.3 (the latest dispatch's `next`, or with a `reducer` the replay of the burst's resolved
  dispatches, each with the reducer of the render it was dispatched from).
- Errors follow 2.4: the latest dispatch's rejection is rethrown inside the transition while the
  owner is connected (`useConnected`); a superseded one, or the latest once the owner is gone,
  goes to `reportDropped` (`internal/action/report-dropped.ts`). The hook holds no error state, so it
  has no ordering constraint against `useTransition` and takes no capture option.
- `transitionTypes(next, prev, details)` receives `details` so a component can take the
  dispatch's origin into account; `prev` is the committed value at dispatch time, not the
  optimistic one. `details.event.currentTarget` is **not** the dispatching element (for a
  native event it is React's root container by the time the action runs): Tabs derives
  `fsui-tabs-next` / `fsui-tabs-prev` by looking the committed and target tabs up **by id**
  under the root and comparing their DOM order.
- `latestInFlight()` is the base of the residual paths (3.8 rule 1, `intendedValue`);
  `adopt(next)` takes a browser default without a dispatch (uncontrolled Select, 3.8).

**The `reducer` option.** A component passes **no `reducer`** for single-valued state (the
optimistic value is the dispatched `next`, the uncontrolled commit is the latest dispatch's
`next`): Toggle, Tabs, Select, RadioGroup, overlay `open`, Collapsible `open`, and the
`exclusive` modes of ToggleGroup and Accordion. It passes one for set-valued state: CheckboxGroup, and ToggleGroup
and Accordion without `exclusive`. Passing one changes two things at once: the optimistic value
is re-based change by change, and the uncontrolled commit becomes the replay of 3.3. A reducer:

- reads the change from `details` (a patch's `added` / `removed`, or `item` and `open`), not
  from `next`. It has no exception to make: an absolute dispatch is made with
  `{ whole: true }` and never reaches the reducer (3.3);
- is pure and does not depend on the optimistic value at dispatch time: it runs again, later,
  against a different base;
- is `undefined` for a mode that is single-valued, never a "replace" reducer: with a reducer
  the dispatch would enter the replay.

**`adoptFact(next)`** (3.9.5) is the one way a state owner takes a change it could not hold.
It is called from the platform event's listener (an overlay's `toggle` / `close`), never inside
a transition, and never calls the action. It:

- advances the latest-dispatch counter, so no dispatch in flight commits uncontrolled state any
  more and a later rejection of one is reported (2.4);
- makes `next` the in-flight intent, so `intended()` and the next Trigger click see it;
- drops the optimistic patches of those dispatches, in the fact's own commit (each patch
  carries the `epoch` of its dispatch and the render's reducer ignores older ones);
- writes the committed value urgently in uncontrolled mode;
- advances `epoch`, which is part of the returned value, so a memoised context built on it
  re-renders its parts in the fact's commit even when a controlled parent keeps its value.
  That is how a refused dismissal is re-shown at once.

Only the overlay Roots call it.

Library state never lives in `useSyncExternalStore`: a store mutation during a transition forces a
blocking re-render and defeats both fallback avoidance and ViewTransition. Reading
`matchMedia` for display only is fine.

**Pure-trigger parts share `useActionTrigger`** (`internal/action/use-action-trigger.ts`): a part with
a bare `action` and its own transition but no state (`Button`, `Dialog.Close`, `Popover.Close`,
`Menu.Item`, `Toast.Action`) runs the action through this hook instead of calling
`useTransition` itself, and so do the steps of the continuous controls (through
`internal/action/use-step-commit.ts`):

```ts
const { pending, run } = useActionTrigger({ openGeneration, ignoreWhilePending }); // both optional
const started = run(() => action?.(details), () => close()); // `then` runs inside the same transition once `work` resolved
if (!started) event.preventDefault();                        // ignored while pending (2.5.1)
```

- `pending` is the part's own transition (`data-pending` on the button or item).
- `ignoreWhilePending` (default `false`: the hook's baseline is React's): `run` returns
  `false` and starts nothing while a run is in flight, judged by the hook's synchronous
  in-flight counter alone, not the last render's `pending` (2.5.1). The option is internal; the
  public surface is the part's `whilePending` prop. The four kinds of part that have the prop
  go through `usePureTrigger({ whilePending, defaultWhilePending, openGeneration? })`
  (`internal/action/use-pure-trigger.ts`), which resolves `(whilePending ?? default) === "ignore"`
  per render, cancels an ignored activation (`runActivation`) and returns the owned pending
  keys (`pendingProps`: `aria-disabled` and `data-pending`, 3.6). The continuous controls
  reach `useActionTrigger` without `usePureTrigger` (through `useStepCommit`) and run every
  step.
- `then` runs once per burst of overlapping runs: when the last run in flight settles, and only
  if the latest run resolved (it is the latest run's `then`). With one run at a time this is
  the run's own `then` when it resolves. A rejection skips `then`; where it goes is 2.4.
- `then` still runs when the part unmounted meanwhile (an overlay's close must happen even though
  the part left with the content), so the only thing that cancels it is the **open-generation
  guard**: with `openGeneration` given, the hook reads the counter when `run` is called and skips
  `then` when it has changed by the time `work` resolved, which means the user dismissed and
  re-opened the overlay while the action ran and the close belongs to the earlier open (Popover
  3.4). `Popover.Root`, `Dialog.Root` and `Menu.Root` all carry the counter.
- React entangles transitions with a pending async action: a re-open dispatched while a run is
  still pending commits only when the run settles. Documented per component (Popover 3.4, Menu
  12), not worked around.

## 3.8 Native checkable inputs: the shared machinery

Switch, Checkbox and RadioGroup render controlled native inputs, and every form control shares
one dispatch model for the residual browser paths of 3.5 (mount reconciliation, form reset).
The model lives in internal hooks; each hook's doc comment is its contract, and this section is
the list of them plus the rules they implement (numbered: the source cites "3.8 rule N").
`design/components/switch.md` 7 and `design/components/radio-group.md` show them in use.

| Helper (`internal/`) | Used by | What it is |
| --- | --- | --- |
| `useFormOwnerEvent(ref, type, handler, options?)` (`use-form-owner-event.ts`) | `useFormReset`; `Field.Root` (`input` / `change` for cross-field `validate`, `submit` for its flags) | The stable subscription of rule 4 for any event of the form owner (`ref.current.form`; an `<input>`, `<select>` or `<fieldset>`, all honouring `form=`). |
| `useFormReset(ref, onReset, onResetEvent?)` (`use-form-reset.ts`) | the hooks below, Combobox, `Select.Value` (the `<selectedcontent>` refresh), `CheckboxGroup.Parent`, `OTPField.Root`, `Field.Root` (its validity refresh) | The `reset` subscription: `onResetEvent(event)` synchronously in the event (rule 6's mirror write), then `onReset(event)` after the dispatch and the reset algorithm (`afterDispatch`, rule 5) unless the reset was cancelled (rule 7). |
| `useResetTarget(value, defaultValue)` (`use-form-reset.ts`) | Slider, NumberField, Select, Combobox (value and text) | Rule 6's target by mode; `undefined` when absent, and the caller adds its fallback. |
| `useNativeChecked(options)` (`use-native-checked.ts`) | every `<input type="checkbox" \| "radio">` part: Switch, Checkbox, `RadioGroup.Item`, `CheckboxGroup.Item` and `Parent` | Per element: the ref callback with the dev tag / `type` check, the re-apply effect of rule 8 and, unless `group: true`, the two residual paths of a single control, reported through `onPlatformChange(next, event)`. With `group: true` it reports nothing and calls the group's `onItemMounted` (rule 3). |
| `useNativeGroupReconciliation<T>(options)` (`use-native-group-reconciliation.ts`) | a group Root (`RadioGroup.Root`, `CheckboxGroup.Root`: `element` is the `<fieldset>`); `useNativeSelectValue`; Slider (through its first Thumb's input, with `readDefault` returning the JS-computed target and `onResetEvent` passed through) and NumberField | Mount reconciliation (`readCurrent()` against `base()`) and form reset (`readDefault()` against `base()`), **one dispatch per group** through `onPlatformChange(next, event, path)`; returns the stable `{ onItemMounted }` for late members (rule 3). Comparison is the `equals` option (default `Object.is`; `CheckboxGroup.Root` passes set equality). |
| `useNativeSelectValue(options)` (`use-native-select-value.ts`) | `Select.Root` | The `<select>` analogue: mirrors the reset target into `option.defaultSelected` **and then** re-applies the intended option's `selected` (that order: `defaultSelected = true` on a never-selected option moves the selection), after every commit and for each late Option. Both paths dispatch once per Select and only when the intended option exists. With neither `value` nor `defaultValue` the browser's choice is **adopted** without a dispatch (`adopt(next)` on `useControllableAction`, uncontrolled only). |
| `useCheckableInput(options)` (`use-checkable-input.ts`) | `Checkbox`, `Switch` | The single-input machinery the two share, in one hook order: `useFieldControl`, `useControllableAction<boolean>`, `useFieldValueChange`, `useNativeChecked`, `useMergedRefs`. Returns the input's owned layer (`libraryProps`) and state; the components keep their props, `useRender` call and transition boundary. |
| `useFieldsetGroup(options)` (`use-fieldset-group.ts`) | `RadioGroup.Root`, `CheckboxGroup.Root` | The `<fieldset>` wiring of a group Root: `useFieldControl` (`labelable: false`), the fallback `name` (own, else the Field's, else `useId()`), "own or the Field's" `disabled` / `required`, the element check and the merged `rootRef`. |
| `groupMemberProps(options)` (`group-member.ts`) | `RadioGroup.Item`, `CheckboxGroup.Item` | The owned layer of a group member's `<input>`: `type`, the group's `name` / `form`, `value`, optimistic `checked`, `defaultChecked` never rendered, a checkbox's `aria-checked` removed, the member's own `disabled` (the Root's reaches it through `<fieldset disabled>`), `required`, `aria-invalid` only when given, the state `data-*` attributes and the guarded `onChange` (rule 9). The hydration-time attribute sync next to it is `syncPresences` (`sync-presence.ts`). |
| `useItemOrder(options)` (`use-item-order.ts`) | `CheckboxGroup.Root`, `ToggleGroup.Root` | The Items' document order kept in state for the Root state's `value` (the optimistic set in document order, values with no Item last); re-read after each Root commit, re-rendering only when what renders from it changed. Set and order arithmetic: `value-set.ts` (Accordion too) and `dom-order.ts`. |
| `useFieldControl(options)` (`use-field-control.ts`) | `Field.Control` and the owner part of every FUNSTACK form control: `Checkbox`, `Switch`, the group Roots (their `<fieldset>`, `labelable: false`), `Select.Root`, `Combobox.Input`, `Slider` (one thumb: its input; several: the group element, `labelable: false`), `NumberField.Input` (the visible input, with the hidden number input as `validityElement`), `OTPField.Input` (its one input, as `Field.Control`) | How a control becomes a Field's control. Outside a `Field.Root`: `inField: false`, nothing to merge. Inside: a **ref callback** that registers `{ element, labelable, required, disabled }` with the Field (no extra render), the resolved `name` / `disabled` / `required` / `id`, and `attributes`, the owned layer the part spreads: `id` (labelable only), `aria-labelledby` (groups), `aria-describedby` (token-merged by the part), `aria-invalid` (a `group` such as CheckboxGroup moves it to its items), `data-invalid`. **No `data-pending`**: a control keeps its own (2.7). The **Field** attaches its listeners to the registered element and resolves the **validity element** (the element itself when it is a form control, else the first named `willValidate` member of a `<fieldset>`, else the first control inside; or `validityElement()` when given, 3.6). Two registrations in one Field warn (`design/components/field-form.md` 7). |
| `useFieldValueChange(value, takeEdit?)` (`use-field-control.ts`) | every owner part whose DOM value can change **without** an `input` / `change` event the Field hears: `Combobox.Root` (a pick), `CheckboxGroup.Root` (a Parent click, the derived `required`), `Checkbox`, `Switch`, `RadioGroup.Root`, `Select.Root` (a controlled change from outside, a rollback), `Slider` (a pointer gesture), `NumberField.Root` (a step or commit writes the hidden input through the ref), `OTPField.Root` (the filter's write-back and a WebOTP fill write the input during or after its `input` event) | When `value` changed in a commit (never at mount) it calls the Field's `notifyChange(edit)`: the Field re-reads validity and recomputes its slot (dismissing a shown server error when `edit`, as an `input` event would) and asks the `Form.Root` to refresh its other Fields; outside a `Form.Root` only the control's own Field. Not a synthetic event: the consumer's handlers do not see it (`design/components/field-form.md` 7.1). |
| `resolveFieldDefaults(field, own)` (`use-field-control.ts`) | `useFieldControl`; `NumberField.Root`, `Combobox.Root` | The one "own or the Field's" rule: `name` falls back to the Field's, `disabled` and `required` are either's. `FieldControlBinding.fieldName` is the Field's own `name` for a control that must tell the two apart (Slider). |
| `intendedValue(latestInFlight, optimistic)` (`use-controllable-action.ts`) | the group Roots' residual paths, `useNativeChecked`, Accordion, the overlay Roots' `intended()`, `Dialog.Root` | Rule 1's base, with the explicit null check, in one place. |

Rules, which component docs cite instead of restating:

1. **Base comparison.** A residual path dispatches only when the DOM value differs from what the
   user already intends: the latest in-flight dispatch's `next` if there is one, else the
   optimistic value. Always through `intendedValue(latestInFlight, optimistic)`, which checks the
   *dispatch* for null; `latestInFlight()?.next ?? optimistic` silently drops an in-flight
   dispatch *to* `null` (RadioGroup's pending reset to "nothing checked"). Reading the DOM alone
   would lose a pending optimistic change. The comparison also makes the StrictMode double
   layout effect dispatch once.
2. **One dispatch per state owner.** A single control dispatches for itself; a group's Root
   dispatches once for the whole group, never once per radio.
3. **Mount reconciliation** runs in a layout effect at mount, before the re-apply effect, and
   dispatches with `reason: "platform"` and `event: undefined`. It covers clicks before hydration
   and Firefox's form-state restoration (react-dom keeps the DOM `checked` when hydrating, fires
   no `onChange` and logs no mismatch).
   - **Ordering in a group.** Children's layout effects run before the parent's, so
     `useNativeChecked` does **not** re-apply `checked` in the mount commit (StrictMode's re-run
     included); from the second commit on it re-applies after every commit. Uniform for single
     controls too.
   - **Late-mounting items** (inside a Suspense boundary that hydrates after the Root) call the
     adapter's `onItemMounted()` from their mount layout effect. Calls before the adapter's own
     mount reconciliation are ignored (those items are covered by it); later calls queue one
     microtask per commit that compares and dispatches `"platform"` with `event: undefined`.
     **The members' DOM value is recorded in the layout phase** of the commit the late members
     mount in, and the microtask reads that snapshot (CheckboxGroup 8.1): a re-render in between
     would re-apply the optimistic value over DOM state not read yet.
   - **Unsupported: partial hydration of a native radio group.** Clicking a hydrated radio while
     same-`name` siblings are inside a still-dehydrated Suspense boundary makes react-dom throw
     ("Mixing React and non-React radio inputs with the same `name` is not supported"). A React
     limitation: RadioGroup warns in development on the late-mount path and documents "keep all
     Items in the Root's Suspense boundary" (issue #34 tracks the human upstream report).
     Checkbox groups are not affected: CheckboxGroup supports late-mounting Items and Parents
     through the same path, with no warning.
4. **The reset subscription must be stable.** React's automatic reset after a successful
   `<form action>` runs in the commit's mutation phase, between the previous effect cleanup and
   the next subscription, so a listener attached in a deps-less effect never sees it.
5. **`onReset` runs after the reset, in both orders.** The `reset` event precedes the reset
   algorithm, and when the algorithm runs relative to a microtask depends on who started the
   reset:
   - a script `form.reset()` (React's automatic reset included; also `button.click()`,
     Testing Library's `fireEvent`, and any click made inside `act`): script is on the stack,
     so a microtask queued in the listener runs **after** the dispatch and the algorithm;
   - a click the user makes on a `<button type="reset">`: the event is dispatched from a task,
     a microtask checkpoint follows each listener, and the microtask runs **before** the later
     listeners and the algorithm, while `checked` and `value` still hold the user's state.
     Only a real click shows this order (a browser test that clicks outside `act`).

   `useFormReset` therefore calls back through `afterDispatch(event, callback)` (a flat
   module of `internal/`, shared with Dialog's Escape baseline): a microtask, and if the event is still being dispatched
   then (`event.eventPhase !== Event.NONE`), a task (`setTimeout(0)`). Either way the callback
   runs after every listener and after the algorithm, so it may read the DOM: `validity`,
   `:user-invalid`, a `FormData`, the selected option. Every `reset` listener of the library
   goes through `useFormReset`, `Field.Root`'s included; none queues its own microtask.

   Two things the timing does not change. **A checkable input's reset value is read from
   `defaultChecked`, not `checked`**: after React's own reset the re-apply effect has already
   put the optimistic value back into `checked` when the callback runs (a group's
   `readDefault()` returns the value of the radio whose `defaultChecked` is true, or `null`).
   And a target computed in JS (rule 6) stays computed. After a real click the callback is a
   task later than the reset, so a frame may paint the reset DOM before the library's
   dispatch; `onResetEvent`, which is synchronous, is where a write that must precede the
   algorithm goes.
6. **Reset target by mode** (`useResetTarget`). Uncontrolled: the latest `defaultX` prop.
   Controlled: the mount-time value; the reset is **offered to the parent** as a `"platform"`
   dispatch with `event.type === "reset"`, and after settle the DOM follows the parent's
   decision. How the target reaches the DOM depends on the input:
   - a checkable input: mirrored into `el.defaultChecked` by the re-apply effect (a group Root
     passes `defaultValue` down so each item mirrors `defaultValue === value`);
   - **a controlled value input** (`type=text`, `type=range`; Combobox's text, Slider's thumbs):
     react-dom rewrites its `defaultValue` attribute after every value change, so the mirror is
     written in the `reset` event itself (`onResetEvent`) and the dispatch carries the
     JS-computed target, never a DOM read;
   - **a hidden input** (Combobox's value) has no reset behaviour at all: the target is computed
     in JS and dispatched from `onReset`;
   - **a library-owned native input that is not the user's surface** (NumberField's hidden
     number input) is uncontrolled: `defaultValue` is the reset target, `.value` is written
     through the ref at every change and re-applied after every commit, so the platform's own
     reset applies and no `onResetEvent` mirror is needed.
7. **A cancelled `reset`** dispatches nothing: the hook reads `event.defaultPrevented` when
   the callback is due (rule 5), after every listener has run, so a `preventDefault()` from
   any of them counts (React's delegated `onReset` on the form, a listener on `document`).
8. **Re-apply after every commit**, in the order `defaultChecked` (if given), `checked`
   (optimistic), `indeterminate` (if given). It is belt-and-braces for `checked` (react-dom
   rewrites it on every commit of the input) and load-bearing for `indeterminate` and
   `defaultChecked`, which React does not manage on a controlled input; the order matters after
   React's automatic form reset, when writing `defaultChecked` would move `checked` too. It also
   ends the `preventDefault()` desync (2.3 item 3) at the next commit.
9. **Click guard**, shared by every part's `onChange` (`guardCheckableChange(event, dispatch,
   componentName?)` in `use-native-checked.ts`): if `event.defaultPrevented` is already true,
   return without dispatching **and without warning** (2.3 item 3); otherwise dispatch, then in
   development warn once per element if the event is now `defaultPrevented`.

## The files of `internal/` (conventions 9.1)

One line per file of `packages/ui/src/internal/` (not exported): the flat helpers first, then
the three subfolders `action/`, `form/` and `overlay/` (the layering rule is in conventions
9.1). A new shared helper gets a line here in the commit that adds it. "section N" in a comment
is a section of `design/conventions.md` or of this document.

```
packages/ui/src/internal/
  types.ts                # Action, ActionDetails, ChangeAction, ChangeReason, RenderProp, StateValue
  data-attr.ts            # dataAttr(flag) -> "" | undefined (section 4.1)
  transition-types.ts     # transitionTypes(component, change?) -> string[] (section 5.3)
  platform-attributes.ts  # the one `declare module "react"` (section 7.4)
  use-render.tsx          # resolves render / className / style / children against state
  render-element.ts       # the directive-free half of use-render: renderElement, rendersButton, isHostButton, disabledButton, cancelClick, pendingAriaDisabled (1.2)
  merge-props.ts          # mergeProps, mergeRefs, mergeTokenLists; directive-free
  use-merged-refs.ts      # useMergedRefs(...refs): the memoised ref merge of every part with a library ref (1.4)
  after-dispatch.ts       # afterDispatch(event, callback): after the event's dispatch and default action, a microtask or a task (section 3.8 rule 5, dialog.md 2.6, field-form.md 2.4); returns its cancel; directive-free
  use-latest.ts           # useLatest(value): a ref written in an insertion effect
  use-dev-warning.ts      # useDevWarning(condition, isDev && message) (7.2)
  use-element-check.ts    # useElementCheck(isDev && (el) => ...): the rendered-element dev check, once per instance (7.2)
  use-name-warning.ts     # useNameWarning / useShownNameWarning: the accessible-name dev checks; BUTTON_NAME / TEXT_NAME (7.2); useShownDescriptionWarning (AlertDialog's missing Description, judged over the first showing)
  dev-warn.ts             # warnOnce for directive-free parts
  use-item-order.ts       # section 3.8: the Items' document order in state (CheckboxGroup, ToggleGroup)
  value-set.ts            # set / order arithmetic of the set-valued components; directive-free
  dom-order.ts            # compareDocumentOrder, sortByDocumentOrder; directive-free
  toolbar-context.ts      # section 7.1: ToolbarContext, read across folders
  menubar-context.ts      # section 7.1: MenubarContext (the registry of the bar's menus and the switch), read by Menu.Trigger and Menu.Popup
  use-roving-focus.ts     # section 7.4: DOM-written roving tabindex
  arrow-keys.ts           # resolveArrowKey, focusWithRing (Tabs.List, the roving engine; Accordion.Root uses resolveArrowKey); directive-free
  details-summary.ts      # the <details> / <summary> pair of Accordion and Collapsible: interceptSummaryClick (the Trigger click rule, accordion.md 2.2), useDetailsCheck / useSummaryCheck (the element checks)
  use-native-focusgroup.ts  # useNativeFocusgroup(flag): the native `focusgroup` detection (section 8)
  announce.ts             # announce(target, message, priority?), canAnnounce(target) (section 8, number-field.md 8.3); directive-free
  shipped-styles.ts       # FSUI_PRECEDENCE (section 12); directive-free
  transition-boundary.tsx # the `<ViewTransition default={transition}>` wrapper, only when `transition` is given (5.1)
  pointer-capture.ts      # setPointerCapture that tolerates a pointer the engine no longer tracks; directive-free
  use-value-set.ts        # a set-valued `value` / `defaultValue` prop as a set
  use-hydrated-mount.ts   # whether this mount is the hydration render (useSyncExternalStore)
  use-register-count.ts   # how many parts of a kind are registered
  use-mount-fixed.ts      # useMountFixed(value, isDev && message): a prop read once at mount (the JS-free / library mode, `exclusive`), with its dev warning
  use-delayed-pair.ts     # an open timer and a close timer that exclude each other
  decimal.ts              # decimal helpers of Slider and NumberField; directive-free
  range-value.ts          # clamp, percentage and formatting of Progress and Meter; directive-free
  csp-context.ts          # what <CSPProvider> gives the parts that render a hoisted <style> (section 12)
  use-option-registry.ts  # the mounted Options, Statuses and Labels of a listbox, the label cache, optionId, optionLabel (Combobox, MultiSelect; combobox.md 2, multi-select.md B.15)
  use-active-option.ts    # the active option (urgent virtual focus) and its revalidation; the pending edge, a resolver, the `loading` hold (combobox.md 6.5, multi-select.md B.8)
  use-deferred-leave.ts   # the focus-leave decision of a listbox's focus surface, deferred past a press (combobox.md 5.4)
  typeahead.ts            # the 500 ms typeahead buffer and its prefix match (Menu, MultiSelect; menu.md 5.1); directive-free
  action/                 # actions and triggers (section 3.4, conventions 2); imports flat modules only
    action-details.ts     # createActionDetails (section 2.2); directive-free
    use-controllable-action.ts # section 3.4; also intendedValue (3.8 rule 1)
    use-action-trigger.ts # section 3.4: pure triggers
    use-pure-trigger.ts   # usePureTrigger: the whilePending wiring of the four pure triggers with the prop (2.5.1, 3.6)
    use-step-commit.ts    # the step / commit core of the continuous controls, Slider and NumberField (2.3; slider.md 2.4)
    report-dropped.ts     # section 2.4: reportDropped(error) -> global reportError, console.error fallback; directive-free (callUrgentHandler imports it)
    use-connected.ts      # section 2.4: useConnected(), whether the owner's effects are connected; both hooks and Form.Root call it
    call-urgent-handler.ts # callUrgentHandler: the one rule of every `on*` handler (2.1); directive-free
    use-multiple-selection.ts # the set-valued selection of a listbox (Combobox `multiple`, MultiSelect): patch reducer, replay, absolute reset (combobox.md 15.4)
  form/                   # native form controls and Field (section 3.8); imports action/ and flat modules
    use-form-reset.ts     # section 3.8; also useResetTarget(value, defaultValue), the reset target by mode (rule 6)
    use-form-owner-event.ts # section 3.8; declares FormAssociatedElement
    use-native-checked.ts # section 3.8; also exports guardCheckableChange
    use-native-group-reconciliation.ts # section 3.8
    use-native-select-value.ts # section 3.8 (Select)
    use-checkable-input.ts # section 3.8: Checkbox / Switch
    use-fieldset-group.ts # section 3.8: RadioGroup.Root / CheckboxGroup.Root
    group-member.ts       # section 3.8: a group Item's owned input layer
    sync-presence.ts      # hydration-time attribute presence sync (3.8)
    field-context.ts      # FieldContext, FormContext, fieldDataAttributes (7.1)
    use-field-control.ts  # useFieldControl, useFieldValueChange, fieldInputProps, resolveFieldDefaults (3.8)
    validity.ts, focus-first-invalid.ts # Field helpers; directive-free
    form-status-watcher.tsx # the useFormStatus edge watcher of Form.Root and Dialog.Form
    hidden-values.tsx     # HiddenValues: one hidden input per value of a set-valued Root (Combobox `multiple`, MultiSelect); directive-free
  overlay/                # open state, popups, placement, the modal stack (3.9, 13); imports action/ and flat modules
    use-overlay-root.ts   # useOverlayRoot, OverlayRootValue (section 3.9; Dialog), usePopoverRoot, PopoverRootValue (plus the `shown` mirror; Popover, Menu, Combobox, HoverCard, NavigationMenu.Item), popoverDetails
    use-popover-popup.ts, use-popover-trigger.ts # the shared Popup and Trigger of Popover, Menu, Combobox, NavigationMenu (its Popup passes `elements: ["DIV"]` and `whileShown: listenInvokerPresses`, for its focus-leave close); toggleFromTrigger, the Trigger click rule (popover.md 2.8), also called by Combobox.Trigger. HoverCard uses the Popup hook only, with `quietShow` (every show a no-focus show), `allowOpen` (its "no open until fresh interest" at the `beforetoggle` interception), `elements` (a `<span>` card), `beforeInterestHide` (passed on to `useInterestDismiss`: blur before the lost-interest hide) and `onRoutedOpen`; hover-card.md 12
    overlay-popup.tsx     # renderOverlayContent, useCloseHold, useInitialFocusTarget, returnFocusToTrigger, commandOf, useJsFreePropWarnings
    overlay-show.ts       # createPopupFlags (awaitingClose, the library echo, refusedFact), showWithFocus (the refused re-open's `inert`, the `autofocus` write; 3.9.4): the popup state both Popup implementations share; directive-free
    use-apply-open-state.ts # useApplyOpenState: the apply effect (popover.md 2.5, dialog.md 2.5) both Popup implementations share, over an `isShown` / `show` / `hide` driver
    use-overlay-close.ts  # useOverlayClose: the one Close part of Popover and Dialog (and AlertDialog's Cancel and Action); no `commandfor` / `command` with `action` (conventions 7.3)
    content-focus-probe.tsx # useContentFocusProbe (popover.md 6.2)
    use-exit-animation.ts # held content while an exit animates (popover.md 4.4)
    popover-open.ts       # isPopoverOpen(element); directive-free
    invokers.ts           # eventSource, closedByPopoverTarget, isPopoverInvoker, listenInvokerPresses (popover.md 2.3, menu.md 2.2); directive-free
    focus-visible.ts      # QuietFocusTarget, supportsFocusVisibleOption, resetFocusVisibleOption (popover.md 6.1); directive-free
    anchor-position.ts    # positionArea, parsePositionArea, POSITION_TRY_FALLBACKS (section 13); directive-free
    use-resolved-placement.ts # useResolvedPlacement, useAnchoredPlacement (13.2)
    css-transition-cut.ts # withCssTransitionCut (5.1); directive-free
    trigger-ref.ts        # the Root's triggerRef, with the second-Trigger dev warning
    use-interest-dismiss.ts # the lost-interest hide of an interest-opened popup (popover.md 2.9); `beforeHide` runs right before it
    modal-registry.ts, use-modal-registration.ts # the stack of open modal dialogs (section 3.5); the registry is directive-free
```
