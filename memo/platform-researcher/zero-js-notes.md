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
  defer() does not pass one.
- cache()-scoped mutable store breaks with async children (probe app-server.tsx).
- Headless libs (Radix, Base UI, RAC, Ark, Headless UI, Mantine): no react-server condition.
  next-intl/swr/apollo use it; next-intl types point at the client build only.
