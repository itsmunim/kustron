![downloads](https://img.shields.io/npm/dm/kustron?style=flat-square)
![version](https://img.shields.io/npm/v/kustron?color=green&style=flat-square)

<p align="center">
  <a href="https://github.com/dibosh/kustron">
    <img alt="Kustron" title="Kustron" src="https://i.imgur.com/Nndv5Vv.png" width="300">
  </a>
</p>

<p align="center">
  Kustomize based kubernetes manifest generator. Simple but glorified!
</p>

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Usage](#usage)
- [Structure](#structure)
- [Release Flow](#release-flow)
- [Feedback](#feedback)

## Introduction

If you have started moving your services to `kubernetes` cluster and was looking for a way to know how to write manifest files in a manageable and idiomatic way- `kustron` is for you. `kustron` is a simple cli tool that helps you generate manifest files for your service. `kustron` uses [kustomization](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) for dynamic templating, to keep things simple and understandable.

**Few of the manifest files are relevant(e.g. cert.yml) only if you are using GKE, but with some basic tweaking you can make the manifests work for any provider like AWS or Azure. Eventually kustron will be extended to support all the major providers out of the box.**

## Features

A few of the things `kustron` can do for you:

* Generate k8s manifests with different env specific overrides

* Generate a `Makefile` with helper commands that you can utilise in your CI/CD pipelines

* Generate a gitlab pipeline with GCP integration format(more cloud providers and other pipeline runners will be available soon)

## Prerequisite

- Install via [npm](https://www.npmjs.com/)- `npm i -g kustron`

- Your application must have been dockerized already, meaning a `Dockerfile` exists at application root dir

## Usage

- In your application root dir, you can run this- `kustron -g` e.g. `cd projects/checkout-service && kustron -g`

- It will ask you a few questions regarding your application; the questions are pretty straight-forward and self-explanatory

- Once you have provided all the answers, a `deployment` folder will be generated with all the necessary files

- If you have chosen the option to generate pipeline, it will also generate a `Makefile` and `gitlab` pipeline for you

- You can also do- `kustron -g -p /absolute/path/of/your/application/folder` to generate all the mentioned files and folders in the path you specified. e.g. `kustron -g /users/lbm/projects/gaan-recorder/`

- You can always do `kustron -h` if you need

## Next Steps

- The generated `deployment` folder will have following structure

```
- deployment
  - base
    - config
      - configmap.yml
      - hpa.yml (only if you have told kustron that your application needs autoscaling)
    - deployment.yml
    - ... (other files like service.yml, ingress.yml etc.)
    - kustomization.yml
  - overrides (all the env specific overrides to base manifests reside here in proper folders)
    - dev
      - ...
    - stg
      - ...
    - prd
      - ...
```

- `base` folder contains base configurations

- `overrides` folder has specific overrides, it considers you will deploy your service at least into 3 envs(e.g. `dev`, `stg`, `prd`)

- All the files have necessary comments to help you out with any modifications you want

- Adding another `env` override should be as simple as creating a dir under `overrides` and copying the files from any of the existing `env` and doing necessary amendments

- If you have asked `kustron` to generate pipeline as well, it will generate a `Makefile` as well as a `.gitlab-ci.yml` file(right now only gitlab pipeline with GCP integration is supported, more options with different providers will come in future)

Apart from these, you should know about few particular files to make things work for your application the right way-

### configmap.yml

- This is the place where you should put all the env vars that your application need at runtime. For example, in case of a nodejs application, you should put proper `NODE_ENV` in this file

- Check the given comments in the file to understand what you can do with it or check official [documentation](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)

### deployment.yml

- Apart from the env variables that get loaded from configmap(and which is hard coded), there are some sensitive env variables(like api key for a third party service) that you can load via `kubernetes` [secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

- These sensitive env variables can be loaded in `deployment.yml` during runtime, an example is given as comments in the file itself

### cert.yml

- Only relevant if you have defined your application to be https only

- The certificate created by this `yml` is a GCP managed certificate resource

- This is already tied to the `ingress` given in env specific overrides(as every env will have different url like dev.myapp.com, stg.myapp.com etc. and hence difference certificates)

- If you are not using GCP, you might check how to add other certificates to your ingress. Here's one with [let's encrypt](https://runnable.com/blog/how-to-use-lets-encrypt-on-kubernetes)


### ingress.yml

- It's a good practice to have `ingress` if you want to expose your service, this necessarily works as a load balancer and creates a public ip

- If your answer to `Is Public` was `No` while creating manifests by `kustron`, this file won't be generated and your service will only be privately accessible by your other services in the cluster

### Makefile & .gitlab-ci.yml

- If your answer to `Generate Pipeline` was `Yes`, `kustron` will generate these files for you

- These files give you the building blocks for your automated build and deployment pipeline

- Check both the files, as they have lots of comments to make things self-explanatory

- None of these files will require much changes when you use a different provider like Azure or AWS- but you should check the comments and understand what has to be changed

## Release Flow

The default generated gitlab pipeline respects the following release flow-

<p align="center">
  <img alt="kustron release flow" title="kustron release flow"
  src="https://i.imgur.com/gsKDi0a.jpg" width="500">
</p>

## Feedback

Feel free to [file an issue](https://github.com/dibosh/kustron/issues/new).

Would love to extend this for other cloud providers. Please create a [pull request](https://github.com/dibosh/kustron/pulls) with one, if you want to add.



