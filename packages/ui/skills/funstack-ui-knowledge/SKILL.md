---
name: funstack-ui-knowledge
description: Use this skill when you write, review or debug code that uses `@funstack/ui` (FUNSTACK UI, the headless React component library your app uses). Its API differs from other headless libraries (action props instead of onX handlers, transitions by default, `render` instead of `asChild`), so read this before using any of its components.
---

# FUNSTACK UI Knowledge

**FUNSTACK UI** (`@funstack/ui`) is a headless React component library built on React's async features: actions, transitions, `useOptimistic`, Suspense and `<ViewTransition>`. Components render accessible HTML with `data-*` attributes and ship no visual styles. It is experimental (alpha releases under the `alpha` dist-tag); APIs change between releases, so trust the bundled docs over your memory.

Requirements: `react` and `react-dom` `>=19.3.0` (peer dependencies). ESM only. Supported browsers: the latest stable Chrome/Edge, Safari and Firefox, with no fallbacks for older ones.

## Mental model

- **Action props, not event handlers.** Interactive props are named `action` or `fooAction` (`pressedChangeAction`, `valueChangeAction`, `openChangeAction`, `checkedChangeAction`). The component calls them inside its own React transition and awaits a returned promise. Change actions (`xChangeAction`) take `(next, details)`; task actions (`action` on `Button`, `Menu.Item`, `Dialog.Close`, `Popover.Close`, `Toast.Action`) take only `(details)`, so write `action={() => save()}`, not `action={(next) => ...}`. The return type is `unknown`. `details.event` is the native DOM event; `details.reason` (where present) is `"activate" | "platform" | "dismiss" | "timeout"`.
- **State triple.** A controllable state `x` comes as `x` (controlled), `defaultX` (uncontrolled initial value) and `xChangeAction`. `undefined` means uncontrolled; "nothing selected" is `null`. Do not switch between controlled and uncontrolled after mount.
- **Optimistic and pending are built in.** While an action is pending, triggers (the parts the user acts on) already show the new value, and the state owner (usually the `Root`) and the trigger carry `data-pending`. If the action rejects, the value rolls back and the error goes to the nearest Error Boundary. Uncontrolled state is written only after success.
- **Latest intent wins, for uncontrolled state.** A second click while pending is a new intent: the optimistic display follows it, and uncontrolled state commits only the most recent dispatch. In controlled mode, your own `setState` after an `await` lands in completion order, so an older response can overwrite a newer one; guard it yourself or queue the calls with React's `useActionState`. Exception: a pure trigger (a part that runs a task, such as `Button`, `Dialog.Close`, `Menu.Item`) ignores clicks while its own action is pending and is `aria-disabled` meanwhile. Parts are never natively disabled while pending.
- **Content regions show the committed value.** Panels and popup content follow the committed state, so content that suspends keeps the old content on screen until it is ready (with value or open props, an Accordion item, Dialog or Popover stays closed until then; without them their content is rendered ahead and must not suspend). The library never adds `<Suspense>` and has no `fallback` props; you place boundaries.
- **`transition` prop = `<ViewTransition>`.** Parts whose content is driven by library state accept `transition`; passing it wraps the part in `<ViewTransition default={transition}>`. Without it, no boundary is rendered. Each dispatch is tagged with `fsui-<component>` transition types (for example `fsui-tabs-next`), usable in a type map or `:active-view-transition-type()`.
- **Browser-owned state.** Where the platform owns the state (popover top layer, `<details open>`, `<dialog>` dismissal, native inputs), the library observes it instead of copying it. Escape and click-outside are browser dismissals: `openChangeAction(false)` is a notification and cannot be vetoed.
- **Headless.** No provider, no theme, no stylesheet. Style with your CSS on `data-*` attributes (present as `data-x=""` when true, absent when false; enum states carry a value, `data-orientation="vertical"`). Hover, focus and active are not attributes: use `:hover`, `:focus-visible`, `:active`.

## Things agents get wrong

1. **Do not use `onClick`, `onChange`, `onValueChange`, `onOpenChange`, `onPressedChange`.** They do not exist as library props. Handlers a part installs itself (for example `onClick` on `Toggle`) are removed from its props type; unused DOM handlers pass through to the element. The one `on*` prop the library defines is `Combobox.Root`'s `onInputValueChange` (controlled input text must update synchronously).
2. **Do not wrap the action in `startTransition` yourself**, and do not add `useOptimistic` or a pending flag around a component: it already does this. But a `setState` that runs **after your own `await`** inside an action is outside the transition (a React rule); wrap that one in `startTransition`.
3. **Return a promise only if the UI must wait for it.** A pending async action holds every other transition in the app (including router navigations). For background work, do not return the promise: `valueChangeAction={(v) => { void save(v); }}`.
4. **No `asChild`, no `as`.** Use `render`: `render={<MyButton />}` (the element must accept `ref` and spread its props) or `render={(props, state) => <a {...props} />}`.
5. **`className`, `style` and `children` may be functions of the part's state**, for example `className={({ pending }) => ...}`. Trigger `children` render from optimistic state and must not suspend.
6. **Import from subpaths**: `import { Tabs } from "@funstack/ui/tabs"`. The root entry also works; shared types (`ActionDetails`, `ChangeAction`, `ChangeReason`, `RenderProp`, `StateValue`, `UrgentChangeHandler`) are exported from `@funstack/ui`.
7. **Compound components are namespaces of parts** (`Tabs.Root`, `Tabs.Tab`). The namespace itself is not a component.
8. **Do not add polyfills or JS fallbacks** for the Popover API, `<dialog>`, CSS Anchor Positioning or Invoker Commands. Features not in every engine yet are opt-in `experimental_*` props.
9. **Server Components**: parts are `"use client"` modules, so a Server Component can render them, but it can only pass serialisable props. A Server Function (`"use server"`) can be passed directly to any action prop; a plain function cannot.
10. **Panels never get `data-pending`.** To style content while the next one loads, select through the Root (`.tabs[data-pending] .panel { opacity: .6 }`). Dialog and Popover Roots render no element: use the Trigger's `data-pending` instead.
11. **Toasts need a viewport.** Render `<Toast.Viewport>` once (its `children` is a function of `{ toasts }`), then call `toast({ title })` anywhere on the client.

## Component index

Each line: import path, parts, main state props.

- `Button` (`@funstack/ui/button`): `action` (pure trigger, ignores clicks while pending), `formAction`.
- `Toggle` (`@funstack/ui/toggle`): `pressed` / `defaultPressed` / `pressedChangeAction`.
- `ToggleGroup` (`@funstack/ui/toggle-group`): `Root`, `Item`. `value` is `string[]`, or `string | null` with `exclusive`.
- `Toolbar` (`@funstack/ui/toolbar`): `Root`, `Separator`. Any focusable descendant is an item; no item part.
- `Tabs` (`@funstack/ui/tabs`): `Root`, `List`, `Tab`, `Panel`, `Indicator`. `value` / `valueChangeAction`; `Panel` takes `transition`, `keepMounted`.
- `Accordion` (`@funstack/ui/accordion`): `Root`, `Item` (`<details>`), `Trigger` (`<summary>`, first child of the Item), `Panel`. Without value props it needs no JavaScript; `exclusive` for one open item.
- `Tooltip` (`@funstack/ui/tooltip`): `Root`, `Trigger`, `Popup`, `Arrow`. Open state is the browser's (no open props); `delay`, `closeDelay`.
- `Popover` (`@funstack/ui/popover`): `Root`, `Trigger`, `Popup`, `Close`, `Title`, `Description`. `open` / `openChangeAction`; without open props it needs no JavaScript.
- `Dialog` (`@funstack/ui/dialog`): `Root`, `Trigger`, `Popup` (`<dialog>`), `Close`, `Form`, `Title`, `Description`. Same modes as Popover; `Dialog.Form` closes after its form action settles.
- `Menu` (`@funstack/ui/menu`): `Root`, `Trigger`, `Popup`, `Item` (`action`), `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `GroupLabel`, `Separator`, `SubmenuTrigger`, `ContextTrigger` (context menu). A `Root` inside a `Popup` is a submenu.
- `Toast` (`@funstack/ui/toast`): `toast()` (also `toast.promise`, `toast.update`, `toast.dismiss`), `createToastManager`, parts `Viewport`, `Root`, `Title`, `Description`, `Action`, `Close`.
- `Field` (`@funstack/ui/field`): `Root`, `Label`, `Control`, `Description`, `Error`. Native constraint validation, no validation engine.
- `Form` (`@funstack/ui/form`): `Root` (`action`, `errors` for server errors per field), `Submit`.
- `Checkbox` (`@funstack/ui/checkbox`): native checkbox; `checked` / `checkedChangeAction`, controlled-only `indeterminate`.
- `CheckboxGroup` (`@funstack/ui/checkbox-group`): `Root`, `Label`, `Item`, `Parent` (select-all). `value` is `string[]`.
- `RadioGroup` (`@funstack/ui/radio-group`): `Root`, `Label`, `Item`. Native radios; `value` / `valueChangeAction`.
- `Switch` (`@funstack/ui/switch`): native `<input type="checkbox" role="switch">`; `checked` / `checkedChangeAction`.
- `Select` (`@funstack/ui/select`): a real `<select>`. `Root`, `Trigger`, `Value`, `Option`, `Group`, `GroupLabel`, `Separator`. Styled picker via CSS `appearance: base-select`.
- `Combobox` (`@funstack/ui/combobox`): `Root`, `Label`, `Input`, `Trigger`, `Clear`, `Popup`, `List`, `Option`, `Group`, `GroupLabel`, `Empty`, `Status`. You render the options (no built-in filtering); `List` children get the deferred `query`; `inputValue` / `onInputValueChange` is urgent.
- `Slider` (`@funstack/ui/slider`): `Root`, `Label`, `Track`, `Indicator`, `Thumb`, `Value`. `valueChangeAction` per step, `valueCommitAction` once per gesture; `value` is a number or `number[]`.
- `NumberField` (`@funstack/ui/number-field`): `Root`, `Label`, `Input`, `Increment`, `Decrement`. Locale-formatted; `valueChangeAction`, `valueCommitAction`.
- `Progress` (`@funstack/ui/progress`) and `Meter` (`@funstack/ui/meter`): `Root`, `Track`, `Indicator`, `Label`, `Value`. Output only, no actions; the Root renders in a Server Component.
- `CSPProvider`, `STYLE_SHA256` (`@funstack/ui/csp`): for a strict `style-src` Content Security Policy.

## Full documentation

The full documentation (concepts, every component page with props tables, data attributes, keyboard behaviour and recipes) is bundled as Markdown in the installed package. Start from the index and open the page you need:

```
node_modules/@funstack/ui/dist/docs/index.md
```

The same docs are online at https://ui.funstack.work (`/llms.txt` lists every page as Markdown).
