---
name: release-funstack
description: A skill to make a GitHub release for the `@funstack/ui` package. Use this skill when the user wants to release a new version of the package.
allowed-tools:
  - Read
  - Bash(gh:*)
  - Bash(git:*)
metadata:
  internal: true
---

# Release FUNSTACK Skill

Creating a GitHub release is the whole release: the `release: created` event triggers the npm publish workflow.

- `.github/workflows/publish.yml` builds `@funstack/ui` and publishes it to npm (trusted publishing). A prerelease version such as `0.1.0-alpha.0` is published under the matching dist-tag (`alpha`); other versions go to `latest`.
- `.github/workflows/deploy-docs.yml` deploys the docs site (https://ui.funstack.work, worker `funstack-ui`) to Cloudflare Workers on the same event. The dev worker `funstack-ui-dev` is deployed on push by Cloudflare's Git integration.

Do not run `npm publish` or `wrangler deploy` locally.

To release a new version of the `@funstack/ui` package, follow these steps:

1. Read the `packages/ui/package.json` file to determine the current version of the package.

- User may or may not have already updated the version in `package.json`. Ask the user to confirm if they have updated the version. If not, you should update the version based on semantic versioning rules (patch, minor, major) as per user's instruction.

2. Update the version in `packages/ui/package.json`, commit and push to `master` if necessary.

- The commit message should be `chore: bump version to x.y.z` where `x.y.z` is the new version.
- Stage only `packages/ui/package.json` (`git add packages/ui/package.json`).

3. Inspect the git log since the last release tag to generate release notes.

- The release notes should summarize the changes made since the last release.
- Especially, highlight any breaking changes, new features, or important fixes.
- If there is no previous tag (first release), summarize the components and features the package ships instead of a change list, and omit the compare link.

4. Use the `gh` CLI to create a new release on GitHub with the new version and the generated release notes.

- The tag name should be `x.y.z` where `x.y.z` is the new version (no `v` prefix).
- Mark prerelease versions (those containing `-`) with `--prerelease`.

5. Inform the user that the release has been created successfully, providing the URL to the release page on GitHub, and that the npm publish and docs deploy workflows are now running (`gh run list --limit 5` shows them).

## Writing Release Notes

When writing release notes, consider the following structure:

```markdown
## What's Changed

### Breaking Changes

- Rename the `Tabs.Root` prop `onValueChange` to `valueAction`, matching the action-props convention.

### Features

- Add the `Tooltip` component, built on the Popover API and `interestfor`.

### Fixes

- Keep `Accordion` panels searchable with `hidden="until-found"` after a pending action settles.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.0.1...0.0.2
```

Notes:

- Highlight breaking changes if any. The project is experimental, so breaking changes may ship in minor versions; still call them out.
- Group changes into categories like "Features", "Improvements", "Fixes", etc.
- Documentation updates, playground (`packages/example`) changes and dependency updates should be omitted unless they are significant (e.g. breaking changes, a raised React peer dependency).
- Provide a link to the full changelog comparing the previous version and the new version.
