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
- [CI/CD Pipeline](#ci/cd-pipeline)
- [Feedback](#feedback)

## Introduction

If you have started moving your services to `kubernetes` cluster and was looking for a way to know how to write manifest files in a manageable and idiomatic way- `kustron` is for you. `kustron` is a simple cli tool that helps you generate manifest files for your service. `kustron` uses [kustomization](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) and even generates `dockerfile` for your service specific language.

**Even though some of the manifest files are mainly targeted if you are using GKE(google kubernetes engine) but most of them are easily applicable for any other cloud providers.**

## Features

A few of the things `kustron` can do for you:

* Generate k8s manifests with different env specific overrides

* Generate `dockerfile` for your specific stack; currently supported- `java with maven`, `golang` and `nodejs`(more language options will be added soon)

* Generate a `Makefile` with helper commands that you can utilise in your CI/CD pipelines

* Generate a gitlab pipeline with GCP integration format(more cloud providers and other pipeline runners will be available in near future)

## Usage

- Install via [npm](https://www.npmjs.com/)- `npm i -g kustron`

- In your service source dir, you can run this- `kustron -g` e.g. `cd projects/checkout-service && kustron -g`

- It will ask you a few questions regarding your app/service; the questions are pretty straight-forward and self-explanatory

- Once you have provided all the answers, a `deployment` folder will be generated with all the necessary files

- A `dockerfile` will also be generated at the project root

- If you have chosen the option to generate pipeline, it will also generate a `Makefile` and `gitlab` pipeline for you

- You can also do- `kustron -g -p /absolute/path/of/your/service/folder` to generate all the mentioned files and folders in the path you specified. e.g. `kustron -g /users/lbm/projects/gaan-recorder/`

- You can always do- `kustron -h` to check the help

## Structure

- The generated `deployment` folder will have following structure

```
- deployment
  - base
    - config
      - configmap.yml
      - hpa.yml
    - deployment.yml
    - ...
    - kustomization.yml
  - overrides
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

- The goal is to get you started with your manifestation with a full fledged CI/CD- even though right now only GCP specific suffs are available, you can easily tweak this to add providers like AWS or Azure. `kustron` will be enriched with those options in future releases

## CI/CD Pipeline

The default generated gitlab pipeline respects the following release flow-

<p align="center">
  <img alt="kustron release flow" title="kustron release flow"
  src="https://i.imgur.com/gsKDi0a.jpg" width="500">
</p>

## Feedback

Feel free to [file an issue](https://github.com/dibosh/kustron/issues/new).

Would love to extend this for other cloud providers and language options. Feel free to create a PR with one if you want to add. 



