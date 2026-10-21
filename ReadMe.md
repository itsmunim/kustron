# [Kustron](https://itsmunim.github.io/kustron)

![Coverage](https://img.shields.io/badge/coverage-53%25-green)
[![CI](https://github.com/itsmunim/kustron/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmunim/kustron/actions/workflows/ci.yml)

A single CLI that takes you from "I have some apps" to a running local development environment.

Think docker-compose, but powered with a lightweight kubernetes running locally. You define your apps in a `kustron-env.yaml` file, run `kustron env up`, and everything gets built, deployed, and exposed.

> ▶ **New here?** Watch the [fullstack demo](https://itsmunim.github.io/kustron/features.html#demo) (a CRUD app, live rebuilds, a RabbitMQ stream and a public repo, in under 3 minutes), then read [How kustron compares with tilt.dev](docs/comparison.md).

---

## Why kubernetes?

`k3d` is lightweight, and works like a sandbox. You can run as many apps as you need in this mini cluster, and when you're done testing, tear it all down with one command. For testing locally, that's really powerful. With a few minor tweaks, this in a `VM` can serve your MVP.

---

## Use Cases

Kustron is built for developers and teams who want a real Kubernetes environment without the operational burden.

### Full-stack local development

Frontend, API, database, cache, workers — everything running together in one namespace, reachable by name. `kustron env watch` watches your source directories and auto-redeploys on every save. No manual container restarts, no stale dependencies.

### Onboarding new team members

The `kustron-env.yaml` _is_ the environment documentation. Clone the repo, run `kustron env up`, and you're productive in minutes instead of hours of manual setup.

### Reproducible environments anywhere

The same file gives you an identical stack on your laptop, a teammate's machine, or a $6/month cloud VM. No "works on my machine" — the environment is version-controlled and deterministic.

### Production parity before shipping

Test Helm charts, private registry authentication, deploy ordering with `dependsOn`, HPA autoscaling, and namespace isolation locally. Catch production-only issues before they reach staging.

### Ephemeral sandboxes and demos

Spin up an isolated stack for a spike, a customer demo, or integration testing. `env destroy` when done and nothing lingers on your machine.

### Safe experimentation alongside production

Kustron never calls `kubectl config use-context`. Every command uses `--context=k3d-<clusterName>`, so your production clusters stay untouched. Experiment freely without fear.

## Features

- **One file defines the whole stack.** Three app types in `kustron-env.yaml`: build from source (local folder or git URL), run an existing image, or deploy a Helm chart.
- **Deterministic, idempotent `env up`.** Content-hash image tags mean re-running with no changes is a fast no-op. Source edits rebuild only what changed. Removed apps are pruned automatically.
- **Hot-reload during development.** `kustron env watch` watches local source directories and auto-redeploys on save.
- **App-level lifecycle and debugging.** Stop, start, stream logs, run commands inside containers (`exec`), and forward local ports — all without tearing down the cluster.
- **Secrets as Kubernetes Secrets.** `secret:` creates real K8s Secrets (not ConfigMaps). `${ENV}` interpolation pulls from your shell environment.
- **Smart healthchecks that match the protocol.** `/<path>` for HTTP GET, `tcp` for socket probes, or omit for no probes. TCP-only services stop stalling rollouts.
- **Deploy ordering with readiness checks.** `dependsOn` deploys apps in topological order, with `rollout`, `established`, or custom `command` readiness per dependency. `hooks.pre` / `hooks.post` for migrations and seeding.
- **Helm support done right.** Nested `values` (real `--values` file), extra `valuesFiles`, local charts, OCI charts — and split build from deploy: a `source`/`image` app pairs with a chart via `helm.imageValues` (dotted paths) so your built image runs inside the chart's deployment.
- **Private registry support.** Per-app `registry` creds create and attach an imagePullSecret, plus `kustron registry login` and `registry prune`.
- **Escape hatches when you need them.** `command`, `args`, `resources` as first-class fields, and a generic `patch` that deep-merges onto the generated Deployment.
- **CLI scaffolding.** `kustron env init`, `apps add`, and `apps remove` build up your `kustron-env.yaml` without hand-editing YAML. `env show-spec` prints the full schema reference.
- **Reusable components.** A `components:` block pulls in a `Kustronfile` (local dir or git URL) with inputs, outputs, and apps. Wire values together via `${component.x}` and `${app.endpoint}` interpolation.

---

## Prerequisites

- **Container runtime:** [Podman](https://podman.io) or Docker ([OrbStack](https://orbstack.dev) / Docker Desktop). Kustron auto-detects whichever you have and uses it for the k3d cluster and image builds.

> **Note**: We strongly recommend Podman, or OrbStack if you're on a Mac. Docker Desktop eats CPU for no good reason while running k3d.

- **k3d:** `brew install k3d`
- **kubectl:** `brew install kubectl`

Optional:

- **Helm:** `brew install helm` (only if you use Helm charts)
- **Railpack:** see [railpack.io](https://railpack.io) (fallback build tool when no Dockerfile exists)
- **Git:** usually pre-installed

---

## Installation

**From npm** — Kustron is a Node.js CLI (Node >= 18). Install it, then check your machine is ready:

```bash
npm install -g kustron
kustron doctor
```

`kustron doctor` lists the runtime dependencies — container runtime (podman / OrbStack / Docker Desktop), k3d, kubectl (required); railpack, helm, git (optional) — with install links for whatever's missing, and verifies the container runtime daemon is reachable.

**Or one script installs everything** — it checks what you already have, asks before installing anything (podman / OrbStack / Docker Desktop, k3d, kubectl, railpack, helm, git), then installs Kustron from npm and puts a `kustron` command on your PATH.

```bash
# recommended: download the installer, review it, then run it
curl -fsSL https://raw.githubusercontent.com/itsmunim/kustron/master/download.sh | bash
./install.sh

# same thing in two separate steps
curl -fsSL -o install.sh https://raw.githubusercontent.com/itsmunim/kustron/master/install.sh
chmod +x install.sh
./install.sh

# non-interactive: accept everything and install whatever is missing
./install.sh -y
```

What it asks for, and what happens if you say no:

| Prompt                                                               | Required? | If you say no                                                     |
| -------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| Install podman? (podman / OrbStack / Docker Desktop must be present) | yes       | asks for OrbStack / Docker Desktop, then aborts if none installed |
| Install k3d? (if not installed, kustron will not work)               | yes       | aborts; kustron cannot create a cluster without k3d               |
| Install kubectl?                                                     | yes       | aborts                                                            |
| Install railpack? (builds images when there's no Dockerfile)         | no        | apps with a Dockerfile still build fine                           |
| Install helm? (Helm charts only)                                     | no        | helm apps are skipped                                             |
| Install git? (git-URL sources only)                                  | no        | `source: <git-url>` apps are skipped                              |

The installer is idempotent. Re-run it and it skips whatever's already installed and just re-installs Kustron from npm. To upgrade Kustron later: `npm update -g kustron`.

---

## Quickstart

```bash
# Create a kustron-env.yaml in your project
cd my-project
kustron env init

# Edit kustron-env.yaml and set the port
# Then bring up the environment
kustron env up
```

Your app will be built, pushed to a local registry, and deployed into a k3d Kubernetes cluster. If you set `exposed: true`, it's reachable at `http://localhost:<nodePort>` — the port is printed in the deployment summary.

---

## A real environment in practice

Starting inside your own source folder (with or without `Dockerfile`, if no `Dockerfile` don't forget to install `railpack` when `install.sh` is run).

```bash
cd my-api                                  # your repo, with a Dockerfile
kustron env init                           # creates kustron-env.yaml

# add the infra your app needs while developing locally
kustron apps add --name local-ddb  --image amazon/dynamodb-local:latest --port 8000 --healthcheck tcp
kustron apps add --name local-s3   --image luofuxiang/local-s3 --port 80
kustron apps add --name kivo       --image ghcr.io/itsmunim/kivo:v1.5.0 --port 6379 --healthcheck tcp

kustron env up
```

That gets you a local DynamoDB (`local-ddb:8000`), an S3-compatible store (`local-s3:80`), and a cache (`kivo:6379`), all in one namespace with your app. Your code just talks to `http://local-ddb:8000` etc. by name:

```yaml
apps:
  - name: my-api
    source: ./
    port: 3000
    healthcheck: /health

  - name: local-ddb
    image: amazon/dynamodb-local:latest
    port: 8000
    healthcheck: tcp

  - name: local-s3
    image: luofuxiang/local-s3
    port: 80

  - name: kivo
    image: ghcr.io/itsmunim/kivo:v1.5.0
    port: 6379
    healthcheck: tcp
```

A note on the cache: **kivo** is our Redis-compatible in-memory store. Same protocol, same port, so it drops in wherever you'd use redis for local testing. Take a look at [kivo](https://itsmunim.github.io/kivo) if you're curious. Swap the image for `redis:7` if you prefer and nothing else changes.

## Which container runtime should you use?

Use **OrbStack** on macOS, **Podman** anywhere else. Both are light, free, and fast. Docker Desktop technically works too, but running k3d through it is painful:

- **CPU**: Docker Desktop virtualizes Linux, and k3d runs a whole Kubernetes cluster inside that VM. The extra layer pegs your CPU at 100%+ even when nothing is happening, and idle k3d clusters keep eating cores.
- **Memory**: Docker Desktop reserves several GB for its VM; a k3d cluster on top easily pushes past 6GB used.
- **Startup**: 30+ seconds to get Docker Desktop ready vs ~2 seconds for OrbStack/podman.

OrbStack and Podman avoid the double-virtualization problem, which is why k3d behaves normally on both. Setup for each is covered in the [FAQ](#faq).

## kustron-env.yaml

The one file that defines everything. Like `docker-compose.yml`, but it targets a real local Kubernetes cluster.

```yaml
config:
  namespace: kustron-env # default; all apps share this namespace
  clusterName: myapp # optional; default is 'kustron'

apps:
  # --- Type 1: Source build ---
  - name: api
    source: ./services/api # local path OR git@github.com:user/repo.git
    port: 3000
    healthcheck: /health
    exposed: true # exposed at localhost:<nodePort> (printed in the summary)
    replicas: 1
    ha: false # min 2 / max 5 / cpu 90% / mem 80%
    env:
      NODE_ENV: production
      DB_HOST: postgres # 'postgres' resolves to the postgres app's service
      API_KEY: ${API_KEY} # interpolated from shell environment
    secret:
      DB_PASSWORD: ${DB_PASSWORD} # created as a K8s Secret, not ConfigMap

  # --- Type 2: Existing container image ---
  - name: postgres
    image: postgres:15
    port: 5432
    exposed: false
    env:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp

  # --- Type 3: Helm chart ---
  - name: prometheus
    helm:
      chart: kube-prometheus-stack
      repo: https://prometheus-community.github.io/helm-charts
      version: '45.0.0'
      values:
        grafana.enabled: 'true'
      selector:
        app.kubernetes.io/name: grafana
    exposed: false
```

> **More examples & features:** every app type and field is documented with a
> use case on the [Features & Examples](https://itsmunim.github.io/kustron/features.html)
> page. Run `kustron env show-spec` for a full annotated schema reference.

### Schema rules

| Rule                                                                                                                                                     | Detail                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Exactly one of `source`, `image`, `helm` (a `source` or `image` combined with `helm` deploys the built image via the chart through `helm.imageValues`) | Required per app entry                                                                                     |
| `port`                                                                                                                                                   | Required for `source` and `image` apps using the builtin template; optional for `helm` (the chart owns ports)              |
| `healthcheck`                                                                                                                                            | Optional for `source` and `image`; ignored for `helm`. `/<path>` = HTTP GET, `tcp` = port check, omit / `none` = no probes |
| `ha: true`                                                                                                                                               | Overrides `replicas`; sets min 2 / max 5 / CPU 90% / mem 80%                                                               |
| `env`                                                                                                                                                    | Creates a ConfigMap for `source` and `image`; for `helm` values are passed as a `--values` file (nested YAML supported)    |
| `secret`                                                                                                                                                 | Creates a K8s Secret (not ConfigMap) for passwords and tokens. Use `${ENV}` for shell env interpolation                    |
| `exposed: true`                                                                                                                                          | Service becomes `NodePort` type, reachable at `http://localhost:<nodePort>`; requires `port`                               |
| `config.clusterName`                                                                                                                                     | Name of the k3d cluster (default: `kustron`). Multiple projects can use different names                                    |
| `command` / `args`                                                                                                                                       | First-class escape hatches: override the container command / args                                                          |
| `resources`                                                                                                                                              | First-class escape hatch: override container resource requests / limits (deep-merged over kustron defaults)                |
| `patch`                                                                                                                                                  | Generic escape hatch: deep-merged onto the generated Deployment manifest (objects merge, arrays replace)                   |
| `helm.values`                                                                                                                                            | Arbitrary chart values, nested YAML supported (passed via a `--values` file)                                               |
| `helm.valuesFiles`                                                                                                                                       | Additional local values files, each passed as `--values`                                                                   |
| `helm.imageValues`                                                                                                                                       | Injects the kustron-built image into the chart as `<repository>:<tag>` at the dotted paths you give (`{repository: 'image.repository', tag: 'image.tag'}`). Needs a `source` or `image` field on the same app; you can also pass the image yourself via `helm.values` |
| `helm.chart`                                                                                                                                             | Repo chart name, local path (`./charts/x`), OCI (`oci://...`), or packaged `.tgz`                                          |
| `dependsOn`                                                                                                                                              | Deploy this app only after the listed apps are ready (topological order, cycle-checked)                                    |
| `wait`                                                                                                                                                   | How a dependency must be ready: `rollout` (default), `established` (CRDs), or `command` with `wait.command`                |
| `hooks.pre` / `hooks.post`                                                                                                                               | Host shell commands run before / after the app deploys                                                                     |
| `namespace`                                                                                                                                              | Deploy this app into its own namespace (default: the env namespace)                                                        |
| `instance`                                                                                                                                               | Instance suffix so the same `name` can be deployed twice (`kafka-primary`, `kafka-secondary`)                              |
| `registry`                                                                                                                                               | Private registry creds (`server`, `username`, `password`); creates an imagePullSecret and attaches it                      |
| `components`                                                                                                                                             | Top-level block: reusable app bundles from a `Kustronfile` (local dir or git URL) with `inputs` / `outputs`                |

---

## Commands

| Command                                               | Description                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `kustron doctor`                                      | Check runtime dependencies and the container runtime daemon, print hints  |
| `kustron env init`                                    | Create `kustron-env.yaml` in the current folder                           |
| `kustron env up`                                      | Bring up the environment and deploy all apps                              |
| `kustron env stop`                                    | Stop all apps (scale to 0, uninstall helm) without destroying the cluster |
| `kustron env reload`                                  | Stop + up (pick up any yaml changes)                                      |
| `kustron env watch`                                   | Watch local source directories and auto-redeploy on changes               |
| `kustron env down`                                    | **Deprecated alias for `env destroy`** — deletes the entire cluster       |
| `kustron env show-spec`                               | Pretty-print the `kustron-env.yaml` schema                                |
| `kustron env status`                                  | Show cluster + app states in a table                                      |
| `kustron app stop <name>`                             | Stop a single app                                                         |
| `kustron app start <name>`                            | Start a single app                                                        |
| `kustron app logs <name>`                             | Stream logs for a single app (`-f` to follow, `--tail N`)                 |
| `kustron app exec <name> [command...]`                | Run a command inside a running app container (defaults to `sh`)           |
| `kustron app forward <name> <localPort> [remotePort]` | Forward a local port to an app (for non-exposed services)                 |
| `kustron env destroy`                                 | Delete the k3d cluster and all data in it                                 |
| `kustron registry login <server>`                     | Login to a container registry (docker/podman), then push images to it     |
| `kustron apps add [flags]`                            | Add a new app entry to `kustron-env.yaml`                                 |
| `kustron apps remove <name>`                          | Remove an app entry from `kustron-env.yaml`                               |

### `env up` is deterministic

`kustron env up` reconciles your local environment to the desired state in `kustron-env.yaml`. Running it repeatedly is a no-op when nothing changed:

- **Cluster:** if the cluster already exists and is running, it is not touched. If it exists but is stopped, it is started. If it does not exist, it is created.
- **kubectl access:** the k3d kubeconfig is merged into your default config every run (idempotent). Kustron never calls `kubectl config use-context` — all commands use `--context=k3d-<clusterName>` so your production clusters are safe.
- **Registry:** the in-cluster registry is ensured every run; a pre-existing cluster without one is wired up automatically. Registry names are **cluster-scoped** (`kustron-registry` for the default cluster, `<clusterName>-registry` otherwise) so multiple projects can run their own clusters at the same time, and the host port actually in use is **discovered from the running container** instead of re-probed each run — `docker push` can't end up on a stale port. Port probing also honors ports held by macOS services (AirPlay on 5000).
- **Images:** source apps are tagged with a **content hash** (`<registry>/<app>:<sha>`), not a timestamp. Unchanged source produces the same tag, the build is skipped, and the deployment manifest applies as a no-op. Change the source and the next `env up` builds and rolls out a new version.
- **YAML-only changes** (env vars, replicas, exposure, secrets) are picked up by `kubectl apply` even when the image tag is unchanged. Removed apps are cleaned up automatically.
- **Pruning:** apps removed from `kustron-env.yaml` since the last `env up` are deleted from the cluster automatically.

**Tip:** After editing `kustron-env.yaml` (manually or via `apps add/remove`), run `kustron env reload` to apply changes.

### Healthchecks & rollout

`kustron env up` waits for each deployment to become **Ready**, then prunes old failed ReplicaSets so `kubectl get pods` stays clean.

A pod becomes Ready when its containers are Running **and** its readiness probe passes (if one is declared). Healthchecks are opt-in to keep rollouts deterministic: no declared healthcheck means no probes, so anything that starts successfully is Ready immediately:

| `healthcheck` value   | Probe                                     | Use for                                          |
| --------------------- | ----------------------------------------- | ------------------------------------------------ |
| _(omitted)_ or `none` | none: Ready as soon as the container runs | everything, incl. services that don't speak HTTP |
| `tcp`                 | TCP socket on `port`                      | **redis**, postgres, mysql, memcached, ...       |
| `/health` (any path)  | HTTP GET on that path                     | web apps with a health endpoint                  |

For example, a redis app:

```yaml
apps:
  - name: kivo-redis
    image: redis:7
    port: 6379
    healthcheck: tcp # or omit entirely; redis doesn't speak HTTP, so an HTTP probe would never pass
```

A wrong healthcheck does not hang forever anymore: `env up` fails fast with the pod details on `ImagePullBackOff` / `CrashLoopBackOff`, and only warns when a rollout legitimately takes longer than 150s while pods are running.

---

## Service Discovery

All apps deploy into a single namespace. Apps can reach each other directly by name:

```
http://api:3000
http://postgres:5432
```

No extra configuration needed.

---

## HA Mode

Set `ha: true` on any app to enable horizontal autoscaling:

- **Min replicas:** 2
- **Max replicas:** 5
- **CPU target:** 90% average utilization
- **Memory target:** 80% average utilization

The HPA requires the metrics-server, which Kustron installs automatically during `env up`.

---

## Deploying from a VM

Exposed apps get a `NodePort` service mapped to `localhost` via the k3d loadbalancer, so they're reachable at `http://localhost:<nodePort>` from the host. On a VM, use `http://<vm-public-ip>:<nodePort>`.

---

## Global Flags

| Flag        | Description                          |
| ----------- | ------------------------------------ |
| `--verbose` | Stream all shell command output live |

---

## How It Works

1. **Cluster:** k3d creates a lightweight local Kubernetes cluster with a built-in container registry. Free ports in the NodePort window (30000–30100) are mapped to localhost via the k3d loadbalancer. Registry names are cluster-scoped (`kustron-registry`, `<clusterName>-registry`), so clusters don't collide.
2. **Build:** Source apps are built with the detected container runtime (if `Dockerfile` exists) or Railpack (fallback). BuildKit is auto-detected.
3. **Push:** Images are pushed to the local registry (`localhost:<port>` — discovered from the running registry container), referenced in-cluster as `<clusterName>-registry:5000`. Podman gets `--tls-verify=false` for local registries.
4. **Deploy:** Kubernetes manifests (ConfigMap, Secret, Deployment, Service, HPA) are generated and applied. Every kubectl/helm call uses `--context=k3d-<clusterName>`.
5. **Expose:** Apps with `exposed: true` get a `NodePort` service **pinned to a cluster-free port** inside the mapped window, so it's reachable at `http://localhost:<nodePort>`.

## Architecture

Every command funnels through one pipeline: schema validation → component expansion → dependency sort → cluster ensure → build → push → deploy → wait. The module-level mermaid diagrams live in [plans/design.md](plans/design.md) — start there if you want to hack on the code.

---

## FAQ

### Which container runtime should I use, and how do I set it up?

**OrbStack (macOS, recommended)**:

```bash
brew install --cask orbstack
```

Open OrbStack once (it finishes the setup itself). Kustron detects it automatically via `docker info`; there's nothing else to configure.

**Podman (any platform)**:

```bash
# macOS
brew install podman
podman machine init --rootful --cpus 4 --memory 4096
podman machine start

# Linux: package manager installs the daemon directly, no machine needed
sudo apt install podman        # or dnf / pacman / apk
```

The `--rootful` flag matters: k3d needs a rootful podman machine. The kustron installer does all of this for you and verifies the daemon is responding before continuing.

**Docker Desktop**: works, but see the CPU warning above. If you choose it, open it once to accept the license, then re-run the installer.

---

### Docker Desktop + k3d hogs my CPU

Docker Desktop runs Linux in a VM, and k3d runs a Kubernetes cluster inside that VM. Two layers of virtualization means the k3d containers never stop chewing CPU, even when idle, and Docker Desktop's VM eats several GB of RAM on its own. OrbStack and Podman don't stack a second VM on top, which is why k3d is a lot nicer on both. If you're on Docker Desktop, switching to OrbStack is a 2-minute change and your fan will thank you.

---

### "cannot create network with name 'bridge' because it conflicts with a valid network mode"

Podman reserves `bridge` as a network _mode_ keyword, so a docker network can't actually be named that. Kustron used to try creating a network called `bridge` before starting the cluster; that attempt fails with exactly this error on podman. k3d already handles networking itself: it uses Docker's default `bridge` network when one exists, and on podman it auto-creates a `k3d-<cluster>` network. Current kustron versions just let k3d do its thing, so the error is gone. If you still see it, update kustron (`./install.sh`) and run `kustron env down`, then `kustron env up`.

---

### Railpack won't install (I use a private npm registry)

Railpack used to be published on npm, so `npm install -g railpack` was the usual route, and it fails silently whenever your npm is pointed at a private registry that doesn't mirror it. Railpack isn't on npm anymore, and the kustron installer now downloads the prebuilt binary straight from [GitHub releases](https://github.com/railwayapp/railpack/releases). No npm, no brew, no package manager involved.

If your _app_ pulls dependencies from a private npm registry (and you're building it without a Dockerfile), keep the npm auth where railpack can read it while building: your app's `.npmrc` with a token, or the usual `NPM_TOKEN`-style env vars in the app's build environment. Railpack's [docs](https://railpack.com) cover the auth variables it passes through.

---

### Port 5000 is already in use

Kustron auto-detects an available port starting from 5000. If something else is listening there (e.g. macOS AirPlay), it picks the next free port automatically. You can also set a specific port via `config.registryPort` in `kustron-env.yaml`.

---

### Podman machine is out of memory while k3d runs

A k3d cluster (a few nodes plus a registry) wants around 4GB in the podman VM. On macOS: `podman machine init --rootful --cpus 4 --memory 4096` for a new machine, or `podman machine set --memory 4096` then `podman machine stop/start` for an existing one.

---

### Exposed apps aren't reachable

Exposed apps are NodePort services mapped to `localhost:<nodePort>` via the k3d loadbalancer. They're reachable at `http://localhost:<nodeport>` on your own machine. From a VM or another device, use `http://<host-ip>:<nodeport>`.
---

### Will Kustron change my kubectl context?

No. Kustron never calls `kubectl config use-context`. Every kubectl and helm command includes `--context=k3d-<clusterName>` (or `--kube-context` for helm), so your global kubectl context is never touched. You can safely run `kustron env up` while working with production clusters in other terminals.

---

## Contributing / Running from Source

Clone the repo and install dependencies:

```bash
git clone git@github.com:itsmunim/kustron.git
cd kustron
npm install
```

Build the CLI and symlink it onto your PATH so the `kustron` command points at your local build:

```bash
npm run build
ln -sf "$(pwd)/dist/bin/kustron.js" /usr/local/bin/kustron
```

If `/usr/local/bin` isn't writable, use `~/.local/bin` instead (make sure it's on your PATH):

```bash
mkdir -p ~/.local/bin
ln -sf "$(pwd)/dist/bin/kustron.js" ~/.local/bin/kustron
```

`dist/bin/kustron.js` is a self-contained executable, so the symlink is all you need.

Now any `kustron` command on your machine runs the code in `dist/`. After making changes, re-run `npm run build` (or keep `npm run dev` running in a terminal to rebuild on save) and the linked binary picks up the latest output automatically.

To unlink when you're done:

```bash
rm /usr/local/bin/kustron        # or rm ~/.local/bin/kustron
```

---

## License

MIT
