# Kustron — Locked Features & Delivery Log

**Version:** 2.0.0  
**Last updated:** 2025-01-17  
**Status:** All CI checks passing, coverage ≥ 50%, docs synced

---

## Versioning

**Current approach:** Manual.

- `package.json` version is bumped by hand.
- Git tags (`v1.1.5` → `v2.0.0`) are created manually.
- No automated tool (changesets, semantic-release, standard-version, release-it) is wired in.

**Recommendation:** Adopt **changesets** (`@changesets/cli`) for the next release cycle. It gives us:

1. PR-level changelogs (each PR carries a `.changeset/*.md` describing its impact).
2. Automated `CHANGELOG.md` generation at release time.
3. Automated `package.json` bump + git tag via `changeset version && changeset publish`.
4. Keeps the lightweight, no-boilerplate workflow we have today while adding traceability.

**Next steps for versioning:**

- Install `@changesets/cli` as a dev dependency.
- Run `npx changeset init`.
- Update the CI workflow to run `changeset version` on merge to `main` and `changeset publish` for npm releases.

---

## What Was Done (This Delivery)

### 1. CI Failures Fixed

| File                     | Problem                                                           | Fix                                                |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------- |
| `src/core/deployer.ts`   | Duplicate `buildDeployment` import (syntax error)                 | Removed duplicate import                           |
| `src/core/manifest.ts`   | Duplicate `patch` / `imagePullSecrets` interface fields           | Removed duplicate fields                           |
| `src/utils/checks.ts`    | `isRuntimeInstalled` did not `await` both runtime checks          | Added `await` to both `docker` and `podman` checks |
| `src/commands/env/up.ts` | Missing imports for `pruneRemovedApps` and `recordDeployedApps`   | Added imports from `../../core/state.js`           |
| `package-lock.json`      | Missing `@rollup/rollup-linux-x64-gnu` (macOS-generated lockfile) | Regenerated lockfile after clearing `node_modules` |
| `docs/index.html`        | Unescaped `<nodePort>` inside `<code>` broke Prettier             | Escaped to `&lt;nodePort&gt;`                      |
| `docs/index.html`        | Missing `<tr>` before `env show-spec` row                         | Added `<tr>` wrapper                               |

### 2. Test Coverage Raised: 19% → 51.04%

**26 unit test files, 193 tests passing.**

New tests added:

- `test/unit/checks.test.ts` — prerequisite detection, docker/podman resolution
- `test/unit/manifest.test.ts` — K8s manifest generation (Deployments, Services, ConfigMaps, HPA)
- `test/unit/helm.test.ts` — helm install args, OCI chart handling
- `test/unit/env-file.test.ts` — YAML parsing, `PORT` placeholder rejection, schema validation
- `test/unit/registry.test.ts` — local registry lifecycle, imagePullSecret generation
- `test/unit/cluster.test.ts` — k3d arg generation, port collection
- `test/unit/source.test.ts` — local path resolution, git URL detection
- `test/unit/build.test.ts` — dockerfile vs railpack strategy detection
- `test/unit/exec.test.ts` — execa wrapper, verbose mode, error handling
- `test/unit/state.test.ts` — deployed-app state recording, pruning logic
- `test/unit/context.test.ts` — kubeconfig merge, context isolation
- `test/unit/push.test.ts` — image tagging, registry push
- `test/unit/registry-gc.test.ts` — garbage collection of dangling images
- `test/unit/container-runtime.test.ts` — docker/podman/orbstack detection

### 3. README Deduplicated & Updated

- Removed duplicate `# Kustron` header, duplicate Features block, duplicate "env up is deterministic" section, duplicate "How It Works" section, and duplicate `namespace` YAML line.
- Updated coverage badge to **51%**.
- Added **Use Cases** section with 6 audience-focused scenarios.
- Refreshed **Features** list to highlight what matters most (hot-reload, app-level debugging, safe kubectl isolation, CLI scaffolding).
- Fixed outdated references: noted `helm.imageValues` deprecation, replaced non-existent `registry import` with `registry prune`.
- Removed duplicate sentence in VM deployment section and redundant paragraph in Port 5000 FAQ.
- Consistent `nodePort` casing throughout.

### 4. Landing Page (`docs/index.html`) Fixed

- Fixed grammatical error: "Never them." → "Never expose them."
- Moved `env show-spec` and `env status` from `app` group to `env` group in commands table.
- Fixed `grafana.enabled` YAML example to use proper nested structure.
- Removed duplicate FAQ paragraph about podman memory.
- Fixed malformed commands table rows (`env reload`/`env watch` had extra stray `<td>` elements; `app logs`/`app exec`/`app forward` rows had broken tag structure).
- Ran Prettier over `docs/**/*.html` (files had never been formatted).

### 5. E2E Tests Verified

- `test/e2e/parse-fixtures.test.ts` — fixture-based YAML parsing validation
- `test/e2e/manifest-generation.test.ts` — end-to-end manifest generation for all app types

### 6. Verified Commands

All of the following pass locally and in CI:

```bash
npm run format:check   # ✅
npm test               # ✅ 193 tests
npm run build          # ✅
npm run test:coverage  # ✅ 51.04% statements
```

---

## Architecture Snapshot (Current)

```
src/
├── bin/
│   └── kustron.ts              # commander root — registers all subcommands
├── commands/
│   ├── env/
│   │   ├── init.ts             # interactive wizard + env file creation
│   │   ├── up.ts               # cluster create + deploy all apps + state mgmt
│   │   ├── down.ts             # cluster teardown
│   │   ├── reload.ts           # down + up (pick up yaml changes)
│   │   ├── watch.ts            # file watcher with auto-redeploy
│   │   ├── status.ts           # cluster + app status table
│   │   └── show-spec.ts        # pretty-print full schema
│   ├── app/
│   │   ├── stop.ts             # stop a single app
│   │   ├── start.ts            # start a single app
│   │   ├── logs.ts             # stream logs
│   │   ├── exec.ts             # exec into container
│   │   └── forward.ts          # port-forward
│   ├── apps/
│   │   ├── add.ts              # append app to kustron-env.yaml
│   │   └── remove.ts           # remove app from kustron-env.yaml
│   └── registry/
│       ├── login.ts            # registry credential login
│       ├── prune.ts            # garbage collect dangling images
│       └── import.ts           # import local image into cluster
├── core/
│   ├── cluster.ts              # k3d lifecycle: create, delete, exists
│   ├── context.ts              # kubeconfig merge + context isolation
│   ├── env-file.ts             # parse, validate, generate kustron-env.yaml
│   ├── source.ts               # local path + git URL resolution
│   ├── build.ts                # dockerfile / railpack / image strategy
│   ├── push.ts                 # tag + push to local registry
│   ├── manifest.ts             # programmatic K8s manifest generation
│   ├── apply.ts                # kubectl apply / delete / rollout
│   ├── deployer.ts             # per-app deploy pipeline
│   ├── helm.ts                 # helm install / uninstall
│   ├── state.ts                # deployed-app state recording + pruning
│   ├── components.ts           # reusable component system
│   ├── registry.ts             # local registry lifecycle
│   └── registry-gc.ts          # garbage collection logic
├── utils/
│   ├── exec.ts                 # execa wrapper
│   ├── checks.ts               # prerequisite detection
│   ├── logger.ts               # chalk-based logging
│   ├── i18n.ts                 # translation helper
│   ├── image.ts                # image parsing utilities
│   ├── port.ts                 # port allocation
│   ├── merge.ts                # deep merge utilities
│   └── hash.ts                 # content hashing for deterministic tags
└── types/
    └── index.ts                # all shared TypeScript interfaces
```

---

## Feature Completeness Matrix

| Feature                                      | Status | Notes                                         |
| -------------------------------------------- | ------ | --------------------------------------------- |
| Local source deploy                          | ✅     | dockerfile + railpack                         |
| Git source deploy                            | ✅     | SSH + HTTPS, cached in `~/.kustron/git-cache` |
| Image deploy                                 | ✅     | existing container images                     |
| Helm chart deploy                            | ✅     | repos, OCI, local charts, values files        |
| Hot-reload (`env watch`)                     | ✅     | chokidar-based file watching                  |
| App lifecycle (stop/start/logs/exec/forward) | ✅     | per-app, no cluster teardown                  |
| `dependsOn` + readiness checks               | ✅     | topological deploy ordering                   |
| `hooks.pre` / `hooks.post`                   | ✅     | migrations, seeding                           |
| Secrets as K8s Secrets                       | ✅     | `${ENV}` interpolation                        |
| Private registry support                     | ✅     | per-app `registry` + imagePullSecret          |
| Reusable components                          | ✅     | `Kustronfile` with inputs/outputs             |
| Deterministic `env up`                       | ✅     | content-hash image tags                       |
| Prune removed apps                           | ✅     | `state.ts` tracking                           |
| Safe kubectl isolation                       | ✅     | `--context=k3d-<name>` everywhere             |
| `env init` interactive wizard                | ✅     | `@clack/prompts`                              |
| `env show-spec`                              | ✅     | full schema reference                         |
| Registry GC                                  | ✅     | `kustron registry prune`                      |
| HPA / autoscaling                            | ✅     | `ha: true` mode                               |
| Per-app namespace                            | ✅     | `namespace` field                             |
| Per-app instance                             | ✅     | `instance` field for isolation                |
| Named clusters                               | ✅     | `clusterName` in config                       |
| Auto port allocation                         | ✅     | `config.registryPort` fallback                |
| `patch` escape hatch                         | ✅     | deep-merges onto Deployment                   |
| TCP healthchecks                             | ✅     | `tcp` probe type                              |
| HTTP healthchecks                            | ✅     | `/<path>` probe type                          |
| Coverage ≥ 50%                               | ✅     | 51.04% statements                             |
| CI (GitHub Actions)                          | ✅     | `format:check`, `test`, `build`               |
| Landing page                                 | ✅     | `docs/index.html` + `docs/features.html`      |

---

## Remaining Gaps (Not in Scope for This Delivery)

1. **Coverage gaps** — `src/utils/exec.ts` (~22%), `src/utils/container-runtime.ts` (~23%), `src/core/wait-deps.ts` (0%), `src/types/index.ts` (0%).
2. **E2E tests** — Currently fixture-based. No live k3d cluster tests in CI (would require Docker-in-Docker).
3. **Versioning automation** — See "Versioning" section above.
4. **Windows support** — Not explicitly tested; some path handling assumes POSIX.
5. **Railpack interface** — The exact CLI flags should be re-verified against the latest railpack release.
