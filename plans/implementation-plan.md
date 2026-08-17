# Kustron — Implementation Plan

## Vision

A CLI tool that gives anyone a fully working local Kubernetes setup in minutes:
spin up a k3d cluster, deploy an app from a local folder or git repo, with optional HA/HPA support.
The cluster runs one server and two agent nodes with a built-in container registry.

---

## CLI Interface

```
kustron cluster up           # spin up k3d + local registry + set kubectl context
kustron cluster down         # tear down
kustron cluster status       # show cluster info + deployed apps

# local path e.g. ./ or git SSH URL (if git SSH URL, SSH access must already be set up)
kustron deploy <source>
  --name <app-name>
  --port <port>
  --replicas <n>
  --ha                       # enables HPA + multiple replicas
  --env KEY=VALUE            # repeatable, creates configmap

kustron undeploy <app-name>  # remove deployment
```

---

## Tech Stack

| Concern          | Choice              | Reason                                              |
|------------------|---------------------|-----------------------------------------------------|
| Language         | TypeScript          | Type safety for complex orchestration logic         |
| CLI framework    | `commander` v12     | Familiar, modern API                                |
| Interactive prompts | `@clack/prompts` | Modern, better UX than inquirer                     |
| Shell commands   | `execa` v9          | Async, typed, cross-platform                        |
| Progress display | `listr2`            | Task lists with subtasks — great for pipelines      |
| Logging/color    | `chalk` v5          | Keep familiar                                       |
| K8s manifests    | Programmatic + `js-yaml` | No string templates; JS objects → YAML         |

---

## Project Structure

```
src/
├── bin/
│   └── kustron.ts              # entry point, commander root
├── commands/
│   ├── cluster/
│   │   ├── up.ts               # cluster up command handler
│   │   ├── down.ts             # cluster down command handler
│   │   └── status.ts           # cluster status command handler
│   ├── deploy.ts               # deploy command handler
│   └── undeploy.ts             # undeploy command handler
├── core/
│   ├── cluster.ts              # k3d cluster create/delete/inspect
│   ├── registry.ts             # local registry lifecycle (created via k3d flag)
│   ├── context.ts              # kubeconfig context management
│   ├── source.ts               # local path validation + git SSH clone
│   ├── build.ts                # dockerfile detection + railpack fallback + docker build
│   ├── push.ts                 # docker tag + push to local registry
│   ├── manifest.ts             # programmatic K8s manifest generation
│   └── apply.ts                # kubectl apply/delete
├── utils/
│   ├── exec.ts                 # execa wrapper with logging
│   ├── checks.ts               # prerequisite detection (k3d/kubectl/docker/railpack/git)
│   └── logger.ts               # chalk-based logger
├── types/                      # all shared TypeScript interfaces (see coding-guidelines.md)
│   └── index.ts
└── translations/
    └── en.json                 # all user-facing text, commands, messages
```

---

## Phase 1 — Project Scaffold + Cluster Commands

**Goal:** `kustron cluster up/down/status` fully working.

### Tasks

1. Init TypeScript project: `tsconfig.json`, `package.json` (bin, scripts, deps), `.eslintrc`, `prettier`, `tsup` for bundling
2. `src/utils/logger.ts` — chalk-based `info/success/warn/error/step` helpers
3. `src/utils/exec.ts` — thin execa wrapper; streams output when `--verbose`, captures otherwise; throws with readable error on non-zero exit
4. `src/utils/checks.ts` — checks whether `k3d`, `kubectl`, `docker`, `git`, `railpack` are on PATH; warns/errors appropriately per command
   - This module is also invoked as a **postinstall script** (`package.json` `"postinstall"` hook) so checks run immediately after `npm i -g kustron`
   - For each missing dependency, print the name, what it's needed for, and the exact install command/URL:
     | Dependency | Required for | Install hint |
     |---|---|---|
     | `docker` / OrbStack | All commands | Recommend OrbStack over Docker Desktop (see note below) |
     | `k3d` | `cluster` commands | `brew install k3d` or https://k3d.io/installation |
     | `kubectl` | All commands | `brew install kubectl` |
     | `railpack` | `deploy` (no Dockerfile) | https://railpack.io |
     | `git` | `deploy <git-url>` | Usually pre-installed |
   - Missing optional deps (railpack, git) are warnings; missing required deps (docker, k3d, kubectl) are hard errors that exit non-zero
5. `src/core/cluster.ts`:
   - `createCluster(opts)` — runs:
     ```
     k3d cluster create kustron \
       --agents 2 \
       --registry-create kustron-registry:0.0.0.0:5000 \
       --port "8080:80@loadbalancer" \
       --port "8443:443@loadbalancer" \
       --wait
     ```
   - `deleteCluster(name)` — `k3d cluster delete <name>`
   - `getClusterInfo(name)` — `k3d cluster list -o json`, parse and return
6. `src/core/context.ts`:
   - `importKubeconfig(clusterName)` — `k3d kubeconfig merge <name> --kubeconfig-merge-default`
   - `setCurrentContext(clusterName)` — `kubectl config use-context k3d-<name>`
   - `getCurrentContext()` — `kubectl config current-context`
7. `src/commands/cluster/up.ts` — wires: checks → createCluster → importKubeconfig → setCurrentContext → success with next steps
8. `src/commands/cluster/down.ts` — wires deleteCluster, optionally cleans kubeconfig entry
9. `src/commands/cluster/status.ts` — shows cluster nodes, registry endpoint, current kubectl context, deployed apps
10. `src/bin/kustron.ts` — commander root, registers `cluster up/down/status` subcommands

### Deliverable
`kustron cluster up` spins up k3d with 1 server + 2 agents + local registry on port 5000, merges kubeconfig, sets context. `kubectl get nodes` works immediately after.

---

## Phase 2 — Deploy from Local Source

**Goal:** `kustron deploy ./my-app --name myapp --port 3000` fully working.

### Tasks

1. `src/core/source.ts`:
   - `resolveLocalSource(path)` — validates path exists and is a directory, returns absolute path
   - `isGitUrl(input)` — detects `git@` or `https://` patterns
2. `src/core/build.ts`:
   - `detectBuildStrategy(sourcePath)` → `'dockerfile' | 'railpack'`
   - `buildImage(sourcePath, imageTag, strategy)`:
     - Dockerfile: `docker build -t <imageTag> <sourcePath>`
     - railpack: `railpack build <sourcePath> --tag <imageTag>` (verify actual CLI flags with `railpack build --help`)
3. `src/core/push.ts`:
   - `tagForLocalRegistry(appName, version)` → `k3d-kustron-registry:5000/<appName>:<version>`
   - `pushImage(fullTag)` — `docker push <fullTag>`
   - Note: k3d injects `k3d-kustron-registry` into `/etc/hosts` on both host and cluster nodes automatically
4. `src/core/manifest.ts` — generates K8s resource objects (plain JS objects), serialized to YAML via `js-yaml`:
   - `buildNamespace(name)` → `v1/Namespace`; skipped entirely when `--ns` is provided (namespace assumed to already exist)
   - `buildDeployment(opts)` → `apps/v1/Deployment` with image, port, envVars, replicas, resource defaults
   - `buildService(opts)` → `v1/Service` (ClusterIP by default, NodePort if `--expose`)
   - `buildHPA(opts)` → `autoscaling/v2/HorizontalPodAutoscaler`
5. `src/core/apply.ts`:
   - `applyManifests(manifestYaml)` — pipes YAML string to `kubectl apply -f -` via execa `input` option (no temp files)
   - `deleteApp(appName)` — `kubectl delete namespace <appName>`
6. `src/commands/deploy.ts` — full pipeline using `listr2`:
   ```
   ✓ Resolving source
   ✓ Checking cluster is up
   ✓ Detecting build strategy (Dockerfile found)
   ✓ Building image
   ✓ Pushing to local registry
   ✓ Generating manifests
   ✓ Applying to cluster
   ✓ Waiting for rollout
   ```
   Ends with: `App available at http://localhost:8080`

### Deliverable
Full local deploy pipeline working end-to-end.

---

## Phase 3 — Deploy from Git Repo

**Goal:** `kustron deploy git@github.com:user/repo.git --name myapp --port 3000` working.

### Tasks

1. Extend `src/core/source.ts`:
   - `cloneRepo(sshUrl, targetDir)` — `git clone <url> <targetDir>`
   - `resolveGitSource(sshUrl)` — clones to `os.tmpdir()/kustron-<timestamp>`, returns absolute path; cleaned up after deploy (opt out with `--keep-source`)
2. Extend `src/commands/deploy.ts` to detect git URL and prepend clone step to the listr2 task list

### Deliverable
Git SSH deploy working with same pipeline as local source.

---

## Phase 4 — HA Mode + HPA

**Goal:** `--ha` flag enables HPA and sets meaningful replica/resource defaults.

### Tasks

1. Extend `buildDeployment()` to accept `minReplicas`, `maxReplicas`, resource requests/limits
2. Implement `buildHPA()` in `manifest.ts`:
   - CPU target utilization: 70%
   - Memory target utilization: 80%
   - Scales between `minReplicas` (default 2 with `--ha`) and `maxReplicas` (default 10)
3. Default resource requests/limits (required for HPA to work):
   - CPU: request `100m`, limit `500m`
   - Memory: request `128Mi`, limit `512Mi`
   - Overridable via `--cpu-request`, `--cpu-limit`, `--memory-request`, `--memory-limit`
4. `--ha` flag sets `minReplicas: 2` and includes HPA in generated manifests
5. `--replicas <n>` sets initial/minimum replica count

### Note on metrics-server
k3d does not include metrics-server by default. `cluster up` should install it automatically:
```
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```
Then patch the deployment to add `--kubelet-insecure-tls` (required for k3d's self-signed certs).

### Deliverable
`kustron deploy ./app --name myapp --port 3000 --ha` deploys with 2 replicas and a working HPA.

---

## Phase 5 — Undeploy + Polish

**Goal:** Clean removal and good overall DX.

### Tasks

1. `src/commands/undeploy.ts`:
   - Confirms with `@clack/prompts` before deleting
   - `kubectl delete namespace <appName>`
   - Shows remaining deployments after deletion
2. Error handling polish — actionable messages for common failure modes:
   - Cluster not up → "Run `kustron cluster up` first"
   - Registry unreachable → check `/etc/hosts` for `k3d-kustron-registry`
   - railpack not installed → show install URL
   - Docker not running → clear message
3. `--verbose` global flag: streams all shell command output
4. README: installation, prerequisites (k3d, kubectl, docker, optional railpack), quickstart

---

## Key Technical Notes

### OrbStack over Docker Desktop
Recommend OrbStack (https://orbstack.dev) as the Docker runtime instead of Docker Desktop. It starts in ~2 seconds vs 30+ seconds, uses significantly less memory and CPU, and provides native Apple Silicon support. The postinstall check should detect which runtime is present — if neither is installed, show OrbStack as the primary recommendation with Docker Desktop as the fallback.

### postinstall check implementation
The `postinstall` script in `package.json` must be lightweight and never hard-crash npm's install process. Structure it as:
```json
"scripts": {
  "postinstall": "node dist/scripts/postinstall.js"
}
```
The script prints a formatted dependency table, exits 0 even when optional deps are missing, but exits 1 (with a clear message) only when required deps (docker, k3d, kubectl) are all absent — to avoid false failures in CI where the package might be installed as a dep.

### k3d registry hostname
k3d injects `k3d-kustron-registry` into `/etc/hosts` pointing to `localhost:5000`. Images must be tagged as `k3d-kustron-registry:5000/<name>:<tag>` when pushing from the host. The same tag is used inside K8s manifests — k3d patches the cluster nodes' `/etc/hosts` automatically.

### Manifest generation
Use `js-yaml` to serialize JS objects to YAML strings. Never use string templates for manifests.
Multiple documents separated by `---\n` can be piped together to `kubectl apply -f -`.

### kubectl apply via stdin
Use execa's `input` option to pipe the manifest YAML string directly — no temp files needed:
```ts
await execa('kubectl', ['apply', '-f', '-'], { input: manifestYaml })
```

### Namespace isolation
By default each deployed app gets its own namespace named after `--name`, keeping apps isolated and making undeploy clean (delete the namespace). When `--ns <namespace>` is passed, the deploy targets that existing namespace instead — no namespace manifest is generated or applied. `undeploy` in this case deletes only the app's Deployment, Service, and HPA by label selector, not the entire namespace.

---

## Suggested Agent Task Breakdown

| Agent   | Phases                          | Prerequisite         |
|---------|---------------------------------|----------------------|
| Agent 1 | Phase 1 (scaffold + cluster)    | This plan            |
| Agent 2 | Phase 2 (local deploy pipeline) | Phase 1 complete     |
| Agent 3 | Phase 3 (git deploy)            | Phase 2 complete     |
| Agent 4 | Phase 4 + 5 (HA/HPA + polish)  | Phase 2+3 complete   |
