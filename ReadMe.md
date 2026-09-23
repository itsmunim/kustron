# Kustron

[itsmunim.github.io/kustron](https://itsmunim.github.io/kustron)

A single CLI tool that takes you from "I have some applications" to a fully running, locally-accessible Kubernetes environment — with no Kubernetes knowledge required.

Think of it as `docker-compose` for Kubernetes. You define your apps in a `kustron-env.yaml` file, run `kustron env up`, and everything is built, deployed, and made available on `localhost`.

---

## Why kubernetes?

`k3d` is pretty lightweight, also this is more like a sandbox where you can deploy as many applications as you need. Your full stack can be up and running inside this mini cluster, and once you are done testing, you can simply tear it down. For testing applications locally, that's really powerful.

---

## Prerequisites

- **Container runtime** — [Podman](https://podman.io) or Docker ([OrbStack](https://orbstack.dev) / Docker Desktop). Kustron auto-detects whichever you have and uses it for the k3d cluster and image builds.

> **Note**: We strongly recommend using `Podman` or `Orbstack`(if you are on Mac), Docker desktop takes too much CPU for some random reasons while running `k3d`.

- **k3d** — `brew install k3d`
- **kubectl** — `brew install kubectl`

Optional:
- **Helm** — `brew install helm` (only if you use Helm charts)
- **Railpack** — see [railpack.io](https://railpack.io) (fallback build tool when no Dockerfile exists)
- **Git** — usually pre-installed

---

## Installation

Kustron is installed with a single script. It checks what you already have, asks before installing anything (podman / OrbStack / Docker Desktop, k3d, kubectl, railpack, helm, git), then builds Kustron and puts a `kustron` command on your PATH.

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

| Prompt | Required? | If you say no |
|---|---|---|
| Install podman? (podman / OrbStack / Docker Desktop must be present) | yes | asks for OrbStack / Docker Desktop, then aborts if none installed |
| Install k3d? (if not installed, kustron will not work) | yes | aborts — kustron cannot create a cluster without k3d |
| Install kubectl? | yes | aborts |
| Install railpack? (builds images when there's no Dockerfile) | no | apps with a Dockerfile still build fine |
| Install helm? (Helm charts only) | no | helm apps are skipped |
| Install git? (git-URL sources only) | no | `source: <git-url>` apps are skipped |

The installer is idempotent — re-running it skips what's already installed and just rebuilds Kustron.

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

Your app will be built, pushed to a local registry, and deployed into a k3d Kubernetes cluster. If you set `exposed: true`, it's reachable at the k3d node IP (printed in the deployment summary).

---

## kustron-env.yaml

The central primitive. Works like `docker-compose.yml` but targets a real local Kubernetes cluster.

```yaml
config:
  namespace: kustron-env   # default; all apps share this namespace

apps:
  # --- Type 1: Source build ---
  - name: api
    source: ./services/api              # local path OR git@github.com:user/repo.git
    port: 3000
    healthcheck: /health
    exposed: true                       # accessible at localhost:3000
    replicas: 1
    ha: false                           # min 2 / max 5 / cpu 90% / mem 80%
    env:
      NODE_ENV: production
      DB_HOST: postgres                 # 'postgres' resolves to the postgres app's service

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
      version: "45.0.0"
      values:
        grafana.enabled: "true"
      selector:
        app.kubernetes.io/name: grafana
    exposed: false
```

Run `kustron env show-spec` for a full annotated schema reference.

### Schema rules

| Rule | Detail |
|---|---|
| Exactly one of `source`, `image`, `helm` | Required per app entry |
| `port` | Required for `source` and `image`; optional for `helm` |
| `healthcheck` | Optional for `source` and `image`; ignored for `helm`. `/<path>` = HTTP GET, `tcp` = port check, omit / `none` = no probes |
| `ha: true` | Overrides `replicas`; sets min 2 / max 5 / CPU 90% / mem 80% |
| `env` | Creates a ConfigMap for `source` and `image`; for `helm` values are passed as `--set` |
| `exposed: true` | Service becomes `NodePort` type, reachable at the k3d node IP; requires `port` |
| `helm.selector` | Required when `helm` app has `exposed: true`; must match the chart's pod labels |
| `name` | Becomes the Kubernetes Service name — other apps reach it at `http://<name>:<port>` |
| `port: PORT` | The string `PORT` is treated as an unset placeholder; validation fails with a clear message |

---

## Commands

| Command | Description |
|---|---|
| `kustron env init` | Create `kustron-env.yaml` in the current folder |
| `kustron env up` | Bring up the environment and deploy all apps |
| `kustron env down` | Tear everything down |
| `kustron env reload` | Down + up (pick up any yaml changes) |
| `kustron env show-spec` | Pretty-print the `kustron-env.yaml` schema |
| `kustron apps add [flags]` | Add a new app entry to `kustron-env.yaml` |
| `kustron apps remove <name>` | Remove an app entry from `kustron-env.yaml` |

### `env up` is deterministic

`kustron env up` reconciles your local environment to the desired state in `kustron-env.yaml`. Running it repeatedly is a no-op when nothing changed:

- **Cluster** — if `kustron` already exists and is running, it is not touched. If it exists but is stopped, it is started. If it does not exist, it is created.
- **kubectl access** — the k3d kubeconfig and context are merged every run (idempotent), so `env up` never fails on a missing context.
- **Registry** — the in-cluster registry is ensured every run; a pre-existing cluster without one is wired up automatically.
- **Images** — source apps are tagged with a **content hash** (`<registry>/<app>:<sha>`), not a timestamp. Unchanged source produces the same tag, the build is skipped, and the deployment manifest applies as a no-op. Change the source and the next `env up` builds and rolls out a new version.
- **YAML-only changes** (env vars, replicas, exposure) are picked up by `kubectl apply` even when the image tag is unchanged.

**Tip:** After editing `kustron-env.yaml` (manually or via `apps add/remove`), run `kustron env reload` to apply changes.

### Healthchecks & rollout

`kustron env up` waits for each deployment to become **Ready**, then prunes old failed ReplicaSets so `kubectl get pods` stays clean.

A pod becomes Ready when its containers are Running **and** its readiness probe passes (if one is declared). Healthchecks are opt-in to keep rollouts deterministic — no declared healthcheck means no probes, so anything that starts successfully is Ready immediately:

| `healthcheck` value | Probe | Use for |
|---|---|---|
| *(omitted)* or `none` | none — Ready as soon as the container runs | everything, incl. services that don't speak HTTP |
| `tcp` | TCP socket on `port` | **redis**, postgres, mysql, memcached, ... |
| `/health` (any path) | HTTP GET on that path | web apps with a health endpoint |

For example, a redis app:

```yaml
apps:
  - name: kivo-redis
    image: redis:7
    port: 6379
    healthcheck: tcp   # or omit entirely — redis doesn't speak HTTP, so an HTTP probe would never pass
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

Exposed apps get a `NodePort` service on the k3d node, so the VM's public IP works directly (`http://<vm-public-ip>:<nodeport>`).

---

## Global Flags

| Flag | Description |
|---|---|
| `--verbose` | Stream all shell command output live |

---

## How It Works

1. **Cluster:** k3d creates a lightweight local Kubernetes cluster with a built-in container registry
2. **Build:** Source apps are built with the detected container runtime (if `Dockerfile` exists) or Railpack (fallback)
3. **Push:** Images are pushed to the local `k3d-kustron-registry:5000`
4. **Deploy:** Kubernetes manifests (ConfigMap, Deployment, Service, HPA) are generated and applied
5. **Expose:** Apps with `exposed: true` get a `NodePort` service reachable at the k3d node IP

---

## Contributing / Running from Source

Clone the repo and install dependencies:

```bash
git clone git@github.com:itsmunim/kustron.git
cd kustron
npm install
```

Build and link globally so the `kustron` command points to your local build:

```bash
npm run build
npm link
```

Now any `kustron` command on your machine runs the code in `dist/`. After making changes, re-run `npm run build` (or keep `npm run dev` running in a terminal to rebuild on save) and the linked binary picks up the latest output automatically.

To unlink when you're done:

```bash
npm unlink -g kustron
```

---

## License

MIT
