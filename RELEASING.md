# Releasing

This repo is an npm workspace with two publishable packages:

| Package | Path | npm |
|---|---|---|
| `@sensecall/govuk-rewrite` | `packages/core` | Core library |
| `@sensecall/govuk-rewrite-cli` | `packages/cli` | CLI tool |

## Version strategy

- `@sensecall/govuk-rewrite` (core) and `@sensecall/govuk-rewrite-cli` are versioned independently.
- Both packages are always released together in the same PR and git tag.
- Use a single `v<major>.<minor>.<patch>` tag on `main` for the release.
- Follow semver: patch for fixes, minor for new features, major for breaking changes.
- `@sensecall/govuk-rewrite-cli` depends on `@sensecall/govuk-rewrite ^<major>.<minor>.0`.

## Required repository secrets

- `NPM_TOKEN`: npm automation token with publish rights.
- `GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Release process

### 1. Create a release branch

```bash
git checkout main && git pull
git checkout -b release/vX.Y.Z
```

### 2. Bump versions

In `packages/core/package.json`:
```json
"version": "X.Y.Z"
```

In `packages/cli/package.json`:
```json
"version": "X.Y.Z"
```

If the core version changed, also update the dep in `packages/cli/package.json`:
```json
"@sensecall/govuk-rewrite": "^X.Y.0"
```

### 3. Run local checks

```bash
npm ci
npm run build
npm test
cd packages/core && npm pack --dry-run && cd ../..
cd packages/cli && npm pack --dry-run && cd ../..
```

### 4. Commit

```bash
git add package-lock.json packages/core/package.json packages/cli/package.json
git commit -m "chore: bump versions to vX.Y.Z"
```

### 5. Push, open PR, wait for CI

```bash
git push -u origin release/vX.Y.Z
gh pr create --base main --title "chore: release vX.Y.Z"
```

### 6. Merge and tag

```bash
gh pr merge --merge
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

Pushing `vX.Y.Z` triggers `.github/workflows/release.yml`, which publishes both packages to npm and GitHub Packages.

### 7. Verify

Check workflow status and logs in GitHub Actions, then verify npm artifacts:

```bash
npm view @sensecall/govuk-rewrite
npm view @sensecall/govuk-rewrite-cli
```

Verify GitHub Packages in the repository sidebar and package pages.
The first GitHub Packages publish defaults to private; set visibility to public if required.

## Immediate cutover deprecations

After the first scoped release, deprecate old unscoped packages:

```bash
npm deprecate govuk-rewrite@"*" "Package moved to @sensecall/govuk-rewrite"
npm deprecate govuk-rewrite-cli@"*" "Package moved to @sensecall/govuk-rewrite-cli"
```
