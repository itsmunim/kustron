# Kustron — Holistic Remediation & Strategy Plan

> **Date:** 2026-01-13
> **Status:** Draft for review
> **Scope:** Safety, correctness, UX, competitive positioning, and agent readiness

---

## 1. Executive Summary

Kustron's stated value proposition is *"Docker Compose for Kubernetes — no K8s knowledge needed."* After reviewing the full codebase against external feedback and competitor analysis, the abstraction **leaks aggressively**:

- `patch`, `helm.selector`, `wait.type: established`, dotted `imageValues` paths — all require Kubernetes literacy.
- `env down` destroys the entire cluster, not just the apps.
- kubectl context is silently hijacked, creating a production safety risk.
- No logs, exec, port-forward, or file watch — the inner development loop is broken.

**Verdict:** Kustron is currently a YAML-driven kubectl wrapper with a local k3d cluster, not a genuine simplification layer. The edge over Tilt and Garden is supposed to be simplicity, but UX gaps make it harder in practice.

**The opportunity:** If Kustron fixes context safety and builds a fast inner loop, it becomes *"local dev environments that Just Work and Don't Break Your Production Context"* — a unique position neither Tilt nor Garden occupies.

---

## 2. Critical Issues — Validated & Prioritized

### 🔴 P0 — Data Loss / Safety

| # | Issue | Location | Severity | Root Cause |
|---|-------|----------|----------|------------|
| 1 | `env down` / `reload` destroys shared cluster | `src/commands/env/down.ts:21` | **Critical** | `k3d cluster delete kustron` hardcoded |
| 2 | kubectl context hijacking | `src/core/context.ts:17` | **Critical** | `kubectl config use-context kustron` |
| 3 | Every kubectl/helm call uses global context | `apply.ts`, `cluster.ts`, `helm.ts`, `deployer.ts` | **Critical** | No `--context` or `--kubeconfig` passed |
| 4 | Port 5000 conflict (macOS AirPlay) | `src/core/cluster.ts:11` | **Critical** | `REGISTRY_PORT = 5000` hardcoded |
| 5 | `--verbose` breaks `env up` | `src/utils/exec.ts:47` | **Critical** | Verbose output pollutes JSON parsing |
| 6 | Exposed URLs unreachable (Docker Desktop, podman) | `src/core/cluster.ts` | **Critical** | NodePort + container IP unreachable from host |
| 7 | Helm charts from repo fail | `src/core/helm.ts` | **Critical** | Non-absolute URLs need `repo_name/chart` format |
| 8 | Railpack builds need BuildKit | `src/core/build.ts` | **Critical** | `BUILDKIT_HOST` not set |
| 9 | podman push needs `--tls-verify=false` | `src/core/push.ts` | **Critical** | podman defaults to TLS verification |
| 10 | ConfigMap edits don't restart pods | `src/core/manifest.ts:87` | **High** | No rollout restart on env change |
| 11 | Removed apps keep running | `src/commands/env/up.ts` | **High** | No pruning of deleted apps |

### 🔴 P0 — Security

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 12 | Registry bound to `0.0.0.0` with no auth | **Critical** | Bind to `127.0.0.1`; add basic auth |
| 13 | Passwords in error output | **Critical** | Sanitize commands before logging |
| 14 | Secrets in plaintext ConfigMaps | **High** | Add `env.secret:` → K8s Secrets; `${ENV}` interpolation |
| 15 | Registry password committed in YAML | **High** | Move to `KUSTON_REGISTRY_PASSWORD` env var |

### 🟠 P1 — Core Functionality

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 16 | Components broken (`dependsOn` unprefixed) | `src/core/components.ts` | **High** |
| 17 | Clone deleted before build completes | `src/core/deployer.ts` | **High** |
| 18 | Component apps skip validation | `src/core/components.ts` | **High** |
| 19 | `instance` ignored by build-skip, Helm name, status | Multiple files | **High** |
| 20 | `ha: true` + `replicas` resets HPA | `src/core/manifest.ts` | **High** |
| 21 | Helm values shallow merge drops siblings | `src/core/helm.ts` | **High** |
| 22 | Image parsing breaks on `nginx`, digests, registry ports | `src/core/manifest.ts` | **High** |
| 23 | `source` hash skips `dist/` | `src/core/manifest.ts:175` | **High** |
| 24 | Git sources re-cloned every run | `src/core/deployer.ts` | **Medium** |
| 25 | Fixed temp dir blocks on crash | `src/core/deployer.ts` | **Medium** |
| 26 | `apps add` loses comments | `src/utils/file-utils.ts` | **Medium** |
| 27 | `A=x=y` truncated by `apps add` | `src/utils/file-utils.ts` | **Medium** |
| 28 | Port coercion: `"30x"` → `30` | `src/utils/yaml-utils.ts` | **Medium** |
| 29 | Unknown keys accepted | `src/types/index.ts` | **Medium** |

### 🟡 P2 — Performance & UX

| # | Issue | Severity |
|---|-------|----------|
| 30 | Strictly sequential deploy | **Medium** |
| 31 | No logs / exec / port-forward / watch | **Medium** |
| 32 | No inner development loop | **Medium** |
| 33 | No dry-run / preview | **Medium** |
| 34 | No build progress without `--verbose` | **Low** |
| 35 | Heavy defaults (2 agent nodes, 500m/512Mi limits) | **Low** |

### 🟢 P3 — Maintainability & Agent Readiness

| # | Issue | Severity |
|---|-------|----------|
| 36 | tsup builds with type errors | **High** |
| 37 | `npm ci` fails (lockfile out of sync) | **High** |
| 38 | No tests | **High** |
| 39 | No lint / format / test in CI | **High** |
| 40 | 20 code comments cite purged roadmap | **Low** |
| 41 | README claims falsehoods | **Medium** |
| 42 | `.claude/` gitignored → agent settings lost | **Medium** |
| 43 | Plan contradicts code (loadbalancer, timestamp tags, etc.) | **Medium** |

---

## 3. Competitive Analysis

### Tilt.dev (9.9k stars, Docker Inc.)

| Feature | Tilt | Kustron (Current) | Kustron (Target) |
|---------|------|-------------------|------------------|
| Config format | Tiltfile (Starlark DSL) | `kustron-env.yaml` (YAML) | ✅ Keep YAML |
| File watching | ✅ Built-in | ❌ Manual `reload` | ✅ Add `--watch` |
| Live update | ✅ Syncs into running container | ❌ Full rebuild + rollout | ✅ Live sync |
| Web UI | ✅ Rich dashboard | ❌ CLI table only | ✅ Local dashboard |
| K8s knowledge required | Medium | Low (leaky) | Low (fixed) |
| Multi-cluster | ✅ | ❌ Single hardcoded | ✅ Named clusters |
| Context safety | ⚠️ Warns, doesn't enforce | ❌ Hijacks silently | ✅ Scoped by design |
| Snapshots / sharing | ✅ | ❌ | `env snapshot` |

### Garden.io (Production-grade, Garden Cloud)

| Feature | Garden | Kustron (Current) | Kustron (Target) |
|---------|--------|-------------------|------------------|
| Config complexity | High (actions, workflows) | Low (single YAML) | ✅ Keep low |
| Team caching | ✅ | ❌ | Optional remote |
| Remote builders | ✅ | ❌ | Optional |
| CI/CD integration | ✅ First-class | ❌ None | `env up --ci` |
| Terraform/Pulumi | ✅ Native | ❌ None | Optional |
| Live sync | ✅ | ❌ | ✅ Add |
| Graph execution | ✅ Parallel, cached | Sequential | Parallel by level |

### Where Kustron Can Win

| Unique Selling Proposition | Why It Matters | Implementation |
|---------------------------|---------------|----------------|
| **Zero-K8s YAML** | Tiltfile = learn Starlark; Garden = learn actions/workflows | Keep YAML simple; eliminate `patch` for common cases |
| **Context safety** | Neither Tilt nor Garden prevents kubectl context accidents | Scoped `--context` + dedicated `KUBECONFIG` |
| **Single binary, no daemon** | Tilt runs a daemon; Garden runs a server | Keep as CLI; `--watch` spawns lightweight watcher |
| **Agent-generatable config** | YAML is simple enough for AI to produce reliably | Document schema; validate strictly |
| **Instant local environments** | `kustron env up` in 30s vs Garden's multi-minute | Single-node default; lazy image pulls |

---

## 4. Phased Remediation Plan

### Phase 1: Safety & Trust (Week 1–2)
**Goal: Stop destroying data and hijacking contexts.**

| # | Task | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 1.1 | Scoped kubectl/helm | `exec.ts`, `apply.ts`, `cluster.ts`, `helm.ts` | Every call uses `--context=k3d-{cluster}` |
| 1.2 | Remove `setContext()` | `context.ts` | Deleted; no `kubectl config use-context` anywhere |
| 1.3 | Named clusters | `cluster.ts`, `kustron-env.yaml` schema | `config.clusterName` supported; default = project dir name |
| 1.4 | Rename `env down` | `commands/env/down.ts`, CLI | `env down` → `cluster destroy`; add `env stop` (scale to 0) |
| 1.5 | Auto port allocation | `cluster.ts` | Registry and NodePort pick available ports |
| 1.6 | Fix `--verbose` | `exec.ts` | Separate stdout/stderr; use `--output=json` consistently |
| 1.7 | Registry security | `cluster.ts` | Bind to `127.0.0.1`; add `--registry-auth` option |
| 1.8 | Sanitize logs | `logger.ts`, `exec.ts` | Passwords stripped from error output |
| 1.9 | Fix exposure | `cluster.ts` | Use `k3d -p <port>@loadbalancer` mapping |
| 1.10 | Fix Helm repo refs | `helm.ts` | Non-absolute URLs use `repo_name/chart` format |

### Phase 2: Core Correctness (Week 3–4)
**Goal: Make the declared YAML actually match reality.**

| # | Task | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 2.1 | Track deployed state | `deployer.ts`, `apply.ts` | Server-side apply with `--prune -l managed-by=kustron` |
| 2.2 | Fix components | `components.ts`, `deployer.ts` | `dependsOn` resolved with prefix; clone survives until build done; component apps validated |
| 2.3 | Fix `instance` | `manifest.ts`, `deployer.ts`, `status.ts` | Included in hash key, Helm release name, status output |
| 2.4 | Fix Helm values merge | `helm.ts` | Deep merge `imageValues` |
| 2.5 | Fix image parsing | `manifest.ts` | Handle untagged, digested, port-containing refs |
| 2.6 | Fix `ha: true` | `manifest.ts` | Omit `replicas` when HPA enabled |
| 2.7 | ConfigMap rollout | `deployer.ts` | Trigger pod restart on env ConfigMap change |
| 2.8 | Secrets support | `manifest.ts`, schema | `env.secret:` → K8s Secret; `${ENV}` interpolation |
| 2.9 | Git source caching | `deployer.ts` | Cache clones; clean up on crash with temp dir + PID |
| 2.10 | Fix `source` hash | `manifest.ts` | Include `dist/` in hash; respect `.dockerignore` |

### Phase 3: Developer Experience (Week 5–6)
**Goal: Close the gap with Tilt's inner loop.**

| # | Task | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 3.1 | `kustron env plan` | New command | Dry-run showing diff against current cluster state |
| 3.2 | `kustron logs <app>` | New command | Stream logs; `-f` for follow; `--all` for all apps |
| 3.3 | `kustron exec <app> -- <cmd>` | New command | Shell into running container |
| 3.4 | `kustron forward <app> <local>:<remote>` | New command | Port-forward to service |
| 3.5 | `kustron env up --watch` | `deployer.ts`, new watcher | File watcher; auto-rebuild on change |
| 3.6 | Live sync | New module | For Node/Python/Go: sync files into running container without rebuild |
| 3.7 | Build progress | `deployer.ts`, `build.ts` | Show steps by default; `--quiet` to suppress |
| 3.8 | First-run wizard | New command | `kustron init` scaffolds `kustron-env.yaml` interactively |

### Phase 4: Speed & Scale (Week 7–8)
**Goal: Deploy fast, work in teams.**

| # | Task | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 4.1 | Parallel deploy | `deployer.ts` | Group by dependency level; deploy each level in parallel |
| 4.2 | Registry GC | New module | Prune old content-hash images on `env reload` |
| 4.3 | Deterministic builds | `manifest.ts`, `deployer.ts` | Pin git refs; honor `.dockerignore` |
| 4.4 | Hook failures | `deployer.ts` | Remove `{reject: false}` or add `hooks.failOnError` toggle |
| 4.5 | Graceful shutdown | `bin/kustron.ts` | SIGINT handler cleans up temp dirs; offers rollback |
| 4.6 | Team sharing | New commands | `kustron env snapshot` / `import` with lockfile |
| 4.7 | CI mode | `deployer.ts` | `env up --ci`: deterministic, no prompts, proper exit codes |

### Phase 5: Quality & Agent Readiness (Ongoing)
**Goal: Professional codebase that agents can extend safely.**

| # | Task | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 5.1 | Type safety | All | `tsc --noEmit` passes; added to CI |
| 5.2 | Unit tests | `tests/` | Tests for all pure functions (manifest builders, topoSort, merge, interpolate) |
| 5.3 | E2E tests | `tests/e2e/` | Harness with example env; runs in CI |
| 5.4 | CI/CD pipeline | `.github/workflows/` | Lint, typecheck, test, build on PR |
| 5.5 | Lockfile sync | `package-lock.json` | `npm ci` passes; enforced in CI |
| 5.6 | Documentation | `README.md`, `CLAUDE.md` | Rewrite README to match code; add agent instructions |
| 5.7 | Coding standards | `CONTRIBUTING.md` | No type declarations outside `src/types/`; strict lint rules |
| 5.8 | Audit stale comments | All | Delete or update comments referencing purged roadmap |
| 5.9 | Single source of truth | `plans/` | Update implementation plan to match code; or update code |

---

## 5. UX Improvements — Detailed

### Immediate Wins (Phase 1–2)

1. **Clearer command semantics**
   - `env up` — create or update environment
   - `env stop` — scale all deployments to 0 (keep cluster)
   - `env down` — scale to 0 (alias for `stop`)
   - `env destroy` — delete the k3d cluster and all data
   - `env reload` — rebuild and redeploy changed apps

2. **Sensible error messages**
   - Instead of `Unexpected end of JSON input` → `"Cluster 'myapp' already exists. Run 'kustron env up' to use it, or 'kustron cluster destroy' to recreate."`
   - Instead of silent hook failure → `"Post-deploy hook 'migrate' failed with exit code 1. Run with --verbose for details."`

3. **Progress indicators**
   - Build: `[1/3] Building api...`, `[2/3] Pushing api...`, `[3/3] Waiting for api...`
   - Deploy: `api ✓`, `postgres ✓`, `redis ✗ (ImagePullBackOff)`

4. **`env status` as a live dashboard**
   - Refreshable (`--watch`)
   - Pod health + recent events
   - Exposed URLs as clickable links
   - Color-coded status (green/yellow/red)

### Medium-Term (Phase 3–4)

5. **Web dashboard** — `kustron dashboard` opens a local web UI (or TUI with `blessed`)
   - Services list with health
   - Log streaming per service
   - Rebuild status
   - Dependency graph visualization

6. **Service dependency graph** — `kustron env graph` outputs ASCII or Mermaid diagram

7. **One-command database setup**
   ```bash
   kustron apps add --image postgres:15 --port 5432
   # Auto-creates app + volume + healthcheck + wait condition
   ```

8. **Environment parity** — `kustron env snapshot` exports exact state; `kustron env restore` recreates it

### Long-Term (Phase 5+)

9. **IDE integration** — VS Code extension showing Kustron status, one-click restart, log panels
10. **GitHub Codespaces / Dev Containers** — Pre-configured container with Kustron + k3d
11. **Cloud environments** — `kustron env up --remote` for cloud-based k3s clusters

---

## 6. Agent Readiness — Specific Actions

Kustron was planned for agent generation but doesn't currently support it. Fix:

1. **Build must fail on type errors** — Add `npm run typecheck` = `tsc --noEmit`
2. **Add `CLAUDE.md`** at repo root with:
   - Project overview and architecture
   - How to run tests
   - Common pitfalls
   - Coding standards
3. **Add example fixtures** — `examples/nodejs-postgres/kustron-env.yaml` for agent testing
4. **Add dry-run mode** — `kustron env plan` so agents verify changes without a cluster
5. **Commit agent instructions** — Create `.keen/` or `.cursor/` with shared prompts; do not gitignore
6. **Tests as guardrails** — Every pure function gets unit tests for immediate agent feedback
7. **Single source of truth** — Implementation plan must match code exactly

---

## 7. Success Metrics

| Metric | Current | 4-Week Target | 8-Week Target |
|--------|---------|---------------|---------------|
| `env up` time (cold) | ~60s | ~30s | ~20s |
| `env up` time (warm, no changes) | ~30s | ~5s | ~3s |
| Inner loop (code change → running) | Manual `reload` | `env up --watch` | Live sync (<5s) |
| Context safety | ❌ Hijacks | ✅ Scoped | ✅ Dedicated kubeconfig |
| Data loss risk | High (`env down`) | Medium (renamed) | Low (pruning + stop) |
| Test coverage | 0% | 30% (pure functions) | 60% (pure + e2e) |
| CI passes | ❌ | ✅ Lint + typecheck | ✅ Full suite |

---

## 8. Open Questions

1. Should Kustron support remote clusters (EKS, GKE, DOKS) or stay local-only? - local only.
2. Should Kustron integrate with Terraform/Pulumi for infrastructure, or stay app-focused? - stay app focused.
3. Should Kustron build a web UI (like Tilt) or a TUI (terminal UI) first? - no, just a TUI to show interactive state, and the overall graph. 
4. Should Kustron support Docker Compose migration (`docker-compose.yml` → `kustron-env.yaml`)? - no.
5. Should Kustron charge for team/enterprise features, or stay fully open-source? - fully oss.

---

*End of plan.*
