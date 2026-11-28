# #219: @funstack/ui loaded twice under vite dev with @vitejs/plugin-rsc

Versions checked: `@vitejs/plugin-rsc` 0.5.39, `@funstack/static` 1.3.5, Vite 8.4.0,
`@funstack/ui` 0.1.0-alpha.30 (and master with the #219 warning copied into its `dist`).
Repro: a copy of the dogfood 2 app with the `optimizeDeps.exclude` line removed.

## Root cause (evidence)

1. `rsc:use-client` (plugin-rsc `dist/plugin-*.js`, `vitePluginUseClient`) decides how the browser
   imports a `"use client"` module found in the `rsc` graph:
   - if the module is what a **bare specifier resolved to** (recorded by `rsc:virtual-client-package`'s
     `resolveId`, which only fires for bare imports), it becomes
     `virtual:vite-rsc/client-package-proxy/<specifier>`, which does `export {...} from "<specifier>"`:
     the browser resolves the bare specifier, so it goes through the optimizer like a client
     component's import. FUNSTACK Router is in this case (its entry has the directive).
   - otherwise, for a file under `/node_modules/` in dev, it becomes
     `virtual:vite-rsc/client-in-server-package-proxy/<abs path>`, which does
     `export * from "<abs path>"`: a **raw file path, never optimized**.
2. `@funstack/ui` puts `"use client"` on each part file; the subpath entries
   (`dist/navigation-menu/index.mjs`) have no directive and build a plain namespace object. So
   every server-rendered part takes the second path (`.../dist/navigation-menu/navigation-menu-popup.mjs`).
3. A client component's `import { NavigationMenu } from "@funstack/ui/navigation-menu"` is a
   normal bare import in the `client` environment, so Vite pre-bundles it
   (`/node_modules/.vite/deps/@funstack_ui_navigation-menu.js`). Seen in the transformed
   `/src/components/NavLink.tsx`.
4. Two module instances of `navigation-menu-context.mjs` (and `toolbar-context`, `field-context`,
   ...): the Link reads a different `NavigationMenuPopupContext` from the one the Popup provides.
   Checked in Chromium: panel open after the link click (`:popover-open` true), plus the new
   library warning. With the exclude: closes, no warning.
5. plugin-rsc only puts React libraries in `optimizeDeps.exclude` for the `rsc` and `ssr`
   environments (`crawlFrameworkPkgs` -> `optimizeDepsExclude`), not `client` (client exclude is
   `[PKG_NAME]` only).
6. FUNSTACK Static's `findClientPackages` (plugin `configEnvironment`, `name === "client"`) pushes
   every direct dependency with a `react` peer dependency into the client `optimizeDeps.include`,
   without looking at `optimizeDeps.exclude`. So `@funstack/ui` (the root entry) is pre-bundled
   even with the user's exclude, and Vite's resolver (`tryOptimizedResolve`, before the exclude
   check) maps a client `import ... from "@funstack/ui"` to `.vite/deps/@funstack_ui.js`: the
   workaround does not cover root-entry imports. Verified by transforming a probe module
   (`@funstack/ui` -> `.vite/deps/@funstack_ui.js`, `@funstack/ui/tabs` -> raw `dist/tabs/index.mjs`).
7. plugin-rsc does warn: `(rsc) warning: client component dependency is inconsistently optimized.
   It's recommended to add the dependency to 'optimizeDeps.exclude'.`, once per part file (21
   lines on the dogfood home page), even on a cold start here (because FUNSTACK Static's include
   already put the files in `_metadata-rsc.json`). It does not name the package, and it keeps
   firing after the exclude is added (same reason as 6), so it reads as noise.

Our docs site (`packages/docs`) has the same latent issue but does not show it: `@funstack/ui`
is `workspace:*`, so it resolves to `packages/ui/dist` (outside `node_modules`). plugin-rsc then
uses the plain `/@fs/...` URL for server-rendered parts (the `/node_modules/` branch is skipped)
and Vite does not pre-bundle a linked package's subpaths, so both sides load the same raw files.
FUNSTACK Static still pre-bundles the root entry there (`.vite/deps/@funstack_ui.js` exists), so
a docs client component importing from `"@funstack/ui"` would get a second copy; none does.

## What to report (a human files these)

Filed by a human as #224.

### uhyo/funstack-static (primary)

Title: "Dev: a client package whose `"use client"` is on internal files loads twice (Server
Component parts unbundled, client imports pre-bundled)"

- `findClientPackages` adds every `react`-peer dependency to the client `optimizeDeps.include`.
  That is right for a package whose export entries carry `"use client"` (FUNSTACK Router: the
  plugin proxies it by specifier), wrong for one whose directive is on internal files
  (`@funstack/ui`, also Base UI / Radix-style packages): plugin-rsc imports those internals by raw
  path, so the client component's pre-bundled copy is a second instance (two React contexts).
- Asks:
  1. Respect the user's `optimizeDeps.exclude`: do not push a package into `include` when it is
     excluded (today the root entry stays pre-bundled and Vite's `tryOptimizedResolve` maps
     client imports of it to `.vite/deps` despite the exclude).
  2. Better: for client packages, put them in the client `optimizeDeps.exclude` instead of
     `include` when any of their export entries lacks `"use client"` while the package has
     `"use client"` files (or always, with `include: ["pkg > cjs-dep"]` for their CommonJS deps).
     `@funstack/ui` has no runtime dependencies, so excluding it costs nothing.
- Repro: any app with `@funstack/ui` where a Server Component renders `NavigationMenu.Root/Item/Popup`
  and a client component renders `NavigationMenu.Link` inside the Popup; in `vite dev` the Link
  does not close the panel; `vite build` is fine. `optimizeDeps: { exclude: ["@funstack/ui"] }`
  fixes subpath imports.

### vitejs/vite-plugin-react, `plugin-rsc` (secondary)

Title: "plugin-rsc: client-in-server-package-proxy imports raw files while client imports of the
same package are optimized (duplicate module instances in dev)"

- The `client` environment's `optimizeDeps.exclude` only contains the plugin itself, while the
  `rsc`/`ssr` ones get every crawled React library. A React library whose `"use client"` is on
  internal modules is then optimized for client components but reached raw through
  `client-in-server-package-proxy` for Server Components.
- Asks (any of): exclude the crawled React libraries from client pre-bundling too (as for
  rsc/ssr), or at least those whose `"use client"` modules are not package entries; or make the
  `inconsistently optimized` warning name the package and the exact config line, and not fire
  when the package is already in the user's exclude.
- Related: vitejs/vite-plugin-react#906 (closed reproduction; the maintainer's answer was
  "add it to optimizeDeps.exclude").

## Our side (done on dev/219)

- `internal/use-copy-check.ts`: development-only `console.error` once per page when parts of two
  copies are mounted together (registry on `globalThis` under
  `Symbol.for("@funstack/ui/mounted-copies")`, detection only).
- Server Components page: "With the Vite dev server" (`#vite-dev`), skill rule 20.

## In-package fixes considered and rejected

- `"use client"` on subpath entries: kills `Tabs.Root` from a Server Component (cannot dot into
  a client reference).
- Self-referencing bare specifiers for every part (`@funstack/ui/_parts/*` exports) so plugin-rsc
  proxies them by specifier: works in principle (the optimizer would share chunks with the
  subpath entry), but ~185 part files become exports, each is found only at request time
  (re-optimization pass on cold start, the thing FUNSTACK Static #128 avoids), and it changes
  resolution in every other bundler.
- A `react-server` export condition per subpath (review of dev/219): the server entry builds the
  namespace from a `"use client"` bare-specifier entry (`@funstack/ui/navigation-menu/client`),
  so plugin-rsc proxies by specifier. ~40 `/client` entries rather than 185, and they could go in
  `optimizeDeps.include`. Costs: a changed exports map for every bundler; each part must be a
  named export of the client entry; the directive-free parts (Progress/Meter Roots,
  NavigationMenu Root/List, Separator) must stay out of it; FUNSTACK Static still has to include
  the entries. Not done.
- Contexts on `globalThis`: fixes contexts only, not module state (escape-key layering, modal
  registry), and couples context shapes across versions.
- No package.json field: Vite has no package-level opt-out of pre-bundling, and plugin-rsc reads
  only `peerDependencies`/`dependencies` (`react`) from package.json.
