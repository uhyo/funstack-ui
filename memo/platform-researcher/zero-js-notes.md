# #19 zero-JS variants — working notes (2026-10-23)

- Probe harness: copy `probes/19-zero-js/` to `packages/docs/.probe-19/` (needs docs' node_modules),
  `VARIANT=<app-name> npx vite build`, output in `dist/public` (outDir override is ignored by
  FUNSTACK Static; copy out between builds). Delete the folder afterwards.
- FUNSTACK Static always `import()`s the runtime chunk and fetches the RSC payload, even with zero
  client references (76 KB gzip). Marginal part cost 2-5 KB gzip.
- Prod Flight message for context read is "Cannot use() an already resolved Client Reference"; dev
  is "Cannot read a Client Context from a Server Component".
- Server useId `_S_n_` restarts per Flight render -> duplicate ids across `defer()` chunks.
  Affects Progress.Root / Meter.Root label id. Flight supports `identifierPrefix`; FUNSTACK Static
  defer() did not pass one up to 1.3.3.
- #94 re-check (2026-10-23): FIXED in @funstack/static 1.3.4 (PR uhyo/funstack-static#199).
  Prefix per deferred payload: `_<name>_<n>S_1_` named, `_d<n>S_1_` unnamed, main stays `_S_1_`;
  `_shellS_` for Root shell with ssr:false. No opt-in. Verified with app-defer.tsx and new
  app-defer-progress.tsx + check-ids.mjs (Chromium, Firefox; WebKit not installed): no dupes,
  correct accessible names, no hydration errors. 1.3.3 in the same harness: `_S_1_-label` x3.
  Harness now standalone (no packages/docs needed): copy folder to scratchpad, package.json with
  @funstack/static, react/react-dom 19.3.1, @vitejs/plugin-react, vite, @funstack/ui from
  `pnpm pack` tarball (file: link would pull a second React). npm install, build, serve dist/public.
  Docs site still on 1.3.3 (lockfile); needs ^1.3.4.
- cache()-scoped mutable store breaks with async children (probe app-server.tsx).
- Headless libs (Radix, Base UI, RAC, Ark, Headless UI, Mantine): no react-server condition.
  next-intl/swr/apollo use it; next-intl types point at the client build only.
