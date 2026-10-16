# Tabs

Status: **proposed** (2026-10-15, GitHub issue #7). Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/react-async-apis.md` (sections
2, 3, 5, 6, 7), `docs/research/modern-platform-survey.md` (Tabs, `focusgroup`,
`hidden="until-found"`, `focus({ focusVisible })`, React integration notes), the WAI-ARIA APG Tabs
pattern, and two jsdom probes on React 19.3.1 recorded in `memo/architect/tabs-notes.md`.

Tabs is the component where the library's Suspense story is most visible: selecting a tab whose
panel suspends must keep the current panel on screen, mark the tab and the root `data-pending`,
and swap when the data is ready. Everything below is arranged so that this falls out of the
conventions' state model rather than being special-cased.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Tabs.Root` (`div`), `Tabs.List` (`div[role=tablist]`), `Tabs.Tab` (`button[role=tab]`), `Tabs.Panel` (`div[role=tabpanel]`), `Tabs.Indicator` (`span`, optional). No `Portal`, no registry. |
| 2 | State | One library-owned state, `value: string \| null`, as `value` / `defaultValue` / `valueChangeAction(next: string, details)`. `null` means no tab selected; `defaultValue` defaults to `null`; a dev-mode warning fires once when neither `value` nor `defaultValue` is given (product-owner decision). |
| 3 | Who renders what | `Tab` and `Indicator` render **optimistic** selection; `Panel` renders **committed** selection. `data-pending` on `Root` and on the Tab whose value is the optimistic one. |
| 4 | Activation | `activationMode="automatic"` by default (selection follows focus), `"manual"` on Enter/Space/click. Automatic is safe here because focus moves synchronously and the panel swap is a transition; choose manual when `valueChangeAction` is an awaited round trip. |
| 5 | Panel mounting | Default: inactive panels are **not rendered**. `keepMounted` keeps a panel in `<Activity mode="hidden">` (state kept, effects stopped, pre-rendered, absent from SSR HTML). `keepMounted="until-found"` keeps it as `hidden="until-found"` (in SSR HTML, effects live, find-in-page selects the tab). |
| 6 | Keyboard | APG: orientation-aware arrows, Home/End, Tab into the panel. Roving `tabindex` derived from optimistic selection (no focus-tracking state). `experimental_focusgroup` on `List` hands arrows to the browser where supported. |
| 7 | Disabled tabs | Focusable (`aria-disabled`), reachable with arrows, never dispatch. |
| 8 | Transition types | `fsui-tabs`, plus `fsui-tabs-next` / `fsui-tabs-prev` by DOM order of the target tab relative to the committed tab, both looked up by id under the root (so platform dispatches from a panel get a direction too). |
| 9 | Indicator | Positioned by CSS Anchor Positioning (each Tab gets an `anchor-name`; the Indicator sets `position-anchor` to the optimistic tab). Slides via a plain CSS `transition` on the anchored insets, **not** `<ViewTransition>`: optimistic commits are sync and never start a view transition. No measurement code. |
| 10 | No-op rule | A dispatch is skipped when the target equals the **optimistic** value, so clicking back to the committed tab while another selection is pending is a real dispatch (it cancels the intent). |

---

## 1. Anatomy

```tsx
import { Tabs } from "@funstack/ui/tabs";

<Tabs.Root defaultValue="general">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="general">General</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
    <Tabs.Tab value="danger" disabled>Danger zone</Tabs.Tab>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel value="general"><GeneralSettings /></Tabs.Panel>
  <Tabs.Panel value="billing"><BillingSettings /></Tabs.Panel>
  <Tabs.Panel value="danger"><DangerZone /></Tabs.Panel>
</Tabs.Root>
```

Rendered DOM for the example (ids come from `useId` on the Root; see section 8):

```html
<div data-orientation="horizontal">
  <div role="tablist" aria-orientation="horizontal" aria-label="Settings" data-orientation="horizontal">
    <button type="button" role="tab" id="_r_1_-tab-general" aria-selected="true" aria-controls="_r_1_-panel-general"
            tabindex="0" data-selected="" data-orientation="horizontal" style="anchor-name: --fsui-tab-_r_1_-tab-general">General</button>
    <button type="button" role="tab" id="_r_1_-tab-billing" aria-selected="false" aria-controls="_r_1_-panel-billing"
            tabindex="-1" data-orientation="horizontal" style="anchor-name: --fsui-tab-_r_1_-tab-billing">Billing</button>
    <button type="button" role="tab" id="_r_1_-tab-danger" aria-selected="false" aria-controls="_r_1_-panel-danger"
            aria-disabled="true" tabindex="-1" data-disabled="" data-orientation="horizontal" style="anchor-name: …">Danger zone</button>
    <span aria-hidden="true" data-selected="" style="position-anchor: --fsui-tab-_r_1_-tab-general"></span>
  </div>
  <div role="tabpanel" id="_r_1_-panel-general" aria-labelledby="_r_1_-tab-general" tabindex="0" data-selected="">…</div>
  <!-- billing and danger panels are not rendered -->
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `div` | none | pending, orientation | Owns state, context, the transition, ids. |
| `List` | `div` | `tablist` | orientation | Owns arrow-key navigation. |
| `Tab` | `button` | `tab` | **optimistic** value | `aria-selected`, roving `tabindex`, `anchor-name`. |
| `Panel` | `div` | `tabpanel` | **committed** value | Mounted only when selected unless `keepMounted`. |
| `Indicator` | `span` | none (`aria-hidden`) | **optimistic** value | Optional. Must come after the Tabs inside `List`. |

Every part renders exactly one element (or nothing), with `<ViewTransition>` as the outermost node
on `Panel` and `Tab`. `Indicator` has none: it changes only in optimistic (sync) commits, which do
not start view transitions (section 10.1), so it animates with CSS transitions instead.

## 2. States

| State | Owner | Kind | Library-owned or browser-owned | Transition? |
| --- | --- | --- | --- | --- |
| `value` | `Root` | `string \| null` | Library-owned | Yes, every change (click, arrow in automatic mode, Enter/Space, `beforematch`). |
| `pending` | `Root` | boolean | Library-owned (derived from `useTransition`) | n/a |
| focus position in the list | DOM | element | Browser-owned | Not tracked in React state. The roving `tabindex` is derived from optimistic `value`, and arrow keys call `element.focus()` directly. |
| `orientation`, `activationMode`, `loop`, `disabled` | `Root` | config | n/a | Plain props, not controllable state. |

There is no second library-owned state. In particular the library does **not** store "which tab is
focused": storing it as transition state would lag behind real focus while an async action holds
the transition lane (conventions section 2.3 item 5), and storing it as urgent state would be the
library's first urgent update, which the vision defers. Deriving `tabindex` from the optimistic
value is what the APG example implementations do and costs nothing.

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts` (conventions section 2.2 and 9.4).
`TransitionProp` below is `ViewTransitionProps["default"]` from React (`ViewTransitionClass`).

### 3.1 `Tabs.Root`

```ts
export type TabsOrientation = "horizontal" | "vertical";
export type TabsActivationMode = "automatic" | "manual";

export interface TabsValueChangeDetails extends ActionDetails {
  /**
   * Library-wide vocabulary (conventions 2.2):
   * "activate": the user selected the tab (click, Enter/Space, or focus in automatic mode).
   * "platform": the browser selected it: a `keepMounted="until-found"` panel revealed through
   * find-in-page or a text fragment (`details.event` is the `beforematch` event), or interaction
   * before hydration.
   */
  readonly reason: ChangeReason; // shared public type, conventions 2.2
}

export interface TabsRootState {
  /** Optimistic selected value, or null. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** An action dispatched through this Tabs is in flight. */
  readonly pending: boolean;
  readonly orientation: TabsOrientation;
  readonly disabled: boolean;
}

export interface TabsRootProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children" | "defaultValue"> {
  /** Controlled selected value. `null` selects nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /** Initial value in uncontrolled mode. Defaults to `null` (no panel shown). */
  defaultValue?: string | null;
  /** Runs inside the Root's transition whenever the user selects a tab. May be async. */
  valueChangeAction?: ChangeAction<string, TabsValueChangeDetails>;
  /** Layout and arrow-key axis. Default "horizontal". */
  orientation?: TabsOrientation;
  /** "automatic": selection follows focus. "manual": Enter, Space or click selects. Default "automatic". */
  activationMode?: TabsActivationMode;
  /** Whether arrow keys wrap from the last tab to the first. Default true. */
  loop?: boolean;
  /** Disables every Tab. */
  disabled?: boolean;
  className?: StateValue<string | undefined, TabsRootState>;
  style?: StateValue<CSSProperties | undefined, TabsRootState>;
  children?: StateValue<ReactNode, TabsRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsRootState>;
}
```

`valueChangeAction` receives `next: string`, never `null`: the Tabs UI cannot deselect. A
controlled parent may still set `value={null}` programmatically.

### 3.2 `Tabs.List`

```ts
export interface TabsListState {
  readonly orientation: TabsOrientation;
  readonly disabled: boolean;
}

export interface TabsListProps
  extends Omit<ComponentPropsWithRef<"div">, "onKeyDown" | "onFocus" | "className" | "style" | "children"> {
  /**
   * Render `focusgroup="tablist …"` and, where the browser implements it, let the browser handle
   * arrow keys, Home and End. Chromium 150+ only; elsewhere the JS path stays active. Default false.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, TabsListState>;
  style?: StateValue<CSSProperties | undefined, TabsListState>;
  children?: StateValue<ReactNode, TabsListState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsListState>;
}
```

Consumers label the list themselves (`aria-label` or `aria-labelledby`); both pass through.

### 3.3 `Tabs.Tab`

```ts
export interface TabsTabState {
  readonly value: string;
  /** Optimistic: true as soon as the user selects this tab, before the action settles. */
  readonly selected: boolean;
  /** The Root is pending and this tab is the optimistic target. */
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly orientation: TabsOrientation;
}

export interface TabsTabProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    "onClick" | "onKeyDown" | "onFocus" | "id" | "value" | "className" | "style" | "children"
  > {
  /** The value this tab selects. Must be unique within the Root. */
  value: string;
  /** Focusable but inert: `aria-disabled="true"`, never dispatches. */
  disabled?: boolean;
  /**
   * Forwarded to the Tab's `<ViewTransition default>`. Default "none". Fires only on the commit
   * that settles the action (or rolls it back), never on the optimistic click (section 10.1).
   */
  transition?: TransitionProp;
  className?: StateValue<string | undefined, TabsTabState>;
  style?: StateValue<CSSProperties | undefined, TabsTabState>;
  children?: StateValue<ReactNode, TabsTabState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, TabsTabState>;
}
```

`id` is omitted because the library owns the `id` / `aria-controls` / `aria-labelledby` wiring
(conventions section 1.2). `value` is omitted from the inherited button props because the Tab
redefines it.

### 3.4 `Tabs.Panel`

```ts
export interface TabsPanelState {
  readonly value: string;
  /** Committed: true only once the action has resolved and the render has committed. */
  readonly selected: boolean;
  readonly orientation: TabsOrientation;
}

export interface TabsPanelProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "hidden" | "className" | "style" | "children"> {
  /** The tab value this panel belongs to. */
  value: string;
  /**
   * What happens while this panel is not the committed selection.
   * - `false` (default): the panel is not rendered.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state are preserved, effects are
   *   stopped, content is pre-rendered at low priority. Not part of server-rendered HTML.
   * - `"until-found"`: rendered with `hidden="until-found"`: DOM, state and effects stay live,
   *   the content is in server-rendered HTML, and find-in-page or a text fragment selects the tab.
   */
  keepMounted?: boolean | "until-found";
  /** Forwarded to the Panel's `<ViewTransition default>`. Default "none". */
  transition?: TransitionProp;
  className?: StateValue<string | undefined, TabsPanelState>;
  style?: StateValue<CSSProperties | undefined, TabsPanelState>;
  children?: StateValue<ReactNode, TabsPanelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, TabsPanelState>;
}
```

`hidden` is omitted because the library controls it in `"until-found"` mode and `<Activity>`
controls visibility in `keepMounted` mode. `tabIndex` passes through; the default is `0` (section 8).

### 3.5 `Tabs.Indicator`

```ts
export interface TabsIndicatorState {
  /** Optimistic selected value, or null (the indicator is then `hidden`). */
  readonly value: string | null;
  readonly pending: boolean;
  readonly orientation: TabsOrientation;
}

export interface TabsIndicatorProps
  extends Omit<ComponentPropsWithRef<"span">, "hidden" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, TabsIndicatorState>;
  style?: StateValue<CSSProperties | undefined, TabsIndicatorState>;
  children?: StateValue<ReactNode, TabsIndicatorState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, TabsIndicatorState>;
}
```

### 3.6 Namespace

```ts
export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
  Indicator: TabsIndicator,
} as const;
```

## 4. Activation mode

### 4.1 What each mode does

| | `"automatic"` (default) | `"manual"` |
| --- | --- | --- |
| Arrow / Home / End | Move focus **and** dispatch `valueChangeAction(next)` | Move focus only |
| Enter / Space on a focused tab | No-op (already the optimistic selection) | Dispatch |
| Click | Dispatch through the click handler (when mousedown moves focus from another tab in the list, the `focusin` dispatches first and the click is a no-op) | Dispatch |
| Tab key into the list | Lands on the optimistic selected tab; never dispatches. With `value` `null` (or a controlled `value` matching no tab) the List redirects to the first enabled tab **without dispatching**; arrow keys from there select as usual | Same focus targets, never dispatches |
| Focus entering from outside for any other reason (window re-activation, focus restore after a dialog, `autoFocus`, programmatic `tab.focus()` from elsewhere) | Never dispatches | Nothing |

Implementation (product-owner decision): automatic mode is "selection follows focus **within the
list**", implemented in the Tab's `focus` handler:
`if (activationMode === "automatic" && !disabled && optimistic !== value && list.contains(event.relatedTarget) && event.relatedTarget !== list) dispatch`.
Focus arriving from outside the List never dispatches, and neither does the List's own redirect
(its `relatedTarget` is the List itself); a focus change is a selection only when it is the user
moving between tabs. This also keeps Tabs-as-links (11.5) from navigating on Tab-key entry. Clicks dispatch through the click handler regardless of where
focus came from. The arrow-key code in `List` only moves focus; it does not know about
activation. This keeps the JS roving path and the `experimental_focusgroup` path identical: both
end in a focus event whose `relatedTarget` is another tab in the list.

The post-veto case is why the rule exists: after a controlled parent vetoes a change, focus stays
on the tab that is *not* selected. Without the `relatedTarget` check, re-activating the window or
returning focus from a dialog would fire `focusin` on that tab and dispatch the vetoed value
again (verified by the reviewer); with it, only an arrow key or click re-dispatches.

Consequence to document: in automatic mode `details.event` is a `FocusEvent` whose `type` is
`"focusin"` (React's `onFocus` listens to `focusin`, not `focus`) for keyboard selection and, in
Blink and Gecko, also for mouse selection (mousedown focuses the button before `click`). WebKit does not focus buttons on click, so there `details.event` is the `MouseEvent`.
Consumers must not branch on the event type to tell keyboard from mouse. Radix avoids this by
dispatching from `mousedown`; the library prefers one dispatch site over consistent event types.

### 4.2 Why automatic is the default, in Async React terms

APG recommends automatic activation "as long as their associated tab panels are displayed without
noticeable latency", and manual activation otherwise, because in a conventional implementation a
slow panel swap blocks the main thread or shows a spinner on every arrow press and "significantly
hampers users' ability to navigate efficiently across the tab list".

In this library the panel swap is a transition keyed off committed state, which changes the
calculation:

- **Focus never waits.** `element.focus()` runs synchronously in the keydown handler; the
  optimistic `aria-selected` / `tabindex` update renders at sync priority. Each arrow press gives
  immediate, announced feedback regardless of panel latency.
- **No fallback flashes.** The old panel stays until the new one is ready (section 10.1). Rapid
  arrow presses never show a skeleton per step.
- **Overlap is collapsed.** Five arrow presses in a row are five dispatches on the same state hook,
  which React entangles into one render (research doc section 2, case 3); the shared hook's
  latest-dispatch guard commits only the last. Intermediate panels may begin their `use()`
  fetches, which is cheap prefetching, not visible work.

So the APG concern about focus latency does not apply. What does cost is **the action itself**:
with automatic activation every arrow press calls `valueChangeAction`. If that action awaits a
network round trip, each press is a round trip, and while any of them is pending every transition
in the app is entangled with it (conventions section 2.3 item 5). That is the one case for manual
activation, and the rule is:

| `valueChangeAction` | Recommended mode |
| --- | --- |
| Absent, synchronous, or fire-and-forget (`void save(next)`) | `"automatic"` |
| Awaited server round trip that gates the switch | `"manual"` |

The docs state this rule next to the prop. The default stays `"automatic"` because it is the
APG recommendation, the prior-art default (Radix, Base UI, React Aria), and the mode where this
library's model is most visibly better than a conventional one.

Trade-off accepted: in automatic mode a disabled tab reached with arrows receives focus but does
not change selection, so focus and selection diverge until the next enabled tab. This follows from
"disabled tabs are focusable" (conventions section 3.6) and matches React Aria's
`disabledBehavior="selection"`.

## 5. Panel mounting

### 5.1 The three strategies

| | `keepMounted={false}` (default) | `keepMounted` | `keepMounted="until-found"` |
| --- | --- | --- | --- |
| Inactive panel DOM | Not rendered | Rendered inside `<Activity mode="hidden">` (`display: none`) | Rendered with `hidden="until-found"` (`content-visibility: hidden`) |
| React state of children | Lost on deselect | Preserved | Preserved |
| Effects while inactive | None | Stopped (`useLayoutEffect` cleanup runs; `<video>` pauses) | Running |
| `use()` data fetch | Starts when selected, inside the transition | Starts at mount, at low priority; does not block the visible panel (verified, jsdom probe 1) | Starts at mount, **blocks the initial render** of the whole Tabs until every such panel resolves |
| Server-rendered HTML | Selected panel only | Selected panel only (hidden Activity emits nothing; verified, probe 2) | All panels, with `hidden=""` until hydration upgrades it |
| Find-in-page / text fragments | No | No | Yes, selects the tab via `beforematch` |
| `<ViewTransition>` trigger on switch | `exit` / `enter` | `exit` / `enter` (Activity mode change inside the library's transition) | `update` on both panels |

### 5.2 Why unmounting is the default

- It is the only strategy where a panel's data is requested when, and only when, the user asks for
  it, and where that request runs inside the transition. That is the Suspense-native story.
- It matches ecosystem expectations (Radix, Base UI, Headless UI unmount by default) and avoids
  hidden-media surprises.
- `keepMounted` with `<Activity>` is strictly better than the classic `hidden` attribute for state
  preservation (effects stop, pre-rendering, no first-render blocking), so the classic attribute is
  not offered. `"until-found"` exists only because `<Activity>` cannot do find-in-page (it sets
  `display: none`), and the survey marks `hidden="until-found"` as adopt-level.

### 5.3 `"until-found"` details

react-dom 19.3 serialises `hidden="until-found"` as `hidden=""` on both client and server, so the
Panel follows conventions section 7.4: it renders `hidden={!selected}`, and the internal hook
`use-until-found.ts` upgrades the attribute to `"until-found"` through the Panel's ref in a layout
effect, and re-asserts it after every render **while `!selected && optimistic !== value`**, i.e.
while the panel is neither committed nor the optimistic target. The second condition matters:
after a find-in-page reveal the panel is the optimistic target of the dispatched action, and it
must stay revealed while that action is pending (re-asserting on every render would re-hide it
under the user's cursor; verified by the reviewer in Chromium). The re-assert itself matters too:
when the browser reveals a panel it removes the attribute, and if the resulting action is rejected
React sees no prop change; because optimistic reverts on rejection, the condition becomes true
again and the hook re-hides the panel.

The hook also listens for `beforematch` on the panel and dispatches
`valueChangeAction(value, { event, reason: "platform" })` inside the Root's transition. Between the
browser's reveal and the commit the revealed panel and the committed panel are both visible; that
window is as long as the action takes, which for a sync action is one render.

Before hydration a server-rendered `"until-found"` panel is `display: none`, not
`content-visibility: hidden`, so find-in-page does not reach it until the page is interactive.

SSR note for `keepMounted`: because a hidden `<Activity>` emits no HTML, an inactive
`keepMounted` panel is client-rendered after hydration at low priority. Consumers who need
inactive panel content in the HTML (SEO, no-JS reading) use `"until-found"`.

## 6. ARIA and DOM output

Per APG Tabs pattern.

| Part | Attributes |
| --- | --- |
| `Root` | `data-pending`, `data-orientation`, `data-disabled` |
| `List` | `role="tablist"`, `aria-orientation` (always set), `data-orientation`, `data-disabled`, `tabindex="0"` only while the List is the tab stop: `value` is `null`, or a controlled `value` matches no `Tabs.Tab` (section 8); with `experimental_focusgroup`: `focusgroup="tablist inline wrap"` (`block` for vertical, `nowrap` when `loop={false}`) |
| `Tab` | `type="button"` (only when the rendered element is a `<button>`; `render={<a />}` gets no `type`, conventions 1.2), `role="tab"`, `id`, `aria-selected` (optimistic), `aria-controls` (always set, see below), `aria-disabled="true"` when disabled, `tabindex` (`0` on the optimistic tab, else `-1`), `data-selected`, `data-pending`, `data-disabled`, `data-orientation`, `style="anchor-name: …"` |
| `Panel` | `role="tabpanel"`, `id`, `aria-labelledby`, `tabindex="0"` (overridable), `data-selected` (committed); `hidden` in `"until-found"` mode |
| `Indicator` | `aria-hidden="true"`, `hidden` when no optimistic selection, `data-selected` when there is one, `data-pending`, `style="position-anchor: …"` |

- **Ids.** `rootId = useId()`; `tabId = \`${rootId}-tab-${slug(value)}\``;
  `panelId = \`${rootId}-panel-${slug(value)}\``. `slug` replaces every character outside
  `[A-Za-z0-9-]` with `_<hex>_`, **including `_` itself (`_5f_`)**, otherwise `"a b"` and
  `"a_20_b"` would collide; the result is both a valid HTML id and a valid CSS dashed-ident
  suffix (anchor names reuse it). The root id from `useId` is used as-is in element ids; the
  anchor name escapes it the same way, so with React 19.3 ids (`_r_1_`) an anchor name is exactly
  `--fsui-tab-<tab id>`. Both parts derive ids from context plus `value`, so
  no registration pass and no extra render.
- **`aria-controls` is set on every tab**, including tabs whose panel is currently unmounted.
  A dangling `aria-controls` is ignored by assistive technology; the alternative (a mounted-panel
  registry) costs a second render and a context write per panel. APG's own examples keep all
  panels in the DOM, so there is no APG guidance on the unmounted case; Radix made the same choice.
- **`aria-orientation` is always emitted** on the list, even for the default horizontal, so the
  attribute agrees with `data-orientation`.
- **Panel `tabindex="0"`.** APG wants the panel in the tab sequence when it contains no focusable
  content; the library cannot know that, so it defaults to `0` like Radix and Base UI, and a
  consumer with a focusable first child passes `tabIndex={-1}`.
- **Disabled.** `Root disabled` disables every Tab. A disabled Tab stays focusable
  (`aria-disabled`, not `disabled`) per conventions section 3.6.

## 7. State exposure

| Attribute | On | Source | Meaning |
| --- | --- | --- | --- |
| `data-pending` | `Root` | `useTransition` | A dispatch is in flight (including a suspending panel's wait). |
| `data-pending` | `Tab` | `pending && optimistic === value` | This tab is the one the user is waiting on. |
| `data-pending` | `Indicator` | `pending` | Convenience for a pulsing marker. |
| `data-selected` | `Tab`, `Indicator` | optimistic | Immediate. |
| `data-selected` | `Panel` | committed | Only present on the committed panel (relevant with `keepMounted`). |
| `data-disabled` | `Root`, `List`, `Tab` | prop | |
| `data-orientation` | `Root`, `List`, `Tab` | prop | Value-carrying enum. |

Panels never carry `data-pending` (conventions section 4.3). Dimming the current panel while the
next one loads is `.root[data-pending] .panel { opacity: .6 }`.

```css
.tab[data-selected] { color: var(--accent); }
.tab[data-pending]::after { content: ""; /* spinner */ }
.tab[aria-disabled="true"] { opacity: .4; }
.root[data-pending] .panel { opacity: .6; transition: opacity 150ms 150ms; }
.list[data-orientation="vertical"] { flex-direction: column; }
```

## 8. Keyboard interaction

Per APG Tabs. All handling lives in `List`'s `onKeyDown` (navigation) and `Tab`'s `onKeyDown`
(activation) and `onFocus` (automatic activation).

| Key | Horizontal | Vertical | Effect |
| --- | --- | --- | --- |
| `ArrowRight` / `ArrowLeft` | next / previous tab (swapped under `direction: rtl`) | ignored | Move focus; wrap if `loop`. Automatic mode dispatches via the focus event. |
| `ArrowDown` / `ArrowUp` | ignored | next / previous tab | Same. |
| `Home` / `End` | first / last tab | first / last tab | Same. |
| `Enter` / `Space` on a tab | | | `preventDefault()`, dispatch unless already the optimistic selection or disabled. Handled on keydown so a `render`ed non-button element behaves the same. |
| `Tab` | | | Native. Leaves the list; the next stop is the selected panel (`tabindex="0"`) or its first focusable child. |
| `Shift+Tab` from the panel | | | Native. Lands on the tab with `tabindex="0"`, which is the optimistic selection. In manual mode this may differ from the last tab the user arrowed to; the APG reference implementation behaves the same way. |

Roving tabindex details:

- The tab with `tabindex="0"` is the optimistic selected tab. When `value` is `null`, no tab has
  `tabindex="0"`; instead the `List` itself gets `tabindex="0"` and, on receiving focus **from
  outside the list** (`relatedTarget` not inside it), moves it to the first non-disabled tab
  (first tab if all are disabled). Focus arriving from a tab inside the list is left alone;
  otherwise Shift+Tab from a tab would bounce back into the list, a trap in manual mode. The
  redirect never dispatches in either mode (its `relatedTarget` is the List itself, 4.1): Tab-key
  entry or a click on empty tablist space focuses the first enabled tab and leaves selection to
  the next arrow key or click. Shift+Tab from a tab stops once on the List and then leaves it
  (not a trap).
- **Controlled `value` that matches no Tab** (product-owner decision; e.g. Tabs-as-links on a
  sub-route, 11.4): no tab has `tabindex="0"`, so without help the Tab key would skip the whole
  tablist. `List` checks in a layout effect whether any registered tab's value equals the
  committed value (a DOM query, `[role="tab"][data-value]`, no registration state); if none does,
  the List takes `tabindex="0"` exactly as in the `null` case, redirecting to the first tab, and
  warns once in development that `value` matches no `Tabs.Tab`. The user sees the same thing
  (Tab key lands on the first tab) and every attribute stays React-owned.
- Navigation reads the DOM at keydown time: `list.querySelectorAll('[role="tab"]')` filtered to
  tabs whose closest `[role="tablist"]` is this list. Disabled tabs are included (focusable).
  Nothing is registered.
- Focus moves with `next.focus({ focusVisible: true })` (survey: adopt) so the ring is shown even
  if the engine's heuristic would not.
- `direction` is read with `getComputedStyle(list).direction` at keydown time; no `dir` prop.
- Handled keys call `preventDefault()` so an overflowing tab strip does not also scroll.
- Key events with `altKey`, `ctrlKey` or `metaKey` set are ignored by the arrow / Home / End
  navigation and by Enter / Space activation, so browser and OS shortcuts keep working.

`experimental_focusgroup`: when on, `List` renders the `focusgroup` attribute and, inside an
effect, checks `"focusgroup" in HTMLElement.prototype`. Where true, the arrow/Home/End branch of
the JS handler is skipped and the browser moves focus; the Tab's `focus` handler still provides
automatic activation. Where false, nothing changes. Markup is identical on server and client
(conventions section 8).

## 9. Async walkthroughs

Notation: `C` = committed value, `O` = optimistic value, `P` = Root pending.

### 9.1 Selecting a tab whose panel suspends

Uncontrolled, `defaultValue="general"`, no action. The billing panel calls `use(billingPromise)`;
the nearest `<Suspense>` is above `Tabs.Root` and already revealed.

1. User clicks "Billing". Tab dispatches inside `useTransition`: `addTransitionType("fsui-tabs")`
   and `"fsui-tabs-next"`, `setOptimistic("billing")`, `await undefined`.
2. Sync render: `O="billing"`, `C="general"`, `P=true`. "Billing" Tab gets `aria-selected`,
   `data-selected`, `data-pending`, `tabindex="0"`; "General" loses them. Root gets `data-pending`.
   Indicator moves to "Billing". The **general panel is still rendered** (committed).
3. The action resolves at once; the post-await `setInternal("billing")` is a transition update.
   React renders the billing panel in the transition lane; it suspends. Because the boundary above
   is already revealed and the update is a transition, React keeps the current DOM: the general
   panel stays, no fallback. `P` stays true. The Tab shows a spinner through `data-pending`, and
   `.root[data-pending] .panel` dims the general panel.
4. `billingPromise` resolves. The transition commits: `C="billing"`, `P=false`, `O` converges.
   General panel unmounts, billing panel mounts; with `transition="fade"` on both panels the
   commit runs an exit and an enter in one view transition.

If the consumer wants a skeleton instead of a wait, they key a boundary inside the panel
(`<Suspense key="billing" fallback={<Skeleton />}>`); a newly mounted boundary shows its fallback
immediately (conventions section 6). Then step 3 commits at once with the skeleton and `P` drops.

### 9.2 Async action that rejects

Controlled, `value={tab}`, `valueChangeAction={async (next) => { await save(next); startTransition(() => setTab(next)); }}`.

1. Click "Billing": `O="billing"`, `P=true`, Tab and Root `data-pending`.
2. `save` rejects. The transition ends; the error propagates to the nearest Error Boundary above
   `Tabs.Root`. The consumer's `setTab` never ran, so `C="general"`; `O` reverts to `"general"`.
3. Final render: "General" Tab selected again, Indicator slides back, no `data-pending`. The
   general panel was never replaced, so nothing in the content region changed.

Uncontrolled is identical: the post-await `setInternal` is skipped on rejection. A consumer who
catches inside the action instead gets a resolved action: in controlled mode `setTab` is their
choice; in uncontrolled mode the new value commits (conventions section 2.4).

### 9.3 Rapid arrow keys with automatic activation

`defaultValue="a"`, tabs a, b, c, d, every panel suspends for 300 ms, `valueChangeAction` absent.
The user presses ArrowRight three times in 100 ms.

1. Press 1: focus b, focus event dispatches b (id 1). `O="b"`, `P=true`.
2. Press 2: focus c, dispatches c (id 2). Reducer rebases: `O="c"`. Tab c is `data-pending`,
   b is not.
3. Press 3: focus d, dispatches d (id 3). `O="d"`.
4. Each action resolves immediately. Guard: only id 3 commits `setInternal("d")`; ids 1 and 2 are
   dropped. The three transition updates to the same hook are entangled, so React renders once
   with `C="d"`; panel d suspends; the panel for a stays.
5. Panel d resolves: `C="d"`, `P=false`. Panels b and c were never committed, though their
   `use()` promises may have been started by interrupted renders.

With an awaited server action instead, three requests go out; the guard still commits only the
latest, and `P` stays true until all three settle (React's pending state covers every action
started through the hook). This is the case where `activationMode="manual"` is recommended.

### 9.4 Clicking back to the committed tab while another is pending

`C="a"`, user clicks b (slow panel): `O="b"`, `P=true`. User clicks a. Because the no-op check
compares against `O`, this is a real dispatch (id 2): `O="a"`, Tab a `data-pending`. When b's
action resolves it is not the latest and does not commit; a's commits `setInternal("a")`, a
no-change update. Panel a was never replaced. The user has cancelled the switch, and the library
never needed an abort signal to do it.

### 9.5 Controlled parent that ignores the change

`value="a"`, `valueChangeAction={() => {}}` (parent never updates). Click b: `O="b"`, `P=true`
for one tick; action resolves; `O` reverts to `"a"`. Tab b flashes selected for a frame and
returns. Focus stays on b with `tabindex="-1"`. This is the documented behaviour of
`useOptimistic`; a parent that wants to veto does nothing, and the UI returns to the parent's
value.

### 9.6 `value` prop changes while pending

Controlled, parent switches `value` from `"a"` to `"c"` (router navigation) while a dispatch of
`"b"` is pending. The reducer re-runs against the new base, so `O` stays `"b"` until the action
settles, then converges to `"c"`. Panels follow `C`: a, then c. The pending Tab stays b. No
special code.

## 10. ViewTransition

### 10.1 What animates when

Verified on React 19.3.1 (team lead's probe `memo/architect/probes/toggle-viewtransition-optimistic.mjs`,
and `memo/architect/tabs-notes.md` probe 5): `useOptimistic` updates render on the sync lane, and
react-dom calls `startViewTransition` only when every lane in the commit is a transition, retry or
idle lane. So:

| Commit | Lane | `<ViewTransition>` fires? | What changes in Tabs |
| --- | --- | --- | --- |
| Optimistic click / arrow press | sync | **No** | Tab `aria-selected`, `data-selected`, `data-pending`, `tabindex`; Indicator `position-anchor`; Root `data-pending` |
| Action settles (success) | transition | Yes | Panel swap (exit + enter), `data-pending` removed; Indicator unchanged (already moved) |
| Action rejects or parent vetoes (snap-back) | transition | Yes | Tab attributes revert, Indicator `position-anchor` reverts |
| `value` prop changes from outside (controlled, in a transition) | transition | Yes | Everything |
| Suspense reveal inside a panel | retry | Yes | Panel content |

Consequences, stated so nobody is surprised:

- **Panels animate through `<ViewTransition>`.** They render committed state, which only changes
  in transition commits. The `transition` prop on `Panel` is the main consumer API.
- **The Indicator animates through CSS transitions, not `<ViewTransition>`.** Its move happens in
  the optimistic commit. A view transition would run only on snap-back, which would double-animate
  against the CSS transition, so `Indicator` takes no `transition` prop and renders no boundary.
- **`Tab` keeps a `<ViewTransition>` and a `transition` prop** for parity with Toggle, but it fires
  only on the settle commit (a spinner in `children` disappearing) and on snap-back. Styling that
  must react to the click uses CSS transitions on `[data-selected]` / `[data-pending]`.
- `useDeferredValue(optimistic)` does not rescue the Indicator: probed, the deferred render also
  commits without a view transition while an action is pending.

### 10.2 Wiring

- `Panel`: when rendered, `<ViewTransition default={transition ?? "none"}><div …/></ViewTransition>`.
  In the default (unmount) mode the whole boundary mounts and unmounts, so a switch is one
  `exit` and one `enter`. In `keepMounted` mode the boundary sits inside `<Activity>`, and the
  mode flip inside the library's transition yields the same `exit` / `enter`. In `"until-found"`
  mode the boundary persists and the attribute flip is an `update` on both panels.
- `Indicator`: a bare `<span>`. The `position-anchor` inline style follows the optimistic tab;
  the consumer's CSS `transition` on `left` / `width` (or `top` / `height`) animates the move
  because the anchored inset's used value changes. Blink and WebKit interpolate `anchor()` /
  `anchor-size()` values (WPT `anchor-transition-default.html`); Gecko does not yet
  (`docs/research/popover-anchor-tooltip.md`), so in Firefox the indicator jumps. That is a
  missing animation, not a broken feature, and the library ships no JS measurement fallback.
- `Tab`: `<ViewTransition default={transition ?? "none"}><button …/></ViewTransition>`; see 10.1
  for when it fires.

Types added per dispatch: `fsui-tabs`, and `fsui-tabs-next` or `fsui-tabs-prev` when both the
committed tab and the target tab are in the DOM. Root's `transitionTypes(next, prev)` looks both
tabs up **by id** under `rootRef.current.getRootNode()` (works in shadow DOM) and compares them
with `compareDocumentPosition`; nothing is threaded through `select`, so a `"platform"` dispatch
from a panel's `beforematch` gets a direction too. The
base for direction is the **committed** value because the panel is what the direction animates;
overlapping dispatches in opposite directions collect both types, and the consumer's type map
should then list `"fsui-tabs-next"` first or map both to the same class.

### 10.3 Consumer usage

```tsx
<Tabs.Root defaultValue="general">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="general">General</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel value="general" transition={{ "fsui-tabs-next": "slide-left", "fsui-tabs-prev": "slide-right", default: "fade" }}>…</Tabs.Panel>
  <Tabs.Panel value="billing" transition={{ "fsui-tabs-next": "slide-left", "fsui-tabs-prev": "slide-right", default: "fade" }}>…</Tabs.Panel>
</Tabs.Root>
```

```css
/* Indicator: anchor positioning places it, a CSS transition slides it (Blink, WebKit). */
.list { position: relative; }
.indicator {
  position: absolute;
  bottom: 0;
  left: anchor(left);
  width: anchor-size(width);
  height: 2px;
  background: var(--accent);
  transition: left 200ms ease-out, width 200ms ease-out;
}
.indicator[data-pending] { animation: fsui-pulse 1s infinite; }

/* Tab feedback on click is CSS too; the view transition only covers the settle commit. */
.tab { transition: color 120ms; }
.tab[data-selected] { color: var(--accent); }

/* Panels: cross-fade by default, directional slide when the type says so. */
::view-transition-old(.fade) { animation: 120ms ease-in both fsui-fade-out; }
::view-transition-new(.fade) { animation: 120ms ease-out both fsui-fade-in; }
::view-transition-old(.slide-left) { animation: 160ms ease-in both fsui-slide-out-left; }
::view-transition-new(.slide-left) { animation: 160ms ease-out both fsui-slide-in-right; }
/* …slide-right mirrored… */

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  .indicator, .tab { transition: none; }
}
```

On click the Indicator and Tab styling move at once through CSS transitions; on rejection the
same CSS transitions carry them back. Panels never change optimistically (they render committed
state), so a rejected action produces no panel animation at all, and a successful one produces
exactly one exit/enter pair.

The release-post pattern `<ViewTransition update="auto" default="none"><Suspense>` is the
consumer's to use **inside** a panel when they key a boundary there: the fallback appears without
animation and the reveal animates. The library does not render Suspense, so it does not render
that pair.

## 11. Call-site examples

### 11.1 Panels that load with `use()`

```tsx
"use client";
import { Suspense, use } from "react";
import { Tabs } from "@funstack/ui/tabs";

function Orders({ promise }: { promise: Promise<Order[]> }) {
  const orders = use(promise);
  return <OrderTable orders={orders} />;
}

export function Account({ profile, ordersPromise }: Props) {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Tabs.Root defaultValue="profile">
        <Tabs.List aria-label="Account">
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="orders">{({ pending }) => <>Orders {pending && <Spinner />}</>}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="profile"><Profile data={profile} /></Tabs.Panel>
        <Tabs.Panel value="orders"><Orders promise={ordersPromise} /></Tabs.Panel>
      </Tabs.Root>
    </Suspense>
  );
}
```

Clicking "Orders" keeps the profile panel visible, shows the spinner in the tab, and swaps when
`ordersPromise` resolves. The boundary above is for first mount only.

### 11.2 Persisting the selection with a Server Function

```tsx
// actions.ts
"use server";
export async function saveActiveTab(tab: string) { await db.user.update({ activeTab: tab }); }
```

```tsx
// account-tabs.tsx
"use client";
import { Tabs } from "@funstack/ui/tabs";
import { saveActiveTab } from "./actions";

export function AccountTabs({ initialTab, children }) {
  return (
    // Switch immediately; persist in the background. Preferred for a preference.
    <Tabs.Root defaultValue={initialTab} valueChangeAction={(next) => { void saveActiveTab(next); }}>
      {children}
    </Tabs.Root>
  );
}
```

To make the switch wait for the save (the tab shows `data-pending` until the server responds, and
a failure rolls the selection back and reaches the Error Boundary), await it and prefer manual
activation so arrow keys do not each start a round trip:

```tsx
<Tabs.Root
  defaultValue={initialTab}
  activationMode="manual"
  valueChangeAction={async (next) => { await saveActiveTab(next); }}
>
```

A Server Component cannot pass `saveActiveTab` directly as `valueChangeAction`: the library calls
the action with `(next, details)`, and `details.event` is a DOM `Event`, which cannot be
serialised to a Server Function. The wrapper component above is required (see Conventions
feedback, item 1).

### 11.3 Controlled by the router

```tsx
"use client";
const tab = useSearchParam("tab") ?? "general";
const navigate = useNavigate();

<Tabs.Root value={tab} valueChangeAction={(next) => { navigate(`?tab=${next}`); }}>
```

The router update is in the sync prefix, so it is a transition update; if the route's loader
suspends, the Tabs stays on the old panel with `data-pending` until the navigation completes.

### 11.4 Preserved panels and find-in-page

```tsx
<Tabs.Root defaultValue="editor">
  <Tabs.List aria-label="Document">
    <Tabs.Tab value="editor">Editor</Tabs.Tab>
    <Tabs.Tab value="preview">Preview</Tabs.Tab>
    <Tabs.Tab value="changelog">Changelog</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="editor" keepMounted><Editor /></Tabs.Panel>          {/* keeps the draft */}
  <Tabs.Panel value="preview" keepMounted><Preview /></Tabs.Panel>        {/* pre-rendered */}
  <Tabs.Panel value="changelog" keepMounted="until-found"><Changelog /></Tabs.Panel> {/* Ctrl+F finds it */}
</Tabs.Root>
```

### 11.5 Tabs as links

```tsx
<Tabs.Root value={pathname} valueChangeAction={(next) => { navigate(next); }}>
  <Tabs.List aria-label="Docs">
    <Tabs.Tab value="/docs/start" render={<Link href="/docs/start" />}>Start</Tabs.Tab>
    <Tabs.Tab value="/docs/api" render={<Link href="/docs/api" />}>API</Tabs.Tab>
  </Tabs.List>
</Tabs.Root>
```

With a `Link` element the Tab's keydown handler covers Space (an anchor does not click on Space).
`role="tab"` and `aria-selected` win over the link's own attributes. Enter on the link runs the
Link's handler first, then the library's (conventions section 1.2), and `preventDefault()` in
the library handler stops the native navigation; the route change comes from
`valueChangeAction`. Panels may be omitted when the route renders the content.

## 12. Test plan

`packages/ui/src/tabs/tabs.test.tsx`, jsdom, `user-event`, helpers from `src/__tests__/helpers.tsx`.
Rows marked (both) run under `describe.each` with the uncontrolled and the "update on success"
controlled wrapper.

| Area | Tests |
| --- | --- |
| Roles and ARIA | Default elements and roles. `aria-selected`, `aria-controls` ↔ `id`, `aria-labelledby` ↔ `id` resolve. `aria-orientation` and `data-orientation` for both orientations. `aria-disabled` on disabled tabs and under `Root disabled`. Unselected panels absent by default. Panel `tabindex="0"` default and override. Ids are stable across re-renders and safe for `value="a b/c"`. |
| Keyboard | Matrix: `{horizontal, vertical} × {ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End}` asserting focus target, including the ignored axis. `loop` on and off at both ends. RTL swaps horizontal arrows (set `direction: rtl` via style). Disabled tabs are reachable. Enter/Space select in manual mode, no-op in automatic mode. `preventDefault` called for handled keys. Tab key from a tab lands on the selected panel. |
| Activation | Automatic: arrow press dispatches with `details.event.type === "focusin"` (React's `onFocus`); manual: arrow press does not dispatch, Enter does. Tabbing into a list with `value={null}` focuses the first enabled tab without dispatching in either mode; a following arrow key dispatches in automatic mode. Focus entering from outside onto an unselected tab (`autoFocus`, `tab.focus()` from outside, focus restore) never dispatches in either mode; after a controlled veto, a `focusin` with `relatedTarget` outside the list does not re-dispatch, an arrow key does. |
| Tab stop | Controlled `value` matching no tab: the List has `tabindex="0"`, Tab from before the list lands on the first tab, a dev warning fires once. `value={null}`: clicking empty list space focuses the first enabled tab without dispatching; Shift+Tab from a tab stops once on the List, then leaves. |
| `render` element type | `render={<a href />}` yields no `type` attribute; `render={<button />}` keeps `type="button"`. |
| Sync action (both) | `(next, details)` shape, `details.reason === "activate"`, `details.event` is a native event. Clicking the selected tab, a disabled tab, or any tab under `Root disabled` never dispatches. |
| Async action (both) | While unresolved: `data-pending` on Root and the clicked Tab only, `aria-selected` moved, old panel still in the DOM, new panel absent. After resolve: pending gone, panels swapped. |
| Rejection (both) | `ErrorCatcher` receives the error; `aria-selected` reverts; panel unchanged; uncontrolled internal value unchanged. Caught-inside variant resolves and (uncontrolled) commits. |
| Overlap | Dispatch b then c, resolve b last: optimistic shows c throughout, final committed is c. Section 9.4: dispatch b, then a (the committed one): panel a never leaves, final committed a. |
| Suspending content (both) | Panel b renders `<Suspender />`. Select b: old panel stays, boundary above shows no fallback, `data-pending` on. Resolve: panel b shown, pending off. Keyed inner boundary variant: fallback shown at once, pending off. |
| `keepMounted` | `true`: inactive panel present with `display: none`; child state survives a round trip; a suspending hidden panel does not block the visible one. `"until-found"`: inactive panel has `hidden="until-found"` after mount; dispatching `beforematch` on it selects the tab with `reason: "platform"`; after a rejected action the attribute is re-asserted. |
| Indicator | `hidden` when `value` is `null`; `position-anchor` style names the optimistic tab and moves before the action resolves and reverts on rejection; renders no `view-transition-name`; placed after the tabs. |
| Function props | `className`, `style`, `children`, `render` on every part receive the documented state; attributes agree (Tab `selected` optimistic, Panel `selected` committed). |
| `render` element | Tab as `<a>`: role and aria win, `className` concatenated, Space selects, `ref` forwarded. Panel and Indicator with custom elements. |
| Post-await rule | Controlled wrapper that awaits then `startTransition(setTab)` works end to end. |
| `transition` prop | `Tab` and `Panel` render with and without `transition` (jsdom has no `startViewTransition`); `Indicator` has no such prop. |
| `experimental_focusgroup` | Attribute rendered with the expected tokens for each orientation and `loop`; JS arrows still work in jsdom (no `focusgroup` in prototype). |
| Directive | Built `dist/tabs/*.mjs` for Root, List, Tab, Panel, Indicator and context begin with `"use client"`; `tabs-ids.mjs` does not. |
| Dev warnings | Neither `value` nor `defaultValue` given warns once (product-owner decision, resolved question 2); `value` together with `defaultValue`, and switching `value` between `undefined` and a string, warn once each. |

Browser-only checks (example app, not automated in v0): panel cross-fade and slide,
Indicator CSS slide via anchor positioning in Blink and WebKit (and the jump in Gecko),
`focusgroup` in Chromium 150+, find-in-page reveal.

## 13. Implementation notes

### 13.1 Files

```
packages/ui/src/tabs/
  index.ts              # no directive; namespace + type re-exports
  tabs-ids.ts           # no directive; slug(), tabId(), panelId(), anchorName()
  tabs-context.ts       # "use client"; createContext<TabsContextValue | null>
  tabs-root.tsx         # "use client"
  tabs-list.tsx         # "use client"
  tabs-tab.tsx          # "use client"
  tabs-panel.tsx        # "use client"
  tabs-indicator.tsx    # "use client"
  tabs.test.tsx
packages/ui/src/internal/
  use-until-found.ts    # "use client"; shared with Accordion if it adopts the attribute
```

### 13.2 Context

```ts
interface TabsContextValue {
  readonly rootId: string;
  readonly committed: string | null;
  readonly optimistic: string | null;
  readonly pending: boolean;
  readonly orientation: TabsOrientation;
  readonly activationMode: TabsActivationMode;
  readonly loop: boolean;
  readonly disabled: boolean;
  /** No-op if `value === optimistic`. Never checks `disabled`; callers do. */
  select(value: string, event: Event, reason: TabsValueChangeDetails["reason"]): void;
}
```

One context; every part re-renders on a dispatch anyway (attributes change).

### 13.3 Root

- `useId()` for `rootId`; `useControllableAction` from `internal/` for `committed`, `optimistic`,
  `pending`, `dispatch`. `select` wraps `dispatch` with the optimistic no-op check and builds
  `details`.
- Transition types: the shared hook's `transitionType` option currently returns one string; Tabs
  needs two (`fsui-tabs` plus a direction). See Conventions feedback, item 2. Direction: look up
  `ownerDocument.getElementById(tabId(committed))` and the target tab (the dispatching element,
  passed through `select`), compare with `compareDocumentPosition`; omit the direction type when
  either is missing.
- Renders `div` through `use-render` with `TabsRootState`.

### 13.4 List

- `tabIndex={optimistic === null ? 0 : undefined}` and `onFocus` redirect to the first
  non-disabled tab when the list itself is the target (section 8). `onFocus` is therefore omitted
  from `TabsListProps` as well as `onKeyDown`.
- `onKeyDown`: ignore if `event.defaultPrevented` or the target is not a tab in this list;
  resolve the key against `orientation` and computed `direction`; collect tabs by DOM query;
  compute the index with `loop`; `preventDefault()`; `focus({ focusVisible: true })`.
- `experimental_focusgroup`: render the attribute (lowercase, typed by the shared augmentation
  file); in an effect set a ref `nativeFocusgroup = "focusgroup" in HTMLElement.prototype`; the
  keydown handler returns early for navigation keys when the ref is true.

### 13.5 Tab

- Reads context; `selected = optimistic === value`; `pending = ctx.pending && selected`;
  `disabled = ctx.disabled || props.disabled`.
- `onFocus`: automatic mode and `!disabled` and `!selected` and `list.contains(event.relatedTarget)`
  and `event.relatedTarget !== list` → `select(value, nativeEvent, "activate")` (4.1: focus from
  outside the list, and the List's own redirect, never dispatch).
- `onClick`: `!disabled` → `select(...)` (no-op guard inside).
- `onKeyDown`: Enter or Space → `preventDefault()`, then as `onClick`.
- `tabIndex`: `0` when selected, else `-1`. The `value === null` case is handled by `List`
  (`tabIndex={listIsTabStop ? 0 : undefined}` plus an `onFocus` that, when
  `event.target === list` and `event.relatedTarget` is not inside the list, focuses the first
  non-disabled tab). `listIsTabStop` is `optimistic === null`, or a layout-effect DOM check found
  no tab whose value equals the committed `value` (with a one-time dev warning, §8). No DOM attribute is ever written
  outside React, so nothing can go stale when a selection later appears.
- `style`: merge `{ anchorName: anchorName(rootId, value) }` under the consumer's style (consumer
  wins, per conventions section 1.2).
- Output: `<ViewTransition default={transition ?? "none"}><button …/></ViewTransition>`.

### 13.6 Panel

- `selected = committed === value`.
- `keepMounted === false`: return `null` when not selected; otherwise the ViewTransition-wrapped div.
- `keepMounted === true`: `<Activity mode={selected ? "visible" : "hidden"}><ViewTransition …><div …/></ViewTransition></Activity>`.
  The mode flips inside the Root's transition because `committed` only changes there.
- `keepMounted === "until-found"`: always render the div with `hidden={!selected}`; call
  `useUntilFound(ref, { active: !selected, onMatch: (event) => select(value, event, "platform") })`.
  The hook: layout effect without deps that sets the attribute when `active`; `useEffectEvent`
  for `onMatch`; `addEventListener("beforematch")` with cleanup.
- `data-selected` from committed state; `tabIndex` default `0`.

### 13.7 Indicator

- `value = optimistic`; `hidden={value === null}`; `style` merges `{ positionAnchor: anchorName(rootId, value) }`.
- Output: a bare `<span aria-hidden …/>`. No `<ViewTransition>` (section 10.1).
- Docs: must be a later sibling of the Tabs inside `List` (anchor must precede the positioned
  element in tree order); `List` needs `position: relative` and the Indicator `position: absolute`
  plus `anchor()` insets. Ships no CSS.

### 13.8 Attribute typing

`anchorName` and `positionAnchor` are typed in the installed `csstype` 3.2.3 (verified), so the
inline styles need no augmentation. `focusgroup` is untyped and goes in the platform augmentation
module per conventions section 7.4. That module must be a `.ts` file imported from the package
entry, not a `.d.ts`: tsdown does not emit source `.d.ts` files, so a `.d.ts` is typecheck-only
and never reaches `dist` (the current `platform-attributes.d.ts` has exactly this problem; the
mechanism is pending the reviewer's confirmation).

## Conventions feedback

1. **Server Functions as change actions do not work as written.** Conventions section 7.1 says a
   Server Component "passes a Server Function" as the action. The `(next, details)` signature
   puts a DOM `Event` in `details`, and React refuses to serialise it (`encodeReply` accepts only
   plain objects). So `valueChangeAction={serverFn}` throws at call time; every Server Function
   must be wrapped in a client component today. Options for the owner: (a) document the wrapper
   as the rule; (b) detect server references (`$$typeof === Symbol.for("react.server.reference")`)
   in the shared hook and call them with `(next)` only; (c) make `details` serialisable by
   dropping `event`. I recommend (a) now and (b) if a demo shows the wrapper is too noisy.
2. **`useControllableAction.transitionType` returns one string.** Tabs emits two types per
   dispatch (`fsui-tabs` and a direction), and the direction needs the dispatching element.
   Suggested shape: `transitionTypes?: (next, prev, details) => readonly string[]`.
3. **`keepMounted` is a three-way choice, not a boolean.** Conventions section 5.5 mentions
   "`keepMounted` panels" as the Activity case. This design uses `keepMounted?: boolean |
   "until-found"` on the Panel. If Accordion adopts `hidden="until-found"` too, the same prop
   shape should be used there, and the conventions vocabulary table could list it.
4. **Exposure table.** `data-orientation` is listed for Root, List and Tab; this design follows
   that and does not emit it on Panel. Confirm this is intended rather than an omission.
5. **Optimistic parts and `<ViewTransition>`.** Given the lead's finding that optimistic commits
   never start a view transition, this design drops the boundary and the `transition` prop from
   `Indicator` and documents `Tab`'s as settle/snap-back only. If the corrected section 5 removes
   `transition` from trigger parts altogether, `Tab` should follow; if it keeps it for Toggle,
   `Tab` stays as designed.
6. **No-op rule precision.** Section 2.3 item 7 says "clicking the already-selected Tab calls
   nothing". This design reads "selected" as the optimistic value, which makes clicking back to the
   committed tab a cancelling dispatch (section 9.4). Worth stating in the conventions so every
   single-shot component does the same.

## Open questions for the product owner

1. **Default `activationMode`.** This design keeps `"automatic"` (APG, prior art, and the mode
   that shows off the Suspense model) and documents manual for awaited round trips. If the owner
   prefers to optimise for server-action-heavy apps, `"manual"` as default is a one-line change
   with no other impact on the design.
2. **`defaultValue` defaulting to `null`.** Resolved (product owner, 2026-10-16): keep `null` and
   add a dev-mode warning, fired once, when both `value` and `defaultValue` are undefined. Not yet
   implemented (developer memo).
3. **Server Function ergonomics** (Conventions feedback, item 1) affects every component, not
   just Tabs.
