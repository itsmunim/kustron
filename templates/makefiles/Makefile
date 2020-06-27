# This makefile is inspired and created for google cloud platform based
# deployment and pipeline. You will need to modify the configuration tasks
# to make it work for other cloud providers.

# Uses semantic version based tags.

# Denotes a tag originated from last annotated tag, but make sure you have
# at least one tag available for this repo otherwise it will fail.
# If you have not added one yet, add by running: git tag -a v1.0.0 -m 'Initial version'
DEV_TAG ?= ${shell git describe}
# Denotes a proper tag, used for production image tagging
PRD_TAG ?= ${shell git describe --abbrev=0}

# Service Account
# ----------------
# env: to authenticate with gcloud cli and to be able to deploy into the cluster
# a service account for each env(e.g. dev, stg) with necessary perms have to be
# created and added to your pipeline as environment variable. In gitlab you can create
# the environment variable as file. If it's not available as file, then you have to write
# the variable content as file. The environment variable follows a naming like: 
# gcp_sa_key_dev, gcp_sa_key_stg etc.
# -----------------
# Permissions:
# gcp_sa_key_dev:
# 1. r/w access to dev project GCS
# 2. necessary access to deploy into dev project GKE cluster
#
# gcp_sa_key_stg:
# 1. r access to dev project GCS
# 2. w access to stg project GCS
# 3. necessary access to deploy into stg project GKE cluster
#
# gcp_sa_key_prd:
# 1. r access to stg project GCS
# 2. w access to prd project GCS
# 3. necessary access to deploy into prd project GKE cluster
GCP_SA_KEY := $(shell eval echo \${gcp_sa_key_${env}})

# Configuration Task
# -------------------
# 
# Should only be invoked by ci-cd pipeline.
#
# Usage: make configure cluster=mygkecluster location="--zone asia-southeast1-a"\
#        project=dev-project\
#        img_registry_host=https://gcr.io\
#        env=dev
configure:
  # This is where you should configure your provider specific cli to make your
	# pipeline able to run the next steps of building and uploading image via docker
	# and also deploying into your provider given kubernetes cluster.
	# 
	# This one uses gcp as example.
	#
	# cluster: the gke cluster name
	#
	# location: the gke cluster location; either zone or region
	# e.g. location="--zone asia-southeast1-a" or location="--region asia-southeast1"
  #
  # project: gcp project id e.g. sample-dev-project, dev-project-001 etc.
	#
	# img_registry_host: the docker image registry host e.g. for gcp https://gcr.io
	@ docker login -u _json_key --password-stdin ${img_registry_host} < ${GCP_SA_KEY}
	@ gcloud auth activate-service-account --key-file ${GCP_SA_KEY}
	@ gcloud container clusters get-credentials ${cluster} ${location} --project ${project}


# Image Build & Publish Tasks
# ------------------------------
#
# The same built image will be used by staging env as well; this is invoked from
# publish_dev step.
#
# img_path: the image path in registry e.g. gcr.io/dev-project/a-service
.PHONY: build_dev
build_dev:
	@ echo "Building dev docker image for version ${DEV_TAG}"
	@ docker build -t ${img_path}:${DEV_TAG} .

# example: make publish_dev img_path=gcr.io/dev-project/a-service
#
# img_path: the image path in registry e.g. gcr.io/dev-project/a-service
.PHONY: publish_dev
publish_dev: build_dev
	@ echo "Publishing image to dev registry"
	@ docker push ${img_path}:${DEV_TAG}
	@ echo "Done publishing: ${img_path}:${DEV_TAG}"

# Instead of building the same image, dev image should be promoted to
# staging env and tested out- hence this step basically promotes the
# dev image to stg.
#
# example: make publish_stg dev_path=gcr.io/dev-project/a-service\
#          stg_path=gcr.io/stg-project/a-service
# 
# dev_path: the dev image path e.g. gcr.io/dev-project/a-service
# stg_path: the stg image path e.g. gcr.io/stg-project/a-service
.PHONY: publish_stg
publish_stg:
	@ echo "Promoting dev image to stg image registry"
	@ docker pull ${dev_path}:${DEV_TAG}
	# tag remains same, just the image path is different
	@ docker tag ${dev_path}:${DEV_TAG} ${stg_path}:${DEV_TAG}
	# this helps during production promotion, explained in publish_prd step
	@ docker tag ${dev_path}:${DEV_TAG} ${stg_path}:latest
	@ docker push ${stg_path}:${DEV_TAG}
	@ docker push ${stg_path}:latest
	@ echo "Done promoting: ${dev_path}:${DEV_TAG} to: ${stg_path}:${DEV_TAG} and ${stg_path}:latest"

# Since production publish is initiated via new tags, at that moment it overrides
# the tag that was used in stg and dev temp tagging, obtained via git describe.
# to overcome that issue the last stg image was also tagged with latest so that
# docker pull img_path:latest can be done to fetch the actual stg image which we
# want to promote to prd.
#
# example: make publish_prd stg_path=gcr.io/stg-project/a-service\
#          prd_path=gcr.io/prd-project/a-service
#
# stg_path: the stg image path e.g. gcr.io/stg-project/a-service
# prd_path: the prd image path e.g. gcr.io/prd-project/a-service
.PHONY: publish_prd
publish_prd:
	@ echo "Promoting latest stg image to prd registry with final tag: ${PRD_TAG}"
	@ docker pull ${stg_path}:latest
	@ docker tag ${stg_path}:latest ${prd_path}:${PRD_TAG}
	@ docker push ${prd_path}:${PRD_TAG}
	@ echo "Done promoting: ${stg_path}:latest to: ${prd_path}:${PRD_TAG}"

# k8s Deployment Tasks
# ---------------------
#
# Base deployment task. All env specific task uses this.
install: 
	@ echo "Deploying image: ${img} into ${env}"
	@ cd deployment/overrides/${env} && \
		kustomize edit set image IMAGE_PLACEHOLDER=${img} && \
		kustomize build ./  | kubectl apply -f -

# example: make install_dev img_path=gcr.io/dev-project/a-service
#
# img_path: the dev image path e.g. gcr.io/dev-project/a-service
install_dev:
	@ $(MAKE) install env=dev img=${img_path}:${DEV_TAG}

# img_path: the stg image path e.g. gcr.io/stg-project/a-service
install_stg:
	@ $(MAKE) install env=stg img=${img_path}:${DEV_TAG}

# img_path: the prd image path e.g. gcr.io/prd-project/a-service
install_prd:
	@ $(MAKE) install env=prd img=${img_path}:${PRD_TAG}