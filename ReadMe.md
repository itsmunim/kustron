![version](https://img.shields.io/npm/v/kustron?color=green&style=flat-square)
![downloads](https://img.shields.io/npm/dw/kustron?style=flat-square)

<p align="center">
  <a href="https://github.com/dibosh/kustron">
    <img alt="Kustron" title="Kustron" src="https://i.imgur.com/Nndv5Vv.png" width="300">
  </a>
</p>

<p align="center">
  <strong>Go from source code to a working local environment in minutes.</strong>
</p>

# Kustron

Building an application is getting easier.

Getting an application **running locally in a realistic environment** is still surprisingly painful.

You clone a repository. Install dependencies. Figure out the right runtime versions. Set environment variables. Start a database. Start Redis. Configure networking. Build a container. Figure out Kubernetes. Configure `kubectl`. Create namespaces. Deal with images. Then, after all of that, you finally get to the part you actually wanted to do:

**run and test your application.**

Kustron is built to remove that friction.

Give Kustron an application — from a local directory or a Git repository — and it creates a complete local Kubernetes environment, builds the application, and deploys it for you.

```sh
kustron deploy ./my-app --name myapp --port 3000
```

That's it.

---

## A little history

I originally built Kustron around **2020**, with a very different goal.

At the time, the idea was simple: provide a CLI that could take a bunch of application parameters and generate Kubernetes manifests that could then be used to deploy an application into Kubernetes.

It was mostly a developer convenience tool.

Fast-forward several years.

Someone reached out to me recently with a question about Kustron. That conversation made me realise something I hadn't really considered:

**People were still using it.**

And more interestingly, some of them were trying to use it in ways that were quite different from what I originally had in mind.

That got me thinking about what Kustron could look like today.

The world of software development has changed dramatically since 2020. AI coding assistants and coding agents can now generate an enormous amount of code in a very short time. Creating a prototype is becoming almost trivial.

But there is an interesting problem:

> **Writing the code is increasingly cheap. Creating the environment in which that code can actually run is not.**

You still need somewhere to run it.

You still need the runtime.

You still need dependencies.

You still need networking.

You still need databases and supporting services.

You still need containers and infrastructure.

And you still need a reasonably realistic environment in which to test what you just built.

So I decided to rebuild Kustron — this time with the help of AI — around that problem.

---

## The problem Kustron solves

Modern development often looks something like this:

```text
Idea
  ↓
AI / Developer writes code
  ↓
"It works on my machine"
  ↓
...now what?
  ↓
Install runtime
Configure dependencies
Set environment variables
Start databases
Configure networking
Build containers
Configure Kubernetes
Deploy
Debug environment
  ↓
Finally test the application
```

Kustron tries to collapse most of that into:

```text
Application
    ↓
  Kustron
    ↓
Complete local environment
    ↓
Run & test
```

Instead of spending your first hour configuring the environment, you can spend it actually building the application.

---

## What is Kustron?

Kustron is a CLI that creates a **fully working local Kubernetes environment** and deploys applications into it.

It takes care of:

- Creating a local [k3d](https://k3d.io) Kubernetes cluster
- Configuring `kubectl`
- Creating a local container registry
- Building your application
- Using your `Dockerfile` when available
- Automatically containerizing applications with [Railpack](https://railpack.io) when a `Dockerfile` isn't available
- Pushing the image to the local registry
- Creating the Kubernetes resources required to run the application
- Deploying the application
- Optionally enabling HA and autoscaling

The application can come from:

- A local directory
- A Git repository

The goal is simple:

**Make the distance between "I have an application" and "I can run and test it" as small as possible.**

---

## Quickstart

Install Kustron:

```sh
npm i -g kustron
```

Then deploy an application:

```sh
kustron deploy ./my-app --name myapp --port 3000
```

Kustron will take care of the environment and deployment.

If you want to explicitly manage the cluster yourself:

```sh
# Create the local Kubernetes environment
kustron cluster up

# Deploy an application
kustron deploy ./my-app --name myapp --port 3000

# Check what's running
kustron cluster status

# Remove an application
kustron undeploy myapp

# Tear everything down
kustron cluster down
```

You can also deploy directly from Git:

```sh
kustron deploy git@github.com:user/repo.git --name myapp --port 3000
```

---

## What does Kustron actually create?

When you run:

```sh
kustron cluster up
```

Kustron creates a local Kubernetes environment consisting of:

- 1 server node
- 2 agent nodes
- A local container registry
- Load balancer port mappings
- An automatically configured `kubectl` context

Your local environment is therefore much closer to the Kubernetes environment your application may eventually run in, without requiring a remote cluster.

The registry is available at:

```text
k3d-kustron-registry:5000
```

Ports `8080` and `8443` are mapped to the cluster load balancer.

Once the cluster is running:

```sh
kubectl get nodes
```

works immediately.

---

## Deploying an application

```sh
kustron deploy <source> [options]
```

`<source>` can be either a local path:

```sh
kustron deploy ./my-app --name myapp --port 3000
```

or a Git SSH URL:

```sh
kustron deploy git@github.com:user/repo.git --name myapp --port 3000
```

### Options

| Option | Description |
|---|---|
| `--name <name>` | Application name. Used as the image name and, unless `--ns` is supplied, the namespace |
| `--port <port>` | Port your application listens on |
| `--ns <namespace>` | Deploy into an existing namespace |
| `--replicas <n>` | Number of replicas. Defaults to 1 |
| `--ha` | Enable HA mode with multiple replicas and autoscaling |
| `--env KEY=VALUE` | Set environment variables. Repeatable |

### Build strategy

Kustron follows a simple strategy:

**1. Dockerfile exists**

Use it.

**2. No Dockerfile**

Use [Railpack](https://railpack.io) to detect the application and build a container automatically.

This means many applications can go directly from source code to a running container without requiring you to first write container configuration.

---

## HA mode

For applications where you want something closer to a production-style deployment:

```sh
kustron deploy ./my-app --name myapp --port 3000 --ha
```

HA mode enables:

- A minimum of 2 replicas
- A `HorizontalPodAutoscaler`
- Scaling up to 10 replicas
- CPU-based scaling at 70%
- Memory-based scaling at 80%
- Sensible resource requests and limits

It's still a local environment, but it gives you an easy way to experiment with Kubernetes behaviours that normally require a more involved setup.

---

## Why Kubernetes?

You could run applications directly on your laptop.

And for many applications, that's perfectly fine.

But modern applications increasingly depend on infrastructure concepts such as:

- Containers
- Services
- Service discovery
- Networking
- Namespaces
- Resource limits
- Replicas
- Autoscaling
- Kubernetes configuration

Kustron uses a lightweight local Kubernetes cluster so that your development environment can exercise many of these concepts without requiring a more involved remote environment.

You get the convenience of local development with an environment that looks much more like the infrastructure your application is eventually going to live in.

---

## Local today. VM tomorrow.

Kustron is designed for local development, but there is nothing fundamentally tying the idea to a laptop.

The same setup can run inside a VM.

That opens up another interesting possibility:

```text
AI-generated application
        ↓
     Kustron
        ↓
   Kubernetes VM
        ↓
 Running application
```

Instead of spending time building infrastructure for a prototype, you could potentially provision a VM, install Kustron, point it at your application, and have a working environment very quickly.

That makes Kustron useful not only for local development, but potentially for:

- MVPs
- Prototypes
- Demos
- Temporary environments
- Experiments
- AI-generated applications
- Quick proof-of-concepts

The idea is not to replace proper production infrastructure.

It's to make the **first working environment ridiculously easy to create.**

---

## Prerequisites

Kustron checks your environment when you install it and tells you exactly what's missing.

### Required

- **Docker runtime** — [OrbStack](https://orbstack.dev) is strongly recommended over Docker Desktop. It starts quickly, uses less memory, and has native Apple Silicon support. Docker Desktop works too.
- **k3d** — `brew install k3d` or see [k3d.io/installation](https://k3d.io/installation)
- **kubectl** — `brew install kubectl`

### Optional

- **Railpack** — only required when your application doesn't have a `Dockerfile`. See [railpack.io](https://railpack.io).
- **git** — only required when deploying from a Git URL. Usually already installed.

---

## Commands

### `kustron cluster up`

Creates the local Kubernetes environment.

Includes:

- 1 server node
- 2 agent nodes
- Local container registry
- Load balancer
- Port mappings
- Automatic `kubectl` configuration

### `kustron cluster down`

Tears down the Kustron cluster and cleans up the kubeconfig entry.

### `kustron cluster status`

Shows:

- Cluster nodes
- Registry address
- Current `kubectl` context
- Deployed applications

### `kustron deploy <source>`

Builds and deploys an application from a local directory or Git repository.

### `kustron undeploy <name>`

Removes an application and its associated Kubernetes resources.

---

## The idea behind Kustron

Kustron started as a Kubernetes manifest generator.

It has now evolved into something slightly different:

> **An environment generator.**

The goal is to make infrastructure less of a prerequisite for experimentation.

Especially in a world where an idea can turn into hundreds of lines of working code in minutes, the bottleneck increasingly isn't writing the code.

**It's getting the code somewhere useful to run.**

That's the problem Kustron is trying to solve.

---

## Feedback

Kustron is still evolving.

If you use it, break it, have an idea, or simply have a different way you think it should work, I'd love to hear about it.

File an issue: [github.com/dibosh/kustron/issues](https://github.com/dibosh/kustron/issues)

Pull requests are welcome.
