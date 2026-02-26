# Releasing

This repo is an npm workspace with two publishable packages:

| Package | Path | npm |
|---|---|---|
| `govuk-rewrite` | `packages/core` | Core library |
| `govuk-rewrite-cli` | `packages/cli` | CLI tool |

## Version strategy

- `govuk-rewrite` (core) and `govuk-rewrite-cli` are versioned independently.
- Both packages are always released together in the same PR and git tag.
- Use a single `v<major>.<minor>.<patch>` tag on `main` for the release.
- Follow semver: patch for fixes, minor for new features, major for breaking changes.
- `govuk-rewrite-cli` depends on `govuk-rewrite ^<major>.<minor>.0` — update this if the core minor or major version changes.

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
"govuk-rewrite": "^X.Y.0"
```

### 3. Commit

```bash
git add packages/core/package.json packages/cli/package.json
git commit -m "chore: bump versions to vX.Y.Z"
```

### 4. Push, open PR, wait for CI

```bash
git push -u origin release/vX.Y.Z
gh pr create --base main --title "chore: release vX.Y.Z"
```

CI runs: build, tests, `npm pack --dry-run` on both packages.

### 5. Merge and tag

```bash
gh pr merge --merge
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 6. Publish

```bash
npm run build

cd packages/core
npm publish --access public --otp=<code>

cd ../cli
npm publish --access public --otp=<code>
```

Publish core before cli — cli depends on core being resolvable on the registry.

### 7. Verify

```bash
npm view govuk-rewrite
npm view govuk-rewrite-cli
```

## Deprecating a version

If a version needs to be deprecated (for example after a rename):

```bash
npm deprecate govuk-rewrite@"<=X.Y.Z" "Message explaining the change" --otp=<code>
```

## npm authentication

Log in with:

```bash
npm login
```

npm requires an OTP from your authenticator app on publish and deprecate operations. Pass it with `--otp=<code>` or npm will prompt for it interactively.
