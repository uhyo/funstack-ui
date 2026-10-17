# @funstack/ui

> **Experimental.** APIs will change without notice.

Headless UI library for React — the first **Async React-native** UI library. Part of the
[FUNSTACK](https://github.com/uhyo/funstack-ui) family.

- **Transition by default.** Interactions are _action props_ (`pressedChangeAction`,
  `valueChangeAction`, …), run inside a React transition. Actions can be async; components expose
  `data-pending` and show optimistic state while they run.
- **Server Functions pass directly.** `<Toggle pressedChangeAction={serverFn} />` works from a
  Server Component.
- **Suspense-native.** Content that suspends keeps the previous UI visible instead of flashing a
  fallback.
- **`<ViewTransition>` built in** via a `transition` prop.
- **Modern HTML/CSS first.** Popover API, CSS Anchor Positioning, `<details>`, `hidden="until-found"`;
  bleeding-edge features behind `experimental_*` props.

Documentation: https://ui.funstack.work

## Installation

```sh
npm install @funstack/ui@alpha
```

React 19.3 or later is required (`react` and `react-dom` are peer dependencies).

```tsx
import { Toggle } from "@funstack/ui/toggle";

<Toggle pressedChangeAction={async (pressed) => await saveFavorite(pressed)}>Favorite</Toggle>;
```

Components: `Toggle`, `Tabs`, `Accordion`, `Tooltip`.

## Browser support

Latest stable version of each major engine. No fallbacks.

## License

MIT
