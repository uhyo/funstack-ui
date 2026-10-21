# Button

Status: **Accepted by the product owner** (2026-10-22, GitHub issue #79, wave 8 tracker #80;
drafted 2026-10-18). Every recommendation accepted as recommended; user decisions: **`Toolbar.Button`
is removed now** (a breaking change, section 7.3 and the migration note in 14) and
`focusableWhenDisabled` ships in v1. The follow-up for the other pure triggers is **#81**.
Follows `design/conventions.md` (accepted); where this document and the conventions disagree,
the conventions win. The conventions amendments this design asks for are applied to
`design/conventions.md` in the same commit (resolved question 34).

Inputs: `docs/vision.md`, `design/conventions.md` (1.2, 2.3, 2.5, 2.7, 3.4, 3.6, 4.1, 7.1),
`docs/research/button.md` (af1993f; probes in `memo/platform-researcher/probes/16-button/`),
the product owner's decisions on the research (recorded in section 0),
`packages/ui/src/internal/use-action-trigger.ts`, `toolbar/toolbar-button.tsx`,
`form/form-submit.tsx`, `form/form-root.tsx`, `menu/menu-item.tsx`, `menu/menu-dom.ts`,
`dialog/dialog-close.tsx`, `dialog/dialog-trigger.tsx`, `popover/popover-close.tsx`,
`design/components/toggle-group.md` 3.4 and 11.5 (`Toolbar.Button`), `design/components/field-form.md`
(`Form.Submit`, repeat submits), `design/components/menu.md` 2.3. Prior art: React Aria Components
1.22 `Button` (`isPending`), Base UI 1.9 `Button` (`focusableWhenDisabled`), MUI 9 `loading`,
Radix Themes `loading`, GOV.UK `preventDoubleClick`.

## 0. Product-owner decisions this design starts from

1. A Button **ignores activation while its own action is pending**, by default. It renders
   `aria-disabled="true"` meanwhile and never native `disabled`, so focus stays and a Tooltip
   still works. Conventions 2.5 and 3.6 are amended.
2. **No `aria-busy` by default, no built-in announcement** in v1.
3. **Forms**: default `type="button"`, `"submit"` when `formAction` is given; `formAction` shows
   pending for this button's own submissions only; `Form.Submit` stays; a plain `type="submit"`
   Button does not read `useFormStatus`.
4. **Composition**: an already-cancelled click does not block the action
   (`Dialog.Trigger render={<Button />}` works); focus and hover listeners keep working while
   pending; the Toolbar question is decided here (section 7.3).
5. The module is `"use client"`; the cost to Server Component callers is documented (section 11).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One plain component, `Button` (`@funstack/ui/button`), a `<button type="button">` by default; `render` allowed (`<a href>` included). No parts, no `.Root`. |
| 2 | Action | Bare `action(details)` in the Button's own transition through `useActionTrigger` (conventions 3.4). `data-pending` / `state.pending` while it runs. Without `action` the Button is a plain native button (a `formAction` submitter, an Invoker Command, a link). |
| 3 | Re-entry | **Ignored while pending**: a click, Enter or Space while the Button's own `action` (or its own `formAction` submission) is in flight starts nothing and is `preventDefault()`ed, so a link does not navigate, a form does not submit and a command does not run twice. Guarded by a synchronous in-flight ref **and** the rendered `pending` (section 5.2). No opt-out prop (section 5.4). |
| 4 | AT state while pending | `aria-disabled="true"` (owned), `data-disabled` **not** set, `state.disabled` unchanged. Never native `disabled`, never `inert`, no `aria-busy`, no announcement. |
| 5 | Library-wide rule | "A pure trigger ignores re-entry" becomes the conventions' rule (2.5, 3.6) and a `useActionTrigger` option; **wave 8 lands it for Button only**; `Dialog.Close`, `Popover.Close`, `Menu.Item` follow in **#81** because their tests and docs are built on re-run and `Menu.Item`'s navigation keys on `aria-disabled` (section 5.5). `Form.Submit` is **not** guarded (section 6.4). |
| 6 | `type` | Default `"button"`; `"submit"` when `formAction` is given. The Button's own `type` prop wins (`"submit"` / `"reset"` allowed); the computed value is owned on a `<button>` and omitted for any other element. `action` with a submitting `type` warns in development. |
| 7 | `formAction` | First-class pass-through with **per-submitter pending**: `useFormStatus().pending && status.action === <the function this Button submitted with>`. `action` and `formAction` together is a development error. Progressive enhancement is React's (a Server Function submits before hydration). |
| 8 | `disabled` | Native `disabled` (owned) plus `data-disabled`, like `Dialog.Close` / `Form.Submit`. `focusableWhenDisabled` renders `aria-disabled="true"` instead (Base UI's name); inside a `Toolbar.Root` it is implied `true` (APG Toolbar). Never dispatches either way; a disabled link does not navigate. |
| 9 | Toolbar | `Button` reads `ToolbarContext`; **`Toolbar.Button` is removed** (user decision, a breaking change): a Toolbar's command button is `<Button>`, with the same `aria-disabled` behaviour `Toolbar.Button` had. One implementation, one name. |
| 10 | Composition | Button does **not** treat a `defaultPrevented` click as a veto (a Trigger-wrapped Button runs its action); its guard cannot stop an outer part's handler that ran first; `command` / `commandfor` pass through untouched (both the action and the command run on one click). |
| 11 | Announcement | None in v1; the outcome is the consumer's (toast, Field error, `ariaNotify` in the action). `aria-busy` is pass-through. |
| 12 | ViewTransition | `transition` on the Button (content keyed on `pending`, the Toggle rule); no `fsui-*` types (as Toolbar). |
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
keyboard (Enter), as `Menu.Item` and `Toolbar.Button` already allow.

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
pending while `saveDraft` runs, "Discard" is not, even though `useFormStatus().pending` is `true`
for the whole form. Both Buttons are `type="submit"` (the default once `formAction` is given) so
constraint validation, `FormData` and React's automatic reset all work; a second click on a
pending one is ignored. The Server Functions render as `formaction` attributes before hydration,
so the buttons submit without JavaScript (React's progressive enhancement, unchanged).

### 2.3 A Trigger that is a Button

```tsx
<Dialog.Root>
  <Dialog.Trigger render={<Button action={prefetchProfile} />}>Edit profile</Dialog.Trigger>
  <Dialog.Popup>…</Dialog.Popup>
</Dialog.Root>
```

The Trigger's library click handler runs first (it cancels the native command and opens the
dialog through the Root's transition); the Button's handler runs next and runs `action` although
the click is already `defaultPrevented`. The documented direction is "Trigger renders Button", as
for `Dialog.Trigger render={<Menu.Item />}`. The same works with `Popover.Trigger` and
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
Toolbar example). This is what `Toolbar.Button` did; `Button` replaces it (section 7.3).

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
   * the Button. While it is pending the Button ignores further activation and renders
   * `aria-disabled="true"`. Not combinable with `formAction` (development error).
   */
  action?: Action<[details: ButtonActionDetails]>;
  /**
   * React's `formAction`: a function (a Server Function, a `useActionState` dispatch, a client
   * function) or a URL, run by React instead of the form's `action` when this Button submits the
   * form. With a function, the Button is `pending` while its own submission runs (not while
   * another submitter's does), ignores further activation meanwhile, and defaults to
   * `type="submit"`.
   */
  formAction?: ComponentPropsWithRef<"button">["formAction"];
  /**
   * Default `"button"`, or `"submit"` when `formAction` is given. Owned on a `<button>` (set it
   * here, not on a `render` element); omitted for other elements. `action` together with
   * `"submit"` / `"reset"` warns in development: one click would do two things.
   */
  type?: "button" | "submit" | "reset";
  /**
   * Native `disabled` (owned; a `render` element cannot re-enable it) and `data-disabled`.
   * Never dispatches. With `focusableWhenDisabled`, or inside a `Toolbar.Root`, renders
   * `aria-disabled="true"` instead so the Button stays focusable.
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens. Default
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

ARIA state the Button computes: `aria-disabled="true"` while `pending`, while
`disabled && (focusableWhenDisabled || inToolbar)`; absent otherwise.

Owned keys (conventions 1.2; a `render` element cannot re-introduce them):

| Key | Value | When |
| --- | --- | --- |
| `type` | the Button's `type` prop, else `"submit"` with `formAction`, else `"button"` | on a `<button>` (`rendersButton(render)`); the key is omitted for any other element |
| `disabled` | the prop, unless `focusableWhenDisabled` / Toolbar (then `undefined`, which removes it) | always |
| `aria-disabled` | `true` while pending or focusable-disabled; `undefined` otherwise | always |
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

### 5.1 The click handler

```ts
onClick: (event) => {
  if (disabled) {
    event.preventDefault();          // a disabled link must not navigate either
    return;
  }
  if (action === undefined) {
    // A native button: formAction, command, link, plain submit. Only the re-entry guard applies.
    if (formPending) event.preventDefault();   // my formAction submission is in flight
    return;
  }
  const details = createActionDetails(event.nativeEvent, {});
  const started = run(() => action(details));  // useActionTrigger, ignoreWhilePending: true
  if (!started) event.preventDefault();        // ignored: do not navigate, submit or run a command
}
```

`event.defaultPrevented` is **never read**: an outer part (`Dialog.Trigger`) cancels the click as
part of its own mechanism before the Button's handler runs, and the Button must still run its
action (decision 4; this is the complementary case to conventions 2.3 item 3, which is about
checkable inputs where a cancelled click reverts the DOM). The warning of 2.3 item 3 (a
`preventDefault()` in the sync prefix) does not apply to a pure trigger: there is no DOM state to
revert, and `details.event.preventDefault()` in the action is a legitimate way to stop a link's
navigation or a command.

### 5.2 What "ignored while pending" means

While the Button's own run is in flight, an activation (pointer click, Enter, Space, a
programmatic `.click()`, the click an implicit form submission sends to the default button):

- starts **no** second run of `action` (and sends no second submission when the pending is a
  `formAction` one);
- is `preventDefault()`ed, so a `render={<a href>}` does not navigate again, a `formAction`
  Button does not submit again, and a `command` does not run again;
- is **not** `stopPropagation()`ed: an outer part's handler already ran (merge order), and
  ancestors see the click as usual;
- leaves every other listener alone: focus, blur, hover, pointer enter / leave, keydown all fire,
  which is what keeps a `Tooltip.Trigger` and the consumer's own pass-through handlers working.

The guard reads two things, and ignores when **either** says pending:

1. an **in-flight counter in a ref** inside `useActionTrigger`, incremented synchronously when
   `run` starts the transition and decremented when the work settles. This catches two
   activations in one task (a double `fireEvent.click`, a key repeat), where React's `isPending`
   is still the stale render value `false`;
2. the **rendered `pending`** of the last render. This covers the window after the promise
   settled but before the commit that ends the transition, which React may hold for as long as
   any other async action is pending (entanglement, conventions 2.3 item 5). The button still
   shows `data-pending` and `aria-disabled` in that window, so ignoring there matches what the
   user sees; a new run would also only commit at the same time anyway.

For the `formAction` path only the second source exists (React starts the form's status in a
transition update, so a same-task double click sees stale `false`; a user cannot click twice in
one task, and the first click's own guard is React's `preventDefault()` of the native
submission). Section 6.2 explains how "my submission" is recognised.

### 5.3 `aria-disabled="true"` while pending

A control that will not act is, to assistive technology, unavailable; that is what React Aria
renders for `isPending` and what the research recommends (2.4). The Button sets it while
`pending` (either source) and removes it in the same commit that clears `data-pending`. It does
**not** set `data-disabled` (that attribute is the consumer's `disabled`, and `[data-pending]`
styles pending) and `state.disabled` stays `false`, so `children(state)` reads as before.

Never native `disabled` (verified: Chromium and Firefox move focus to `<body>` two frames after a
focused button becomes `disabled`; WebKit leaves focus on a dead element), never `inert`, and no
`aria-busy` (its meaning is "my content is being modified"; NVDA and VoiceOver ignore it and JAWS
may hide the button's name, research 1.1). The consumer may add `aria-busy` through pass-through.

Whether the `aria-disabled` *change* on the focused element is spoken is not known (research
2.4 did not verify it); the value is that a user who presses again, or returns to the button,
hears "unavailable" rather than nothing.

### 5.4 No opt-out prop

A concurrent-run button (a "+1" counter, a "fire" button in a game) is spelled with an action
that does not await its work:

```tsx
<Button action={() => { void increment(); }}>+1</Button>   // pending ends at once; every click counts
```

That is conventions 2.3 item 5 ("await only what the UI must wait for") applied to the one case
where the UI must not wait. An ordered, result-threaded sequence is `useActionState` (React's
queue), passed as `formAction` or called from the action. Neither needs a Button prop, and a
`repeatable` prop would invite the duplicate-submit bug the default exists to prevent. If a real
case appears, the hook option already exists and the prop would be a boolean on Button; it is not
named now.

### 5.5 The other pure triggers: rule now, change later

The conventions now say **every pure trigger ignores re-entry** (2.5, 3.6 as amended), and
`useActionTrigger` gains the guard as an option (section 15.2). Wave 8 turns it on for Button
only. The four existing users keep running every activation until a follow-up issue switches
them, for these reasons:

| Part | What changes | Why not in wave 8 |
| --- | --- | --- |
| `Dialog.Close`, `Popover.Close` | With `action`: a second click while pending is ignored instead of re-running the action (the close already happened at most once). Gains `aria-disabled` while pending. | Their designs (Dialog "Pending, in order", Popover 3.4) and about twenty test assertions document "repeated clicks re-run the action; the first close wins"; the superseded-rejection rows become unreachable through user input. Mechanical, but each design doc and walkthrough has to be rewritten. |
| `Menu.Item` | A second activation while pending is ignored. | `menu-dom.ts` treats `aria-disabled="true"` items as disabled for arrow navigation and typeahead, so a pending item would be skipped by the arrows while it is the focused one. The follow-up must key the DOM query on something else (`data-disabled`) before the item may render `aria-disabled` while pending; a design decision, not a flag flip. |
| `Toolbar.Button` | Removed; `Button` replaces it (section 7.3), so a toolbar's command button is guarded in wave 8. | |
| `Form.Submit` | **Unchanged, by design** (section 6.4). | |

The follow-up is **#81**: switch `Dialog.Close`, `Popover.Close`, `Menu.Item` to
`useActionTrigger({ ignoreWhilePending: true })`, render `aria-disabled` while pending, make
`menu-dom.ts` key disabled on `data-disabled`, rewrite the re-run walkthroughs and test rows in
dialog.md, popover.md, menu.md and toggle-group.md 11.5, then make `ignoreWhilePending` the
hook's default and drop the option.

Until then the conventions text records the split ("landed for Button in #79; the other parts
follow in #81"), the same way other staged rules were recorded.

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
formPending = status.pending && typeof formAction === "function"
  && (status.action === formAction || status.action === submittedWith.current);
```

`submittedWith` is a ref the click handler sets to the `formAction` the Button is about to submit
with. The second comparison exists because the identity of an inline `formAction={(fd) => …}`
changes when the parent re-renders during the submission, which would otherwise drop `pending`
after the first re-render; the click handler also runs for the click an implicit submission sends
to the default button, so both paths capture it. A `form.requestSubmit(button)` from script sends
no click and relies on the first comparison; the docs recommend a stable function (a Server
Function, a `useActionState` dispatch, `useCallback`) for that case.

A string `formAction` (a URL) is a navigating submission: no React status, no pending, no guard
beyond the browser's own.

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
| `pending` | the form channel: any submitter | its own submissions only | none |
| Re-entry while pending | **not blocked** (a `useActionState` dispatch queues it, in order; a plain action runs concurrently; `Form.Submit` has no action of its own to key a guard on, and the queue is React's documented semantics for forms, conventions 2.5) | ignored | none |
| Use | the one primary submit button | secondary submitters | rarely; `Form.Submit` is the documented spelling |

The product owner asked whether `Form.Submit` should block repeat submissions. Recommendation:
**no.** Its pending is the form's, not its own: blocking on it would make "Save draft" pending
(a `Button formAction`) also disable "Publish" (`Form.Submit`), which is exactly the coupling
conventions 2.7 forbids in the other direction; and a `useActionState` form has the ordered
queue React designed for repeat submits. The field-form design's decision 11 stands; a consumer
who wants a hard block styles `Form.Submit[data-pending] { pointer-events: none }` or renders
the primary button as `<Button formAction={dispatch}>` to get the guard.

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

### 7.3 Toolbar: `Button` reads `ToolbarContext`; `Toolbar.Button` is removed

Options weighed (research 4):

| | (a) `Button` reads `ToolbarContext` and replaces `Toolbar.Button` | (b) keep `Toolbar.Button` as a separate part; Button is a plain item |
| --- | --- | --- |
| Surface | one implementation, one name | two button components with different pending behaviour until #81, and two `disabled` semantics by name |
| Toolbar `disabled` | `aria-disabled` (APG), automatic | `aria-disabled` only if the author remembers `Toolbar.Button`; a `Button disabled` in a toolbar drops out of the sequence and out of AT discovery |
| Cost | one context read (`useToolbarContext()`, already read across folders by `ToggleGroup.Root`, `Toolbar.Separator`, `Menu.Trigger`); a breaking rename for alpha users (`Toolbar.Button` → `Button`) | none now |
| Behaviour change | a toolbar's command button gains the re-entry guard, `formAction`, `type` / `tabIndex` pass-through, `focusableWhenDisabled` (a no-op in a toolbar) | none |

**(a)**, the smaller surface that stays consistent (the product owner's criterion), with the
alias dropped (**user decision**: the project is alpha, and two names for one component is
surface). The toolbar rule is literally `focusableWhenDisabled` forced on, which is why the prop
exists: the context only flips its default. Edge to document: the context is React's, not the
DOM's, so a Button rendered under a `Toolbar.Root` in the React tree but outside its DOM items
(inside a `Menu.Popup` opened from the toolbar) is also focusable-disabled; harmless.

What goes: `toolbar/toolbar-button.tsx`, `Toolbar.Button` from the namespace,
`ToolbarButtonProps` / `ToolbarButtonState` / `ToolbarButtonActionDetails` from `toolbar/index.ts`
and the root entry, the `Toolbar.Button` rows of `toolbar.test.tsx` (their guarded form lives in
`button.test.tsx`), the `Toolbar.Button` props table on the Toolbar docs page. The Toolbar's
keyboard rows and `ToolbarEditor.tsx` / `ToolbarVertical.tsx` switch to `<Button>`;
toggle-group.md 3.4 and 11.5 are superseded by this document (an amendment note there is part of
#79's docs work). **Migration** (changelog / Toolbar page): replace `Toolbar.Button` with `Button`
from `@funstack/ui/button`; props, `disabled` semantics inside the toolbar and `data-*` are the
same; new: a second click while pending is ignored and the button is `aria-disabled` meanwhile.

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
| `aria-disabled` | `"true"` while pending, or while `disabled` with `focusableWhenDisabled` / inside a Toolbar; absent otherwise |
| `disabled` | the prop, except in the focusable-disabled cases |
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
label (the Toggle rule), and a mount / unmount of the Button inside a transition. The click itself
commits nothing. No `fsui-button` types: `useActionTrigger` attaches none, as for Toolbar
(conventions 5.3). Reduced motion is the consumer's CSS.

---

## 10. Async walkthroughs

1. **Click, slow action, resolve.** Click → `run` starts the transition (ref `inFlight = 1`), sync
   prefix of `action` runs during the event; render: `data-pending`, `aria-disabled="true"`,
   focus unchanged. Resolve → `inFlight = 0`; commit: attributes gone. One call.
2. **Click twice, pointer.** Second click while pending: handler sees `inFlight > 0` (or the
   rendered `pending`), `preventDefault()`, returns. One call. After settle, a third click runs.
3. **Enter held (key repeat).** Repeated `click`s in quick succession: the first starts the run,
   the rest are ignored by the ref even before React re-rendered.
4. **Rejection.** `action` rejects → React's route to the nearest boundary above the Button (the
   Button is the transition owner); the boundary replaces the Button, so there is no stuck guard.
   Caught inside: the action resolves, pending ends, the next click runs.
5. **Settled, commit held.** `action` resolved while another async action elsewhere is pending:
   the commit that clears `data-pending` waits for it (entanglement). Clicks in that window are
   ignored by the rendered `pending`; the button looks pending and behaves pending. When the other
   action settles, one commit clears both.
6. **Two Buttons.** A's action pending; B is clicked: B's handler runs at once (its own ref and
   rendered `pending` are clear), B's action runs immediately, B shows `data-pending` from the
   sync `isPending` render; A and B clear in the same commit when both have settled. No Button
   blocks another; only the commits are shared.
7. **Suspending content.** The action commits a value that makes sibling content suspend: the old
   content stays, `data-pending` stays until the content is ready (conventions 6), clicks are
   ignored meanwhile.
8. **`formAction` twice.** Click → React cancels the native submission and starts the host
   transition; `submittedWith = formAction`; render: `pending` (status matches), `aria-disabled`.
   Second click: `formPending` is `true` → `preventDefault()`, so React's submit handler never
   sees a second `submit` event. Resolve → status clears, React resets the form.
9. **Two `formAction` Buttons.** A pending; B clicked: B's own submission starts (React runs them
   concurrently, verified), both show their own pending, `Form.Submit` in the same form shows the
   form channel for the whole time.
10. **`render={<a href>}`, slow action.** First click: action runs, navigation proceeds natively
    (the consumer's action may `preventDefault()` to hold it). Second click while pending:
    cancelled, no navigation.
11. **Unmount while pending.** The action keeps running; its result is not awaited by anyone; a
    rejection after unmount follows the hook's existing rule (latest run → React's route; nothing
    new).
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
reconciliation; as `Toolbar.Button`); a Server Function `formAction` Button submits natively; a
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

`packages/ui/src/button/button.test.tsx` (jsdom) and `button.browser.test.tsx` (Chromium,
Firefox, WebKit). Top-of-file comment (conventions 10.1): "Button: no controlled state, so the
controlled-parity, optimistic, platform-path, urgent-action, continuous-control and inside-a-Field
rows are N/A; the **overlap and superseded-rejection rows are N/A because the re-entry guard means
a Button never has two of its own runs in flight** (rows 5 and 6 replace them)."

| # | Area | Project | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | Default `<button type="button">`, no `role`; `type="submit"` with a function `formAction`; a consumer `type="submit"` / `"reset"` wins; `render={<a href>}` gets no `type`; `render={<button type="submit">}` is overridden by the Button's computed `type` (owned); `disabled` renders native `disabled` + `data-disabled`, no `aria-disabled`; `focusableWhenDisabled` renders `aria-disabled="true"`, no `disabled`, `data-disabled`; a consumer `aria-disabled` prop is not accepted (type) and a render element's is removed (owned). |
| 2 | Sync action | jsdom | Click, Enter and Space each call `action` once with `details.event` the native event; disabled (both spellings) never dispatches and a disabled `render={<a href>}` click is `defaultPrevented`; a Button without `action` starts no transition (no `data-pending` flicker: assert no `data-pending` after a click, synchronously). |
| 3 | Async action | jsdom | Deferred action: `data-pending`, `aria-disabled="true"`, **no** `data-disabled`, `state.disabled === false` in `children(state)`; `document.activeElement` stays the button from click through resolve; after resolve all three facts invert, focus still on the button. |
| 4 | Rejection | jsdom | Reaches `<ErrorCatcher>` above the Button; pending ended. Caught inside: resolves; the next click runs again (no stuck guard). |
| 5 | Re-entry ★ | jsdom | While a deferred action pends: a second click, an Enter and a Space each leave `action` at one call and are `defaultPrevented`; two `fireEvent.click`s inside one `act` (same task, before any re-render) call it once (the ref); after resolve a click calls it again; `render={<a href>}`: the second click while pending is `defaultPrevented`, the first was not; with `commandfor` / `command` attributes present the second click is `defaultPrevented` (jsdom runs no command; the browser row 22 covers the command itself). |
| 6 | Settled-but-held commit ★ | jsdom | A second, unrelated `useTransition` action (deferred) is pending; the Button's action resolves; the button still shows `data-pending` (entangled commit) and a click in that window is ignored; when the unrelated action resolves, one commit clears the attributes and the next click runs. |
| 7 | Two Buttons | jsdom | A pending; B clicked: B's action called at once, B `data-pending`; both clear after both resolve. |
| 8 | Suspending content | jsdom | The action sets a value that makes sibling content suspend (`createSuspender`): old content stays, `data-pending` on until it resolves, clicks ignored meanwhile. |
| 9 | Function props, `render` | jsdom | `className` / `style` / `children` receive `{ pending, disabled }` and agree with the attributes; element form merges `className` / `style`, keeps dispatch and the guard, forwards `ref`; function form gets `(props, state)`; `render={<MyButton />}` (a component that spreads props) works; a pass-through `onFocus` / `onPointerEnter` / `onKeyDown` fires while pending. |
| 10 | Consumer state after await | jsdom | `action={async () => { await d.promise; startTransition(() => setCount(c => c + 1)); }}` commits once per accepted click (guards the documented post-await pattern). |
| 11 | `formAction`, per-submitter pending ★ | jsdom | A `<form>` with `Form.Submit` and two `Button formAction` (deferred functions `a`, `b`): click A → A `data-pending` + `aria-disabled`, B neither, `Form.Submit` `data-pending`; `useFormStatus().action === a` observed through a probe; click A again → `a` called once, click `defaultPrevented`; click B while A pends → `b` called, both pending; resolve A → only A clears; resolve B → all clear. `type` on both is `"submit"`. |
| 12 | `formAction` inside `Form.Root` ★ | jsdom | `Form.Root action={formAction}` with a `Button formAction={mine}`: clicking the Button calls `mine`, not `formAction`; `Form.Root` shows `data-pending` meanwhile (form channel); the button element has a `formaction` attribute (react-dom's URL for a function), which is what `Form.Root`'s submitter check keys on; `Form.Submit` in the same form still runs `formAction`. |
| 13 | `formAction` identity | jsdom | An inline `formAction={(fd) => …}` whose parent re-renders (state change) during the submission keeps the Button `data-pending` until it settles (the `submittedWith` ref); a stable function works without the ref (sanity). |
| 14 | Dev warnings | jsdom | `action` + `formAction` logs an error once; `action` + `type="submit"` and `+ "reset"` warn once; no warning for `formAction` alone, `type="submit"` alone, `commandfor` + `action`. |
| 15 | Trigger-wrapped ★ | jsdom | `Dialog.Trigger render={<Button action={a} />}` in library mode: one click calls `a` **and** opens the dialog (the click arrives `defaultPrevented`); `Button render={<Dialog.Trigger />}` likewise; while `a` pends the dialog is open and a second click leaves `a` at one call. |
| 16 | Toolbar ★ | jsdom | Inside `Toolbar.Root`: `Button disabled` renders `aria-disabled="true"` and no `disabled`, is reached by the arrows and never dispatches; `Toolbar` has no `Button` member (type and runtime); `ToolbarEditor`-style mixed children with `<Button>` in place of `Toolbar.Button` still pass the toolbar's row 12; a `Button` with `tabIndex={-1}` is skipped by the arrows (pass-through, as any item). |
| 17 | `details.event` is virtual | jsdom | As Toggle row 21 for `ButtonActionDetails`: `details.event` is the click, `"event" in details`, `Object.keys(details)` is `[]`, a Server-Function-shaped `action` receives it. |
| 18 | Types | jsdom (`expectTypeOf`) | `onClick`, `aria-disabled` not accepted; `type` is the three-way union; `formAction` accepts a `(formData: FormData) => Promise<void>` and a string; `ButtonProps` / `ButtonState` / `ButtonActionDetails` exported from `@funstack/ui/button` and the root. |
| 19 | SSR markup | jsdom | `renderToString`: `type="button"`, no `aria-disabled`, no `data-pending`; with a function `formAction`: `type="submit"` and a `formaction` attribute; `hydrateRoot` over it logs no mismatch. |
| 20 | Directive | script | `dist/button/button.mjs` starts with `"use client"`; `dist/button/index.mjs` does not; `dist/toolbar/toolbar-button.mjs` no longer exists. |
| 21 | Focus retention | browser | All three engines: focus the Button, click (Enter), action pending: `document.activeElement` is the Button after two animation frames (the probe's window in which native `disabled` would have blurred it in Chromium / Firefox), and still after resolve. |
| 22 | Invoker Command + action | browser | `<Button commandfor="p" command="toggle-popover" action={slow}>`: first click runs the action and the popover is `:popover-open`; second click while pending: action still one call and the popover still open (the command did not run); after settle a click closes it. Same engines (Invoker Commands are Baseline on all three). |
| 23 | Tooltip while pending | browser | `Tooltip.Trigger render={<Button action={slow} />}`: hover during pending opens the popup (`:popover-open`), leave closes it; focus during pending opens it. Chromium with `experimental_interestFor` on takes the native path (branch on `src/__tests__/engine.ts`). |
| 24 | Implicit submission | browser | A form with a text field and a `Button formAction={slow}` as its only submit button: Enter in the field submits once; Enter again while pending submits nothing (the guard cancelled the synthetic click); with `Form.Submit` as the default button and a pending `Button formAction` elsewhere in the form, Enter submits the form's action. |
| 25 | ViewTransition | browser | `{show && <Button />}` mounted in a `startTransition`: `document.startViewTransition` called zero times without `transition`, once with `transition="none"` (conventions 10.1 mount row); a settle that swaps `children(state)` under `transition="none"` calls it once. |
| 26 | Accessibility tree | browser (Chromium, CDP) | The pending Button's name is unchanged and the node has the `disabled`-equivalent state from `aria-disabled` (whatever CDP reports for it; the row records the value, `memo/developer/cross-engine.md`); after settle the state is gone. |

★ rows are the ones this design adds beyond conventions 10.1.

---

## 14. Docs page

`packages/docs/src/pages/ButtonPage.tsx` at `/components/button`, first in `componentNavItems`
(it is the most basic component), routed in `App.tsx`. Sections:

1. Intro: a button whose click is a transition; what it adds over `<button onClick>` (pending
   state, re-entry guard, errors to a boundary, Server Functions as actions).
2. Examples (`src/examples/`, source shown):

   | Example | Directive | Shows |
   | --- | --- | --- |
   | `ButtonSave.tsx` | `"use client"` | 2.1: fake async save (`fake-api.ts`), `children(state)` spinner, the re-entry guard made visible (a call counter), a rejecting variant inside `DemoErrorBoundary`, a caught-inside variant with a toast. |
   | `ButtonFormActions.tsx` | `"use client"` | 2.2: `Form.Root` with `Form.Submit` "Publish" and two `Button formAction` ("Save draft", "Discard"), each with its own pending; the form-channel pending on `Form.Submit` contrasted. |
   | `ButtonCompose.tsx` | `"use client"` | 2.3: `Dialog.Trigger render={<Button />}` and `Tooltip.Trigger render={<Button />}` (hover a pending button). |
   | `ButtonInvoker.tsx` | **none (Server Component)** | 2.5's second button: `commandfor` / `command` opening a Dialog with no JS, plus a `Button` styled by `[data-pending]` CSS only; the page says the file has no directive and which props a Server Component cannot pass. (The docs site has no Server Functions, so `action` from a Server Component is shown as code, not run.) |
   | `button.css` | | 2.6 recipes, reduced motion. |

3. Anatomy (one element), props table (`ButtonProps`, with `type`'s default rule and the
   `formAction` identity note), `ButtonState`, data attributes (and the "pending is not disabled"
   sentence), owned keys.
4. "Pending and re-entry": what is ignored, `aria-disabled`, why not `disabled`, the
   non-awaiting spelling for concurrent clicks, `useActionState` for a queue.
5. "Forms": `type` defaults, `formAction` vs `Form.Submit` (the 6.4 table), implicit submission.
6. "Which button?": the 1. list (`Form.Submit`, `Dialog.Close`, `Menu.Item`, `Toggle`, `Toolbar`),
   as a callout.
7. Keyboard (8.2), "What assistive technology hears" with the outcome pattern (8.3) and the
   `aria-busy` note.
8. Server Components (11), before hydration.
9. The reduced-motion block.

Also: `ToolbarPage.tsx` drops the `Toolbar.Button` props table, uses `<Button>` in its examples
and links here, with a **migration callout** ("`Toolbar.Button` was removed in this release; use
`Button` from `@funstack/ui/button`, which behaves the same inside a toolbar and also ignores a
second click while pending"); `RoadmapPage.tsx`'s changelog entry marks the removal as a
breaking change; `MenuPage.tsx` gains a one-line "a Button inside a Menu
is not an item"; `ActionPropsPage.tsx` / `GettingStartedPage.tsx` may use `<Button action>` as
the first example of an action prop; `ServerComponentsPage.tsx` lists Button under "client
modules you can render from a Server Component" with the Server Function `action` / `formAction`
note; `RoadmapPage.tsx` changelog entry; `packages/example` gets a demo page; `index.ts`,
`tsdown.config.ts` and `package.json` exports gain `button`.

---

## 15. Implementation notes

### 15.1 Files

```
packages/ui/src/button/
  index.ts              # no directive
  button.tsx            # "use client"
  button.test.tsx
  button.browser.test.tsx
packages/ui/src/internal/use-action-trigger.ts   # gains the guard option, `run` returns boolean
packages/ui/src/toolbar/index.ts                 # Toolbar = { Root, Separator } (7.3)
packages/ui/src/toolbar/toolbar-button.tsx       # removed (7.3), with its types and root-entry exports
```

### 15.2 `useActionTrigger` change

```ts
export interface ActionTriggerOptions {
  /** Open generation of the overlay a `then` belongs to (unchanged). */
  readonly openGeneration?: () => number;
  /**
   * Ignore `run` while a run is in flight (conventions 2.5 as amended): `run` returns `false`
   * and starts nothing. In flight means the in-flight counter is non-zero **or** the last
   * render's `pending` is true. Default `false` until the follow-up of design 5.5 flips it.
   */
  readonly ignoreWhilePending?: boolean;
}

export interface ActionTrigger {
  readonly pending: boolean;
  /** Returns `false` when the run was ignored (so the part can `preventDefault()`). */
  readonly run: (work: () => unknown, then?: () => void) => boolean;
}

export function useActionTrigger(options?: ActionTriggerOptions | (() => number)): ActionTrigger;
```

The positional `openGeneration` form may stay accepted for the three existing call sites, or they
may be edited to the object form (three one-line changes); the developer's choice. Inside:
`inFlight` is a `useRef(0)`; `run` does `if (ignoreWhilePending && (inFlight.current > 0 || pending)) return false; inFlight.current++;` before `startOwnTransition`, and decrements in a
`finally` around `await work()`. The superseded-rejection machinery stays (it is reachable for the
unguarded parts and stays correct for guarded ones).

### 15.3 `Button` sketch

```tsx
export function Button({ action, formAction, type, disabled = false, focusableWhenDisabled = false,
  transition, className, style, children, render, ...rest }: ButtonProps) {
  const toolbar = useToolbarContext();
  const focusable = focusableWhenDisabled || toolbar !== null;
  const { pending: ownPending, run } = useActionTrigger({ ignoreWhilePending: true });
  const status = useFormStatus();
  const submittedWith = useRef<unknown>(undefined);
  const formPending = status.pending && typeof formAction === "function"
    && (status.action === formAction || status.action === submittedWith.current);
  const pending = ownPending || formPending;
  useDevWarning(...); // action + formAction (error), action + submitting type (warn)
  const state: ButtonState = { pending, disabled };
  const element = useRender<ComponentPropsWithRef<"button">, ButtonState>({
    defaultElement: "button", render, state, className, style, children,
    props: { ...rest, formAction },
    libraryProps: {
      ...(rendersButton(render) && { type: type ?? (formAction !== undefined ? "submit" : "button") }),
      disabled: disabled && !focusable ? true : undefined,
      "aria-disabled": pending || (disabled && focusable) ? true : undefined,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (disabled) { event.preventDefault(); return; }
        if (action === undefined) {
          if (formPending) { event.preventDefault(); return; }
          submittedWith.current = formAction;
          return;
        }
        const details: ButtonActionDetails = createActionDetails(event.nativeEvent, {});
        if (!run(() => action(details))) event.preventDefault();
      },
    },
  });
  return useTransitionBoundary("Button", transition, element);
}
```

`useFormStatus` is imported from `react-dom` as in `form-submit.tsx`. `disabled` is passed as
`undefined` (not `false`) in the focusable case so the owned key removes a render element's
`disabled` (conventions 1.2, owned keys).

### 15.4 Toolbar

`toolbar/index.ts`: `export const Toolbar = { Root: ToolbarRoot, Separator: ToolbarSeparator } as const;`
with the `ToolbarButton*` type exports removed there and in `src/index.ts`. The `toolbar.test.tsx`
rows that test `Toolbar.Button`'s own action (sync / async / rejection / "pending stays until both
overlapping runs settle") move to `button.test.tsx` in their guarded form; the keyboard rows
render `<Button>` from `../button/button.js` instead of `Toolbar.Button` and are otherwise
unchanged. `packages/example` and the docs examples follow the same rename.

---

## Conventions amendments (applied to `design/conventions.md` in this commit; accepted 2026-10-22)

1. **Decisions table, row 2**: a pure trigger ignores activation while its own action is pending
   and says so with `aria-disabled="true"` (#79).
2. **1.1 `Button` row**: `Button` is now the general single-element button (`@funstack/ui/button`)
   and replaces `Toolbar.Button`; the "not a general button component" sentence goes. 3.6, 4.1
   and 5.3 drop their `Toolbar.Button` mentions accordingly.
3. **2.3 item 3**: a pure trigger does not treat an already-cancelled click as a veto (the
   Trigger-wrapped Button); item 9 reworded to "never *natively* disabled while pending; pure
   triggers ignore re-entry (2.5)".
4. **2.5**: new bullet "**Pure triggers ignore re-entry.**" with the rule, the two guard sources,
   `preventDefault()`, the non-awaiting spelling, and the staged rollout (Button in #79; the
   other parts in the follow-up).
5. **2.7**: a part with its **own** `formAction` may expose per-submitter form-channel pending
   (`useFormStatus().action` identity), the third allowed reading of the channel.
6. **3.4**: `useActionTrigger`'s `ignoreWhilePending` option and `run`'s boolean return.
7. **3.6**: "A part is never **natively** disabled while pending" (unchanged reason), plus: a pure
   trigger renders `aria-disabled="true"` while its own action is pending because it ignores
   activation then; `data-disabled` and `state.disabled` are the consumer's `disabled` only; the
   "latest-intent rule makes repeated activation safe" sentence is removed (it never protected a
   trigger); `focusableWhenDisabled` joins Tabs / Toolbar as a source of `aria-disabled`.
8. **4.1 `pending` row**: `Button` (its own action, or its own `formAction` submission).
9. **5.3**: `Button` emits no types.
10. **9.1**: `button/` folder.
11. **10.1**: a "Re-entry" row required for every guarded pure trigger; the superseded-rejection
    row notes that a guarded trigger declares it N/A with the reason.
12. **Resolved questions**: entry 34.

---

## Recommendations and decisions (all accepted 2026-10-22)

1. **Re-entry guard: Button in wave 8, the rest in a follow-up** (5.5). The rule is library-wide
   in the conventions now; `Dialog.Close`, `Popover.Close`, `Menu.Item` switch in **#81** because
   of their re-run tests and docs and `menu-dom.ts`'s `aria-disabled` query.
   Alternative: switch all five now (one wave, about twenty assertions and four design docs,
   plus the Menu navigation change). Recommended: staged. **Accepted: staged, #81 filed.**
2. **No opt-out prop** (5.4): the non-awaiting action is the spelling. Alternative: `repeatable`.
3. **`aria-disabled="true"` while pending; `data-disabled` and `state.disabled` untouched** (5.3).
4. **`type` is owned on a `<button>`**, computed from the Button's own `type` prop (6.1), so a
   `render` element's `type` is overridden. Alternative: not owned (the element's wins), which
   would make `render={<button type="submit">}` a silent submit button.
5. **`formAction` per-submitter pending with the `submittedWith` ref** (6.2). Alternative: prop
   identity only, with a documented "pass a stable function" rule.
6. **`Form.Submit` stays unguarded** (6.4).
7. **Implicit submission goes through the guard**, no `type` flip (6.5).
8. **`Button` reads `ToolbarContext`** (7.3). Accepted.
9. **`Toolbar.Button`: keep as an alias or remove.** The draft recommended keeping the alias
   through `0.1.0`. **User decision: remove it now** (one name for one component; the project is
   alpha; a breaking change recorded in 7.3 and the migration note in 14).
10. **`focusableWhenDisabled`** (3, 7.2): the one prop this design adds beyond the product owner's
    list. It is the toolbar rule as a prop and the only way to put a Tooltip on a disabled Button
    (a natively disabled button fires no events, and `aria-disabled` is owned). **User decision:
    in v1.**
11. **Trigger-wrapped Button runs its action on a cancelled click** (7.1), as decided.
12. **Browser rows 21 to 26** are the ones jsdom cannot observe; 21 (focus retention) is the
    load-bearing accessibility claim and runs on all three engines.

## Resolved questions (2026-10-22)

1. Remove `Toolbar.Button` now, or keep the alias? **Removed now** (user).
2. `focusableWhenDisabled` in v1, or defer? **In v1** (user).
3. The follow-up for the other pure triggers: **one issue, #81** (product owner).

## Open questions

None at present.
