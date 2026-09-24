# Kustron

[itsmunim.github.io/kustron](https://itsmunim.github.io/kustron)

A single CLI that takes you from "I have some apps" to a running local Kubernetes environment. No Kubernetes knowledge required.

Think docker-compose, but for Kubernetes. You define your apps in a `kustron-env.yaml` file, run `kustron env up`, and everything gets built, deployed, and exposed at the cluster node IP.

---

## Why kubernetes?

`k3d` is lightweight, and this is basically a sandbox. You can run as many apps as you need in this mini cluster, and when you're done testing, tear it all down with one command. For testing locally, that's really powerful.

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

One script installs everything. It checks what you already have, asks before installing anything (podman / OrbStack / Docker Desktop, k3d, kubectl, railpack, helm, git), then builds Kustron and puts a `kustron` command on your PATH.

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
| Install k3d? (if not installed, kustron will not work) | yes | aborts; kustron cannot create a cluster without k3d |
| Install kubectl? | yes | aborts |
| Install railpack? (builds images when there's no Dockerfile) | no | apps with a Dockerfile still build fine |
| Install helm? (Helm charts only) | no | helm apps are skipped |
| Install git? (git-URL sources only) | no | `source: <git-url>` apps are skipped |

The installer is idempotent. Re-run it and it skips whatever's already installed and just rebuilds Kustron.

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
  namespace: kustron-env   # default; all apps share this namespace

apps:
  # --- Type 1: Source build ---
  - name: api
    source: ./services/api              # local path OR git@github.com:user/repo.git
    port: 3000
    healthcheck: /health
    exposed: true                       # exposed at the k3d node IP (printed in the summary)
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
| `name` | Becomes the Kubernetes Service name; other apps reach it at `http://<name>:<port>` |
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
| `kustron env status` | Show cluster + app states in a table |
| `kustron apps add [flags]` | Add a new app entry to `kustron-env.yaml` |
| `kustron apps remove <name>` | Remove an app entry from `kustron-env.yaml` |

### `env up` is deterministic

`kustron env up` reconciles your local environment to the desired state in `kustron-env.yaml`. Running it repeatedly is a no-op when nothing changed:

- **Cluster:** if `kustron` already exists and is running, it is not touched. If it exists but is stopped, it is started. If it does not exist, it is created.
- **kubectl access:** the k3d kubeconfig and context are merged every run (idempotent), so `env up` never fails on a missing context.
- **Registry:** the in-cluster registry is ensured every run; a pre-existing cluster without one is wired up automatically.
- **Images:** source apps are tagged with a **content hash** (`<registry>/<app>:<sha>`), not a timestamp. Unchanged source produces the same tag, the build is skipped, and the deployment manifest applies as a no-op. Change the source and the next `env up` builds and rolls out a new version.
- **YAML-only changes** (env vars, replicas, exposure) are picked up by `kubectl apply` even when the image tag is unchanged.

**Tip:** After editing `kustron-env.yaml` (manually or via `apps add/remove`), run `kustron env reload` to apply changes.

### Healthchecks & rollout

`kustron env up` waits for each deployment to become **Ready**, then prunes old failed ReplicaSets so `kubectl get pods` stays clean.

A pod becomes Ready when its containers are Running **and** its readiness probe passes (if one is declared). Healthchecks are opt-in to keep rollouts deterministic: no declared healthcheck means no probes, so anything that starts successfully is Ready immediately:

| `healthcheck` value | Probe | Use for |
|---|---|---|
| *(omitted)* or `none` | none: Ready as soon as the container runs | everything, incl. services that don't speak HTTP |
| `tcp` | TCP socket on `port` | **redis**, postgres, mysql, memcached, ... |
| `/health` (any path) | HTTP GET on that path | web apps with a health endpoint |

For example, a redis app:

```yaml
apps:
  - name: kivo-redis
    image: redis:7
    port: 6379
    healthcheck: tcp   # or omit entirely; redis doesn't speak HTTP, so an HTTP probe would never pass
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
3. **Push:** Images are pushed to the local registry (`localhost:5000`), referenced in-cluster as `kustron-registry:5000`
4. **Deploy:** Kubernetes manifests (ConfigMap, Deployment, Service, HPA) are generated and applied
5. **Expose:** Apps with `exposed: true` get a `NodePort` service reachable at the k3d node IP

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

Podman reserves `bridge` as a network *mode* keyword, so a docker network can't actually be named that. Kustron used to try creating a network called `bridge` before starting the cluster; that attempt fails with exactly this error on podman. k3d already handles networking itself: it uses Docker's default `bridge` network when one exists, and on podman it auto-creates a `k3d-<cluster>` network. Current kustron versions just let k3d do its thing, so the error is gone. If you still see it, update kustron (`./install.sh`) and run `kustron env down`, then `kustron env up`.

---

### Railpack won't install (I use a private npm registry)

Railpack used to be published on npm, so `npm install -g railpack` was the usual route, and it fails silently whenever your npm is pointed at a private registry that doesn't mirror it. Railpack isn't on npm anymore, and the kustron installer now downloads the prebuilt binary straight from [GitHub releases](https://github.com/railwayapp/railpack/releases). No npm, no brew, no package manager involved.

If your *app* pulls dependencies from a private npm registry (and you're building it without a Dockerfile), keep the npm auth where railpack can read it while building: your app's `.npmrc` with a token, or the usual `NPM_TOKEN`-style env vars in the app's build environment. Railpack's [docs](https://railpack.com) cover the auth variables it passes through.

---

### Port 5000 is already in use

Kustron binds the local image registry to `localhost:5000`. If something else is already listening there, creating the cluster or registry fails. Free the port and re-run `kustron env up`.

---

### Podman machine is out of memory while k3d runs

A k3d cluster (a few nodes plus a registry) wants around 4GB in the podman VM. On macOS: `podman machine init --rootful --cpus 4 --memory 4096` for a new machine, or `podman machine set --memory 4096` then `podman machine stop/start` for an existing one.

---

### Exposed apps aren't reachable from another machine / VM

Exposed apps are NodePort services on ports 30000-32767. They're reachable at the cluster node IP on your own machine; from a VM or another device, allow that range inbound (security group / firewall) and use `http://<public-ip>:<nodeport>`.

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
