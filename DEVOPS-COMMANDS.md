# DevOps Command Reference

Every command used to actually run this project, grouped by concept. Pulled from what's real and verified elsewhere in this repo (main [README.md](README.md), [terraform_ansible_deployment.md](terraform_ansible_deployment.md), and the `devops/*/README.md` write-ups) — this file is the condensed, copy-paste version with no narrative.

## Table of Contents

- [1. Local Development](#1-local-development)
- [2. Docker / Docker Compose](#2-docker--docker-compose)
- [3. CI — GitHub Actions](#3-ci--github-actions)
- [4. Infrastructure as Code — Terraform](#4-infrastructure-as-code--terraform)
- [5. Configuration Management — Ansible](#5-configuration-management--ansible)
- [6. One-Command Cloud Deploy/Teardown](#6-one-command-cloud-deploytearndown)
- [7. Container Orchestration — Kubernetes](#7-container-orchestration--kubernetes)
- [8. Package Management — Helm](#8-package-management--helm)

---

## 1. Local Development

```bash
cp .env.example .env              # fill in GITHUB_CLIENT_ID/SECRET at minimum

npm install                       # install dependencies
npx prisma generate               # generate Prisma client
npx prisma migrate dev --name init  # create DB tables (needs a running Postgres + DATABASE_URL)

npm run dev                       # start dev server → http://localhost:3000
npm run build                     # production build
npm run start                     # run the production build

npx tsc --noEmit                  # type check only, no output
npm run lint                      # ESLint (next/core-web-vitals)
```

---

## 2. Docker / Docker Compose

```bash
docker compose up --build         # build + start app + Postgres (foreground)
docker compose up --build -d      # same, detached

docker compose logs -f app        # follow app logs
docker compose down               # stop everything
docker compose down -v            # stop + delete the DB volume (full reset)

docker build -t gitinsight .      # build the image directly (no compose)
docker ps                         # list running containers
docker exec -it <container> sh    # shell into a running container
```

---

## 3. CI — GitHub Actions

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — checkout → setup Node → `npm ci` → `prisma generate` → type check → lint → build. Triggers: `push`/`pull_request` to `main`, or on demand.

```bash
gh auth login                                  # one-time device-flow login
gh auth status                                 # confirm logged in

gh workflow run ci.yml                         # trigger a run on demand (workflow_dispatch)
gh run list --workflow=ci.yml --limit 5        # recent runs
gh run watch <run-id> --exit-status            # live-follow a run until it finishes
gh run view <run-id>                           # summary of a finished run
gh run view <run-id> --log                     # full raw log

git push origin main                           # also triggers a run automatically
```

---

## 4. Infrastructure as Code — Terraform

Inside `terraform/` — provisions an AWS EC2 instance + Elastic IP + security group for the production deploy.

```bash
cd terraform

terraform init                    # download providers, set up backend
terraform plan                    # preview what would change
terraform apply                   # create/update the infrastructure
terraform apply -auto-approve     # same, no interactive confirmation

terraform output                  # show outputs (ec2_public_ip, ssh_connection_command, ...)
terraform state list               # list every resource Terraform is tracking
terraform destroy                 # tear everything down
terraform destroy -auto-approve   # same, no confirmation (what destroy.sh/destroy.ps1 run)
```

---

## 5. Configuration Management — Ansible

### Production deploy (`ansible/deploy.yml`, targets the real EC2 box via `ansible/inventory.ini`)

```bash
ansible-galaxy collection install -r ansible/requirements.yml   # one-time, installs ansible.posix

cd ansible
ansible all -i inventory.ini -m ping                  # connectivity check
ansible-playbook -i inventory.ini deploy.yml          # full deploy (Docker install, rsync code, docker compose up)
```

On Windows, if `ansible-playbook` isn't installed natively, run it through WSL instead:

```powershell
wsl ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -i inventory.ini deploy.yml
```

### Lab case study (`devops/kubernetes-ansible/ansible/`, 3 disposable local containers as "servers")

```powershell
# One-time: spin up 3 SSH-reachable Ubuntu containers + bootstrap sshd on each
.\devops\kubernetes-ansible\ansible\setup-servers.ps1
```

```bash
cd devops/kubernetes-ansible/ansible

ansible all -i inventory.ini -m ping                      # → pong from server1/2/3
ansible-playbook -i inventory.ini install-nginx.yml        # installs nginx, starts it, deploys a page
ansible-playbook -i inventory.ini install-nginx.yml        # run again → changed=0 (idempotency proof)
```

---

## 6. One-Command Cloud Deploy/Teardown

Wraps Terraform + Ansible together (credential setup: see [terraform_ansible_deployment.md](terraform_ansible_deployment.md)).

```bash
# Windows
.\deploy.ps1
.\destroy.ps1

# Linux / macOS / Git Bash / WSL
chmod +x deploy.sh destroy.sh
./deploy.sh
./destroy.sh
```

---

## 7. Container Orchestration — Kubernetes

Works against either a `kind` cluster or Docker Desktop's built-in Kubernetes (`kubectl config get-contexts` to see which is active).

```bash
kind create cluster --name devops-lab       # create a local cluster (if not using Docker Desktop's)
kind delete cluster --name devops-lab       # tear it down

kubectl get nodes -o wide                   # cluster/node info
kubectl config get-contexts                 # which cluster kubectl is pointed at
```

### Core objects (see `devops/kubernetes-ansible/k8s/*.yaml` for the actual manifests)

```bash
kubectl apply -f pod.yaml                                      # Pod
kubectl apply -f deployment.yaml                                # Deployment (3 replicas)
kubectl expose deployment nginx-deployment --type=NodePort --port=80   # Service from a Deployment

kubectl create namespace dev                                    # Namespace
kubectl create configmap app-config --from-literal=APP_ENV=production   # ConfigMap
kubectl create secret generic db-secret --from-literal=username=admin --from-literal=password=admin123   # Secret

kubectl apply -f pv.yaml -f pvc.yaml -f pv-pod.yaml             # PersistentVolume → Claim → Pod
```

### Service types (standalone manifests)

```bash
kubectl apply -f service-clusterip.yaml       # internal-only
kubectl apply -f service-nodeport.yaml        # <Node-IP>:<NodePort>
kubectl apply -f service-loadbalancer.yaml    # external IP (cloud) / <pending> on bare kind
kubectl apply -f service-externalname.yaml    # pure DNS alias, no ClusterIP
```

### Inspecting / verifying

```bash
kubectl get pods,deployments,svc,configmap,secret,pv,pvc -o wide
kubectl get namespaces
kubectl describe pod <name>
kubectl logs <pod-name>

curl http://localhost:<node-port>             # hit a NodePort service directly
```

### Cleanup

```bash
kubectl delete pod,deployment,svc,configmap,secret,pvc,pv --all
kubectl delete namespace dev
```

---

## 8. Package Management — Helm

See `devops/kubernetes-helm/myapp/` for the actual chart.

```bash
helm version                            # check install

helm create myapp                       # scaffold a new chart

helm template myapp ./myapp             # render manifests locally, no cluster changes

helm install myrelease ./myapp          # install a release
helm list                               # list releases + their revision
helm status myrelease                   # full status: resources, notes, revision

# edit values.yaml (e.g. bump replicaCount), then:
helm upgrade myrelease ./myapp          # apply the change, revision increments
helm rollback myrelease 1               # revert to a previous revision

helm uninstall myrelease                # remove every resource the release owns
```
