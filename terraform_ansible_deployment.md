# Terraform & Ansible FA1 Deployment Guide

This repository contains a production-grade, automated deployment pipeline using **Terraform** (Infrastructure as Code) and **Ansible** (Configuration Management) to provision AWS EC2 infrastructure and deploy the **Workflow Automation DevOps** Docker container stack.

---

## 🏗️ Architecture Overview

1. **Terraform (`terraform/`)**:
   - Provisions an AWS EC2 `t2.micro` instance running Ubuntu 22.04 LTS (Jammy).
   - Configures `aws_security_group` opening inbound ports `22` (SSH), `80` (HTTP), and `3000` (Next.js Application), with all egress allowed.
   - Attaches a 20GB `gp3` root volume.
   - Supports pre-existing SSH key pairs (`var.use_existing_key = true`) or dynamic RSA key generation (`tls_private_key`).

2. **Ansible (`ansible/`)**:
   - Automatically installs Docker Engine and Docker Compose v2 plugin.
   - Configures user permissions (adding `ubuntu` to `docker` group).
   - Synchronizes application source code to `/home/ubuntu/app` (excluding local state, node_modules, and git data).
   - Handles environment configuration by creating `.env` with a securely generated `NEXTAUTH_SECRET`.
   - Orchestrates container lifecycle: `docker compose down --remove-orphans` and `docker compose up -d --build`.
   - Polls `http://127.0.0.1:3000` until HTTP 200/302 OK status is achieved.

3. **Orchestration Scripts (`deploy.sh` / `deploy.ps1`)**:
   - One-click, single-command execution supporting Windows PowerShell, Linux, macOS, Git Bash, and WSL.

---

## 🔑 Key & Credential Placement Map

| Credential / Key | Exact File & Location | Action / Instructions |
| :--- | :--- | :--- |
| **SSH Private Key (`.pem`)** | `keys/fa1-key.pem` | Place your private key file inside `keys/fa1-key.pem`. Ensure permissions: `chmod 400 keys/fa1-key.pem`. (Strictly ignored by `.gitignore`). |
| **AWS Access Key ID** | `aws.env` or `~/.aws/credentials` | Run `aws configure` OR copy `aws.env.example` to `aws.env` and paste your ID into `export AWS_ACCESS_KEY_ID="..."`. |
| **AWS Secret Access Key** | `aws.env` or `~/.aws/credentials` | Run `aws configure` OR copy `aws.env.example` to `aws.env` and paste your secret into `export AWS_SECRET_ACCESS_KEY="..."`. |
| **AWS Session Token** | `aws.env` or `~/.aws/credentials` | Optional: Paste token into `aws.env` (`export AWS_SESSION_TOKEN="..."`) if using AWS Academy / Learner Lab. |

---

## 🚀 Execution Instructions (Post-Merge Workflow)

After this pull request is merged into `main`, execute the deployment on your machine using these steps:

### Step 1: Pull Main Branch
```bash
git checkout main
git pull origin main
```

### Step 2: Configure Credentials & SSH Key
- Place `fa1-key.pem` into the `keys/` directory (`keys/fa1-key.pem`).
- Set permissions (Linux/macOS/Git Bash/WSL):
  ```bash
  chmod 400 keys/fa1-key.pem
  ```
- Configure AWS credentials:
  ```bash
  aws configure
  # OR:
  cp aws.env.example aws.env
  # (edit aws.env with your keys)
  source aws.env
  ```

### Step 3: Run the Master Deployment Script

#### On Windows PowerShell:
```powershell
.\deploy.ps1
```

#### On Linux / macOS / Git Bash / WSL:
```bash
chmod +x deploy.sh destroy.sh
./deploy.sh
```

---

## 🌐 Verification & Testing

Once deployment completes, the script outputs the live application URL:
```text
http://<EC2_PUBLIC_IP>:3000
```
Open `http://<EC2_PUBLIC_IP>:3000` in your web browser to access the running Next.js application dashboard.

---

## 🧹 Zero-Cost Cloud Teardown

To avoid incurring AWS billing costs after testing, execute the single-command teardown script:

#### On Windows PowerShell:
```powershell
.\destroy.ps1
```

#### On Linux / macOS / Git Bash / WSL:
```bash
./destroy.sh
```
This runs `terraform destroy -auto-approve` inside `terraform/` to terminate the EC2 instance and remove security groups.
