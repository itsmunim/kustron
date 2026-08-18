# Kustron

![version](https://img.shields.io/npm/v/kustron?color=green&style=flat-square)
![downloads](https://img.shields.io/npm/dw/kustron?style=flat-square)

<p align="center">
  <a href="https://github.com/dibosh/kustron">
    <img alt="Kustron" title="Kustron" src="https://i.imgur.com/Nndv5Vv.png" width="300">
  </a>
</p>

<p align="center">
  <strong>Go from source code to a working local Kubernetes environment in minutes.</strong>
</p>

---

## What is Kustron?

Kustron is a CLI tool that creates a **fully working local Kubernetes setup** and deploys applications into it.

Give it an application — from a local directory or a Git repository — and it handles the rest.

```sh
kustron deploy ./my-app --name myapp --port 3000
```

That's it.

---

## Quickstart

### Install Kustron

```sh
npm i -g kustron
```

### Set up dependencies (optional but recommended)

```sh
kustron init-env
```

This checks for Docker, k3d, kubectl, and other tools — and downloads any missing ones automatically.

### Create your local Kubernetes environment

```sh
kustron cluster up
```

This creates:

- 1 server node
- 2 agent nodes
- A local container registry at `k3d-kustron-registry:5000`
- Load balancer port mappings (9080/9443)
- An automatically configured `kubectl` context
- Metrics-server for autoscaling support

### Deploy an application

From a local directory:

```sh
kustron deploy ./my-app --name myapp --port 3000
```

From a Git repository:

```sh
kustron deploy git@github.com:user/repo.git --name myapp --port 3000
```

### Check what's running

```sh
kustron cluster status
```

Shows cluster nodes, registry status, current context, and deployed apps.

### Manage deployed apps

```sh
kustron apps list          # Show all deployed applications
kustron apps delete myapp  # Remove an application (interactive confirmation)
```

### Tear everything down

```sh
kustron cluster down
```

---

## How deployment works

Kustron follows a simple strategy:

**1. Dockerfile exists?**

Use it. `docker build` produces the image.

**2. No Dockerfile?**

Use [Railpack](https://railpack.io) to auto-detect the language/framework and build the container.

The image is pushed to the local registry, Kubernetes manifests are generated and applied, and the rollout is monitored.

---

## Options

| Option | Description |
|---|---|
| `--name <name>` | Application name (used as namespace unless `--ns` is set) |
| `--port <port>` | Port your application listens on |
| `--ns <namespace>` | Target namespace |
| `--replicas <n>` | Number of replicas (default: 1) |
| `--ha` | Enable HA: 2+ replicas + HorizontalPodAutoscaler |
| `--env KEY=VALUE` | Environment variables (repeatable) |
| `--expose` | Expose via NodePort |
| `--healthcheck <path>` | HTTP health check endpoint (e.g. `/health`) |
| `--cpu-request <value>` | CPU request override (default: 100m) |
| `--cpu-limit <value>` | CPU limit override (default: 500m) |
| `--memory-request <value>` | Memory request override (default: 128Mi) |
| `--memory-limit <value>` | Memory limit override (default: 512Mi) |

### HA mode

```sh
kustron deploy ./my-app --name myapp --port 3000 --ha
```

Enables:

- 2+ replicas
- HorizontalPodAutoscaler (CPU 70%, memory 80%)
- Max 10 replicas
- Resource requests/limits enforced

---

## Commands

| Command | Description |
|---|---|
| `kustron init-env` | Check and auto-install missing dependencies |
| `kustron cluster up` | Create the local k3d cluster + registry + kubectl context |
| `kustron cluster down` | Tear down the cluster |
| `kustron cluster status` | Show cluster nodes, registry, context, and deployed apps |
| `kustron deploy <source>` | Build and deploy an application |
| `kustron apps list` | List all deployed applications |
| `kustron apps delete <name>` | Delete a deployed application |

---

## Prerequisites

Kustron checks your environment and tells you exactly what's missing.

### Required

- **Docker runtime** — [OrbStack](https://orbstack.dev) is recommended (faster, lighter, Apple Silicon native). Docker Desktop works too.
- **k3d** — `brew install k3d` or let `kustron init-env` install it
- **kubectl** — `brew install kubectl` or let `kustron init-env` install it

### Optional

- **Railpack** — only needed when your app doesn't have a `Dockerfile`. `kustron init-env` can install it.
- **git** — only needed when deploying from a Git URL. Usually pre-installed.

---

## Why Kubernetes?

Modern applications increasingly depend on infrastructure concepts like containers, services, networking, namespaces, resource limits, replicas, and autoscaling. Kustron uses a lightweight local Kubernetes cluster so your development environment exercises these concepts without requiring a remote cluster.

**The goal: make the first working environment ridiculously easy to create.**

---

## Feedback

File an issue: [github.com/dibosh/kustron/issues](https://github.com/dibosh/kustron/issues)

Pull requests welcome.
