# Working notes: Server Function action props (#17)

Date: 2026-10-15. Doc: `docs/research/server-function-action-props.md`.

## Probe setup

- Scratch install (not in packages/ui): `/tmp/claude-1000/-home-uhyo-repos-funstack-ui/9edfb96d-3075-4d78-bcf8-d09772e47fee/scratchpad/rsdw`
  with `react@19.3.1 react-dom@19.3.1 react-server-dom-webpack@19.3.1 jsdom`. The probe takes
  `SCRATCH=<dir>` so it can be re-pointed if the scratchpad is gone.
- Must run with `node --conditions=react-server` so `react-server-dom-webpack/server` loads; the
  browser client build still loads under that condition.
- Must require `react-server-dom-webpack/client.browser` explicitly. Under Node the `./client`
  export resolves to the SSR client, whose `callServer` throws "Server Functions cannot be
  called during initial render".
- The browser client reads `__webpack_require__.u` at load; stub `globalThis.__webpack_require__ = { u: () => "" }`.
- Dev: `node --conditions=react-server memo/platform-researcher/probes/03-server-function-action-details.mjs`;
  prod: prefix `NODE_ENV=production`. Outputs saved as `*.dev-output.txt` / `*.prod-output.txt`.

## Things that surprised me

- Getter case 3 first showed a spurious extra `console.error` because my getter returned a
  fresh Event each call (`this[key] !== value` triggers the "toJSON" warning). Fixed with a
  stable event. Noted so nobody re-chases it.
- With temporary references, an Event in args is *silent* in dev: the `$T` path returns before
  any dev warning. So "it works in Next.js" is true and tells you nothing.
- Next.js `omitUnusedArgs` trims trailing args the server fn does not declare: a server fn
  `(id, next)` never receives `details` at all in Next.js. Framework-specific; not relied on.
- `isObjectPrototype` accepts a null-prototype object whose own names all exist on
  `Object.prototype`, so a prototype-getter trick would need the getter to be named like an
  `Object.prototype` member. Dead end; the Proxy is cleaner.
- A frozen Proxy target breaks the `has` trap invariant for the virtual `event` key.

## Open

- Conventions 2.2 wording change recommended (reported to lead, not edited): `details` is a
  plain serialisable object; `event` is a virtual non-own property; Server Functions may be
  passed directly. `toggle.md` 2.2 / section 9 then drop the "wrapper required" caveat.
