# Kubernetes Objects, Services and Ansible Configuration Management

Executed end-to-end on a local machine (Windows 11 + Docker Desktop, WSL2). All commands below were actually run; the output shown is real, not illustrative.

## Environment

- **Kubernetes cluster**: Docker Desktop's built-in single-node cluster (`kubectl config get-contexts` → `docker-desktop`), rather than a separate `kind` cluster — `kind` was tried first but its control-plane node failed to boot under this host's cgroup v2 configuration (`could not find a log line that matches "...Multi-User System...|detected cgroup v1"`). Docker Desktop's own cluster gives identical object/Service semantics with no extra moving parts.
- **Ansible control node**: WSL2 (Ubuntu), invoked as `wsl ansible-playbook ...` — matches this repo's existing convention for running Ansible on Windows (see `deploy.ps1`).
- **Ansible targets**: 3 disposable local Docker containers (`geerlingguy/docker-ubuntu2204-ansible`) standing in for "multiple Linux web servers", reachable over real SSH on `127.0.0.1:2222/2223/2224`. A real, already-provisioned AWS EC2 instance exists elsewhere in this repo (the production Terraform/Ansible deployment pipeline), but it's currently running the actual production app — deliberately not reused here to avoid mixing an unrelated demo onto live infrastructure.

---

## Part A — Kubernetes Objects

### 1. Pod

```
kubectl apply -f k8s/pod.yaml
→ pod/nginx-pod created

kubectl get pods
NAME        READY   STATUS    RESTARTS   AGE
nginx-pod   1/1     Running   0          13m
```

### 2. Deployment

```
kubectl apply -f k8s/deployment.yaml
→ deployment.apps/nginx-deployment created

kubectl get deployments
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3/3     3            3           13m
```

### 3. Service (exposing the Deployment)

```
kubectl expose deployment nginx-deployment --type=NodePort --port=80
→ service/nginx-deployment exposed

kubectl get svc
NAME               TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
nginx-deployment   NodePort   10.107.16.40   <none>        80:31334/TCP   12m
```

Verified live: `curl http://localhost:31334` → HTTP 200, nginx welcome page.

### 4. Namespace

```
kubectl create namespace dev
→ namespace/dev created

kubectl get namespaces
NAME                     STATUS   AGE
default                  Active   2d13h
dev                      Active   12m
...
```

### 5. ConfigMap

```
kubectl create configmap app-config --from-literal=APP_ENV=production
→ configmap/app-config created

kubectl get configmap app-config -o yaml
apiVersion: v1
data:
  APP_ENV: production
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
```

### 6. Secret

Dummy lab credentials for demonstration purposes — not real secrets.

```
kubectl create secret generic db-secret --from-literal=username=admin --from-literal=password=admin123
→ secret/db-secret created

kubectl get secret db-secret -o yaml
apiVersion: v1
data:
  password: YWRtaW4xMjM=
  username: YWRtaW4=
kind: Secret
type: Opaque
```

(base64-encoded, not encrypted — demonstrates the format, not a security boundary.)

### 7. Persistent Volume → Claim → Pod

`k8s/pv.yaml` defines a `hostPath` PersistentVolume; `k8s/pvc.yaml` claims it; `k8s/pv-pod.yaml` mounts the claim into an nginx Pod. Both PV and PVC use `storageClassName: manual` deliberately — Docker Desktop's cluster ships a default dynamic-provisioning StorageClass, which would otherwise provision a fresh volume instead of binding to this manually-created one.

```
kubectl apply -f k8s/pv.yaml -f k8s/pvc.yaml -f k8s/pv-pod.yaml

kubectl get pv
NAME     CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM             STORAGECLASS   AGE
app-pv   1Gi        RWO            Retain           Bound    default/app-pvc   manual         12m

kubectl get pvc
NAME      STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
app-pvc   Bound    app-pv   1Gi        RWO            manual         12m

kubectl get pod pv-demo-pod
NAME          READY   STATUS    RESTARTS   AGE
pv-demo-pod   1/1     Running   0          12m
```

---

## Service Types

Each type applied as its own Service, backed by the same `nginx-deployment` Pods (except `ExternalName`, which has no selector at all):

```
kubectl get svc -o wide
NAME                 TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)        SELECTOR
external-service     ExternalName   <none>           example.com   <none>         <none>
kubernetes           ClusterIP      10.96.0.1        <none>        443/TCP        <none>
nginx-clusterip      ClusterIP      10.111.158.120   <none>        80/TCP         app=nginx
nginx-deployment     NodePort       10.107.16.40     <none>        80:31334/TCP   app=nginx
nginx-loadbalancer   LoadBalancer   10.101.253.25    localhost     80:30125/TCP   app=nginx
```

| Type | Observed behavior here |
|---|---|
| **ClusterIP** | `nginx-clusterip` only got an internal `10.111.158.120` address — reachable from inside the cluster, not from the host. This is the default type, used for internal service-to-service traffic. |
| **NodePort** | `nginx-deployment` opened node port `31334`, reachable at `<Node-IP>:<NodePort>`. Verified: `curl http://localhost:31334` → HTTP 200. |
| **LoadBalancer** | `nginx-loadbalancer` actually received a real `EXTERNAL-IP` of `localhost` here, because Docker Desktop's Kubernetes ships its own LoadBalancer implementation. On a bare `kind` cluster (no cloud LB controller) the same manifest would instead sit at `<pending>` indefinitely — a real difference between local test clusters and cloud environments. Verified: `curl http://localhost:80` → HTTP 200. |
| **ExternalName** | `external-service` has no `ClusterIP` at all — it's a pure DNS alias. Inside the cluster, resolving `external-service` returns a `CNAME` to `example.com` rather than routing to any Pod. |

---

## Part B — Ansible Case Study: Automated Nginx Installation

### Architecture

```
Ansible control node (WSL2)
        |
    SSH (key-based)
    /    |    \
server1 server2 server3
(127.0.0.1:2222/2223/2224 → 3 separate Docker containers)
```

### Inventory (`ansible/inventory.ini`)

```ini
[webservers]
server1 ansible_host=127.0.0.1 ansible_port=2222 ansible_user=root ansible_ssh_private_key_file=~/devops-lab-keys/id_rsa ...
server2 ansible_host=127.0.0.1 ansible_port=2223 ansible_user=root ansible_ssh_private_key_file=~/devops-lab-keys/id_rsa ...
server3 ansible_host=127.0.0.1 ansible_port=2224 ansible_user=root ansible_ssh_private_key_file=~/devops-lab-keys/id_rsa ...
```

### Connectivity test

```
ansible all -i inventory.ini -m ping

server1 | SUCCESS => { "ping": "pong" }
server2 | SUCCESS => { "ping": "pong" }
server3 | SUCCESS => { "ping": "pong" }
```

### Playbook (`ansible/install-nginx.yml`)

Installs nginx, starts + enables it, and deploys a static `index.html`.

```
ansible-playbook -i inventory.ini install-nginx.yml

TASK [Install Nginx]  → changed: [server1] [server2] [server3]
TASK [Start Nginx]    → changed: [server1] [server2] [server3]
TASK [Deploy Web Page]→ changed: [server1] [server2] [server3]

PLAY RECAP
server1 : ok=4  changed=3  unreachable=0  failed=0
server2 : ok=4  changed=3  unreachable=0  failed=0
server3 : ok=4  changed=3  unreachable=0  failed=0
```

### Verification

```
curl http://127.0.0.1:8091   (server1)
curl http://127.0.0.1:8082   (server2)
curl http://127.0.0.1:8083   (server3)

→ <h1>Web Server Configured Using Ansible</h1>   (all three, identical)
```

### Idempotency

Re-running the exact same playbook against already-configured servers changes nothing — the core guarantee Ansible modules provide:

```
ansible-playbook -i inventory.ini install-nginx.yml

PLAY RECAP
server1 : ok=4  changed=0  unreachable=0  failed=0
server2 : ok=4  changed=0  unreachable=0  failed=0
server3 : ok=4  changed=0  unreachable=0  failed=0
```

### Notable setup issues (worth noting — this is where the real learning happened)

- `geerlingguy/docker-ubuntu2204-ansible` is built for Ansible's Molecule testing (`docker exec`-based), not SSH — `openssh-server` had to be installed and enabled on each container as a bootstrap step (see `ansible/setup-servers.ps1`).
- Booting a systemd container (`/sbin/init`) under this host's cgroup v2 setup required `--cgroupns=host` plus a `/sys/fs/cgroup` mount and `tmpfs` mounts for `/run`/`/run/lock` — without these the containers exited immediately with no log output. `docker-compose` (v5.0.1, bundled with this Docker Desktop) has no schema field for this, so the servers are started via a plain `docker run`-based script instead of `docker-compose.yml`.
- A public key bind-mounted directly onto `/root/.ssh/authorized_keys` from a Windows path comes through as world-writable (`777`) — OpenSSH's `StrictModes` silently rejects that for publickey auth. Fixed by mounting the key to a scratch path and copying it into place with `chmod 600` inside the container instead.
- The same permission issue applies to the *private* key on the Ansible control-node side: a key on a Windows-mounted WSL path (`/mnt/d/...`) can't carry real POSIX permission bits, so OpenSSH refuses it there too. Fixed by copying the private key into WSL's own filesystem (`~/devops-lab-keys/id_rsa`, `chmod 600`) and pointing `ansible_ssh_private_key_file` at that copy.

---

## Ansible Benefits Demonstrated

- **Agentless** — only SSH + Python needed on the targets, confirmed by the `ping` module using nothing but a key.
- **Repeatable / Infrastructure as Code** — the same `install-nginx.yml` ran identically against 3 independent containers.
- **Idempotent** — second run showed `changed=0` across all hosts.
- **Centralized management & scaling** — adding a 4th server is a one-line inventory addition, no playbook change.
- **Reduced manual error** — no server was configured by hand; every step is in version control.

## Combined DevOps Workflow

This repo already runs the first half of that pipeline for real: GitHub → GitHub Actions → Docker build → containerized app, deployed via the existing Terraform + Ansible pipeline (`terraform/`, `ansible/deploy.yml`) onto AWS EC2. The exercises in this folder cover the remaining two stages of that same diagram — container **orchestration** (Kubernetes objects/Services, Part A) and **infrastructure configuration automation** (Ansible, Part B) — using local, disposable infrastructure so the techniques could be demonstrated safely without touching the production deployment.

## Cleanup (not run — left live for review)

```
kubectl delete pod,deployment,svc,configmap,secret,pvc,pv --all --field-selector metadata.namespace=default
kubectl delete namespace dev
docker rm -f devops-lab-server1 devops-lab-server2 devops-lab-server3
```
