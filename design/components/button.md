# Button

Status: **accepted**, implemented. Follows `design/conventions.md`; where this document and the
conventions disagree, the conventions win. History (the product owner's starting decisions,
reviews, the wave 9 and #146 amendments as written, implementation notes, test rows):
`design/CHANGELOG.md`, parts "button.md".

Inputs: `docs/vision.md`, `design/conventions.md` (1.2, 2.3, 2.5, 2.7, 3.4, 3.6, 4.1, 7.1),
`docs/research/button.md` (af1993f; probes in `memo/platform-researcher/probes/16-button/`),
the product owner's decisions on the research (recorded in section 0),
`packages/ui/src/internal/action/use-action-trigger.ts`,
`form/form-submit.tsx`, `form/form-root.tsx`, `menu/menu-item.tsx`, `menu/menu-dom.ts`,
`dialog/dialog-close.tsx`, `dialog/dialog-trigger.tsx`, `popover/popover-close.tsx`,
`design/components/toggle-group.md` 3.4 and 11.5, `design/components/field-form.md`
(`Form.Submit`, repeat submits), `design/components/menu.md` 2.3. Prior art: React Aria Components
1.22 `Button` (`isPending`), Base UI 1.9 `Button` (`focusableWhenDisabled`), MUI 9 `loading`,
Radix Themes `loading`, GOV.UK `preventDoubleClick`.

## 0. Product-owner decisions this design starts from

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One plain component, `Button` (`@funstack/ui/button`), a `<button type="button">` by default; `render` allowed (`<a href>` included). No parts, no `.Root`. |
| 2 | Action | Bare `action(details)` in the Button's own transition through `useActionTrigger` (conventions 3.4). `data-pending` / `state.pending` while it runs. Without `action` the Button is a plain native button (a `formAction` submitter, an Invoker Command, a link). |
| 3 | Re-entry | The prop **`whilePending`** (`"run"` \| `"ignore"`, section 18). Default **`"run"`**: every activation runs, nothing is cancelled. With `"ignore"`, a click, Enter or Space while the Button's own `action` (or its own `formAction` submission) is in flight starts nothing and is `preventDefault()`ed, so a link does not navigate, a form does not submit and a command does not run twice. The guard is the Button's **own synchronous in-flight counter only** (section 5.2; the rendered `pending` is not a guard source). |
| 4 | AT state while pending | Under `whilePending="ignore"`: `aria-disabled="true"` (owned), `data-disabled` **not** set, `state.disabled` unchanged. Under `"run"`: nothing. Never native `disabled`, never `inert`, no `aria-busy`, no announcement. |
| 5 | Library-wide rule | Every pure trigger has `whilePending`; the default follows who owns the action (conventions 2.5.1): `"run"` for `Button`, `"ignore"` for `Dialog.Close` / `Popover.Close`, `closeOnActivate ? "ignore" : "run"` for `Menu.Item` and `Toast.Action` (sections 16 and 18.4). `Form.Submit` has no guard (section 6.4). |
| 6 | `type` | Default `"button"`; `"submit"` when `formAction` is given. The Button's own `type` prop wins (`"submit"` / `"reset"` allowed); the computed value is owned on a `<button>` and on a **component** `render` element (assumed to render a `<button>`; library-wide in `rendersButton`), and omitted only for a host element of another tag (`<a href>`). `action` with a submitting `type` warns in development. |
| 7 | `formAction` | First-class pass-through with **per-submitter pending**: latched once `useFormStatus().pending && status.action === <the function this Button submitted with>` has rendered, held until the form status is idle (6.2, #154). `action` and `formAction` together is a development error. Progressive enhancement is React's (a Server Function submits before hydration). |
| 8 | `disabled` | Native `disabled` (owned) plus `data-disabled`, like `Dialog.Close` / `Form.Submit`. `focusableWhenDisabled` renders `aria-disabled="true"` instead (Base UI's name); it is implied `true` inside a `Toolbar.Root` (APG Toolbar). A host element of another tag (`<a href>`) and a component `render` whose click only the Button's handler acts on take the same `aria-disabled` branch (native `disabled` means nothing on a link and would expose an enabled link to AT). A component or host `<input>` `render` whose click the browser also acts on (a submit or reset `type`, the `formAction` default, `commandfor` / `popoverTarget`; with or without `action`) keeps native `disabled`, the only thing that stops it before hydration (conventions 1.2). Never dispatches either way; a disabled link does not navigate. Native `disabled` wins over the pending `aria-disabled`. |
| 9 | Toolbar | `Button` reads `ToolbarContext`: a Toolbar's command button is `<Button>`, focusable when disabled there (`aria-disabled`, APG Toolbar). The Toolbar has no button part of its own. One implementation, one name. |
| 10 | Composition | Button does **not** treat a `defaultPrevented` click as a veto (a Trigger-wrapped Button runs its action); its guard cannot stop an outer part's handler that ran first; `command` / `commandfor` pass through untouched (both the action and the command run on one click). |
| 11 | Announcement | None in v1; the outcome is the consumer's (toast, Field error, `ariaNotify` in the action). `aria-busy` is pass-through. |
| 12 | ViewTransition | `transition` on the Button: it is a pure trigger, not a value control, and its content is keyed on `pending`, its only state (conventions 5.1); no `fsui-*` types (as Toolbar). |
| 13 | Directive | `button.tsx` is `"use client"`; no directive-free variant (section 11). |
| 14 | Types | `ButtonProps`, `ButtonState`, `ButtonActionDetails`. |

---

## 1. Anatomy

```
Button    button type="button" [aria-disabled] [data-pending] [data-disabled]
```

One element, no parts. The default element is `<button>`; `render` substitutes any element
(`<a href>` for a link that runs an action, a styled `<MyButton>` that spreads its props). The
Button adds no `role`: a `render={<a href>}` stays a link to assistive technology, with a link's
keyboard (Enter), as `Menu.Item` allows.

What a Button is for: **a click that is a transition**. The library's other buttons each carry a
second meaning and stay: `Form.Submit` (the form's own submission, form-channel pending),
`Dialog.Close` / `Popover.Close` (action, then a close), `Menu.Item` (`role="menuitem"`, closes the
menu), `Dialog.Trigger` / `Popover.Trigger` / `Menu.Trigger` (open state), `Toggle` (pressed
state), `NumberField.Increment` / `Decrement` (steps). A Button inside a `Menu.Popup` is not a
menu item; the docs say so.

---

## 2. Usage

### 2.1 An async action with pending feedback

```tsx
"use client";
import { Button } from "@funstack/ui/button";

export function SaveButton({ draft }: { draft: Draft }) {
  return (
    <Button action={async () => { await api.save(draft); }}>
      {({ pending }) => (pending ? <><Spinner /> Saving…</> : "Save")}
    </Button>
  );
}
```

While `api.save` runs the button has `data-pending=""` and `aria-disabled="true"`, keeps focus,
and a second click, Enter or Space does nothing. When the promise settles the attributes go,
and a rejection reaches the nearest Error Boundary above the Button. A consumer who wants an
inline error catches inside the action (conventions 2.4), which the library counts as success:

```tsx
<Button
  action={async () => {
    try {
      await api.save(draft);
      toast({ title: "Saved" });
    } catch (e) {
      startTransition(() => setError(String(e)));
    }
  }}
>
  Save
</Button>
```

### 2.2 Secondary submitters in a form: `formAction`

```tsx
import { Form } from "@funstack/ui/form";
import { Button } from "@funstack/ui/button";
import { publish, saveDraft, discard } from "./actions"; // "use server"

<Form.Root action={publish}>
  <Field.Root name="title">…</Field.Root>
  <Form.Submit>Publish</Form.Submit>
  <Button formAction={saveDraft}>Save draft</Button>
  <Button formAction={discard}>Discard</Button>
</Form.Root>
```

Three buttons, three meanings of `pending`. `Form.Submit` shows the **form channel**: it is
pending for every submission of this form, whichever button started it (`useFormStatus().pending`,
conventions 2.7). Each `Button formAction` shows **its own submissions only**: "Save draft" is
pending from its own submission until the form's submissions have all finished, "Discard" is
not (unless it submitted too), even though `useFormStatus().pending` is `true` for the whole
form. Both Buttons are `type="submit"` (the default once `formAction` is given) so constraint
validation, `FormData` and React's automatic reset all work; a second click on a
pending one is ignored. The Server Functions render as `formaction` attributes before hydration,
so the buttons submit without JavaScript (React's progressive enhancement, unchanged).

### 2.3 A Trigger that is a Button

```tsx
<Dialog.Root>
  <Dialog.Trigger render={<Button action={() => { void prefetchProfile(); }} />}>
    Edit profile
  </Dialog.Trigger>
  <Dialog.Popup>…</Dialog.Popup>
</Dialog.Root>
```

The Trigger's library click handler runs first (it cancels the native command and opens the
dialog through the Root's transition); the Button's handler runs next and runs `action` although
the click is already `defaultPrevented`. The action here does **not** await the prefetch: the
open is a transition, and every transition started while an async action is pending is entangled
with it (conventions 2.3 item 5), so an **awaited** `action` would hold `showModal()` until it
settles, with the Trigger showing `data-open` / `data-pending` meanwhile and the dialog opening
when the action resolves. That is React's rule, not the Button's, and the Dialog cannot open on
anything but committed state (review deviation 1); "await only what the UI must wait for"
applies. The documented direction is "Trigger renders Button", as for
`Dialog.Trigger render={<Menu.Item />}`. The same works with `Popover.Trigger` and
`Tooltip.Trigger`:

```tsx
<Tooltip.Root>
  <Tooltip.Trigger render={<Button action={remove} aria-label="Delete" />}>
    <TrashIcon />
  </Tooltip.Trigger>
  <Tooltip.Popup>Delete</Tooltip.Popup>
</Tooltip.Root>
```

The tooltip keeps opening on hover and focus while the Button is pending: the Button is
`aria-disabled`, not `disabled`, and it removes no listeners.

### 2.4 Inside a Toolbar

```tsx
<Toolbar.Root aria-label="Editor">
  <Button action={cut}>Cut</Button>
  <Button action={copy} disabled={!hasSelection}>Copy</Button>
  <Button action={paste}>Paste</Button>
  <Toolbar.Separator />
  <Toggle pressedChangeAction={setBold}>Bold</Toggle>
</Toolbar.Root>
```

Inside a `Toolbar.Root` a disabled Button renders `aria-disabled="true"` instead of native
`disabled`, stays in the arrow-key sequence and is still found by assistive technology (the APG
Toolbar example; section 7.3).

### 2.5 From a Server Component

```tsx
// A Server Component: no "use client" in this file.
import { Button } from "@funstack/ui/button";
import { archive } from "./actions"; // "use server"; (id, details) => Promise<void>

export function Row({ post }: { post: Post }) {
  return (
    <>
      <Button action={archive.bind(null, post.id)} className="row-action">Archive</Button>
      <Button commandfor={`preview-${post.id}`} command="show-modal">Preview</Button>
    </>
  );
}
```

A Server Function is a valid `action` (`details.event` is virtual, conventions 2.2) and a valid
`formAction`. `commandfor` / `command` are plain attributes, so the second button opens its
dialog before hydration with no JavaScript. What a Server Component **cannot** pass: function
`children`, `className`, `style` or `render` (not serialisable), so the pending spinner of 2.1
needs a Client Component or CSS on `[data-pending]` (section 11).

### 2.6 Styling

```css
.btn[data-pending] { cursor: progress; }
.btn[data-pending] .label { visibility: hidden; }
.btn[data-pending]::after { content: ""; /* spinner */ }
.btn[data-disabled], .btn[aria-disabled="true"]:not([data-pending]) { opacity: 0.5; }
```

`[data-disabled]` is the consumer's `disabled` only; `[data-pending]` is the in-flight state. The
two never need to look alike, which is why pending does not set `data-disabled`. Tailwind:
`data-pending:cursor-progress data-disabled:opacity-50`.

---

## 3. Props and types

```ts
// packages/ui/src/button/button.tsx
"use client";

/** Details passed to `Button`'s `action`. Serialisable; `event` is virtual (conventions 2.2). */
export interface ButtonActionDetails extends ActionDetails {}

export interface ButtonState {
  /** This Button's own `action` is in flight, or a submission it started through its own `formAction`. */
  readonly pending: boolean;
  /** The `disabled` prop. Not set by pending. */
  readonly disabled: boolean;
}

export interface ButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "aria-disabled" | "className" | "style" | "children"
> {
  /**
   * Runs inside this Button's own transition on click, Enter or Space (`data-pending` meanwhile).
   * Sync or async; may be a Server Function. A rejection reaches the nearest Error Boundary above
   * the Button. A further activation while it is pending runs as well, unless
   * `whilePending="ignore"` (section 18). Not combinable with `formAction` (development error).
   */
  action?: Action<[details: ButtonActionDetails]>;
  /** `"run"` (default) or `"ignore"`: section 18.1, conventions 2.5.1 (#146). */
  whilePending?: WhilePending;
  /**
   * React's `formAction`: a function (a Server Function, a `useActionState` dispatch, a client
   * function) or a URL, run by React instead of the form's `action` when this Button submits the
   * form. With a function, the Button is `pending` from its own submission until the form's
   * submissions have all finished (never for another submitter's alone, 6.2, #154) and defaults
   * to `type="submit"`. A further activation meanwhile
   * submits again unless `whilePending="ignore"` (section 18.3).
   */
  formAction?: ComponentPropsWithRef<"button">["formAction"];
  /**
   * Default `"button"`, or `"submit"` when `formAction` is given. Owned on a `<button>` and on a
   * component `render` element (set it here, not on the element; a component is assumed to
   * render a `<button>` and should spread the prop, a component that renders a link may drop
   * it); omitted for a host element of another tag. `action` together with `"submit"` / `"reset"`
   * warns in development: one click would do two things.
   */
  type?: "button" | "submit" | "reset";
  /**
   * Native `disabled` (owned; a `render` element cannot re-enable it) and `data-disabled`.
   * Never dispatches. With `focusableWhenDisabled` or inside a `Toolbar.Root`, renders
   * `aria-disabled="true"` instead and cancels the click. So does a host element of another tag
   * (`render={<a href />}`), and a component `render` whose click only the Button acts on. A
   * component `render` whose click the browser also acts on (`type="submit"` / `"reset"`, the
   * `formAction` default, `commandfor` / `popoverTarget`; with or without `action`) keeps
   * native `disabled`: only that stops a submission or command before hydration. Native `disabled`
   * wins over the pending `aria-disabled`.
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens. Before
   * hydration a focusable disabled submitter still submits (nothing native stops it). Default
   * `false`; implied `true` inside a `Toolbar.Root` (APG Toolbar).
   */
  focusableWhenDisabled?: boolean;
  /**
   * Forwarded as `default` to the Button's `<ViewTransition>`: animates the commit that ends the
   * action (content keyed on `pending`), not a click. Static; any value makes a mount inside a
   * transition start a document view transition (issue #35).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ButtonState>;
  style?: StateValue<CSSProperties | undefined, ButtonState>;
  children?: StateValue<ReactNode, ButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ButtonState>;
}

export function Button(props: ButtonProps): ReactNode;
```

Notes on the type:

- `onClick` is omitted (the library's prop-form handler, conventions 1.5); every other DOM event
  prop passes through and runs independently, including while pending (`onFocus`, `onBlur`,
  `onPointerEnter`, `onPointerLeave`, `onKeyDown`, …). A pass-through `onClick` from a `render`
  element or an outer part still reaches the element and runs before the Button's handler
  (conventions 1.2).
- `aria-disabled` is omitted because the Button computes it (pending, `focusableWhenDisabled`,
  Toolbar); `aria-busy` is **not** omitted: it is the consumer's (decision 2).
- `type` is narrowed to the three button types; `commandfor` / `command` / `interestfor` come from
  `internal/platform-attributes.ts` as on every `<button>` part.
- `formAction`'s type is React's own (`string | ((formData: FormData) => void | Promise<void>)`),
  so a Server Function and a `useActionState` dispatch type-check as they do on a native button.
- Not in the type (section 12): `pending` / `loading` as a consumer-driven prop, `href`,
  `announce`, `repeatable`.

### 3.1 Namespace and exports

```ts
// src/button/index.ts (no directive)
export { Button } from "./button.js";
export type { ButtonProps, ButtonState, ButtonActionDetails } from "./button.js";
```

Root entry: `export { Button }` and the three types. Subpath `@funstack/ui/button`
(`tsdown.config.ts` entry, `package.json` exports).

---

## 4. States, data attributes, owned keys

| State | Kind | Attribute | Meaning |
| --- | --- | --- | --- |
| `pending` | boolean | `data-pending` | The Button's own `action` transition is in flight (until the resulting commit, including a Suspense wait), or a submission this Button started through its function `formAction` is pending (`useFormStatus().pending` for that function). |
| `disabled` | boolean | `data-disabled` | The `disabled` prop. **Not** set by pending. |

ARIA state the Button computes: `aria-disabled="true"` while `disabled && focusable`, and while
pending (under `whilePending="ignore"`) unless natively disabled; absent otherwise. `focusable`
is `disabledButton(render, disabled, { handlesClick: !browserRun, alwaysFocusable:
focusableWhenDisabled || inToolbar })` (conventions 1.2), where `browserRun` means a resolved
`type` of `"submit"` / `"reset"` (a host `<input>` render: its own `type`) or a `commandfor` /
`popoverTarget` prop, with or without `action`. So:
the opt-in (Toolbar, `focusableWhenDisabled`) is always focusable; a host element other than
`<button>` / `<input>` is always focusable; a component `render` is focusable when the Button's
handler is all the click does (`browserRun` false) and natively disabled when the browser runs the
click; a host `<button>` and the function form are natively disabled.

The two `render` predicates follow one rule, **when the element is unknown, pick the attribute
that is harmless if the guess is wrong** (review items 1 and 2): `type="button"` on a component
that turns out to render a link is an ignored attribute, while a missing `type` on a component
that renders a `<button>` inside a form is a silent submit; `aria-disabled` on a component that
turns out to render a `<button>` is a focusable-disabled button that still never dispatches,
while native `disabled` on a link is an enabled link to assistive technology. So a component
element of a Button with `action` gets `type` **and** the `aria-disabled` branch; a host `<a>`
gets neither `type` nor native `disabled`; a host `<button>` gets both natives. Where the browser
acts on the click (submit, reset, an invoker; also next to an `action`), the harmless guess for a component is
the other one: an `aria-disabled` component that renders a `<button>` is a live submitter or
invoker before hydration, while native `disabled` on a component that renders a link costs
nothing (a link cannot submit or invoke, so the Button fails at its job either way).

Owned keys (conventions 1.2; a `render` element cannot re-introduce them):

| Key | Value | When |
| --- | --- | --- |
| `type` | the Button's `type` prop, else `"submit"` with `formAction`, else `"button"` | no `render`, the function form, a host `<button>` or a **component** element (`rendersButton(render)` as amended library-wide, conventions 1.2); the key is omitted for a host element of another tag |
| `disabled` | the prop, unless `focusable` (then `undefined`, which removes it) | always |
| `aria-disabled` | `true` while focusable-disabled, or while pending (ignoring) and not natively disabled; `undefined` otherwise | always |
| `onClick` | the library handler (section 5.1) | always (a pass-through / render-element `onClick` runs first) |
| `data-pending`, `data-disabled` | by presence | always |

Not owned: `formAction` (pass-through, read by the Button), `name`, `value`, `form`,
`commandfor`, `command`, `aria-busy`, `aria-label`, `tabIndex` (inside a Toolbar the roving
engine writes `tabindex` through the DOM, and an explicit `tabIndex={-1}` opts the item out of the
arrow sequence, as for any toolbar item), everything else.

CSS hooks next to the attributes: `:focus-visible`, `:hover`, `:active` (platform, conventions 4.2),
`:disabled` (native `disabled` only; `[data-disabled]` also covers the focusable-disabled case).

---

## 5. Pending and re-entry

Which activations run while the Button is pending is the prop `whilePending` (section 18). The
default is `"run"`: every activation runs, nothing is cancelled, no `aria-disabled` while
pending. 5.2 and 5.3 describe `whilePending="ignore"`.

### 5.1 The click handler

```ts
onClick: (event) => {
  if (disabled) {
    event.preventDefault();          // a disabled link must not navigate either
    return;
  }
  if (action === undefined) {
    // A native button: formAction, command, link, plain submit. Only the re-entry guard applies.
    if (ignoring && formPending) { event.preventDefault(); return; }  // my formAction submission is in flight
    submittedWith.current = formAction;        // per-submitter pending, 6.2
    return;
  }
  const details = createActionDetails(event.nativeEvent, {});
  const started = run(() => action(details));  // useActionTrigger({ ignoreWhilePending: ignoring })
  if (!started) event.preventDefault();        // ignored: do not navigate, submit or run a command
}
```

`event.defaultPrevented` is **never read**: an outer part (`Dialog.Trigger`) cancels the click as
part of its own mechanism before the Button's handler runs, and the Button must still run its
action (decision 4; this is the complementary case to conventions 2.3 item 3, which is about
checkable inputs where a cancelled click reverts the DOM). The warning of 2.3 item 3 (a
`preventDefault()` in the sync prefix) does not apply to a pure trigger: there is no DOM state to
revert, and `details.event.preventDefault()` in the action is a legitimate way to stop a link's
navigation or a command. `ignoring` is `(whilePending ?? "run") === "ignore"`.

### 5.2 What "ignored while pending" means

Under `whilePending="ignore"`, while the Button's own run is in flight, an activation (pointer click, Enter, Space, a
programmatic `.click()`, the click an implicit form submission sends to the default button):

- starts **no** second run of `action` (and sends no second submission when the pending is a
  `formAction` one);
- is `preventDefault()`ed, so a `render={<a href>}` does not navigate again, a `formAction`
  Button does not submit again, and a `command` does not run again;
- is **not** `stopPropagation()`ed: an outer part's handler already ran (merge order), and
  ancestors see the click as usual;
- leaves every other listener alone: focus, blur, hover, pointer enter / leave, keydown all fire,
  which is what keeps a `Tooltip.Trigger` and the consumer's own pass-through handlers working.

The guard reads **one** thing: the **in-flight counter in a ref** inside `useActionTrigger`,
incremented synchronously when `run` starts the transition and decremented when the work
settles (resolves or rejects). It is synchronous, so two activations in one task (a double
`fireEvent.click`, a key repeat) see it where React's `isPending` is still the stale render
value `false`.

The rendered `pending` is **not** a guard source. There is a
window after the promise settled but before the commit that ends the transition, which React
holds for as long as any other async action in the app is pending (entanglement, conventions
2.3 item 5) or while the resulting render suspends. In that window the button still shows
`data-pending` and `aria-disabled`, and a click starts a **new run**: the previous one has
fully settled, so this is not a duplicate side effect, and the new run's commit joins the held
one. The alternative, ignoring clicks whenever the button looks pending, silently dropped user
intent: a non-awaiting "+1" Button clicked three times while an unrelated action was pending
got **one** call. Losing intent is the worse failure; the cost accepted is
that `aria-disabled="true"` can outlast the guard by the length of the held commit.

For the `formAction` path the guard is `formPending` (section 6.2), a render value: React's form
status is the only source of truth for a submission the Button did not run itself, and React
itself keeps that status pending until the submission's commit. A same-task double click sees a
stale `false` there (a user cannot produce one; the native submission is already cancelled by
React); in a held-commit window a `formAction` click is ignored, unlike an `action` click, and
the docs say so.

### 5.3 `aria-disabled="true"` while pending

A control that will not act is, to assistive technology, unavailable; that is what React Aria
renders for `isPending` and what the research recommends (2.4). Under `whilePending="ignore"`
the Button sets it while `pending` (either source) and removes it in the same commit that clears `data-pending`. It does
**not** set `data-disabled` (that attribute is the consumer's `disabled`, and `[data-pending]`
styles pending) and `state.disabled` stays `false`, so `children(state)` reads as before.

Never native `disabled` (verified: Chromium and Firefox move focus to `<body>` two frames after a
focused button becomes `disabled`; WebKit leaves focus on a dead element), never `inert`, and no
`aria-busy` (its meaning is "my content is being modified"; NVDA and VoiceOver ignore it and JAWS
may hide the button's name, research 1.1). The consumer may add `aria-busy` through pass-through.

Whether the `aria-disabled` *change* on the focused element is spoken is not known (research
2.4 did not verify it); the value is that a user who presses again, or returns to the button,
hears "unavailable" rather than nothing.

### 5.4 Counting every click

With the default `whilePending="run"` every click runs the action, also while an earlier run is
pending (section 18.2). An action that does not await its work
(`action={() => { void increment(); }}`) is still the spelling for "the UI must not wait"
(conventions 2.3 item 5): pending ends at once. An ordered, result-threaded sequence is
`useActionState` (React's queue), passed as `formAction` or called from the action.

### 5.5 The other pure triggers

`Dialog.Close`, `Popover.Close`, `Menu.Item` and `Toast.Action` have the same prop with their
own defaults: conventions 2.5.1, sections 16 and 18.4. `Form.Submit` has none (section 6.4).

---

## 6. Forms

### 6.1 `type`

`type="button"` by default: a Button whose behaviour is its `action` must not also submit the
form it happens to sit in (every surveyed library agrees). When `formAction` is given the default
flips to `"submit"`, because React warns on `type="button"` with a `formAction` and a non-submit
button never submits. The Button's own `type` prop overrides either default; a consumer may write
`<Button type="submit">` (the form's own submit button; see 6.4 for why `Form.Submit` is the
better spelling) or `<Button type="reset">`.

Development warnings, once per instance: `action` together with `type="submit"` or `"reset"`
("one click would run `action` in a transition and submit / reset the form"); `action` together
with `formAction` (an error: two actions for one click; the Button runs `action` and leaves
`formAction` in place, so the console tells the author which one they meant).

### 6.2 `formAction` and per-submitter pending

React runs a submitter's function `formAction` instead of the form's `action`, in the form's host
transition, with its automatic reset, and `useFormStatus()` reports `{ pending, action }` where
`action` is **the submitter's function** (verified in 19.3.1, research 3.2). The Button reads
`useFormStatus()` unconditionally (a hook; outside a form it reports not pending) and computes

```ts
named = status.pending && typeof formAction === "function"
  && (status.action === formAction || status.action === submittedWith.current);
// `submitted`: useState latch, updated during render (derived state, #154)
if (named && !submitted) setSubmitted(true);
if (!status.pending && submitted) setSubmitted(false);
formPending = typeof formAction === "function" && (named || (status.pending && submitted));
```

Rule: **a `formAction` Button is pending from its own submission until the form's submissions
have all finished.** `status.action` is only the *latest* submitter's function: React keeps one
optimistic status per form and overwrites it on every submission, naming no submitter and keeping
no history. Without the latch, A lost `pending` the moment B (or the form's own `action`) submitted
while `a` still ran, and under `whilePending="ignore"` a third click on A ran `a` a second time
(#154, `memo/architect/154-per-submitter-pending.md`). Overlapping form actions are not queued
(each runs at once) and React entangles them: `status.pending` ends once, when every overlapping
submission has settled, and a settled action's transition updates are committed only then. So
"pending exactly while my own promise is unsettled" is rendered nowhere in React; the latch gives
the observable truth and the same lifetime as two overlapping `Button action`s. A Button that did
not submit is still never pending; only React's status sets the latch, so a click whose submission
constraint validation or an `onSubmit` cancels never latches. Wrapping the function to await its
own promise was rejected: React would be given a wrapper, so a Server Function would lose its
`$$FORM_ACTION` (no submission before hydration), `useFormStatus().action` would no longer equal
the consumer's function and a `useActionState` dispatch would no longer be recognised; and its
pending, a transition too, would be held just as long.

Known limits (documented, not solved): two submissions started by script in one task
(`requestSubmit(a); requestSubmit(b)`) never render the status that names `a`, so A is not
pending (user input cannot do this: React flushes the status between discrete events); two
Buttons sharing one function stay indistinguishable (below); after `b` settled first, B stays
pending until `a` settles, which is React's entanglement, not the latch.

`submittedWith` is a ref the click handler sets to the `formAction` the Button is about to submit
with. The second comparison exists because the identity of an inline `formAction={(fd) => …}`
changes when the parent re-renders during the submission, which would otherwise drop `pending`
after the first re-render; the click handler also runs for the click an implicit submission sends
to the default button, so both paths capture it. A `form.requestSubmit(button)` from script sends
no click and relies on the first comparison; the docs recommend a stable function (a Server
Function, a `useActionState` dispatch, `useCallback`) for that case.

A string `formAction` (a URL) is a navigating submission: no React status, no pending, no guard
beyond the browser's own.

The match is by **function identity**, because `useFormStatus` reports no submitter. Two Buttons
that share one `formAction` function (`formAction={dispatch}` with different `name` / `value`)
therefore both show `pending` and both ignore clicks while either one's submission runs (review
minor 6); give each its own function (`dispatch.bind(null, "draft")`) when they must be told
apart. The docs props table carries this note next to the identity one.

What this is not: a plain `<Button type="submit">` with neither `action` nor `formAction` does
**not** read the form channel into its `pending` (decision 3). That would duplicate
`Form.Submit`, and conventions 2.7 reserves form-channel pending for parts with no action of
their own. The Button's `useFormStatus` call is spent only on its own `formAction`.

### 6.3 With `Form.Root`, `Dialog.Form`, a plain `<form action>`

`Form.Root` runs a function `action` itself from `onSubmit` but leaves a submitter that carries a
`formaction` attribute to React (`form-root.tsx`: `submitter.hasAttribute("formaction")`).
react-dom writes a `formaction` attribute for a function `formAction` (the `javascript:` URL that
throws if the form is ever submitted without React), so a `Button formAction` inside a `Form.Root`
goes React's way: the Button's function runs, the form's `action` does not, React's automatic
reset applies to that submission, `Form.Root` shows form-channel `data-pending` as for any
submission and never sees `errors` from it (a `formAction` Button's result is not the Form's
`useActionState` result; a consumer who wants Field errors from a secondary action routes it
through the same `useActionState` and passes its dispatch as `formAction`). `Dialog.Form`
observes the channel the same way, so `closeOnSettle` closes after a `formAction` submission
too. Test row 12 guards the first two facts.

### 6.4 `Form.Submit` stays, and is not guarded

| | `Form.Submit` | `Button formAction` | `Button type="submit"` |
| --- | --- | --- | --- |
| Submits | the form's own `action` | its own function instead | the form's own `action` |
| `pending` | the form channel: any submitter | from its own submission until the form's submissions have all finished | none |
| Re-entry while pending | **not blocked** (a `useActionState` dispatch queues it, in order; a plain action runs concurrently; `Form.Submit` has no action of its own to key a guard on, and the queue is React's documented semantics for forms, conventions 2.5) | `whilePending`: submits again (`"run"`, default) or cancelled (`"ignore"`) | none |
| Use | the one primary submit button | secondary submitters | rarely; `Form.Submit` is the documented spelling |

`Form.Submit` does not block repeat submissions. Its pending is the form's, not its own:
blocking on it would make "Save draft" pending (a `Button formAction`) also disable "Publish"
(`Form.Submit`), which is exactly the coupling conventions 2.7 forbids in the other direction;
and a `useActionState` form has the ordered queue React designed for repeat submits. A consumer
who wants a hard block styles `Form.Submit[data-pending] { pointer-events: none }` or renders
the primary button as `<Button formAction={dispatch} whilePending="ignore">` to get the guard.

### 6.5 Implicit submission

Enter in a text field clicks the form's default button (the first submit button in tree order).
If that is a pending `Button formAction`, the click goes through the Button's guard and is
cancelled: no second submission, the honest result for a user who pressed Enter twice. If the
default button is `Form.Submit` or a plain `Button type="submit"`, nothing is blocked (6.4).
React Aria's trick of flipping a pending submit button to `type="button"` is not used: the probe
shows a form with one text field then submits through implicit submission with **no** default
button at all, running the form's action instead of the button's (research 3.2).

---

## 7. Composition

### 7.1 Merge order and the cancelled click

Conventions 1.2: the `render` element's handlers run first, then the part's pass-through ones,
then the library's. For `<Dialog.Trigger render={<Button action={a} />}>` the Trigger's library
`onClick` is a pass-through prop of the Button and runs before the Button's; it has already
`preventDefault()`ed (cancelling the `command`) and dispatched the open. The Button then runs `a`
regardless of `defaultPrevented` (5.1). The Button's guard cannot stop the Trigger (it ran
first), which is right: the Trigger's open has its own overlap rules.

What the user sees depends on `a` (review deviation 1): the open is a Root transition and is
entangled with the Button's pending action, so with an **awaited** `a` the Trigger shows
`data-open` and `data-pending`, the Button shows `data-pending`, and `showModal()` runs in the
commit that follows `a`'s settlement (the Dialog opens only on committed state, by its design); a
second click while `a` pends is ignored by the Button and is a no-op for the Trigger (the open is
already intended). With a **non-awaiting** `a` (2.3) the dialog opens at once. The docs example
uses the non-awaiting form and names the awaited behaviour.

The reverse, `<Button render={<Dialog.Trigger />}>`, also works (the Button's `onClick` becomes
the Trigger's pass-through and runs first; the Trigger's handler runs last and opens), but the
documented direction is Trigger-renders-Button.

### 7.2 Tooltip

`Tooltip.Trigger` attaches its hover / focus listeners with `addEventListener` and merges
`aria-describedby` as a token list. A pending Button removes nothing and is not natively
disabled, so the tooltip opens by hover and by focus throughout. A natively disabled Button
never opens a tooltip (no events); `focusableWhenDisabled` is the answer for a disabled button
that needs one (section 3). The Tooltip's composite-role check (toggle-group.md 18) is unaffected:
a Button inside a Toolbar has the engine's `tabindex`, which the check already allows.

### 7.3 Toolbar: `Button` reads `ToolbarContext`

`Button` reads `ToolbarContext` (`useToolbarContext()`, also read by `ToggleGroup.Root`,
`Toolbar.Separator` and by every other library button-like part: `Toggle`, `ToggleGroup.Item`
and the Triggers of Menu, Popover, Dialog, AlertDialog and Drawer, which are focusable when
disabled inside a Toolbar exactly as `Button` is, conventions 3.6), and the Toolbar has no
button part of its own: one implementation, one name. Inside a `Toolbar.Root` the rule is `focusableWhenDisabled` forced
on, which is why the prop exists: the context only flips its default. A `Button disabled` in a
toolbar therefore renders `aria-disabled` (APG), stays in the arrow-key sequence and in AT
discovery, and never dispatches; `action`, `formAction`, `whilePending`, `type` and `data-*`
are as anywhere else.

Edge to document: the context is React's, not the DOM's, so a Button rendered under a
`Toolbar.Root` in the React tree but outside its DOM items (inside a `Menu.Popup` opened from
the toolbar) is also focusable-disabled; harmless.

### 7.4 Invoker Commands

`command` / `commandfor` pass through, typed by `internal/platform-attributes.ts`; the Button adds
no prop. Rules:

- `<Button commandfor command>` with no `action`: the browser runs the command, before and after
  hydration (the explicit `type="button"` matters inside a form: only the Button state reaches the
  command). No pending (nothing to await).
- With `action` too: one click runs the action (transition) **and** the command (the button's
  activation behaviour, after dispatch). While pending the guard cancels the click, so the command
  does not run again either (5.2). An action that must stop the command calls
  `details.event.preventDefault()` in its sync prefix.
- `Dialog.Trigger` / `Popover.Trigger` / `Menu.Trigger` / `Dialog.Close` / `Popover.Close` own
  their `command` / `commandfor`; wrapping a Button in one of them lands the Trigger's command on
  the Button's element, as today for any render element.

### 7.5 Menu

A Button inside a `Menu.Popup` is not a menu item: no `role="menuitem"`, not in the menu's roving
set, not closing the menu. `Menu.Item` is the action item; the docs say so.

---

## 8. Accessibility

### 8.1 ARIA

| Rendered | Value |
| --- | --- |
| element | `<button type="button">` (implicit `button` role); any `render` element keeps its own role |
| `aria-disabled` | `"true"` while pending (`whilePending="ignore"`) and not natively disabled, or while `disabled` with `focusableWhenDisabled`, inside a Toolbar, on a host element of another tag (`<a href>`), or on a component `render` whose click only the Button acts on (section 4); absent otherwise |
| `disabled` | the prop, on a host `<button>` (no `render`, the function form, `render={<button />}`), and on a component or host `<input>` render whose click the browser acts on (submit, reset, an invoker; section 4); never on a host link, where it would mean nothing to the browser and hide the disabled state from AT, nor on a component whose click only the Button acts on |
| name | the consumer's (`children`, `aria-label`, `aria-labelledby`); the Button never touches it, so a `{({ pending }) => pending ? "Saving…" : "Save"}` name change is the consumer's choice and, as every name change on the focused element, is not reliably spoken (field-form.md M2) |
| `aria-describedby` | token-merged (a Tooltip adds its id) |
| `aria-busy` | pass-through only |

### 8.2 Keyboard

| Key | Native `<button>` | `render={<a href>}` |
| --- | --- | --- |
| Enter | click → `action` (unless pending / disabled) | click → `action` and navigation; while pending: neither |
| Space | click on keyup → `action` | nothing (a link; the consumer adds `role="button"` and a key handler if a link must act on Space) |
| Tab | sequential, or the Toolbar's roving stop inside one | same |

Focus never moves because of pending: the Button is focusable throughout, and the commit that
ends the action does not touch focus.

### 8.3 What assistive technology hears, and the outcome pattern

Nothing from the library when the action starts or ends (decision 2). What a screen-reader user
gets: the click (as any button), `aria-disabled` if they press again or revisit the button, and
whatever the **outcome** produces, which is the consumer's and where WCAG 4.1.3 status messages
belong: a `toast()` (announced by the Viewport), a `Field.Error` (the Form focuses it), content
that replaces the button, or `ariaNotify` from the action. The docs show the toast and the
"content replaces the button" patterns. If a built-in announcement is added later, it copies
React Aria's shape: only while focused, only on the start / end edges, strings the consumer
already provides, overridable through `announce(state)` (conventions 11).

---

## 9. ViewTransition

`transition` wraps the Button's element in `<ViewTransition default={transition}>` through
`useTransitionBoundary("Button", …)`, only when given (conventions 5.1). What it animates: the
commit that ends the action, where `children(state)` keyed on `pending` swaps a spinner for the
label (a pure trigger's only state, conventions 5.1), and a mount / unmount of the Button inside a transition. The click itself
commits nothing. No `fsui-button` types: `useActionTrigger` attaches none, as for Toolbar
(conventions 5.3). Reduced motion is the consumer's CSS.

---

## 10. Async walkthroughs

1. **Click, slow action, resolve.** Click → `run` starts the transition (ref `inFlight = 1`), sync
   prefix of `action` runs during the event; render: `data-pending`, `aria-disabled="true"`,
   focus unchanged. Resolve → `inFlight = 0`; commit: attributes gone. One call.
2. **Click twice, pointer.** Second click while the action runs: the hook sees `inFlight > 0`,
   `run` returns `false`, the handler `preventDefault()`s and returns. One call. After settle, a
   third click runs.
3. **Enter held (key repeat).** Repeated `click`s in quick succession: the first starts the run,
   the rest are ignored by the ref even before React re-rendered.
4. **Rejection.** `action` rejects → React's route to the nearest boundary above the Button (the
   Button is the transition owner); the boundary replaces the Button, so there is no stuck guard.
   Caught inside: the action resolves, pending ends, the next click runs.
5. **Settled, commit held.** `action` resolved while another async action elsewhere is pending:
   the commit that clears `data-pending` waits for it (entanglement). The in-flight counter is
   already zero, so a click in that window starts a **new run** (the action runs at once; its
   commit joins the held one); the button looks pending but accepts the click, which is the
   lesser failure (5.2). When the other action settles, one commit clears everything.
6. **Two Buttons.** A's action pending; B is clicked: B's handler runs at once (its own counter
   is zero), B's action runs immediately, B shows `data-pending` from the
   sync `isPending` render; A and B clear in the same commit when both have settled. No Button
   blocks another; only the commits are shared.
7. **Suspending content.** The action commits a value that makes sibling content suspend: the old
   content stays, `data-pending` stays until the content is ready (conventions 6). The action
   itself has settled, so a click meanwhile starts a new run (as 5); an action that must not run
   twice while its result loads awaits the load inside the action instead of letting the render
   suspend.
8. **`formAction` twice.** Click → React cancels the native submission and starts the host
   transition; `submittedWith = formAction`; render: `pending` (status matches), `aria-disabled`.
   Second click: `formPending` is `true` → `preventDefault()`, so React's submit handler never
   sees a second `submit` event. Resolve → status clears, React resets the form.
9. **Two `formAction` Buttons.** A pending; B clicked: B's own submission starts (React runs them
   concurrently, verified), both show pending until both submissions have settled (React holds
   the form status for the whole overlap; A keeps it through the latch of 6.2, #154),
   `Form.Submit` in the same form shows the form channel for the whole time.
10. **`render={<a href>}`, slow action.** First click: action runs, navigation proceeds natively
    (the consumer's action may `preventDefault()` to hold it). Second click while pending:
    cancelled, no navigation.
11. **Unmount while pending.** The action keeps running; its result is not awaited by anyone; a
    rejection after unmount is passed to `reportError`: React would route it only through a
    render of the unmounted part (#152, conventions 2.4).
12. **`disabled` flips to `true` during pending.** Native `disabled` lands (focus moves per the
    engine; the consumer chose it) next to `aria-disabled`; on settle only `aria-disabled` goes.

---

## 11. Server Components, directives, before hydration

Files: `button/button.tsx` (`"use client"`: `useTransition` through `useActionTrigger`,
`useFormStatus`, a ref, an event prop), `button/index.ts` (no directive). No directive-free
variant: a Button with no `action`, no `formAction` and no `command` does nothing a native
`<button type="button">` does not, and a directive is per module, so an action-less root could not
import a client `action` path (research 5).

What a Server Component can do: render `Button` with serialisable props; pass a **Server
Function** as `action` (receives `(details)` with `details.event === undefined`) or as
`formAction` (progressively enhanced: `formaction` / `formmethod` / `name="$ACTION_ID_…"` in the
HTML, submits before hydration and without JavaScript); pass `commandfor` / `command`; pass a
string `className` / `style` object / `transition` (a string or an object of strings is
serialisable); style pending with `[data-pending]` CSS. What it cannot: pass function `children`,
`className`, `style` or `render` (the spinner-in-children pattern needs a Client Component), pass a
plain client function as `action`.

Before hydration: an `action` Button does nothing on click (no residual browser path, no mount
reconciliation); a Server Function `formAction` Button submits natively; a
command Button runs its command; a `render={<a href>}` navigates. The server markup carries no
`aria-disabled` and no `data-pending`.

---

## 12. Not in v1

- A consumer-driven `pending` / `loading` prop (React Aria `isPending`, MUI `loading`) for work the
  Button did not start: the library's pending is always a transition the part owns; the form case
  is `Form.Submit`; anything else is CSS on the consumer's own state.
- A built-in announcement (8.3) and `aria-busy` (5.3).
- An opt-out of the re-entry guard (5.4) and a library queue (conventions 2.5).
- `href` as a prop: `render={<a href>}` or a router `Link`.
- Toolbar-specific extras (`Toolbar.Link`, `Toolbar.Group`): the Toolbar design has none.
- A `details.reason`: a Button has one way to activate.

---

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## 14. Docs page

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## 15. Implementation notes

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## 16. The other pure triggers

The users of `useActionTrigger`, and what `whilePending="ignore"` means on each part. The
defaults are in 18.4 and conventions 2.5.1.

### 16.1 Which `useActionTrigger` users are pure triggers

| User | What `run` wraps | Pure trigger? | `whilePending` |
| --- | --- | --- | --- |
| `Button` | its `action` | yes | prop, default `"run"` |
| `Dialog.Close` | `action`, then the close | yes | prop, default `"ignore"` |
| `Popover.Close` | `action`, then the hide | yes | prop, default `"ignore"` |
| `Menu.Item` | `action`, then the menu close | yes | prop, default `closeOnActivate ? "ignore" : "run"` |
| `Toast.Action` | `action`, then the toast close | yes: an Undo / Retry / View run twice is a duplicate side effect | prop, default `closeOnActivate ? "ignore" : "run"` |
| `Slider.Root` (`runStep`) | each step's `valueChangeAction` | **no**: a continuous control dispatches one step per pointer move or key press and every step must run (conventions 2.1, 10.1 "Continuous control"); the hook is used for per-step `pending` and superseded-rejection reporting (`reportError`, conventions 2.4) only | none: every step runs |
| `NumberField.Root` (`runStep`) | each step's `valueChangeAction` (press-and-hold) | **no**, as Slider | none: every step runs |

### 16.2 The hook's option

`useActionTrigger({ openGeneration?, ignoreWhilePending? })`. `ignoreWhilePending` is `false`
by default; a part passes `(whilePending ?? <its default>) === "ignore"`, read per render.
`run` returns `false` when the run was ignored. The four pure triggers with a `whilePending`
prop (Button, the Close parts through `useOverlayClose`, Menu.Item, Toast.Action) do this
through `usePureTrigger({ whilePending, defaultWhilePending, openGeneration? })`
(`internal/action/use-pure-trigger.ts`), which also returns `ignoring`, `runActivation(event, work,
then?)` (`run` plus the `preventDefault()` of an ignored activation) and `pendingProps(
disabledProps, pending?)`, the owned `aria-disabled` (through `pendingAriaDisabled`, 17.2) and
`data-pending`. Button passes its pending merged with the form channel; Slider and NumberField
call `useActionTrigger` directly (no `whilePending`).

### 16.3 Per-part behaviour

Under `"ignore"`, common to the four parts: while the part's own run is in flight (in-flight
counter, never the rendered `pending`, 5.2), a click / Enter / Space starts nothing and is
`preventDefault()`ed; the part renders `aria-disabled="true"` for exactly the renders where
`data-pending` is set; `data-disabled` and `state.disabled` stay the consumer's `disabled`;
every other listener keeps working. `aria-disabled` is among each part's owned keys. Under
`"run"` every activation runs and the part's close is requested once, when the last run in
flight settles and only if the latest run resolved (conventions 2.5.1).

- **`Dialog.Close`** (dialog.md "Pending, in order"). The click is already always cancelled in
  library mode; with `action`, `run` returning `false` makes the handler return before
  `close()`. Pending spans the action **and** the close commit (entanglement), so the button is
  `aria-disabled` until the dialog is closed; harmless, it is leaving. Without `action` nothing
  changes (no run, no pending). The open-generation guard is unchanged. JS-free mode with
  `action`: same guard before `dialog.close()`.
- **`Popover.Close`** (popover.md 3.4): identical shape; pending spans the action and the hide.
- **`Menu.Item`** (menu.md 2.3, 12). The activation path (`useMenuItem`'s `activate`) calls
  `run`; when it returns `false` the keydown / click is `preventDefault()`ed and nothing else
  happens. The item renders `aria-disabled="true"` while pending **and `menu-dom.ts` must stop
  reading `aria-disabled`**: `isDisabledItem(item)` keys on **`data-disabled`** (present exactly
  when the item's `disabled` prop is set). Its only reader is `edgeItem` (the open focus, and
  the Trigger's ArrowDown / ArrowUp while the menu is open); the in-menu arrows, Home / End and
  typeahead walk every item, disabled included (menu.md 5, APG), and never read it. `useMenuItem`
  emits `data-disabled`; `Menu.SubmenuTrigger` too. Consequence: a pending item is an ordinary
  item for navigation and still the "first enabled item" for the open focus, which is right (it
  is pending, not disabled).
  `closeOnActivate={false}` items (a "Refresh" item) are the ones where the guard is visible:
  the item stays, shows `data-pending`, and a second Enter does nothing until it settles.
  `CheckboxItem` / `RadioItem` are state owners (`useControllableAction`), not pure triggers:
  unchanged, latest intent wins.
- **`Toast.Action`** (toast.md 4.2, walkthrough 5). `run` returning `false` returns from the
  handler. `aria-disabled` while pending is an owned key (`disabled` on the Toast parts: toast.md). The
  Root's `actionPending` pauses the timer. "Undo clicked twice": the second click is ignored;
  one dispatch, one close.

### 16.4 Test rows per part

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## 17. `disabled` on link and component renders, library-wide

Conventions 1.2: a `disabled` part renders `aria-disabled="true"`, not native `disabled`, where
its rendered element certainly cannot be natively disabled, or where the part's own click
handler is the action and the element is not certainly a host `<button>`; where the browser runs
the click and the element may be a button, native `disabled`. This section applies it to every
part that owns `disabled` and accepts an arbitrary `render`.

### 17.1 The parts

| Part | `disabled` on a host `<button>` | Click handler always installed? | Focusable-disabled branch for other renders |
| --- | --- | --- | --- |
| `Dialog.Close` | native `disabled`, owned | library mode or with `action`; JS-free mode without `action` is the browser's `request-close` command | **yes, when a click handler is installed** (`handlesClick: installClick`). In JS-free command mode a component render must render a `<button>` anyway (dev warning), and native `disabled` is what stops the command; a host link there is `aria-disabled` (it cannot be natively disabled, and it is no invoker), and while disabled the part installs a click handler that only cancels the click (`cancelClick`), so the link does not navigate after hydration. |
| `Popover.Close` | same | same | same |
| `Dialog.Trigger` (and AlertDialog's, Drawer's) | native `disabled`, owned; **inside a Toolbar `aria-disabled`** (`alwaysFocusable`, conventions 3.6), with a `cancelClick` handler in JS-free mode | library mode or non-modal; JS-free modal mode is the `show-modal` command | same condition (`installClick`) |
| `Popover.Trigger` | native `disabled`, owned; inside a Toolbar `aria-disabled`, likewise | library mode only; JS-free mode is `toggle-popover` | same condition (library mode) |
| `Menu.Trigger` | native `disabled`, owned; inside a Toolbar or a Menubar `aria-disabled` | always (`onClick` + `onKeyDown`) | **yes** |
| `Toggle` | native `disabled`, owned; inside a Toolbar `aria-disabled` | always | **yes** |
| `ToggleGroup.Item` | native `disabled`, owned, and no item of the roving engine; inside a Toolbar `aria-disabled` and reached by the arrows | always | **yes**; a link / component Item that is disabled is **reachable by the arrows** in a standalone group too (the engine leaves out `:disabled` only), which is the rule for an `aria-disabled` item (conventions 3.10) |
| `Combobox.Trigger`, `Combobox.Clear` | native `disabled`, owned (`tabIndex` owned too) | always | **yes** |
| `NumberField.Increment` / `Decrement` | native `disabled` (also at bound / `readOnly`), owned | always (`useStepButton`) | **yes**; the at-bound case follows the same branch |
| `Form.Submit` | native `disabled`, owned | only while `disabled` (it cancels the click; an enabled submitter's click is the browser's) | **no** for anything that may be a submitter: no `render`, a host `<button>` or `<input>`, or a component render. With `aria-disabled` alone it would still submit before hydration and on implicit submission, so native `disabled` is the only correct disabled state for a submitter. A host element of another tag (`<a>`, `<div>`) takes the `aria-disabled` branch with the cancelled click (`field-form.md` 4). |
| `Button` | native `disabled`, owned; inside a Toolbar `aria-disabled` | always (it cancels the click while disabled) | **yes** when only the Button acts on the click, inside a Toolbar or with `focusableWhenDisabled`; **no** for a component or host `<input>` render whose click the browser acts on (a submit or reset `type`, the `formAction` default, `commandfor` / `popoverTarget`; with or without `action`), as `Form.Submit`; a host element of another tag is always `aria-disabled` (section 4) |
| `Select.Trigger` | native | must stay a `<button>` (conventions 1.2) | no (host button by contract) |
| `Tabs.Tab`, `Accordion.Trigger`, `Menu.Item`, `Menu.CheckboxItem` / `RadioItem` / `SubmenuTrigger` | `aria-disabled` already | | no change |
| `Toast.Action`, `Toast.Close` | see `toast.md` (the library `disabled` rule, #157) | always | see `toast.md` |
| `Tooltip.Trigger` | renders no `disabled` attribute (`data-disabled` only; the Root's `disabled` switches the tooltip off) | | no change |

Where the condition is "when a click handler is installed", the part computes `focusable` from
the same `installClick` flag it already has, so the branch and the handler always agree: the
handler is what makes `aria-disabled` safe (it returns before dispatch, and `preventDefault()`s
so a link does not navigate), exactly as `Button` does.

### 17.2 Shared mechanics

- `isHostButton(render)` from `internal/render-element.ts` is the predicate (no `render`, the
  function form, a host `"button"`) where the part handles the click.
- `disabledButton(render, disabled, { handlesClick?, alwaysFocusable? })` in the same module is
  the rule for every part of 17.1, `Button` and `Form.Submit` included: it returns `props`, the
  owned `disabled` / `aria-disabled` keys of the chosen branch, and `invoker`, whether
  `commandfor` / `command` may render. `handlesClick: false` (the browser runs the click) is
  native unless the element is a host element other than `<button>` / `<input>`;
  `alwaysFocusable` is the opt-in (`Button`'s Toolbar and `focusableWhenDisabled`, a submenu
  trigger).
- `pendingAriaDisabled(props, pending && ignoring)` merges the branch with a pure trigger's
  pending `aria-disabled` (Button, the Close parts, Toast.Action): `true` in the focusable
  branch, nothing while natively disabled (native `disabled` wins), else the pending rule.
- In the focusable branch the part passes `disabled: undefined` (owned removal) and
  `"aria-disabled": disabled ? true : undefined`; `data-disabled` and `state.disabled` are
  unchanged. Parts that already own `aria-disabled` for another reason (the Close parts, for
  pending) merge the conditions through `pendingAriaDisabled`.
- **`aria-disabled` is owned only where the part computes it**:
  in the focusable branch, and always on the parts that render it for pending. A
  host-button Toggle / Trigger outside the branch does not own the key, so a consumer's own
  `aria-disabled` passes through as before (conventions 1.2: "a part that does not own a key in
  some mode omits the key instead").
- **An invoker in the focusable-disabled branch owns its invoker attributes (`popoverTarget`,
  `commandfor`, `command`) as `undefined`**: `aria-disabled` has no behaviour, so a disabled component render that
  spreads onto a real `<button commandfor command>` would be a live invoker in the server HTML
  and open / close its target on a click before hydration, where native `disabled` used to make
  the button "not a valid invoker". With the attributes removed there is nothing to invoke while
  disabled; the implicit anchor and the platform's `aria-expanded` mapping are moot for a
  disabled control, and both return when `disabled` is unset. Applies to `Popover.Trigger`,
  `Menu.Trigger`, `Menu.SubmenuTrigger` (`use-popover-trigger.ts`), library-mode modal
  `Dialog.Trigger`, `Dialog.Close` and `Popover.Close`; harmless on a link render (an `<a>` is
  never an invoker).
- The `onClick` guard is `if (disabled) { event.preventDefault(); return; }` in `Toggle`, the
  Close parts and the Triggers, so a disabled link render does not navigate, as `Button`.
- No new prop: `focusableWhenDisabled` stays Button-only. The Toolbar context read is not:
  every part of this table that can be a Toolbar item (`Button`, `Toggle`, `ToggleGroup.Item`,
  the Menu, Popover, Dialog, AlertDialog and Drawer Triggers) passes
  `alwaysFocusable: toolbar !== null`, so all of them are focusable when disabled inside a
  Toolbar (conventions 3.6, toggle-group.md decision 13). `usePopoverTrigger` already has the
  option (`Menu.Trigger` uses it in a Menubar); Dialog's Trigger passes it to `disabledButton`
  itself.

### 17.3 Test rows per part

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.

## 18. `whilePending`

What a pure trigger does with an activation that arrives while its own action is pending is a
prop. The library-wide rule and the classification of every pure trigger are conventions 2.5.1;
this section is Button's share.

### 18.1 The prop

```ts
export interface ButtonProps /* … */ {
  /**
   * What an activation does while this Button's own `action` (or its own function `formAction`
   * submission) is pending. `"run"`: it runs as well; the Button shows `data-pending` until
   * every run has settled. `"ignore"`: it starts nothing, its default action is cancelled (no
   * second submit, navigation or command), and the Button renders `aria-disabled="true"` while
   * pending. Use `"ignore"` for an action that must not run twice (Save, Pay, Delete).
   *
   * @defaultValue `"run"`
   */
  whilePending?: WhilePending;   // "run" | "ignore", conventions 2.5.1 and 9.4
}
```

```tsx
<Button action={async () => { await incrementOnServer(); }}>+1</Button>   // counts every click
<Button action={save} whilePending="ignore">Save</Button>                 // one save at a time
<Button formAction={publish} whilePending="ignore">Publish</Button>       // one submission at a time
```

Why Button's default is `"run"`: Button is the fully user-owned trigger; the library does
nothing on a click but run the consumer's function, so it has no ground for a policy on how
often (conventions 2.5.1). It is also what React's `useTransition` and `<button formAction>` do.
The cost is stated plainly: **a double click on an unguarded Save runs the save twice**. The docs lead the Save example with `whilePending="ignore"`.

### 18.2 Behaviour by value

| | `"run"` (default) | `"ignore"` |
| --- | --- | --- |
| Second click, Enter, Space while pending | runs `action` again, in the same transition hook | starts nothing |
| The click's default action (link navigation, `command`, the `formAction` submission) | not touched by the Button | `preventDefault()`ed |
| `data-pending`, `state.pending` | from the first run until the last has settled and committed | while the one run is pending |
| `aria-disabled="true"` from pending | **never** | exactly while `data-pending`, unless natively disabled (native `disabled` wins) |
| `data-disabled`, `state.disabled` | the `disabled` prop only | the `disabled` prop only |
| Two runs in flight | yes | never |
| An older run rejects | `reportError`, once (conventions 2.4) | unreachable |
| The latest run rejects | Error Boundary above the Button, after older runs settled | Error Boundary above the Button |
| Guard source | none | the in-flight counter (5.2), or `formPending` for a function `formAction` |

The click handler is 5.1; `aria-disabled` is
`pendingAriaDisabled(disabledProps, pending && ignoring)` (17.2): `true` when
`disabled && focusable`, absent while natively disabled, else `pending && ignoring`. Under `"ignore"` the
counter-only guard and the settled-but-held window (5.2) and `aria-disabled`, never native
`disabled` (5.3), apply.

`disabled` wins over both values. A Button with neither `action` nor a function `formAction` is
never pending, so the prop does nothing there (no warning). Composition (7.1) is unchanged: in
`"run"` mode a `Dialog.Trigger render={<Button action={a} />}` runs `a` on every click, as the
Trigger dispatches on every click.

### 18.3 `formAction`

Under `"run"` a `Button formAction={fn}` is React's submitter with per-submitter pending (6.2)
and nothing more: a second click submits again, `pending` stays until React's form status
clears (also when another submitter's submission overlaps its own). Overlapping submissions are React's form channel, where **React drops the rejection of
an older overlapping submission** and the library cannot see it (conventions 2.5.1). Under `"ignore"` the guard is `formPending` as in 5.2, with its documented
difference (a render value: a click in a held-commit window is ignored). With the latch (6.2)
the guard holds through another submitter's overlapping submission: click A, click B,
click A again is cancelled while `a` runs. 6.5 (implicit
submission): Enter in a field submits again under `"run"`, is cancelled under `"ignore"`.

### 18.4 The other pure triggers

Conventions 2.5.1 has the table. `Dialog.Close`, `Popover.Close` (`useOverlayClose`),
`Menu.Item` and `Toast.Action` each have `whilePending?: WhilePending` and pass it with their
default to `usePureTrigger` (16.2), which renders `aria-disabled` from `pending && ignoring`.
Defaults: Close parts `"ignore"`; `Menu.Item` and `Toast.Action`
`closeOnActivate ? "ignore" : "run"`. Slider and NumberField have no prop: every
step runs.

### 18.5 Tests

Moved to `design/CHANGELOG.md` (part "button.md"). Not part of the contract: the code and the tests are the reference.
