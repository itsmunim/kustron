# Kustron — Agent Skill Reference

## Project Overview

Kustron is a CLI tool that provides "Docker Compose for Kubernetes" — local development environments using a single declarative YAML file (`kustron-env.yaml`). It wraps k3d (k3s in Docker), kubectl, helm, and container runtimes into a simplified workflow.

**Key principle:** Kustron should be simpler than Tilt, lighter than Garden, and **never break the user's production kubectl context**.

## Architecture

```
src/
  bin/kustron.ts          # CLI entry point (commander.js)
  commands/               # CLI command handlers
    env/                  # env up, down, stop, reload, status
    app/                  # app stop, start, logs
    cluster/              # cluster destroy
    registry/             # registry login, prune
  core/                   # Business logic
    kubectl.ts            # Scoped kubectl/helm wrappers (NEVER mutate global context)
    cluster.ts            # k3d cluster lifecycle
    context.ts            # kubeconfig management (merge only, never use-context)
    deployer.ts           # Build + deploy orchestration
    apply.ts              # kubectl apply, rollout wait, cleanup
    manifest.ts           # K8s manifest builders (Deployment, Service, HPA, ConfigMap, Secret)
    helm.ts               # Helm install/upgrade with image injection
    build.ts              # Dockerfile or Railpack builds
    push.ts               # Push to local registry
    hash.ts               # Content-hash for idempotency
    source.ts             # Local path or git URL resolution (cached in ~/.kustron/git-cache)
    components.ts         # Component expansion (multi-app bundles)
    deps.ts               # Topological sort, ${var} interpolation
    wait-deps.ts          # Dependency wait strategies
    state.ts              # Track deployed apps for pruning
    registry-gc.ts        # Registry garbage collection
  utils/                  # Utilities
    exec.ts               # Shell execution wrapper (verbose-safe)
    logger.ts             # Structured logging
    checks.ts             # Dependency availability checks
    port.ts               # Available port detection
    merge.ts              # Deep merge utilities
    image.ts              # Docker image reference parser
    container-runtime.ts  # docker/podman detection
  types/index.ts          # Shared TypeScript types
  core/env-file.ts        # YAML parsing and validation (zod schemas)
```

## Key Conventions

1. **Never call `kubectl config use-context`.** All kubectl/helm calls go through `src/core/kubectl.ts` which injects `--context=k3d-{clusterName}` or `--kube-context=k3d-{clusterName}`.

2. **Scoped execution.** Every function that talks to a cluster receives `clusterName: string` as a parameter. No global cluster state.

3. **Idempotent builds.** Source directories are hashed (excluding `.git`, `node_modules`, `dist` is now included). Identical source = skipped build.

4. **zod strict schemas.** Both `envFileSchema` and `appEntrySchema` use `.strict()`. Unknown keys in `kustron-env.yaml` are rejected with a clear error.

5. **Secrets go in `env.secret:` not `env:`**. The `secret` field creates K8s Secrets mounted via `envFrom.secretRef`. Never put passwords in `env:` (ConfigMap).

## Common Operations

### Build
```bash
npm run build        # tsup bundles bin/kustron.ts → dist/bin/kustron.js
```

### Run locally
```bash
npm run build
node dist/bin/kustron.js env up
```

### Adding a new CLI command
1. Create handler in `src/commands/<group>/<command>.ts`
2. Import and register in `src/bin/kustron.ts` using commander.js
3. Read clusterName from `envFile.config?.clusterName ?? 'kustron'`
4. Use `kubectl()` or `helm()` wrappers from `src/core/kubectl.ts`

### Adding a new env file field
1. Add to `AppEntry` type in `src/types/index.ts`
2. Add to `appEntrySchema` in `src/core/env-file.ts`
3. Use `.strict()` on the schema — unknown keys are rejected
4. Consume in `src/core/deployer.ts` or `src/core/manifest.ts`

## Critical Pitfalls

- **Do NOT use `exec('kubectl', ...)` directly.** Always use `kubectl(clusterName, args)` from `src/core/kubectl.ts`.
- **Do NOT use `exec('helm', ...)` directly.** Always use `helm(clusterName, args)` from `src/core/kubectl.ts`.
- **Do NOT set `stdout: 'inherit'` in exec when verbose.** It breaks JSON consumers. Use the capture+stream approach in `src/utils/exec.ts`.
- **ConfigMap changes need pod restart.** The Deployment template includes a `kustron.dev/env-hash` annotation so env changes trigger rolling restarts.
- **Git sources are cached.** They live in `~/.kustron/git-cache/`. `cleanupSource()` skips deletion of cached repos.

## Testing Approach (not yet implemented)

When adding tests:
- Unit-test pure functions: `hashSourceDir`, `topoSortApps`, `interpolate`, `parseImageRef`, `injectImageValues`, `deepMerge`
- Mock `exec()` for command tests
- Use temporary directories for file-system tests
- E2E: use `examples/` fixtures with short-lived k3d clusters

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Scoped kubectl instead of kubeconfig copy | Simpler, no file mutation, explicit per-call |
| `env down` → `cluster destroy` | "down" sounded like stopping apps, not deleting infrastructure |
| `env reload` = `env stop` + `env up` | Preserves cluster, just restarts apps |
| NodePort + loadbalancer port mapping | Simplest cross-platform exposed service approach |
| Content-hash skip instead of timestamp | Deterministic, survives clock changes |
| Git cache in `~/.kustron/git-cache` | Avoids re-cloning, shared across projects |
| Registry GC via catalog API | Simple, doesn't require registry admin tools |
