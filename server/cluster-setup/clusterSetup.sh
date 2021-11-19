#!/bin/bash

# Install Helm
sudo snap install helm --classic

# Add helm repos 
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx # ngnix ingress controller
helm repo add jetstack https://charts.jetstack.io # cert manager
helm repo add bitnami https://charts.bitnami.com/bitnami # redis
helm repo update

# install packages onto Kubernetes
helm install sensor ingress-nginx/ingress-nginx --set controller.publishService.enabled=true # install nginx ingress controler
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --version v1.6.0 --set installCRDs=true # install cert-manager
kubectl create namespace redis
kubectl apply -f redis-storage.yaml
helm install sensor-redis bitnami/redis --namespace redis --set persistence.storageClass=redis-storage --set auth.enabled=false --set architecture=standalone
kubectl apply -f prod_issuer.yaml