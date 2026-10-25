# FUNSTACK UI

![FUNSTACK UI](https://raw.githubusercontent.com/uhyo/funstack-ui/master/docs/FUNSTACK_UI_Hero_small.png)

> **Experimental.** APIs will change without notice.

Headless UI library for React — the first Async React-native UI library. Part of the FUNSTACK family.

Documentation: https://ui.funstack.work

See [docs/vision.md](./docs/vision.md) for the principles behind the project.

## Installation

```sh
npm install @funstack/ui@alpha
```

React 19.3 or later is required (`react` and `react-dom` are peer dependencies).

## Using with AI agents

`@funstack/ui` ships an agent skill and its documentation as Markdown. Install the skill with
`npx -p @funstack/ui@alpha funstack-ui-skill-installer`. The site also serves
[llms.txt](https://ui.funstack.work/llms.txt), [llms-full.txt](https://ui.funstack.work/llms-full.txt)
and a `.md` version of every page.

## Packages

- `packages/ui` — the `@funstack/ui` library
- `packages/example` — a Vite playground that consumes the library
- `packages/docs` — the documentation site (`pnpm --filter docs dev`)

## Development

```sh
pnpm install
pnpm test:run
pnpm build
```

See [CLAUDE.md](./CLAUDE.md) for the full list of commands and conventions.

## License

MIT
