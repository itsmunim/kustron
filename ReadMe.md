![version](https://img.shields.io/npm/v/kustron?color=green&style=flat-square)
![downloads](https://img.shields.io/npm/dw/kustron?style=flat-square)

<p align="center">
  <a href="https://github.com/dibosh/kustron">
    <img alt="Kustron" title="Kustron" src="https://i.imgur.com/Nndv5Vv.png" width="300">
  </a>
</p>

<p align="center">
  Local dev environment, done in minutes.
</p>

## What is Kustron?

Kustron is a CLI tool that gives you a fully working local Kubernetes cluster and lets you deploy any application to it — from a local folder or a git repo — with a single command.

It handles everything: spinning up [k3d](https://k3d.io), configuring `kubectl`, building your container image (using your `Dockerfile` or [Railpack](https://railpack.io) as a fallback), pushing to a local registry, and deploying to the cluster. Optional HA mode adds autoscaling out of the box.

It's designed for local development or even running on a VM.

---

## Prerequisites

Kustron will check for these when you install it and tell you exactly what to do if anything is missing.

### Required

- **Docker runtime** — [OrbStack](https://orbstack.dev) is strongly recommended over Docker Desktop. It starts in ~2 seconds, uses a fraction of the memory, and has native Apple Silicon support. Docker Desktop works too.
- **k3d** — `brew install k3d` or see [k3d.io/installation](https://k3d.io/installation)
- **kubectl** — `brew install kubectl`

### Optional - but keep installed

- **Railpack** — only needed if your app has no `Dockerfile`. See [railpack.io](https://railpack.io) for install instructions.
- **git** — only needed when deploying from a git URL. Usually pre-installed.

---

## Installation

```sh
npm i -g kustron
```

After install, Kustron checks your environment and tells you what's missing and how to fix it.

---

## Quickstart

```sh
# 1. Spin up a local cluster (1 server + 2 agents + local registry)
kustron cluster up

# 2. Deploy an app from a local folder
kustron deploy ./my-app --name myapp --port 3000

# 3. Deploy an app from a git repo (SSH access must already be configured)
kustron deploy git@github.com:user/repo.git --name myapp --port 3000

# 4. Check status
kustron cluster status

# 5. Tear down a deployment
kustron undeploy myapp

# 6. Tear down the cluster
kustron cluster down
```

---

## Commands

### `kustron cluster up`

Spins up a k3d cluster with:
- 1 server node + 2 agent nodes
- A local container registry at `k3d-kustron-registry:5000`
- Ports `8080` and `8443` mapped to the load balancer
- `kubectl` context set automatically — `kubectl get nodes` works immediately

### `kustron cluster down`

Tears down the cluster and cleans up the kubeconfig entry.

### `kustron cluster status`

Shows cluster nodes, registry address, current kubectl context, and all deployed applications.

### `kustron deploy <source> [options]`

Deploys an application to the running cluster.

`<source>` is either a local path (e.g. `./my-app`) or a git SSH URL (e.g. `git@github.com:user/repo.git`).

| Option | Description |
|---|---|
| `--name <name>` | Application name (used as the image name and, unless `--ns` is given, as the namespace) |
| `--port <port>` | Port your application listens on |
| `--ns <namespace>` | Deploy into an existing namespace instead of creating one named after `--name` |
| `--replicas <n>` | Number of replicas (default: 1) |
| `--ha` | Enable HA mode: 2 replicas minimum + HPA (auto-scales based on CPU/memory) |
| `--env KEY=VALUE` | Set environment variables (repeatable) |

**Build strategy:** Kustron uses your `Dockerfile` if one exists. If not, it falls back to Railpack to automatically build and containerize your app.

### `kustron undeploy <name>`

Removes a deployed application (deletes its namespace and all associated resources).

---

## HA Mode

Passing `--ha` enables:
- Minimum 2 replicas
- A `HorizontalPodAutoscaler` that scales up to 10 replicas based on CPU (70%) and memory (80%) utilization
- Sensible default resource requests/limits so the HPA can function correctly

```sh
kustron deploy ./my-app --name myapp --port 3000 --ha
```

---

## Feedback

File an issue: [github.com/dibosh/kustron/issues](https://github.com/dibosh/kustron/issues)

Pull requests are welcome.
