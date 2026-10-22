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
| 3 | Re-entry | **Ignored while pending**: a click, Enter or Space while the Button's own `action` (or its own `formAction` submission) is in flight starts nothing and is `preventDefault()`ed, so a link does not navigate, a form does not submit and a command does not run twice. Guarded by the Button's **own synchronous in-flight counter only** (section 5.2; the rendered `pending` is not a guard source, review item 3). No opt-out prop (section 5.4). |
| 4 | AT state while pending | `aria-disabled="true"` (owned), `data-disabled` **not** set, `state.disabled` unchanged. Never native `disabled`, never `inert`, no `aria-busy`, no announcement. |
| 5 | Library-wide rule | "A pure trigger ignores re-entry" becomes the conventions' rule (2.5, 3.6) and a `useActionTrigger` option; **wave 8 lands it for Button only**; `Dialog.Close`, `Popover.Close`, `Menu.Item` follow in **#81** because their tests and docs are built on re-run and `Menu.Item`'s navigation keys on `aria-disabled` (section 5.5). `Form.Submit` is **not** guarded (section 6.4). |
| 6 | `type` | Default `"button"`; `"submit"` when `formAction` is given. The Button's own `type` prop wins (`"submit"` / `"reset"` allowed); the computed value is owned on a `<button>` and on a **component** `render` element (assumed to render a `<button>`; review item 2, library-wide in `rendersButton`), and omitted only for a host element of another tag (`<a href>`). `action` with a submitting `type` warns in development. |
| 7 | `formAction` | First-class pass-through with **per-submitter pending**: `useFormStatus().pending && status.action === <the function this Button submitted with>`. `action` and `formAction` together is a development error. Progressive enhancement is React's (a Server Function submits before hydration). |
| 8 | `disabled` | Native `disabled` (owned) plus `data-disabled`, like `Dialog.Close` / `Form.Submit`. `focusableWhenDisabled` renders `aria-disabled="true"` instead (Base UI's name); it is implied `true` inside a `Toolbar.Root` (APG Toolbar) and for **any `render` element that is not a host `<button>`** (an `<a href>`, a component: native `disabled` means nothing on a link and would expose an enabled link to AT; review must-fix 1). Never dispatches either way; a disabled link does not navigate. |
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
   * Default `"button"`, or `"submit"` when `formAction` is given. Owned on a `<button>` and on a
   * component `render` element (set it here, not on the element; a component is assumed to
   * render a `<button>` and should spread the prop, a component that renders a link may drop
   * it); omitted for a host element of another tag. `action` together with `"submit"` / `"reset"`
   * warns in development: one click would do two things.
   */
  type?: "button" | "submit" | "reset";
  /**
   * Native `disabled` (owned; a `render` element cannot re-enable it) and `data-disabled`.
   * Never dispatches. With `focusableWhenDisabled`, inside a `Toolbar.Root`, or when the
   * rendered element is not a host `<button>` (`render={<a href />}`, a component), renders
   * `aria-disabled="true"` instead so the Button stays focusable and a link is not exposed as
   * an enabled link.
   */
  disabled?: boolean;
  /**
   * Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so
   * keyboard and screen-reader users still find it and a Tooltip on it still opens. Default
   * `false`; implied `true` inside a `Toolbar.Root` (APG Toolbar) and for a `render` element
   * that is not a host `<button>`.
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

ARIA state the Button computes: `aria-disabled="true"` while `pending`, and while
`disabled && focusable`, where `focusable = focusableWhenDisabled || inToolbar || !isHostButton(render)`
(`isHostButton`: no `render`, the function form, or a host `<button>` element); absent otherwise.

The two `render` predicates follow one rule, **when the element is unknown, pick the attribute
that is harmless if the guess is wrong** (review items 1 and 2): `type="button"` on a component
that turns out to render a link is an ignored attribute, while a missing `type` on a component
that renders a `<button>` inside a form is a silent submit; `aria-disabled` on a component that
turns out to render a `<button>` is a focusable-disabled button that still never dispatches,
while native `disabled` on a link is an enabled link to assistive technology. So a component
element gets `type` **and** the `aria-disabled` branch; a host `<a>` gets neither `type` nor
native `disabled`; a host `<button>` gets both natives.

Owned keys (conventions 1.2; a `render` element cannot re-introduce them):

| Key | Value | When |
| --- | --- | --- |
| `type` | the Button's `type` prop, else `"submit"` with `formAction`, else `"button"` | no `render`, the function form, a host `<button>` or a **component** element (`rendersButton(render)` as amended library-wide, conventions 1.2); the key is omitted for a host element of another tag |
| `disabled` | the prop, unless `focusable` (then `undefined`, which removes it) | always |
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

The guard reads **one** thing: the **in-flight counter in a ref** inside `useActionTrigger`,
incremented synchronously when `run` starts the transition and decremented when the work
settles (resolves or rejects). It is synchronous, so two activations in one task (a double
`fireEvent.click`, a key repeat) see it where React's `isPending` is still the stale render
value `false`.

The rendered `pending` is **not** a guard source (review item 3; the draft used both). There is a
window after the promise settled but before the commit that ends the transition, which React
holds for as long as any other async action in the app is pending (entanglement, conventions
2.3 item 5) or while the resulting render suspends. In that window the button still shows
`data-pending` and `aria-disabled`, and a click starts a **new run**: the previous one has
fully settled, so this is not a duplicate side effect, and the new run's commit joins the held
one. The alternative, ignoring clicks whenever the button looks pending, silently dropped user
intent: the reviewer's probe clicked a non-awaiting "+1" Button three times while an unrelated
action was pending and got **one** call. Losing intent is the worse failure; the cost accepted is
that `aria-disabled="true"` can outlast the guard by the length of the held commit.

For the `formAction` path the guard is `formPending` (section 6.2), a render value: React's form
status is the only source of truth for a submission the Button did not run itself, and React
itself keeps that status pending until the submission's commit. A same-task double click sees a
stale `false` there (a user cannot produce one; the native submission is already cancelled by
React); in a held-commit window a `formAction` click is ignored, unlike an `action` click, and
the docs say so.

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
where the UI must not wait. The in-flight counter is back to zero a microtask after the click, so
every click runs the action even while an unrelated async action elsewhere holds this Button's
commit; what lingers in that case is only the `data-pending` / `aria-disabled` attributes, until
the held commit lands (5.2). An ordered, result-threaded sequence is `useActionState` (React's
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

**#81 is designed in section 16 (wave 9, 2026-10-22)**, which supersedes the rest of this
subsection: the four pure triggers (`Toast.Action` included) are guarded and the guard is the
hook's default. The follow-up as proposed here was: switch `Dialog.Close`, `Popover.Close`, `Menu.Item` to
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
| `aria-disabled` | `"true"` while pending, or while `disabled` with `focusableWhenDisabled`, inside a Toolbar, or on a `render` element that is not a host `<button>` (`<a href>`, a component); absent otherwise |
| `disabled` | the prop, on a host `<button>` (no `render`, the function form, `render={<button />}`) only; never on a link or a component element, where it would mean nothing to the browser and hide the disabled state from AT (review must-fix 1) |
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
| 1 | Roles and ARIA | jsdom | Default `<button type="button">`, no `role`; `type="submit"` with a function `formAction`; a consumer `type="submit"` / `"reset"` wins; `render={<a href>}` gets no `type`; `render={<MyButton />}` (a component spreading onto a `<button>`) **gets** `type="button"` and, inside a `<form>`, does not submit on click (review item 2); `render={<button type="submit">}` is overridden by the Button's computed `type` (owned); `disabled` renders native `disabled` + `data-disabled`, no `aria-disabled`; `focusableWhenDisabled` renders `aria-disabled="true"`, no `disabled`, `data-disabled`; `disabled` with `render={<a href>}` and with `render={<MyButton />}` renders `aria-disabled="true"` and **no** `disabled` attribute (review must-fix 1); a consumer `aria-disabled` prop is not accepted (type) and a render element's is removed (owned). |
| 2 | Sync action | jsdom | Click, Enter and Space each call `action` once with `details.event` the native event; disabled (every spelling, the link and component renders included) never dispatches and a disabled `render={<a href>}` click is `defaultPrevented`; a Button without `action` starts no transition (no `data-pending` flicker: assert no `data-pending` after a click, synchronously). |
| 3 | Async action | jsdom | Deferred action: `data-pending`, `aria-disabled="true"`, **no** `data-disabled`, `state.disabled === false` in `children(state)`; `document.activeElement` stays the button from click through resolve; after resolve all three facts invert, focus still on the button. |
| 4 | Rejection | jsdom | Reaches `<ErrorCatcher>` above the Button; pending ended. Caught inside: resolves; the next click runs again (no stuck guard). |
| 5 | Re-entry ★ | jsdom | While a deferred action pends: a second click, an Enter and a Space each leave `action` at one call and are `defaultPrevented`; two `fireEvent.click`s inside one `act` (same task, before any re-render) call it once (the ref); after resolve a click calls it again; `render={<a href>}`: the second click while pending is `defaultPrevented`, the first was not; with `commandfor` / `command` attributes present the second click is `defaultPrevented` (jsdom runs no command; the browser row 22 covers the command itself). |
| 6 | Settled-but-held commit ★ | jsdom | A second, unrelated `useTransition` action (deferred) is pending; the Button's action resolves; the button still shows `data-pending` and `aria-disabled` (entangled commit) and a click in that window **runs the action again** (two calls; the guard is the in-flight counter only); the reviewer's probe as a row: a non-awaiting `action` clicked three times while the unrelated action pends is called three times; when the unrelated action resolves, one commit clears the attributes. |
| 7 | Two Buttons | jsdom | A pending; B clicked: B's action called at once, B `data-pending`; both clear after both resolve. |
| 8 | Suspending content | jsdom | The action sets a value that makes sibling content suspend (`createSuspender`): old content stays, `data-pending` on until it resolves, clicks ignored meanwhile. |
| 9 | Function props, `render` | jsdom | `className` / `style` / `children` receive `{ pending, disabled }` and agree with the attributes; element form merges `className` / `style`, keeps dispatch and the guard, forwards `ref`; function form gets `(props, state)`; `render={<MyButton />}` (a component that spreads props) works; a pass-through `onFocus` / `onPointerEnter` / `onKeyDown` fires while pending. |
| 10 | Consumer state after await | jsdom | `action={async () => { await d.promise; startTransition(() => setCount(c => c + 1)); }}` commits once per accepted click (guards the documented post-await pattern). |
| 11 | `formAction`, per-submitter pending ★ | jsdom | A `<form>` with `Form.Submit` and two `Button formAction` (deferred functions `a`, `b`): click A → A `data-pending` + `aria-disabled`, B neither, `Form.Submit` `data-pending`; `useFormStatus().action === a` observed through a probe; click A again → `a` called once, click `defaultPrevented`; click B while A pends → `b` called, both pending; resolve A → only A clears; resolve B → all clear. `type` on both is `"submit"`. |
| 12 | `formAction` inside `Form.Root` ★ | jsdom | `Form.Root action={formAction}` with a `Button formAction={mine}`: clicking the Button calls `mine`, not `formAction`; `Form.Root` shows `data-pending` meanwhile (form channel); the button element has a `formaction` attribute (react-dom's URL for a function), which is what `Form.Root`'s submitter check keys on; `Form.Submit` in the same form still runs `formAction`. |
| 13 | `formAction` identity | jsdom | An inline `formAction={(fd) => …}` whose parent re-renders (state change) during the submission keeps the Button `data-pending` until it settles (the `submittedWith` ref); a stable function works without the ref (sanity). |
| 14 | Dev warnings | jsdom | `action` + `formAction` logs an error once; `action` + `type="submit"` and `+ "reset"` warn once; no warning for `formAction` alone, `type="submit"` alone, `commandfor` + `action`. |
| 15 | Trigger-wrapped ★ | jsdom | `Dialog.Trigger render={<Button action={a} />}` in library mode: one click calls `a` (the click arrives `defaultPrevented`) and dispatches the open; with a **deferred** `a` the Trigger shows `data-open` and `data-pending`, `showModal` is not yet called, a second click leaves `a` at one call, and resolving `a` calls `showModal` once (entanglement, review deviation 1); with a **non-awaiting** `a` the dialog opens in the same commit; `Button render={<Dialog.Trigger />}` likewise. |
| 16 | Toolbar ★ | jsdom | Inside `Toolbar.Root`: `Button disabled` renders `aria-disabled="true"` and no `disabled`, is reached by the arrows and never dispatches; `Toolbar` has no `Button` member (type and runtime); `ToolbarEditor`-style mixed children with `<Button>` in place of `Toolbar.Button` still pass the toolbar's row 12; a `Button` with `tabIndex={-1}` is skipped by the arrows (pass-through, as any item). |
| 17 | `details.event` is virtual | jsdom | As Toggle row 21 for `ButtonActionDetails`: `details.event` is the click, `"event" in details`, `Object.keys(details)` is `[]`, a Server-Function-shaped `action` receives it. |
| 18 | Types | jsdom (`expectTypeOf`) | `onClick`, `aria-disabled` not accepted; `type` is the three-way union; `formAction` accepts a `(formData: FormData) => Promise<void>` and a string; `ButtonProps` / `ButtonState` / `ButtonActionDetails` exported from `@funstack/ui/button` and the root. |
| 19 | SSR markup | jsdom | `renderToString`: `type="button"`, no `aria-disabled`, no `data-pending`; with a function `formAction`: `type="submit"` and a `formaction` attribute; `hydrateRoot` over it logs no mismatch. |
| 20 | Directive | script | `dist/button/button.mjs` starts with `"use client"`; `dist/button/index.mjs` does not; `dist/toolbar/toolbar-button.mjs` no longer exists. |
| 21 | Focus retention | browser | All three engines: focus the Button, click (Enter), action pending: `document.activeElement` is the Button after two animation frames (the probe's window in which native `disabled` would have blurred it in Chromium / Firefox), and still after resolve. |
| 22 | Invoker Command + action | browser | `<Button commandfor="p" command="toggle-popover" action={slow}>`: first click runs the action and the popover is `:popover-open`; second click while pending: action still one call and the popover still open (the command did not run); after settle a click closes it. Same engines (Invoker Commands are Baseline on all three). |
| 23 | Tooltip while pending | browser | `Tooltip.Trigger render={<Button action={slow} />}`: hover during pending opens the popup (`:popover-open`), leave closes it; focus during pending opens it. Chromium with `experimental_interestFor` on takes the native path (branch on `src/__tests__/engine.ts`). |
| 24 | Implicit submission | browser | A form with a text field and a `Button formAction={slow}` as its only submit button: Enter in the field submits once; Enter again while pending submits nothing (the guard cancelled the synthetic click); with `Form.Submit` as the default button and a pending `Button formAction` elsewhere in the form, Enter submits the form's action. |
| 25 | ViewTransition | browser | `{show && <Button />}` mounted in a `startTransition`: `document.startViewTransition` called zero times without `transition`, once with `transition="none"` (conventions 10.1 mount row); a settle that swaps `children(state)` calls it **zero** times under `transition="none"` (React starts a document view transition for a `"none"` boundary only on mount / reveal) and **once** under `transition="auto"` (review deviation 2). |
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
   * and starts nothing. In flight means the hook's synchronous in-flight counter is non-zero;
   * the last render's `pending` is **not** consulted (design 5.2). Default `false` until #81
   * flips it.
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
`inFlight` is a `useRef(0)`; `run` does `if (ignoreWhilePending && inFlight.current > 0) return false; inFlight.current++;` before `startOwnTransition`, and decrements in a
`finally` around `await work()`. The superseded-rejection machinery stays (it is reachable for the
unguarded parts and stays correct for guarded ones).

### 15.3 `Button` sketch

```tsx
export function Button({ action, formAction, type, disabled = false, focusableWhenDisabled = false,
  transition, className, style, children, render, ...rest }: ButtonProps) {
  const toolbar = useToolbarContext();
  // Not a host <button> (a link, a component): native `disabled` would mean nothing to the
  // browser and hide the state from AT, so the focusable-disabled branch (review must-fix 1).
  const focusable = focusableWhenDisabled || toolbar !== null || !isHostButton(render);
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

`render-element.ts` after review items 1 and 2: `rendersButton(render)` (the `type` predicate,
library-wide) returns `true` for no `render`, the function form, a host `"button"` **and any
component element**, `false` only for a host element of another tag; a new `isHostButton(render)`
keeps today's strict meaning (no `render`, function form, host `"button"`) for the `disabled`
branch. Every part that emits `type="button"` through `rendersButton` (Toggle, Tabs.Tab, the
Menu items, the Close and Trigger parts, …) gains the component case at once, which is the same
footgun fixed everywhere (`<Toggle render={<MyButton />}>` inside a form is the Getting Started
page's own example); the existing "no `type`" assertions all use host `<a>` renders and keep
passing. The other parts' `disabled` on a link render is a separate follow-up (fold, item F3).

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
13. **1.2** (review fold, 2026-10-22): `type="button"` is emitted for a host `<button>` **and for a
    component `render` element**, omitted only for a host element of another tag; a `disabled`
    part whose rendered element is not a host `<button>` uses `aria-disabled`.
14. **2.5, 3.4, 10.1** (review fold): the guard source is the in-flight counter only; the held
    commit window accepts a new run.

---

## Implementation and review fold (#79, 2026-10-22)

Implementation d8136b4 (library, `Toolbar.Button` removed), 465d106 (playground), 0201cec
(docs); review `memo/reviewer/button.md` (c8e09d1, "acceptable with minor fixes"). Decisions on
the review's open items and the developer's deviations, folded into the sections above:

| # | Item | Decision | Where |
| --- | --- | --- | --- |
| F1 | Must-fix 1: `disabled` on `render={<a href>}` outside a Toolbar rendered a meaningless `disabled=""` and no `aria-disabled`. | **Fix in code.** `focusable` includes `!isHostButton(render)`; a link or component render takes the `aria-disabled` branch. | 3 (`disabled` doc), 4, 8.1, 15.3, rows 1 and 2 |
| F2 | Item 2: `render={<MyButton />}` got no `type`, so inside a form it submitted. | **Fix in code, library-wide**: `rendersButton` returns `true` for a component element; `isHostButton` is the new strict predicate for the `disabled` branch. No `nativeButton` prop: host elements are detectable statically, and the "harmless if wrong" rule covers components. Affects every part that emits `type` through `rendersButton` (the same footgun); conventions 1.2 amended. | 4, 15.3, conventions 1.2 |
| F3 | Review's note that other parts (`Dialog.Close`, `Popover.Close`, `Dialog.Trigger`, `Form.Submit`) render native `disabled` on a link `render` too. | **Follow-up issue** (not #79): apply `isHostButton` to their `disabled` branch; `Form.Submit` must stay a submitter anyway. | proposal for the PO |
| F4 | Item 3: the rendered-`pending` guard source dropped clicks under entanglement (probe: three clicks, one call). | **Guard on the in-flight counter only.** The held window accepts a new run; `aria-disabled` may outlast the guard. `formAction` keeps its render-value guard (React's own status). | 5.2, 5.4, walkthroughs 5 and 7, row 6, 15.2, conventions 2.5 / 3.4 / 10.1 |
| F5 | Item 4: row 11 intermediate assertion ("resolve A → only A clears"). | Developer adds it. | row 11 (unchanged) |
| F6 | Item 5: playground `.tb-item[aria-disabled="true"]` styles a pending Button as disabled. | Developer switches to `[data-disabled]` as the docs CSS did. | 2.6 |
| F7 | Minor 6: two Buttons sharing one `formAction` function both show pending. | Documented; inherent to `useFormStatus`. | 6.2 |
| F8 | Minors 7 and 8 (`ButtonInvoker` CSS-only Button, `ButtonSave` counter updates on settle). | Developer's call; optional. | 14 |
| D1 | Trigger-wrapped **awaited** action holds `showModal()` until it settles (entanglement). | **Accepted; the design was wrong.** 2.3 uses a non-awaiting prefetch and names the awaited behaviour; 7.1 and row 15 describe it. | 2.3, 7.1, row 15 |
| D2 | Row 25: a `transition="none"` content swap starts no view transition; `"auto"` starts one. | **Accepted**; row 25 rewritten. | row 25 |
| D3 | Hyphenated `aria-disabled` cannot be type-checked away; `expectTypeOf().not.toHaveProperty` plus the owned-key removal test cover it. | Accepted. | row 18 |
| D4 | Playwright `force: true` for clicks on an `aria-disabled` Button (row 22): Playwright's actionability treats it as disabled; the real pointer click still dispatches. | Accepted. | row 22 |
| D5 | `useDevWarning` (`console.error`, once per instance, in an effect) where the design says "warns". | Accepted; the library's one warning channel. | 6.1 |
| D6 | oxlint disable for reading `submittedWith` in render. | Accepted; written only by the click handler before the submission whose status the render shows (precedent: `progress-root`). | 15.3 |

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

---

## 16. Wave 9, #81: re-entry for the other pure triggers

Status: **design amendment, accepted by the user with wave 9 (tracker #85), 2026-10-22.** Applies
the rule of 5.2 and conventions 2.5 to every pure trigger and settles the hook's default.

### 16.1 Which `useActionTrigger` users are pure triggers

| User | What `run` wraps | Pure trigger? | #81 |
| --- | --- | --- | --- |
| `Button` | its `action` | yes | guarded since #79 |
| `Dialog.Close` | `action`, then the close | yes | **guard** |
| `Popover.Close` | `action`, then the hide | yes | **guard** |
| `Menu.Item` | `action`, then the menu close | yes | **guard** |
| `Toast.Action` | `action`, then the toast close | yes: an Undo / Retry / View run twice is a duplicate side effect (toast.md 4.2 called it "harmless for an idempotent Undo"; it is not harmless for Retry) | **guard** |
| `Slider.Root` (`runStep`) | each step's `valueChangeAction` | **no**: a continuous control dispatches one step per pointer move or key press and every step must run (conventions 2.1, 10.1 "Continuous control"); the hook is used for per-step `pending` and superseded-rejection surfacing only | unguarded, explicit |
| `NumberField.Root` (`runStep`) | each step's `valueChangeAction` (press-and-hold) | **no**, as Slider | unguarded, explicit |

### 16.2 The hook's default flips

`ignoreWhilePending` becomes **`true` by default** and the option stays for the two continuous
controls, which pass `ignoreWhilePending: false` with a comment ("a step is not a re-entry").
Reasoning: five of seven users are pure triggers, the hook's own doc calls itself "the transition
of a pure-trigger part", and the failure mode of a forgotten option should be the safe one (a
guarded trigger) rather than the bug #79 exists to prevent (a duplicate side effect). The
positional `useActionTrigger(openGeneration)` form is removed at the same time: every call site
becomes the options object. `run` keeps returning `boolean`.

### 16.3 Per-part behaviour

Common to the four parts: while the part's own run is in flight (in-flight counter, never the
rendered `pending`, 5.2), a click / Enter / Space starts nothing and is `preventDefault()`ed; the
part renders `aria-disabled="true"` for exactly the renders where `data-pending` is set;
`data-disabled` and `state.disabled` stay the consumer's `disabled`; every other listener keeps
working. `aria-disabled` joins each part's owned keys. Walkthroughs that said "repeated clicks
re-run the action; the first close wins" now read "a repeated click while pending is ignored";
the superseded-rejection and overlap rows of each part become N/A with the #79 reason and are
replaced by a Re-entry row (conventions 10.1).

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
  typeahead walk every item, disabled included (menu.md 5, APG), and never read it (wave 9
  review L1 corrects the draft of this bullet, which said they did). `useMenuItem` already
  emits `data-disabled`; `Menu.SubmenuTrigger` too. Consequence: a pending item is an ordinary
  item for navigation and still the "first enabled item" for the open focus, which is right (it
  is pending, not disabled).
  `closeOnActivate={false}` items (a "Refresh" item) are the ones where the guard is visible:
  the item stays, shows `data-pending`, and a second Enter does nothing until it settles.
  `CheckboxItem` / `RadioItem` are state owners (`useControllableAction`), not pure triggers:
  unchanged, latest intent wins.
- **`Toast.Action`** (toast.md 4.2, walkthrough 5). `run` returning `false` returns from the
  handler. `aria-disabled` while pending is a new owned key (the part owned no `disabled`
  before; `rest.disabled` stays pass-through and the no-dispatch check on it stays). The Root's
  `actionPending` (timer pause) is unchanged. Walkthrough 5 ("Undo clicked twice") becomes "the
  second click is ignored; one dispatch, one close".

### 16.4 Test rows per part

The old rows named here are rewritten, not deleted, so the suites keep their coverage count.

**`dialog.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| D1 | Re-entry (library mode, with `action`) | Deferred `action`: a second click, Enter and Space leave it at one call, each is `defaultPrevented`, `aria-disabled="true"` and `data-pending` are on and `data-disabled` is off; the button keeps focus; resolve → one `openChangeAction(false, "activate")`, one `close(value)`, attributes gone (the dialog is closed, so the button is gone with it in the usual harness; assert on the element reference). JS-free variant: one `dialog.close(value)`. |
| D2 | Re-entry, same task | Two synchronous `fireEvent.click`s inside one `act`: one `action` call. |
| D3 | No `action` | A Close without `action` clicked twice while the Root's close is pending: unchanged behaviour (`requestClose` no-op against `intended()`), no `aria-disabled` (no own run). |
| D4 | Superseded rejection → N/A | `dialog.test.tsx:1240` ("with action: a superseded rejection still reaches the boundary") becomes a rejection row: the single run rejects → boundary above the Close, dialog stays open, a click after the boundary resets runs again. Top-of-file comment lists Overlap / Superseded rejection for the Close part as N/A (#79 reason). |
| D5 | Stale close row (design table "Close part, stale close") | Unchanged except its last sentence: drop "a superseded click's rejection reaches the catcher". |
| D6 | Owned `aria-disabled` | A `render` element's `aria-disabled` is removed when the Close is idle (owned `undefined`). |

**`popover.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| P1 | Re-entry (library mode and JS-free mode, with `action`) | As D1 with `hidePopover` / `requestClose` (one `openChangeAction(false)` / one `hidePopover()`). |
| P2 | Re-entry, same task | As D2. |
| P3 | `popover.test.tsx:1360` ("a superseded rejection still reaches the boundary") | Becomes the single-run rejection row; N/A comment as D4. |
| P4 | Owned `aria-disabled` | As D6. |

**`menu.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| M1 | `menu.test.tsx:844` ("two activations run the action twice; the close happens once") | Rewritten: a deferred `action` on a `closeOnActivate` Item; a second Enter, Space and click leave it at one call and are `defaultPrevented`; the item has `aria-disabled="true"`, `data-pending`, no `data-disabled`; resolve → one `requestClose`, the menu closes. |
| M2 | Re-entry on a `closeOnActivate={false}` Item | Deferred action: second activation ignored; resolve → attributes gone, menu still open, the next Enter runs again. |
| M3 | Navigation ignores pending (split, wave 9 deviation 1) | Integration half (`menu.test.tsx`): while an Item is pending (`aria-disabled` on it), the arrows, Home, End and typeahead land on it as on any item (they never skipped disabled items). Unit half (`menu-dom.test.ts`): `edgeItem` returns a pending item (`aria-disabled` without `data-disabled`) as the first enabled item and skips a `data-disabled` one; the open-focus rows already cover `edgeItem`'s use. The "re-open while pending" case cannot be observed end to end: the re-open is entangled with the pending item's action and commits after it settles, so the pending state is gone by the time the open focus resolves. |
| M4 | `menu.test.tsx:871` ("a superseded rejection reaches the boundary", Item) | Becomes the single-run rejection row (menu stays open, boundary above the item, the next activation runs after reset); N/A comment. `menu.test.tsx:1350` (RadioItem / CheckboxItem) is **unchanged**: state owners keep overlap and superseded rejection. |
| M5 | Design table "Overlap" row (menu.md 966) | "Two Item clicks: action called twice, `requestClose` once effective" → "Two Item clicks: action called once (the second is ignored), one `requestClose`". The RadioItem half stays. |
| M6 | `menu-dom.ts` unit | `isDisabledItem` is `true` for `data-disabled=""` and `false` for `aria-disabled="true"` without it. |

**`toast.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| T1 | `toast.test.tsx:852` ("two Undo dispatches resolved out of order close the toast once") | Rewritten: a deferred Undo `action`; a second click leaves it at one call and is `defaultPrevented`; the Action has `aria-disabled="true"` and `data-pending`, the Root `data-pending`, the timer paused (existing assertion); resolve → one close (`"activate"`). |
| T2 | Superseded rejection rows in that `describe` | Become the single-run rejection row (toast stays, boundary above the Viewport, as walkthrough 4); N/A comment for Overlap / Superseded rejection on `Toast.Action`. |
| T3 | `Toast.Close` while Undo pending (walkthrough 6) | Unchanged: Close is not a `useActionTrigger` user. |
| T4 | Owned `aria-disabled` | A `render` element's `aria-disabled` on an idle Action is removed. |

**`use-action-trigger` and the continuous controls**

| # | Row | Test |
| --- | --- | --- |
| H1 | Default | `useActionTrigger()` with no options ignores a second `run` while the first is in flight (`run` returns `false`), and runs it after settle; `{ ignoreWhilePending: false }` runs both. The existing superseded-rejection hook tests move under the `false` option. |
| H2 | Slider / NumberField | `slider.test.tsx` and `number-field.test.tsx` step rows (two steps in flight, out-of-order resolution, superseded step rejection) pass unchanged with the explicit `false`; one new assertion per file: a second step dispatched while the first step's action pends is **called** (guards the explicit opt-out). |

### 16.5 Docs

Dialog, Popover, Menu and Toast pages: the sentence "repeated clicks re-run the action" becomes
"a second click while pending is ignored and the button is `aria-disabled` meanwhile", with the
non-awaiting spelling for "close now, work later" (menu.md 2.3 already shows it). Owned-keys
lists gain `aria-disabled`. The "Pending & optimistic state" concept page gets one paragraph:
every pure trigger ignores re-entry; state owners (Toggle, Tabs, Checkbox items) take every
click and the latest intent wins. Changelog entry (behaviour change, not breaking).

---

## 17. Wave 9, #83: `disabled` on link and component renders, library-wide

Status: **design amendment, accepted by the user with wave 9 (tracker #85), 2026-10-22.** Applies
the conventions 1.2 rule of the #79 fold (a `disabled` part whose rendered element is not a host
`<button>` renders `aria-disabled="true"`, not native `disabled`) to every part that owns
`disabled` and accepts an arbitrary `render`.

### 17.1 The sweep

| Part | Today | Click handler always installed? | #83 |
| --- | --- | --- | --- |
| `Dialog.Close` | native `disabled`, owned | library mode or with `action`; JS-free mode without `action` is the browser's `request-close` command | **yes, when a click handler is installed**: `focusable = !isHostButton(render) && installClick`. In JS-free command mode a component render must render a `<button>` anyway (dev warning), and native `disabled` is what stops the command. |
| `Popover.Close` | same | same | same |
| `Dialog.Trigger` | native `disabled`, owned | library mode or non-modal; JS-free modal mode is the `show-modal` command | same condition (`installClick`) |
| `Popover.Trigger` | native `disabled`, owned | library mode only; JS-free mode is `toggle-popover` | same condition (library mode) |
| `Menu.Trigger` | native `disabled`, owned | always (`onClick` + `onKeyDown`) | **yes** |
| `Toggle` | native `disabled`, owned | always | **yes** |
| `ToggleGroup.Item` | native `disabled`, owned; roving skips `:disabled` | always | **yes**; a link / component Item that is disabled is then **reachable by the arrows** (the engine skips `:disabled` only), which is the APG Toolbar behaviour and acceptable for the rare non-button Item; row below records it |
| `Combobox.Trigger`, `Combobox.Clear` | native `disabled`, owned (`tabIndex` owned too) | always | **yes** |
| `NumberField.Increment` / `Decrement` | native `disabled` (also at bound / `readOnly`), owned | always (`useStepButton`) | **yes**; the at-bound case follows the same branch |
| `Form.Submit` | native `disabled`, owned; **no click handler** | never: it is a native submitter | **no**. With `aria-disabled` a component render would still submit on click (nothing cancels it), and a link render is already a dev error ("only a submit button submits the form"). Native `disabled` is the only correct disabled state for a submitter; documented in its props table. |
| `Select.Trigger` | native | must stay a `<button>` (conventions 1.2) | no (host button by contract) |
| `Tabs.Tab`, `Accordion.Trigger`, `Menu.Item`, `Menu.CheckboxItem` / `RadioItem` / `SubmenuTrigger`, `Button` | `aria-disabled` already | | no change |
| `Toast.Action`, `Toast.Close` | `disabled` is **pass-through** (not owned; the handler checks `rest.disabled`) | always | out of #83: they do not own `disabled`. Noted for a later "own `disabled` on the Toast parts" item; not a correctness bug today beyond the same link case, which the Toast parts never advertise. |
| `Tooltip.Trigger` | renders no `disabled` attribute (`data-disabled` only; the Root's `disabled` switches the tooltip off) | | no change |

Where the condition is "when a click handler is installed", the part computes `focusable` from
the same `installClick` flag it already has, so the branch and the handler always agree: the
handler is what makes `aria-disabled` safe (it returns before dispatch, and `preventDefault()`s
so a link does not navigate), exactly as `Button` does.

### 17.2 Shared mechanics

- `isHostButton(render)` from `internal/render-element.ts` is the predicate (no `render`, the
  function form, a host `"button"`), the same one `Button` uses.
- In the focusable branch the part passes `disabled: undefined` (owned removal) and
  `"aria-disabled": disabled ? true : undefined`; `data-disabled` and `state.disabled` are
  unchanged. Parts that already own `aria-disabled` for another reason (the Close parts, for
  pending since #81) merge the conditions.
- **`aria-disabled` is owned only where the part computes it** (wave 9 review deviation 5):
  in the focusable branch, and always on the parts that render it for pending (#81). A
  host-button Toggle / Trigger outside the branch does not own the key, so a consumer's own
  `aria-disabled` passes through as before (conventions 1.2: "a part that does not own a key in
  some mode omits the key instead").
- **An invoker in the focusable-disabled branch owns `commandfor` and `command` as `undefined`**
  (wave 9 review M1): `aria-disabled` has no behaviour, so a disabled component render that
  spreads onto a real `<button commandfor command>` would be a live invoker in the server HTML
  and open / close its target on a click before hydration, where native `disabled` used to make
  the button "not a valid invoker". With the attributes removed there is nothing to invoke while
  disabled; the implicit anchor and the platform's `aria-expanded` mapping are moot for a
  disabled control, and both return when `disabled` is unset. Applies to `Popover.Trigger`,
  `Menu.Trigger`, `Menu.SubmenuTrigger` (`use-popover-trigger.ts`), library-mode modal
  `Dialog.Trigger`, `Dialog.Close` and `Popover.Close`; harmless on a link render (an `<a>` is
  never an invoker). Row per part: a disabled component render has no `command` /
  `commandfor` attribute (jsdom), plus a `renderToString` row for `Menu.Trigger`.
- The `onClick` guard `if (disabled) { event.preventDefault(); return; }` is already the shape in
  `Toggle`, the Close parts and the Triggers (some return without `preventDefault()`; add it, so
  a disabled link render does not navigate, as `Toolbar.Button` did in #66 and `Button` does).
- No new prop: `focusableWhenDisabled` stays Button-only (the Toolbar context read is also
  Button-only; a Toggle inside a Toolbar keeps native `disabled`, #66 decision 13).

### 17.3 Test rows per part

One jsdom row per part, in its own suite, plus the regression half:

| Part | Row |
| --- | --- |
| `Dialog.Close`, `Popover.Close` | Library mode, `disabled` with `render={<a href="#x" />}` and with `render={<MyButton />}` (a component spreading onto a `<button>`): `aria-disabled="true"`, no `disabled` attribute, `data-disabled`, click `defaultPrevented` and no `openChangeAction` / `close` / `hidePopover`; `render={<button />}` and no `render`: native `disabled`, no `aria-disabled` (unchanged). JS-free mode without `action`, `render={<MyButton />}` disabled: native `disabled` (the command branch), `aria-disabled` absent. |
| `Dialog.Trigger` | Library mode (modal and non-modal) and JS-free non-modal: link / component renders → `aria-disabled`, click cancelled, nothing opens; JS-free modal with a component render → native `disabled`. |
| `Popover.Trigger` | Library mode: link / component renders → `aria-disabled`, click cancelled, no dispatch; JS-free mode with a component render → native `disabled`. |
| `Menu.Trigger` | Link / component renders → `aria-disabled`; click, Enter, ArrowDown do not open; host button → native `disabled` (unchanged). |
| `Toggle` | `disabled` with `render={<a href>}` / `render={<MyButton />}` → `aria-disabled`, no dispatch, `aria-pressed` still rendered, click `defaultPrevented`; host button unchanged. |
| `ToggleGroup.Item` | Same, plus: a disabled link Item is reached by the arrows (documented), still never dispatches; a disabled host-button Item is skipped (unchanged). |
| `Combobox.Trigger`, `Combobox.Clear` | Component render disabled → `aria-disabled`, `tabIndex` as before, click does nothing (no open / no clear). |
| `NumberField.Increment` / `Decrement` | Component render: disabled by prop, by `readOnly`, and at the bound → `aria-disabled` and no step on click / pointerdown hold; host button → native `disabled` in all three (unchanged). |
| `Form.Submit` | Regression: `disabled` with `render={<MyButton />}` renders native `disabled` and **no** `aria-disabled`; the props-table sentence "always native `disabled`: a submitter has no handler to honour `aria-disabled`" is in the docs. |
| `Button` | Unchanged (#79 rows 1 and 2). |

### 17.4 Docs

Each affected page's `disabled` row gains the sentence "with a link or component `render`,
`aria-disabled="true"` instead (the element stays focusable); native `disabled` on a `<button>`".
Conventions 1.2's "the other `disabled` parts follow in a separate issue" is replaced by the list
above. Changelog entry (behaviour change for link / component renders only).

---

## Implementation and review fold (wave 9, #81 and #83, 2026-10-22)

Implementation 27e64f4 (#81) and f827869 (#83) on `memo/developer/wave9-triggers.md`; review
`memo/reviewer/wave9.md` (a29e3ad, "acceptable with fixes"). All six developer deviations
accepted; the review's items decided as follows and folded into 16 and 17 above.

| # | Item | Decision | Where |
| --- | --- | --- | --- |
| W1 | Review M1: the focusable-disabled branch kept `commandfor` / `command`, so a disabled component render was a live invoker before hydration. | **Fix in code**: own both as `undefined` in that branch (Popover / Menu / Submenu Triggers, library-mode modal Dialog.Trigger, both Close parts); rows per part plus a `renderToString` row for `Menu.Trigger`. | 17.2 |
| W2 | Review M2 / L1: docs, jsdoc, menu.md 2.3 and 16.3 said the arrows, Home / End and typeahead skip disabled items; only `edgeItem` (open focus, Trigger arrows while open) does. | Corrected in menu.md 2.3 and 16.3 here; the developer corrects `MenuPage.tsx`, `menu-item.tsx`'s `disabled` jsdoc and `menu-dom.ts`'s jsdoc to "a pending item is an ordinary item for navigation; only the open focus skips items with the `disabled` prop". | 16.3, menu.md 2.3 |
| W3 | Deviation 1: M3 split into the integration half (arrows / Home / End / typeahead land on a pending item) and an `edgeItem` unit row; the re-open half is unobservable end to end (entanglement). | Accepted; row rewritten. | 16.4 M3 |
| W4 | Deviation 2: D3 asserted as two `openChangeAction` calls (the open and one close), one `close()`, no `aria-disabled`. | Accepted. | 16.4 D3 |
| W5 | Deviation 3: D4 / P3 / M4 also reset the boundary (key bump) and check the next activation runs on the fresh instance. | Accepted; stronger than the design row (the in-flight decrement on reject is not observable through a boundary, which unmounts the part). | 16.4 |
| W6 | Deviation 4: T2 split into "two clicks in one task → one dispatch; rejection reaches the boundary, toast not ending" and the `closeOnSettle={false}` variant (where the guard is visible). | Accepted. | 16.4 T2 |
| W7 | Deviation 5: `aria-disabled` owned only in the focusable branch (and always on the Close parts for pending); host buttons keep a consumer's own `aria-disabled` as pass-through. | Accepted as the rule; recorded in 17.2. | 17.2 |
| W8 | Deviation 6: JS-free non-modal `Dialog.Trigger` renders `aria-disabled` on a component render but no `data-disabled` (dialog.md 4.2: `data-disabled` is library-mode only); `Popover.Trigger` in JS-free mode has the same gap. | Accepted for wave 9 (17.2 said `data-disabled` is unchanged). **Needs a later conventions item**: 4.1's `disabled` row ("any" part) and 1.2's owned-keys rule should say that a part emits `data-disabled` in every mode in which it renders `disabled` *or* `aria-disabled`, so the styling hook and the ARIA state never disagree; the two JS-free Triggers are the only cases today, and the fix is `dataAttr(disabled)` without the `isLibrary &&`. Proposed as a small issue for the product owner to file; not wave 9. | this table |
| W9 | Review L2: the NumberField disabled-link `preventDefault()` row clicks with `detail: 0`. | Developer adds a `detail: 1` assertion. | 17.3 |
| W10 | Review L3: a pointer press on a disabled focusable step render takes focus from the input (`pointerdown` returns before `preventDefault()`). | **Accept the suggestion**: cancel the `pointerdown` when disabled too, so a disabled step button never steals focus (Combobox.Trigger / Clear already cancel unconditionally). | 17.1 NumberField row |
| W11 | Review L4: the #81 changelog says "behaviour change"; a consumer counting clicks through `Menu.Item` / `Toast.Action` changes result silently. | Flag it in the alpha.7 release notes as breaking for that pattern, pointing at the non-awaiting spelling; 16.5 amended by this row. | 16.5 |
