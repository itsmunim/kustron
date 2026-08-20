# Kustron — Implementation Plan v2

## Vision

A single CLI tool that takes you from "I have some applications" to a fully running, locally-accessible Kubernetes environment — with no Kubernetes knowledge required.

The central primitive is `kustron-env.yaml`, which works like a `docker-compose.yml` but targets a real local Kubernetes cluster. Apps can come from a local folder, a git repo, an existing container image, or a Helm chart. Everything runs in one shared namespace. Apps can reach each other by name over HTTP. Exposed apps are accessible on `localhost:<port>`.

The cluster is hidden from the user — there are no cluster commands. The environment either exists or it doesn't. When the yaml changes, `kustron env reload` picks up the changes.

---

## CLI Commands

```
kustron env init                       # create kustron-env.yaml in current folder
kustron env up                         # bring up the environment and deploy all apps
kustron env down                       # tear everything down
kustron env reload                     # down + up (pick up any yaml changes)
kustron env show-spec                  # pretty-print the kustron-env.yaml schema

kustron apps add [flags]               # add a new app entry to kustron-env.yaml
kustron apps remove <name>             # remove an app entry from kustron-env.yaml
```

`apps add` and `apps remove` are yaml-manipulation commands only — they do not touch the running environment. After either command, run `kustron env reload` to apply the change. Alternatively, edit `kustron-env.yaml` directly and run `kustron env reload` — the result is identical.

---

## `kustron env init`

Creates a `kustron-env.yaml` in the current working directory with a single pre-filled app entry:

- `name`: current folder name converted to kebab-case
- `source: ./`
- `port: PORT` (literal placeholder string — intentionally invalid so the user must set it before running)
- `exposed: false`

If `kustron-env.yaml` already exists: exit with error "kustron-env.yaml already exists. Edit it directly or use `kustron apps add` to add apps."

Example output for a folder named `my checkout service`:

```yaml
config:
  namespace: kustron-env

apps:
  - name: my-checkout-service
    source: ./
    port: PORT        # replace with the port your app listens on
    exposed: false
```

---

## `kustron apps add` flags

| Flag | Description |
|---|---|
| `--name <name>` | App name (required) |
| `--source <path\|url>` | Local path or git SSH/HTTPS URL |
| `--image <image>` | Existing container image (e.g. `postgres:15`) |
| `--helm-chart <name>` | Helm chart name |
| `--helm-repo <url>` | Helm chart repository URL |
| `--helm-version <ver>` | Helm chart version |
| `--port <n>` | Port the app listens on (required for source/image) |
| `--healthcheck <path>` | Healthcheck path (default: `/`) |
| `--exposed` | Make app accessible at `localhost:<port>` |
| `--replicas <n>` | Replica count (default: 1) |
| `--ha` | HA mode: min 2, max 5 replicas, CPU 90%, mem 80% |
| `--env KEY=VALUE` | Environment variable (repeatable) |

After writing to the file, always print:
```
App '<name>' added to kustron-env.yaml.
Run `kustron env reload` to apply changes.
```

## `kustron apps remove <name>`

Removes the named app entry from `kustron-env.yaml`. Does not touch the running environment.

After removing, always print:
```
App '<name>' removed from kustron-env.yaml.
Run `kustron env reload` to apply changes.
```

Errors if the name is not found in the file.

---

## kustron-env.yaml Schema

```yaml
# Optional top-level config block
config:
  namespace: kustron-env   # default; all apps share this namespace

apps:

  # --- Type 1: Source build (local path or git SSH/HTTPS URL) ---
  - name: api
    source: ./services/api              # local path OR git@github.com:user/repo.git
    port: 3000                          # required
    healthcheck: /health                # optional, defaults to /
    exposed: true                       # accessible at localhost:3000
    replicas: 1                         # ignored when ha: true
    ha: false                           # min 2 / max 5 / cpu 90% / mem 80%
    env:
      NODE_ENV: production
      DB_HOST: postgres                 # 'postgres' resolves to the postgres app's service

  # --- Type 2: Existing container image ---
  - name: postgres
    image: postgres:15
    port: 5432                          # required
    healthcheck: /                      # optional
    exposed: false
    env:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp

  # --- Type 3: Helm chart ---
  - name: prometheus
    helm:
      chart: kube-prometheus-stack
      repo: https://prometheus-community.github.io/helm-charts
      version: "45.0.0"
      values:                           # passed as helm --set flags
        grafana.enabled: "true"
        alertmanager.enabled: "false"
      selector:                         # required when exposed: true for helm apps
        app.kubernetes.io/name: grafana
    exposed: false
```

### Schema rules

| Rule | Detail |
|---|---|
| Exactly one of `source`, `image`, `helm` | Required per app entry |
| `port` | Required for `source` and `image`; optional for `helm` |
| `healthcheck` | Optional for `source` and `image`; ignored for `helm` |
| `ha: true` | Overrides `replicas`; sets min 2 / max 5 / CPU 90% / mem 80% |
| `env` | Creates a ConfigMap for `source` and `image`; for `helm` values are passed as `--set` |
| `exposed: true` | Service becomes `LoadBalancer` type; requires `port` |
| `helm.selector` | Required when `helm` app has `exposed: true`; must match the chart's pod labels |
| `name` | Becomes the Kubernetes Service name — other apps reach it at `http://<name>:<port>` |
| `port: PORT` | The string `PORT` is treated as an unset placeholder; validation fails with a clear message |

---

## `kustron env show-spec`

Pretty-prints the full schema as a human-readable reference. Output format: chalk-colored YAML with inline comment annotations (mirroring the annotated example above). Does not require the environment to be running. No external deps needed — reads directly from the schema definition.

---

## Architecture

### Namespace

All apps deploy into a single namespace (default: `kustron-env`). This enables direct service-to-service DNS: `api` is reachable at `http://api:3000` from within any other app in the environment.

### Port exposure

k3d maps host ports into the cluster's load balancer **at cluster creation time**. `kustron env up` reads `kustron-env.yaml` (if it exists) and maps `--port <port>:<port>@loadbalancer` for every app with `exposed: true`. No mismatch detection or auto-recreation logic is needed — when the yaml changes (e.g., adding a new exposed app), the user runs `kustron env reload`, which tears down and recreates the cluster with the updated port set.

Traffic flow for an exposed app on port 3000:
```
localhost:3000
  → k3d lb container (mapped at cluster creation)
    → k3d node (klipper-lb DaemonSet, built into k3s)
      → Service type LoadBalancer, port 3000
        → Deployment pods (kube-proxy load balances across replicas)
```

In a VM, `0.0.0.0:<port>` is bound, so the VM's public IP works directly.

### Load balancing

Kubernetes `Service` type `LoadBalancer` distributes traffic across all pods via kube-proxy round-robin. No extra configuration needed. HA mode (multiple replicas) is fully load-balanced automatically.

### Helm

Helm charts install into `kustron-env` namespace via:
```
helm upgrade --install <name> <chart>
  --repo <repo>
  --namespace kustron-env
  --create-namespace
  [--version <version>]
  [--set key=value ...]
  --wait
```

Helm is installed as part of `kustron env up` bootstrapping if not already present.

---

## Project Structure

```
src/
├── bin/
│   └── kustron.ts              # commander root — registers env + apps subcommands
├── commands/
│   ├── env/
│   │   ├── init.ts             # create kustron-env.yaml template
│   │   ├── up.ts               # create cluster + deploy all apps from yaml
│   │   ├── down.ts             # delete cluster + all resources
│   │   ├── reload.ts           # down + up
│   │   └── show-spec.ts        # pretty-print schema
│   └── apps/
│       ├── add.ts              # append app entry to kustron-env.yaml
│       └── remove.ts           # remove app entry from kustron-env.yaml
├── core/
│   ├── cluster.ts              # k3d lifecycle: create, delete, exists
│   ├── context.ts              # kubeconfig merge + context switch
│   ├── env-file.ts             # parse, validate, generate kustron-env.yaml
│   ├── source.ts               # local path resolution + git clone
│   ├── build.ts                # dockerfile detection, railpack fallback, docker build
│   ├── push.ts                 # tag + push to local registry
│   ├── manifest.ts             # programmatic K8s manifest generation (js-yaml)
│   ├── apply.ts                # kubectl apply/delete/rollout status
│   └── helm.ts                 # helm install/uninstall
├── scripts/
│   └── postinstall.ts          # dependency check run after npm i -g kustron
├── utils/
│   ├── exec.ts                 # execa wrapper (verbose/capture modes)
│   ├── checks.ts               # PATH detection: k3d/kubectl/docker/helm/git/railpack
│   └── logger.ts               # chalk info/success/warn/error/step + t() helper
├── types/
│   └── index.ts                # all shared interfaces
└── translations/
    └── en.json                 # all user-facing strings
```

---

## Phase 1 — Scaffold + `kustron env init/up/down/reload/show-spec`

**Goal:** All five `env` subcommands working. Cluster comes up, kubectl context is set.

### Tasks

1. **Project init**
   - `package.json`: name `kustron`, bin `./dist/bin/kustron.js`
   - Scripts: `build` (tsup), `dev` (tsx watch), `postinstall` (`node dist/scripts/postinstall.js`)
   - `tsconfig.json`: strict, ES2022, NodeNext module
   - `tsup.config.ts`: separate entry points for `src/bin/kustron.ts` and `src/scripts/postinstall.ts`
   - `.eslintrc`, `.prettierrc`
   - Runtime deps: `commander`, `@clack/prompts`, `execa`, `listr2`, `chalk`, `js-yaml`, `zod`
   - Dev deps: `typescript`, `tsup`, `tsx`, `vitest`, `@types/node`, `@types/js-yaml`

2. **`src/utils/logger.ts`**
   - `info`, `success`, `warn`, `error`, `step` — chalk-colored output
   - `t(key: string, vars?: Record<string, string>)` helper: loads `en.json`, resolves dot-notation key, substitutes `{{var}}` placeholders

3. **`src/utils/exec.ts`**
   - `exec(cmd, args, opts?)` — wraps execa
   - `opts.input`: string piped to stdin (for `kubectl apply -f -`)
   - When global `--verbose` is active: inherits stdio (live output)
   - Otherwise: captures, returns `{ stdout, stderr }`; throws `KustronExecError` on non-zero exit with captured stderr

4. **`src/utils/checks.ts`**
   - `checkDependency(name: string)` → `{ present: boolean, path?: string }`
   - `checkAll(required: string[], optional: string[])`: prints dependency table, throws `KustronDepsError` if any required dep is missing
   - Required always: `docker`, `k3d`, `kubectl`
   - Required when helm apps present: `helm`
   - Optional: `railpack`, `git`

5. **`src/scripts/postinstall.ts`**
   - Calls `checkAll` with required = `[docker, k3d, kubectl]`, optional = `[railpack, git, helm]`
   - Docker check: looks for `docker` binary or `orbstack` binary; if neither, recommends OrbStack first with install URL, Docker Desktop as fallback
   - Prints a formatted table: dependency name, status (✓ / ✗), install hint for missing
   - Exits 0 for missing optional deps; exits 1 only when all three required deps are absent (avoids false failures when installed as a package dep in CI)

6. **`src/types/index.ts`**
   ```ts
   export interface AppEntry {
     name: string
     source?: string
     image?: string
     helm?: HelmConfig
     port?: number
     healthcheck?: string
     exposed?: boolean
     replicas?: number
     ha?: boolean
     env?: Record<string, string>
   }
   export interface HelmConfig {
     chart: string
     repo?: string
     version?: string
     values?: Record<string, string>
     selector?: Record<string, string>
   }
   export interface EnvFile {
     config?: { namespace?: string }
     apps: AppEntry[]
   }
   export interface ClusterConfig {
     name: string
     namespace: string
     exposedPorts: number[]
   }
   export interface DeployContext {
     namespace: string
     registryHost: string
     clusterName: string
     verbose: boolean
   }
   ```

7. **`src/core/env-file.ts`**
   - Zod schema enforcing all rules from the schema table above, including: exactly one of source/image/helm, port required for source/image, `PORT` placeholder detected and rejected with a clear message pointing to the offending app
   - `parseEnvFile(filePath)` → `EnvFile`
   - `getExposedPorts(envFile)` → `number[]`
   - `appendApp(filePath, entry: AppEntry)` → writes the new entry to the existing yaml, preserving existing content and comments as much as possible (append to `apps:` array)
   - `createEnvFile(filePath, entry: AppEntry)` → writes fresh file with config block + single app entry
   - `renderSpec()` → chalk-formatted string of the full annotated schema (used by `show-spec`)

8. **`src/core/cluster.ts`**
   - `createCluster(config: ClusterConfig)` — builds k3d args:
     ```
     k3d cluster create <name>
       --agents 2
       --registry-create kustron-registry:0.0.0.0:5000
       --port "8080:80@loadbalancer"
       --port "8443:443@loadbalancer"
       [--port "<port>:<port>@loadbalancer" for each in config.exposedPorts]
       --wait
     ```
   - `deleteCluster(name)` — `k3d cluster delete <name>`
   - `clusterExists(name)` → `boolean`

9. **`src/core/context.ts`**
   - `mergeKubeconfig(name)` — `k3d kubeconfig merge <name> --kubeconfig-merge-default`
   - `setContext(name)` — `kubectl config use-context k3d-<name>`

10. **`src/commands/env/init.ts`**
    - Checks `kustron-env.yaml` does not already exist (error if it does)
    - Derives app name: `path.basename(process.cwd())` → kebab-case (replace spaces/underscores/dots with `-`, lowercase)
    - Calls `createEnvFile('./kustron-env.yaml', derivedEntry)`
    - Prints: "Created kustron-env.yaml. Open it, set the port, and run `kustron env up`."

11. **`src/commands/env/up.ts`**
    - `checkAll(['docker', 'k3d', 'kubectl'], [])`
    - Require `kustron-env.yaml` to exist (error if not: "No kustron-env.yaml found. Run `kustron env init` to create one.")
    - Parse and validate the file — fail fast on `PORT` placeholders or schema errors
    - Collect exposed ports from all apps with `exposed: true`
    - If cluster does not exist: create cluster → merge kubeconfig → set context → install metrics-server (see Phase 4)
    - If cluster already exists: skip creation, proceed directly to deploying apps
    - Run the per-app deploy pipeline (implemented in Phase 2) for every app in the yaml
    - Print summary table: app name, type, status, URL (`http://localhost:<port>` or "internal")

12. **`src/commands/env/down.ts`**
    - Confirm with `@clack/prompts` (unless `--yes`)
    - `deleteCluster` → remove kubeconfig entry (`kubectl config delete-context k3d-<name>`)

13. **`src/commands/env/reload.ts`**
    - Calls `down` logic (no confirmation prompt — user explicitly asked for this), then `up` logic
    - Prints "Reloading environment…" before each phase

14. **`src/commands/env/show-spec.ts`**
    - Calls `renderSpec()` from `env-file.ts`, prints to stdout
    - No cluster or yaml required

15. **`src/bin/kustron.ts`**
    - `program.command('env')` → subcommands: `init`, `up`, `down`, `reload`, `show-spec`
    - `program.command('apps')` → subcommands: `add`, `remove`
    - Global `--verbose` flag stored in a module-level context consumed by `exec.ts`

### Deliverable
All `env` commands work (deploy pipeline is wired in Phase 2). `kustron env init` → edit port → `kustron env up` creates the cluster and deploys all apps. `kustron env show-spec` prints schema.

---

## Phase 2 — Deploy pipeline + `kustron apps add/remove` (source and image types)

**Goal:** `kustron env up` fully deploys all apps. `kustron apps add` and `kustron apps remove` manage the yaml.

### Tasks

1. **`src/core/source.ts`**
   - `isGitUrl(s)` — matches `git@...` and `https://...\.git` patterns
   - `cloneRepo(url, targetDir)` — `git clone <url> <targetDir>`
   - `resolveGitSource(url)` — clones to `os.tmpdir()/kustron-<sha256-of-url>`, returns absolute path; registers `process.on('exit')` cleanup (skipped if `--keep-source` flag)
   - `resolveLocalSource(p)` — resolves to absolute path, validates it exists and is a directory

2. **`src/core/build.ts`**
   - `detectStrategy(sourcePath)` → `'dockerfile' | 'railpack'`
   - `buildImage(sourcePath, tag, strategy)`:
     - `'dockerfile'`: `docker build -t <tag> <sourcePath>`
     - `'railpack'`: verify exact interface with `railpack build --help` before implementing — the flag to set the output image tag may differ from `--tag`

3. **`src/core/push.ts`**
   - `REGISTRY_HOST = 'k3d-kustron-registry:5000'` (constant — always this value)
   - `buildTag(appName, timestamp)` → `k3d-kustron-registry:5000/<appName>:<timestamp>` — always unique to trigger rollouts
   - `pushImage(tag)` — `docker push <tag>`

4. **`src/core/manifest.ts`**
   - `buildConfigMap(appName, namespace, env)` → `v1/ConfigMap` with `data` from env map; returns `null` if env is empty
   - `buildDeployment(opts)` → `apps/v1/Deployment`:
     - Labels: `app.kubernetes.io/name: <appName>`, `app.kubernetes.io/managed-by: kustron`
     - `envFrom.configMapRef` when configmap was generated
     - Resource defaults: cpu request `100m` / limit `500m`, memory request `128Mi` / limit `512Mi`
     - `readinessProbe`: httpGet on `healthcheck` path (default `/`) and `port`
     - `replicas`: 1 by default, or from `AppEntry`; if `ha: true`, set to 2
   - `buildService(opts)` → `v1/Service`:
     - `type: 'LoadBalancer'` when `exposed: true`, otherwise `'ClusterIP'`
     - `port` and `targetPort` both set to `AppEntry.port`
   - `buildHPA(opts)` → `autoscaling/v2/HorizontalPodAutoscaler`:
     - `minReplicas: 2`, `maxReplicas: 5`
     - CPU averageUtilization: 90
     - Memory averageUtilization: 80
   - `assembleManifests(resources: object[])` → `resources.map(r => yaml.dump(r)).join('---\n')`

5. **`src/core/apply.ts`**
   - `applyManifests(yamlStr)` — `kubectl apply -f -` with `input: yamlStr`
   - `deleteApp(appName, namespace)` — `kubectl delete all,configmap -l app.kubernetes.io/name=<appName> -n <namespace>`
   - `waitForRollout(appName, namespace)` — `kubectl rollout status deployment/<appName> -n <namespace> --timeout=120s`

6. **`src/core/deployer.ts`** — new module: the per-app deploy pipeline, called by `env up`
   - `deployApp(app: AppEntry, ctx: DeployContext)` — runs the full pipeline for one app:
     ```
     [api]  ✓ Resolving source
     [api]  ✓ Cloning repository            (git source only)
     [api]  ✓ Detecting build strategy      (source type: "Dockerfile found" or "using Railpack")
     [api]  ✓ Building image                (source type only)
     [api]  ✓ Pushing to local registry     (source type only)
     [api]  ✓ Generating manifests
     [api]  ✓ Applying to cluster
     [api]  ✓ Waiting for rollout
     ```
   - Image type: skips build/push, generates manifest with the given image directly
   - Returns `{ name, url: string | null }` for the summary table
   - `deployAll(apps: AppEntry[], ctx: DeployContext)` — iterates sequentially, collects results, prints summary table

7. **`src/commands/apps/add.ts`**
   - Parses flags into `AppEntry`
   - Validates: name required, exactly one of source/image/helm-chart, port required for source/image
   - Checks name doesn't already exist in the file (error if duplicate)
   - Calls `appendApp('./kustron-env.yaml', entry)` from `env-file.ts`
   - Always prints: "App '<name>' added to kustron-env.yaml.\nRun `kustron env reload` to apply changes."

8. **`src/commands/apps/remove.ts`**
   - Reads `kustron-env.yaml`, finds the named app (error if not found)
   - Removes the entry and re-serializes the file via `js-yaml`
   - Always prints: "App '<name>' removed from kustron-env.yaml.\nRun `kustron env reload` to apply changes."

### Deliverable
`kustron env up` (or `reload`) creates the cluster and deploys all apps from yaml. `kustron apps add` and `kustron apps remove` round-trip correctly modifies the file.

---

## Phase 3 — Helm Chart Support

**Goal:** Helm app entries in `kustron-env.yaml` deploy correctly into the shared namespace.

### Tasks

1. **`src/utils/checks.ts`** — when parsing a yaml with helm entries, add `helm` to required deps for that run

2. **`src/core/helm.ts`**
   - `helmInstall(app: AppEntry, namespace: string)`:
     ```
     helm repo add kustron-<name> <repo>   (skipped if no repo URL given)
     helm repo update
     helm upgrade --install <app.name> <app.helm.chart>
       --namespace <namespace>
       --create-namespace
       [--version <version>]
       [--set key=value ...]
       --wait
     ```
   - `helmUninstall(appName, namespace)` — `helm uninstall <appName> --namespace <namespace>`
   - `isHelmRelease(appName, namespace)` → `boolean` — `helm list -n <namespace> -o json`, check release names; used by `undeploy` to choose the right deletion path

3. **Extend `src/core/deployer.ts`**
   - When `app.helm` is set: call `helmInstall`, skip build/push/manifest/apply
   - When `app.helm` is set, `app.exposed` is true, `app.port` is set, and `app.helm.selector` is set: after helm install, generate and apply a standalone `Service type: LoadBalancer` using the selector — this bridges helm-deployed pods to the k3d lb
   - When `app.helm.selector` is missing and `app.exposed` is true: warn "Cannot expose helm app '<name>' without a selector. Add `helm.selector` to kustron-env.yaml and run `kustron env reload`."

4. **`kustron env down`** — cluster deletion destroys the entire namespace, so no explicit helm uninstall is required during teardown

### Deliverable
Helm apps deploy into `kustron-env` namespace. Exposure with selector works.

---

## Phase 4 — Polish + README Update

### Tasks

1. **Idempotent deploys**
   - `kubectl apply` is idempotent for manifests; image tags use `<appName>-<unix-timestamp>` to always trigger a rollout on re-deploy
   - `kustron env up` / `kustron env reload` on an already-running app: updates it in place (no error)

2. **Metrics-server for HPA** (in `commands/env/up.ts`, after cluster creation)
   - Check if metrics-server is installed: `kubectl get deployment metrics-server -n kube-system`
   - If not: apply it, then patch for k3d compatibility:
     ```
     kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
     kubectl patch deployment metrics-server -n kube-system \
       --type=json \
       -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
     ```

3. **Error messages** — actionable, specific:
   - `PORT` placeholder in yaml → "Set the port for '<name>' in kustron-env.yaml before running."
   - Cluster not up → "Run `kustron env up` first."
   - Registry not reachable → "Check that `k3d-kustron-registry` is in /etc/hosts. Try `kustron env reload`."
   - railpack missing with no Dockerfile → show install URL
   - helm missing with helm app → show install URL (`brew install helm`)
   - Git clone fails → "Check that your SSH key is added: `ssh-add -l`"
   - Port already bound on host → "Port <n> is already in use on your machine. Free it or change the port in kustron-env.yaml."

4. **`--verbose` global flag** — streams all shell output live

5. **`src/translations/en.json`** — all user-visible strings; structure mirrors command hierarchy:
   ```json
   {
     "env": { "init": {}, "up": {}, "down": {}, "reload": {}, "showSpec": {} },
     "apps": { "deploy": {}, "add": {}, "undeploy": {} },
     "errors": {},
     "checks": {}
   }
   ```

6. **README update** — see section below

---

## README Update (Phase 4)

Rewrite `ReadMe.md` to reflect the new command model. Sections:

- **What is Kustron** — the `docker-compose` analogy, kubernetes under the hood, no K8s knowledge needed
- **Prerequisites** — OrbStack (recommended) or Docker Desktop, k3d, kubectl; optional: railpack, helm, git
- **Installation** — `npm i -g kustron`
- **Quickstart** — `kustron env init` → edit port → `kustron env up`
- **kustron-env.yaml reference** — full annotated example (all three types), plus a tip to run `kustron env show-spec`
- **Commands reference** — all seven commands with descriptions; note that `kustron env reload` is the answer to "I changed my yaml"
- **Service discovery** — apps reach each other at `http://<name>:<port>`
- **HA mode** — what it enables (2–5 replicas, CPU/mem autoscaling)
- **Deploying from a VM** — exposed apps bind `0.0.0.0`, so the VM's public IP works

---

## Technical Notes for Agents

### Port mapping at cluster creation
k3d maps host ports via `--port <host>:<container>@loadbalancer` at creation time only. `kustron env up` collects all `exposed` ports from `kustron-env.yaml` and includes them in the `k3d cluster create` call. When the yaml changes (new exposed app), the user runs `kustron env reload` — no automatic mismatch detection is needed. Keep `up.ts` simple.

### Registry hostname
k3d injects `k3d-kustron-registry` into `/etc/hosts` on both the host and all cluster nodes. Image tags must always use `k3d-kustron-registry:5000/<name>:<tag>` — never `localhost:5000`.

### kubectl apply via stdin
```ts
await exec('kubectl', ['apply', '-f', '-'], { input: manifestYaml })
```
No temp files. The `input` option of execa pipes the string to the process's stdin.

### Label strategy
All kustron-managed resources carry two labels:
- `app.kubernetes.io/name: <appName>`
- `app.kubernetes.io/managed-by: kustron`

`undeploy` deletes by label selector across `all,configmap` resource types — it never deletes the namespace.

### Helm app exposure
Kustron cannot introspect a helm chart's pod template labels. When `exposed: true` is set on a helm app, the user must also provide `helm.selector` in the yaml (a map of label key-value pairs that match the chart's pods). Kustron creates a standalone `Service type: LoadBalancer` using that selector.

### Railpack interface
Verify `railpack build --help` before implementing `build.ts`. The exact flag to set the output image tag may differ from `--tag`. Update the implementation accordingly.

### Image tag uniqueness
Always tag built images with `<appName>-<unix-timestamp-seconds>` (not `latest`). This ensures `kubectl rollout` detects the new image and a rollout occurs on every `kustron apps deploy`.

### `appendApp` in env-file.ts
When appending to an existing yaml file, use a YAML library (e.g. `js-yaml`) to parse the current content, push the new entry to `apps`, and re-serialize. Do not do string concatenation. Comments in the existing file will be lost (acceptable trade-off — document this).

---

## Suggested Agent Task Breakdown

| Agent   | Phase | Prerequisite |
|---------|-------|--------------|
| Agent 1 | Phase 1: Scaffold + all `env` commands (cluster only, deploy pipeline stubbed) | This plan |
| Agent 2 | Phase 2: Deploy pipeline in `core/deployer.ts` + `apps add/remove` (source + image) | Phase 1 |
| Agent 3 | Phase 3: Helm support in `core/deployer.ts` | Phase 2 |
| Agent 4 | Phase 4: Polish + README | All phases |
