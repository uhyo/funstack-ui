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

## Using with AI agents

The package ships an agent skill, `funstack-ui-knowledge`, and the full documentation as Markdown
in `node_modules/@funstack/ui/dist/docs/` (start at `index.md`). Install the skill into your
project for Claude Code, Cursor, Copilot, Codex and other agents:

```sh
npx -p @funstack/ui@alpha funstack-ui-skill-installer
# or
pnpm dlx --package @funstack/ui@alpha funstack-ui-skill-installer
# or
yarn dlx -p @funstack/ui@alpha funstack-ui-skill-installer
```

Set `SKILL_INSTALL_PATH` (for example `.claude/skills`) to skip the interactive prompt.

The documentation site has the same Markdown at https://ui.funstack.work/llms.txt,
https://ui.funstack.work/llms-full.txt (every page in one file), and at every page URL with `.md`
appended (https://ui.funstack.work/components/dialog.md).

## Browser support

Latest stable version of each major engine. No fallbacks.

## License

MIT
