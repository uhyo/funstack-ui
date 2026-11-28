# Separator

Status: **accepted**, implemented (#169, part of #162): `packages/ui/src/separator/separator.tsx`.
History and the test plan: `design/CHANGELOG.md`. Follows `design/conventions.md`; where this document
and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md` (1.1 part vocabulary, 1.2, 7.1, 7.3),
`design/components/toggle-group.md` 3.5 (`Toolbar.Separator`), `design/components/menu.md` 3.7,
`design/components/select.md` 3.5, `design/components/combobox.md` (no `Separator`), HTML
(`<hr>`: implicit role `separator`; allowed roles `none` / `presentation`), WAI-ARIA 1.2
(`separator`, `aria-orientation`), prior art (Radix `Separator`, Base UI `Separator`, React Aria
`Separator`, Ariakit `Separator`), notes in `memo/architect/small-parts-notes.md`.

A line between two pieces of content. It has no state, no action, nothing pending and nothing to
animate: it is the one part of the library with no Async React in it, and this document does
not pretend otherwise. What the part adds over a bare `<hr>` is small and is listed in section 2
so that the product owner can weigh it.

## Summary

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Shape | A single-element component, `Separator`, from `@funstack/ui/separator`. Renders `<hr>`. |
| 2 | Props | `orientation` (`"horizontal"` default, `"vertical"`), `decorative` (default `false`), plus `className` / `style` / `render` and the `<hr>`'s own props. No `children`. |
| 3 | Semantics | Semantic by default: `role="separator"`, rendered by the part, with `aria-orientation`. `decorative` renders `role="none"` and no `aria-orientation`. The part owns `role` in both cases. |
| 4 | Styling hook | `data-orientation` always. No other attribute. |
| 5 | Server Component | The file has **no `"use client"`**: no context, no hook. Function props run on the server. |
| 6 | `Toolbar.Separator` | Stays: it reads the Toolbar's orientation from context, which a directive-free part cannot do. Same vocabulary (`orientation` state, `data-orientation`) and the same role rule. |
| 7 | `Menu.Separator`, `Select.Separator` | Stay: always horizontal, always semantic, `<hr>`. `Menu.Separator` follows the role rule; `Select.Separator` cannot be anything but an `<hr>` and writes no role (section 5). |
| 8 | Combobox, MultiSelect | Still no `Separator` part. `<Separator decorative />` is the allowed line inside a listbox. |
| 9 | Not this part | A focusable separator (window splitter with `aria-valuenow`). |

---

## 1. Anatomy and usage

```tsx
import { Separator } from "@funstack/ui/separator";

<article>…</article>
<Separator />                                   {/* hr role="separator" aria-orientation="horizontal" */}
<article>…</article>

<nav className="breadcrumbs">
  <a href="/">Home</a>
  <Separator orientation="vertical" decorative /> {/* hr role="none" data-orientation="vertical" */}
  <a href="/docs">Docs</a>
</nav>
```

Rendered HTML:

```html
<hr role="separator" aria-orientation="horizontal" data-orientation="horizontal">
<hr role="none" data-orientation="vertical" data-decorative>
```

| Part | Element | Role | Library state rendered |
| --- | --- | --- | --- |
| `Separator` | `hr` | `separator` (rendered); `none` when `decorative` | `role`, `aria-orientation` (not when `decorative`), `data-orientation`, `data-decorative` |

## 2. Why a part at all

An honest account. A horizontal, semantic separator is `<hr>`, and the part adds only
`data-orientation` to it. The part earns its place in three cases:

- **Vertical.** An `<hr>` is horizontal to assistive technology whatever the CSS does. A vertical
  line needs `aria-orientation="vertical"`, and the stylesheet needs something to select on. One
  prop gives both, in the vocabulary `Toolbar.Separator` already uses.
- **Decorative.** Most separators in application UI are visual only (between two buttons, in a
  breadcrumb, under a heading). A screen reader that announces "separator" for each is noise.
  `decorative` is the spelling for "a line, not a thematic break", and it also removes the
  `aria-orientation` that would be invalid on `role="none"`.
- **A name.** Four of the six surveyed libraries ship one (#162), and a consumer's styled layer
  wants one unit called Separator that carries its class names.

The alternative is to build nothing and show `<hr>`, `<hr aria-orientation="vertical">` and
`<hr role="none">` as a recipe on a docs page, which is what conventions 7.3 does for the
directive-free form controls. The cost of the part is one directive-free file of about forty
lines and one docs page. The user chose to build it (the #169 entries in the changelog).

## 3. Props and types

```ts
export type SeparatorOrientation = "horizontal" | "vertical";

export interface SeparatorState {
  readonly orientation: SeparatorOrientation;
  readonly decorative: boolean;
}

export interface SeparatorProps
  extends Omit<
    ComponentPropsWithRef<"hr">,
    "role" | "aria-orientation" | "className" | "style" | "children"
  > {
  /**
   * The direction of the line itself. A vertical separator sits between things laid out in a row.
   *
   * @defaultValue `"horizontal"`
   */
  orientation?: SeparatorOrientation;
  /**
   * A visual line with no meaning: `role="none"`, no `aria-orientation`. Leave it `false` when
   * the line marks a real break between sections of content.
   *
   * @defaultValue `false`
   */
  decorative?: boolean;
  className?: StateValue<string | undefined, SeparatorState>;
  style?: StateValue<CSSProperties | undefined, SeparatorState>;
  /** Replace the `<hr>`. The part writes the role, so any element is a separator (or, with `decorative`, none). */
  render?: RenderProp<ComponentPropsWithRef<"hr">, SeparatorState>;
}
```

Owned keys (conventions 1.2): `aria-orientation`, `data-orientation`, `data-decorative`
(present while `decorative`: every boolean of a part's state is also an attribute, conventions
4.1 rule 2, so a stylesheet selects `[data-decorative]` as it selects `[data-orientation]`,
without knowing which role the part renders), and `role` **in both modes**: `"separator"`,
or `"none"` while `decorative`. Either wins over a `render` element's own. `role` is not in the
props type: the two meanings the part supports are spelled `decorative` and its absence.

**The role is rendered, not left to the `<hr>`.** This is one rule for every library separator
whose element `render` may replace freely (`Separator`, `Toolbar.Separator`, `Menu.Separator`):

- `render={<div />}` is a separator without the consumer having to know that a `<div>` has no
  role. A line that silently stops being a separator is the failure this library exists to
  prevent; a consumer-supplied role was a rule that had to be remembered at every call site.
- `aria-orientation` is never rendered on an element whose role does not support it.
- `role` is owned in one way: a key the part always writes and always omits from its type,
  with no "owned while decorative" case.

The cost is a redundant attribute on the default element: `<hr role="separator">` repeats the
implicit role. Assistive technology reads the same thing; a markup validator may note the
redundancy (ARIA in HTML discourages, and does not forbid, restating an implicit role). Writing
the role only on a non-`<hr>` was rejected: the part cannot see what a component or a function
`render` produces (conventions 1.2, the `type` rule), so the attribute would depend on a guess.

`aria-orientation` is rendered for both orientations (not only for `"vertical"`, where it
differs from the role's default), so that the part and `Toolbar.Separator` follow one rule and
a `render` element gets the same attributes as the `<hr>`.

No `children`: an `<hr>` is void. A line with a word in it ("or") is
`render={<div>or</div>}`; the children of a `separator` are presentational, so
the word is not announced, which is the right result for "or" and the wrong one for anything
that matters.

Not offered:

- **A `label` or text slot.** Above.
- **Reading `ToolbarContext`.** The part would have to become a client module to flip its
  orientation inside a Toolbar. `Toolbar.Separator` does that. A `Separator` placed in a Toolbar
  works (the Toolbar finds its items by focusability, and an `<hr>` is not one) but is horizontal
  unless told otherwise.
- **A `transition` prop, `data-pending`.** There is no state change to animate or wait for.

## 4. Accessibility

| Case | Rendered | Announced |
| --- | --- | --- |
| default | `hr[role=separator][aria-orientation=horizontal]` | "separator" (wording varies by screen reader) |
| `orientation="vertical"` | `hr[role=separator][aria-orientation=vertical]` | "separator", vertical where the screen reader says so |
| `decorative` | `hr[role=none][data-decorative]` | nothing |

- Not focusable, no keyboard interaction, in every case.
- When to choose which: semantic for a break a sighted reader would describe ("the comments
  start here"); decorative for a line that only tidies a row or a list. The docs page says this
  in one sentence next to the prop, because the default cannot know.
- A separator **inside a composite** follows the composite's content model:
  - `menu`, `toolbar`: `separator` is an allowed child. Use `Menu.Separator` and
    `Toolbar.Separator`.
  - `<select>`: `<hr>` is the only separator the parser keeps. Use `Select.Separator`.
  - `listbox` (Combobox, MultiSelect): `separator` is not allowed. A `role="none"` element is
    (the `List`'s own `Status` is one, conventions 1.1), so `<Separator decorative />` between
    options or groups is valid; without `decorative` it is not. A `Group` boundary styled in CSS
    remains the other spelling.

## 5. The existing separators

| Part | Reads | Orientation | Role | `role` owned |
| --- | --- | --- | --- | --- |
| `Toolbar.Separator` | `ToolbarContext` | perpendicular to the Toolbar's | `separator`, rendered | yes |
| `Menu.Separator` | nothing | horizontal (implicit) | `separator`, rendered | yes |
| `Select.Separator` | the Select's context (its function props get `SelectRootState`) | horizontal (implicit) | the `<hr>`'s own, `separator` where the engine exposes it | no |
| `Separator` | nothing | prop | `separator` or `none`, rendered | yes |

`Select.Separator` is the one exception to the role rule of section 3, and for the reason the
rule exists: its element is fixed. Inside a `<select>` the parser keeps an `<hr>` and nothing
else, so `render` may not replace it with another tag (conventions 1.2), the implicit role can
never be lost, and the part writes none and owns none.

They share an element and a vocabulary, not code: each is one render call with no logic, so a
shared helper would be longer than what it replaces. Folding the three into the standalone part
(deprecating `Menu.Separator` and `Select.Separator`, giving `Separator` a context read for the
Toolbar) was considered and rejected: it breaks call sites for no gain, costs the standalone
part its Server Component property, and loses `Select.Separator`'s state.

## 6. CSS

The library ships no CSS. An `<hr>` has user-agent margins, a border and a border-derived
height, so the recipe resets them:

```css
.separator { margin: 0; border: 0; background: var(--line); flex: none; }
.separator[data-orientation="horizontal"] { block-size: 1px; inline-size: 100%; }
.separator[data-orientation="vertical"]   { inline-size: 1px; align-self: stretch; }
```

Tailwind: `data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px`.

## 7. Server/client boundary

The file carries no `"use client"` (conventions 7.1, like `Progress.Root`): it calls the
directive-free `renderElement` of `internal/render-element.ts`, not the `useRender` hook, and
reads no context. From a Server Component, function `className` / `style` / `render` run on the
server. The Directive test row asserts the absence of the directive.

## 8. Not in v1

- A focusable, value-bearing separator (the APG window splitter): a different component.
- Orientation from a parent's layout (a container query cannot set an ARIA attribute).
