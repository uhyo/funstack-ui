# Release and docs deploy setup (2026-10-16)

- Mirrors funstack-router: `publish.yml` (release created, OIDC trusted publishing) and `deploy-docs.yml` (release created + workflow_dispatch, `pnpm wrangler deploy` in packages/docs).
- publish.yml builds only `@funstack/ui` via `turbo --filter` (sibling runs full `pnpm build`; docs/example are not needed to publish).
- Uses `pnpm/action-setup@v6` like our ci.yml (sibling has v5).
- workerd postinstall is ignored by pnpm (not in onlyBuiltDependencies), same as sibling; `wrangler deploy` and `--dry-run` work without it. `wrangler dev` would need it.
- `wrangler deploy --dry-run` validated offline (71 asset files read).
- Custom domain is not declared in wrangler.toml (sibling doesn't either); attach ui.funstack.work in the Cloudflare dashboard.
- packages/ui has no README, so the npm page will show none. Consider adding one before the first release.
