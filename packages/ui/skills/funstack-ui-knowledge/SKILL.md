---
name: funstack-ui-knowledge
description: Use this skill when you write, review or debug code that uses `@funstack/ui` (FUNSTACK UI, the headless React component library your app uses). Its API differs from other headless libraries (action props instead of onX handlers, transitions by default, `render` instead of `asChild`), so read this before using any of its components.
---

# FUNSTACK UI Knowledge

**FUNSTACK UI** (`@funstack/ui`) is a headless React component library built on actions, transitions, `useOptimistic`, Suspense and `<ViewTransition>`. It is experimental (alpha releases), so trust the bundled docs over your memory.

Requirements: `react` and `react-dom` `>=19.3.0`. ESM only. Latest stable Chrome/Edge, Safari and Firefox; no fallbacks for older ones.

**Read the component's page before you use it.** The docs are bundled as Markdown at `node_modules/@funstack/ui/dist/docs/<route>.md` (start from `index.md`, which lists every page). Each component page starts with an example and its Anatomy. Without the package, use https://ui.funstack.work/llms.txt (each page is at its URL plus `.md`). Paths below are relative to the docs root.

## Mental model

- **Action props, not event handlers.** A prop named `action` or `xChangeAction` runs inside the component's own transition, and a returned promise is awaited. Change actions take `(next, details)`; task actions (`Button`, `Menu.Item`, `Dialog.Close`, `Drawer.Close`, `Popover.Close`, `AlertDialog.Cancel`, `AlertDialog.Action`, `Toast.Action`) take only `(details)`. `concepts/action-props.md`
- **State triple.** State `x` comes as `x` (controlled), `defaultX` (uncontrolled) and `xChangeAction`. `undefined` means uncontrolled; "nothing selected" is `null`. `concepts/action-props.md` ("Naming")
- **Triggers are optimistic, content is committed.** The part the user acts on shows the new value at once, and it and the state owner (usually the `Root`) carry `data-pending`. Panels and popup content show the committed value, so new content that suspends keeps the old one on screen. You place every `<Suspense>`. A rejection rolls back and goes to the nearest Error Boundary; one from a superseded or unmounted action goes to `reportError`, which fails a test run that does not stub it. Content a JS-free component renders ahead (an Accordion, Collapsible, Dialog or Popover without state props) must not suspend. `concepts/pending-and-optimistic.md`, `concepts/suspense.md`
- **The latest intent wins.** A second click while pending is a new intent; uncontrolled state commits only the latest dispatch. Set-valued components (CheckboxGroup; ToggleGroup and Accordion without `exclusive`) commit each change on its own: persist `details.added` / `details.removed`, not `next`. To run saves in order, queue them with `useActionState`. `concepts/action-props.md` ("Overlapping actions")
- **Requests and facts.** Opening and a Close part are requests (`openChangeAction`, awaited, vetoable). Escape and a click outside are facts the browser already performed: `onOpenChange(false, details)`, called synchronously and never pending. A controlled overlay passes both: `open={open} openChangeAction={setOpen} onOpenChange={setOpen}`; set state directly in `onOpenChange`, never in `startTransition` or after an `await`. `concepts/browser-owned-state.md` ("Requests and facts")
- **`transition` prop = `<ViewTransition>`.** Parts that show committed state take it (Panels, the Popups except Tooltip's, `Accordion.Item`, `Collapsible.Root`), and so does `Button`. Other triggers and checkable controls have none: animate them with CSS on their data attributes. Each dispatch adds `fsui-<component>` transition types. Write a popup's exit as a CSS `transition`, not `@keyframes`. `concepts/transitions.md`
- **One Escape closes one layer.** To keep a layer open on Escape, call `preventDefault()` on the `keydown`; `stopPropagation()` does not keep it open. `concepts/browser-owned-state.md` ("One Escape closes one layer")
- **Headless.** No provider, theme or stylesheet. Style `data-*` attributes (`data-x=""` when true, absent when false; enums carry a value). Hover, focus and active are not attributes: use `:hover`, `:focus-visible`, `:active`. `getting-started.md`

## Things agents get wrong

1. **No `onClick`, `onChange`, `onValueChange`, `onPressedChange`.** The library's `on*` props report facts only: `onOpenChange` (on `Popover.Root`, `Menu.Root`, `Combobox.Root`, `MultiSelect.Root`, `Dialog.Root`, `AlertDialog.Root`, `Drawer.Root`, `HoverCard.Root`, `NavigationMenu.Item`), `Combobox.Root`'s `onInputValueChange`, `OTPField.Root`'s `onValueChange`, and `toast({ onClose })`. A DOM handler the part installs itself (`onClick` on `Toggle`) is not in its props type: put yours on the `render` element.
2. **Don't wrap the action in `startTransition`**, and don't add `useOptimistic` or a pending flag: the component does both. Exception: a `setState` after your own `await` is outside the transition, so wrap that one in `startTransition`. Such updates land in completion order (an older response can overwrite a newer one): guard them, or queue the calls with `useActionState`.
3. **A pending save holds every menu, tab and dialog in the app.** React holds all transitions until every pending action settles, and the library opens and switches in transitions. Return the promise only when the UI must wait for it; for a background save write `valueChangeAction={(v) => { void save(v); }}`. Start a refetch after the action (`setTimeout`), not inside it. Open your own controlled overlay (a shortcut) with a plain `setOpen(true)`, outside `startTransition`. `concepts/action-props.md` ("Pending actions hold other transitions")
4. **A caught error counts as success.** To show your own message and roll back (and keep a menu, toast or dialog open), catch, show it, then call `details.reject()` before the action settles. Never `void save().catch(() => details.reject())`: return or await the promise. Handlers, form actions and a Server Function passed directly have no `reject`. `concepts/action-props.md` ("Handling a failed save without an Error Boundary")
5. **An inline save checks `details.valid`.** Invalid values are dispatched too (a `required` TextField commits `""`). Start with `if (!details.valid) return;`, or `return details.reject();` to put the saved value back.
6. **Field errors are for wrong values.** `Form.Root errors[name]` blocks resubmitting the same value until it is edited ("title taken"). A failed request goes to `Form.Root error`, shown by `<Form.Error />`, and the same values can be retried. `components/field.md` ("Form-level errors")
7. **`useActionState` for a form in a Dialog goes inside the Popup**, in a component under `<Dialog.Root defaultOpen={false}>`, so each open starts without the last errors. `components/field.md` ("In a Dialog")
8. **Put `whilePending="ignore"` on a Save, Pay or Delete `Button`.** A `Button` runs its action again on every click by default; the overlay Close parts, `Menu.Item` and `Toast.Action` already ignore them (`Menu.Item` and `Toast.Action` run again with `closeOnActivate={false}`).
9. **No `asChild`, no `as`.** Use `render={<MyButton />}` (accepts `ref`, spreads props) or `render={(props, state) => <a {...props} />}`. `concepts/render.md`
10. **`className`, `style` and `children` may be functions of state**: `className={({ pending }) => ...}`. A trigger's `children` must not suspend.
11. **Panels never get `data-pending`.** Select through the Root: `.tabs[data-pending] .panel { opacity: .6 }`. Dialog and Popover Roots render no element; use the Trigger's `data-pending`.
12. **Import from subpaths**: `import { Tabs } from "@funstack/ui/tabs"`. Shared types (`ChangeReason`, `Rejectable`, `WhilePending`, ...) come from `@funstack/ui/types`; a component's own types from its subpath.
13. **Combobox: typing then Enter picks nothing** (APG manual selection). Pass `autoHighlight` on the Root to make the first match active.
14. **A Close part with `action` does nothing before hydration.** For work that must run without JavaScript, use `Dialog.Form` / `AlertDialog.Form` with a Server Function.
15. **Error Boundary for a toast's Undo**: put it around `Toast.Action`, inside the Root (or one per `Toast.Root`). A boundary around `Toast.Viewport` removes the whole region. `components/toast.md`
16. **No polyfills** for the Popover API, `<dialog>`, Anchor Positioning or Invoker Commands. Features not in every engine are `experimental_*` props.
17. **A Server Function can be passed directly to any action prop**, also from a Server Component; a plain function cannot. `concepts/server-components.md`
18. **No direction or locale provider.** Use the `dir` attribute; `locale` is a prop of `NumberField.Root`, `Progress.Root` and `Meter.Root`. `concepts/direction-and-locales.md`

## Component index

Import path, parts, main state props, must-know rules. The rest is on `components/<name>.md`.

- `Button` (`@funstack/ui/button`): `action`, `formAction`, `whilePending` (default `"run"`).
- `Toggle` (`@funstack/ui/toggle`): `pressed` / `defaultPressed` / `pressedChangeAction`.
- `ToggleGroup` (`@funstack/ui/toggle-group`): `Root`, `Item`. `value` is `readonly string[]`, or `string | null` with `exclusive`; `details` has `added` / `removed`.
- `Toolbar` (`@funstack/ui/toolbar`): `Root`, `Separator`. Any focusable descendant is an item. A disabled library `Button`, `Toggle`, `ToggleGroup.Item` or overlay Trigger inside stays focusable (`aria-disabled`): style `[data-disabled]`, not `:disabled`.
- `Tabs` (`@funstack/ui/tabs`): `Root`, `List`, `Tab`, `Panel`, `Indicator`. `value` / `defaultValue` / `valueChangeAction`.
- `Accordion` (`@funstack/ui/accordion`): `Root`, `Item` (`<details>`), `Trigger` (`<summary>`), `Panel`. `value` / `valueChangeAction`; `exclusive` for one open item. Without them it needs no JavaScript: style `:open`, not `state.open`.
- `Collapsible` (`@funstack/ui/collapsible`): `Root` (`<details>`), `Trigger`, `Panel`. `open` / `defaultOpen` / `openChangeAction`. One disclosure; use it rather than a lone `Accordion.Item`.
- `NavigationMenu` (`@funstack/ui/navigation-menu`): `Root`, `List`, `Item`, `Trigger`, `Popup`, `Link`. Open props on `Item`. Site navigation, not a menu (no menu roles, no arrow keys); mark the current page with `aria-current="page"` yourself.
- `Tooltip` (`@funstack/ui/tooltip`): `Root`, `Trigger`, `Popup`, `Arrow`. No open props (the browser owns it); `delay`, `closeDelay`.
- `HoverCard` (`@funstack/ui/hover-card`): `Root`, `Trigger` (a link), `Popup`. `open` / `openChangeAction` / `onOpenChange`. Supplementary content only (nothing on touch); a click-to-open card is a Popover.
- `Popover` (`@funstack/ui/popover`): `Root`, `Trigger`, `Popup`, `Close`, `Title`, `Description`. `open` / `openChangeAction` / `onOpenChange`; without open props it needs no JavaScript: style `[data-open]` then (`state.open` stays `false`).
- `Dialog` (`@funstack/ui/dialog`): `Root`, `Trigger`, `Popup` (`<dialog>`), `Close`, `Form`, `Title`, `Description`. Same open props as Popover. `Dialog.Form` closes after its form action settles; with field errors, `render={<Form.Root errors={state.errors} error={state.error} />}`.
- `AlertDialog` (`@funstack/ui/alert-dialog`): `Root`, `Trigger`, `Popup`, `Title`, `Description`, `Cancel`, `Action`, `Form`. Always modal. Put the work in `<AlertDialog.Action action={() => deleteProject(id)}>`: it pends, closes when it resolves, and a rejection keeps the dialog open.
- `Drawer` (`@funstack/ui/drawer`): Dialog's parts on an edge, swipe to dismiss. `Drawer.Popup` takes `side` (default `"bottom"`) and `swipeDismiss`. Always render a `Drawer.Close`; copy the page's swipe CSS.
- `Menu` (`@funstack/ui/menu`): `Root`, `Trigger`, `Popup`, `Item` (`action`), `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `GroupLabel`, `Separator`, `SubmenuTrigger`, `ContextTrigger`. A `Root` inside a `Popup` is a submenu.
- `Menubar` (`@funstack/ui/menubar`): one element around ordinary `Menu.Root`s (no Menubar parts); name it with `aria-label`. Application menus only.
- `Toast` (`@funstack/ui/toast`): `toast()` (plus `toast.promise`, `toast.update`, `toast.dismiss`), `createToastManager`; parts `Viewport`, `Root`, `Title`, `Description`, `Action`, `Close`. Render `<Toast.Viewport>` once (`children` is a function of `{ toasts }`); `Toast.Action` closes its toast when its `action` resolves.
- `Field` and `Form` (`@funstack/ui/field`, `@funstack/ui/form`): `Field.Root`, `Label`, `Control`, `Description`, `Error`; `Form.Root` (`action`, `errors`, `error`), `Submit`, `Error`. A textarea is `<Field.Control render={<textarea />} />`. Never disable a fieldset while submitting; style `form[data-pending]`.
- `Checkbox` (`@funstack/ui/checkbox`), `Switch` (`@funstack/ui/switch`): native inputs; `checked` / `defaultChecked` / `checkedChangeAction`; Checkbox has controlled-only `indeterminate`.
- `CheckboxGroup` (`@funstack/ui/checkbox-group`): `Root`, `Label`, `Item`, `Parent` (select-all). `value` is `readonly string[]`.
- `RadioGroup` (`@funstack/ui/radio-group`): `Root`, `Label`, `Item`. `value` / `valueChangeAction`.
- `Select` (`@funstack/ui/select`): a real `<select>`. `Root`, `Trigger`, `Value`, `Option`, `Group`, `GroupLabel`, `Separator`. Single value only (several: `MultiSelect`); style the picker with `appearance: base-select`.
- `Combobox` (`@funstack/ui/combobox`): `Root`, `Label`, `Input`, `Trigger`, `Clear`, `Popup`, `List`, `Option`, `Group`, `GroupLabel`, `Empty`, `Status`; with `multiple` also `Chips`, `Chip`, `ChipRemove`. `value` / `valueChangeAction`, and the urgent `inputValue` / `onInputValueChange`. You render and filter the options (`List` children get the deferred `query`).
- `MultiSelect` (`@funstack/ui/multi-select`): `Root`, `Label`, `Trigger`, `Value`, `Popup`, `List`, `Option`, `Group`, `GroupLabel`, `Empty`, `Status`. `value` is `readonly string[]`; persist `added` / `removed`. Render the summary in `MultiSelect.Value` from `value` (labels are yours). No search or chips: that is `Combobox multiple`.
- `Slider` (`@funstack/ui/slider`): `Root`, `Label`, `Track`, `Indicator`, `Thumb`, `Value`. `valueChangeAction` per step, `valueCommitAction` once per gesture: save in the commit action.
- `NumberField` (`@funstack/ui/number-field`): `Root`, `Label`, `Input`, `Increment`, `Decrement`. `value` (`number | null`), `valueChangeAction`, `valueCommitAction`.
- `OTPField` (`@funstack/ui/otp-field`): `Root` (`length` required), `Input`, `Slot`. The text is urgent: `value` / `onValueChange`. `completeAction` runs when the code is complete; a wrong code is not an error (resolve, show a message).
- `TextField` (`@funstack/ui/text-field`): one element that saves itself. `value` / `defaultValue` are the saved text; `valueCommitAction` runs on blur or Enter (Ctrl/Cmd+Enter in a `<textarea>` via `render`). No `onChange`; for a plain input use `<input>` or `Field.Control`.
- `Progress` (`@funstack/ui/progress`), `Meter` (`@funstack/ui/meter`): `Root`, `Track`, `Indicator`, `Label`, `Value`. Output only.
- `Separator` (`@funstack/ui/separator`): one `<hr>`; `orientation`, `decorative`. Inside a Toolbar, Menu or Select use their own `Separator`.
- `Avatar` (`@funstack/ui/avatar`): `Root` (`alt` required; `""` for decorative), `Image`, `Fallback`. Stack the Fallback under the Image in one grid cell.
- No `ScrollArea`: style a native scroller. `components/scroll-area.md`
- `CSPProvider`, `STYLE_SHA256` (`@funstack/ui/csp`): for a strict `style-src` policy. `concepts/content-security-policy.md`
- Every form control (and `Field.Root`) has `readOnly`: focusable, submitted, never dispatching; style `[data-readonly]`, not `:read-only`. A disabled control is never submitted. `components/field.md`
