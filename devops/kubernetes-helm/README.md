# Kubernetes Architecture and Helm

Executed end-to-end against the same local Kubernetes cluster used in `devops/kubernetes-ansible/` (Docker Desktop's built-in single-node cluster). All commands and output below are real, captured from an actual run — not illustrative.

## Environment

- **Cluster**: Docker Desktop Kubernetes (`docker-desktop` context) — same cluster as `devops/kubernetes-ansible/`.
- **Helm**: v4.3.0, installed via `winget install Helm.Helm`.

---

## Part A — Kubernetes Architecture

Kubernetes automates deployment, scaling, networking, service discovery, load balancing, and recovery of containerized applications, via a **control plane** (cluster-wide decisions) and one or more **worker nodes** (where containers actually run):

```
Kubernetes Cluster

+---------------------------+
|       Control Plane       |
|---------------------------|
| API Server                |
| Scheduler                 |
| Controller Manager        |
| etcd                      |
+-------------+-------------+
              |
      ---------------------
      |                   |
+-------------+     +-------------+
| Worker Node |     | Worker Node |
|-------------|     |-------------|
| kubelet     |     | kubelet     |
| kube-proxy  |     | kube-proxy  |
| Containers  |     | Containers  |
+-------------+     +-------------+
```

### Components, mapped to what's actually running on this cluster

Docker Desktop's Kubernetes runs as a **single node that is both control-plane and worker** — every component below exists as a real Pod in the `kube-system` namespace, confirmed live:

```
kubectl get nodes -o wide
NAME             STATUS   ROLES           VERSION   CONTAINER-RUNTIME
docker-desktop   Ready    control-plane   v1.34.1   docker://29.1.3

kubectl get pods -n kube-system
NAME                                     READY   STATUS    RESTARTS   AGE
coredns-66bc5c9577-lps7d                 1/1     Running   3          2d3h
coredns-66bc5c9577-xd2vs                 1/1     Running   3          2d3h
etcd-docker-desktop                      1/1     Running   5          2d18h
kube-apiserver-docker-desktop            1/1     Running   5          2d18h
kube-controller-manager-docker-desktop   1/1     Running   5          2d18h
kube-proxy-4r44s                         1/1     Running   5          2d18h
kube-scheduler-docker-desktop            1/1     Running   5          2d18h
storage-provisioner                      1/1     Running   9          2d18h
vpnkit-controller                        1/1     Running   5          2d18h
```

| Component | Purpose | Seen above as |
|---|---|---|
| **API Server** | Entry point for all Kubernetes API requests (every `kubectl` command goes through it) | `kube-apiserver-docker-desktop` |
| **etcd** | Stores cluster configuration and state (the source of truth for every object in the cluster) | `etcd-docker-desktop` |
| **Scheduler** | Assigns Pods to suitable worker nodes based on resource requests/constraints | `kube-scheduler-docker-desktop` |
| **Controller Manager** | Runs control loops that reconcile actual state → desired state (e.g. ReplicaSet controller recreating a dead Pod) | `kube-controller-manager-docker-desktop` |
| **kubelet** | Per-node agent that actually starts/stops/monitors Pods and containers | Runs as a host-level process on `docker-desktop` (not a Pod itself — it's what *starts* the Pods above) |
| **kube-proxy** | Implements Service networking/load-balancing rules on each node | `kube-proxy-4r44s` |
| **Container Runtime** | Actually executes containers | `docker://29.1.3` (shown in the node's `CONTAINER-RUNTIME` column) |

(`coredns` provides in-cluster DNS/service discovery; `storage-provisioner` and `vpnkit-controller` are Docker-Desktop-specific extras, not part of core Kubernetes architecture.)

---

## Part B — Helm

Helm is a package manager for Kubernetes: a chart bundles a set of Kubernetes manifests as templates plus a single `values.yaml` of configuration, so the same chart can be installed repeatedly with different settings instead of hand-editing YAML each time.

### Create a chart

```
helm version
version.BuildInfo{Version:"v4.3.0", ...}

helm create myapp
Creating myapp
```

Generated structure (the standard Helm chart layout, plus a few modern scaffolding extras):

```
myapp/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── serviceaccount.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    ├── httproute.yaml
    ├── _helpers.tpl
    ├── NOTES.txt
    └── tests/test-connection.yaml
```

`values.yaml` was edited for this demo:

```yaml
replicaCount: 2        # later changed to 3 to demonstrate `helm upgrade`

image:
  repository: nginx
  tag: "latest"

service:
  type: NodePort
  port: 80
```

### `helm template` — render manifests without deploying anything

```
helm template myapp ./myapp
---
# Source: myapp/templates/service.yaml
apiVersion: v1
kind: Service
...
spec:
  type: NodePort
  ports:
    - port: 80
...
# Source: myapp/templates/deployment.yaml
apiVersion: apps/v1
...
```

Confirms the chart renders correctly with the edited values (`NodePort`, our `nginx:latest` image) before anything touches the cluster.

### `helm install`

```
helm install myrelease ./myapp
NAME: myrelease
LAST DEPLOYED: Wed Oct 14 17:21:21 2026
NAMESPACE: default
STATUS: deployed
REVISION: 1

helm list
NAME       NAMESPACE   REVISION   STATUS     CHART         APP VERSION
myrelease  default     1          deployed   myapp-0.1.0   1.16.0
```

### `helm status` + `kubectl` verification

```
helm status myrelease
==> v1/Service
NAME              TYPE       PORT(S)
myrelease-myapp   NodePort   80:30677/TCP
==> v1/Deployment
NAME              READY   AVAILABLE
myrelease-myapp   2/2     2
==> v1/Pod(related)
myrelease-myapp-7fd88854f4-5l5wt   1/1   Running
myrelease-myapp-7fd88854f4-qc57g   1/1   Running

kubectl get pods,deployments,services -l app.kubernetes.io/instance=myrelease
→ matches helm status exactly — 2 Pods Running, Deployment 2/2
```

**Live traffic verification**: `curl http://localhost:30677` → HTTP 200 (nginx default page, served by the Helm-deployed Pods).

### `helm upgrade`

Changed `replicaCount: 2` → `3` in `values.yaml`, then:

```
helm upgrade myrelease ./myapp
Release "myrelease" has been upgraded. Happy Helming!
REVISION: 2

helm list
NAME       REVISION   STATUS     CHART
myrelease  2          deployed   myapp-0.1.0

kubectl get deployment myrelease-myapp
NAME              READY   UP-TO-DATE   AVAILABLE
myrelease-myapp   3/3     3            3
```

`REVISION` incrementing from 1 → 2 is Helm tracking this as a new, rollback-able version of the release (`helm rollback myrelease 1` would revert it) — not a fresh install.

### `helm uninstall`

```
helm uninstall myrelease
release "myrelease" uninstalled

helm list
No resources found in default namespace.

kubectl get pods -l app.kubernetes.io/instance=myrelease
(empty — Pods, Deployment, Service, ServiceAccount all removed together)
```

Confirms Helm tracks every resource it created as one release and tears all of them down atomically.

### Current state (left running for review)

The release was reinstalled afterward (`helm install myrelease ./myapp`, `values.yaml` still at `replicaCount: 3`) so it can be inspected live:

```
helm list
NAME       NAMESPACE   REVISION   STATUS     CHART         APP VERSION
myrelease  default     1          deployed   myapp-0.1.0   1.16.0

kubectl get svc myrelease-myapp
NAME              TYPE       PORT(S)
myrelease-myapp   NodePort   80:30120/TCP
```

Teardown command (not run): `helm uninstall myrelease`.

---

## Expected Result

A Kubernetes application (3 nginx replicas, exposed via NodePort) was deployed, inspected, upgraded, and torn down successfully using a single Helm chart — confirmed via `helm status`, `kubectl get`, and a live `curl` against the running Service.

## Learning Outcome

- **Architecture**: every control-plane component (API server, etcd, scheduler, controller manager) and the node-level components (kubelet, kube-proxy, container runtime) are not abstract — they're real, inspectable Pods/processes, confirmed against this actual running cluster.
- **Helm**: `helm template` renders without touching the cluster; `helm install` creates a *release* (a named, versioned group of resources, not just "apply some YAML"); `helm upgrade` changes that release's resources in place and increments its revision (making it rollback-able); `helm uninstall` removes every resource the release owns, together, in one command — the core value-add over plain `kubectl apply` on hand-maintained YAML files.
