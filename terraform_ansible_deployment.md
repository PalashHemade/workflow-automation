# Terraform & Ansible FA1 Deployment Guide

This repository contains a production-grade, automated deployment pipeline using **Terraform** (Infrastructure as Code) and **Ansible** (Configuration Management) to provision AWS EC2 infrastructure and deploy the **Workflow Automation DevOps** Docker container stack.

---

## 🏗️ Architecture Overview

1. **Terraform (`terraform/`)**:
   - Provisions an AWS EC2 `t3.micro` instance running Ubuntu 22.04 LTS (Jammy) — free-tier eligible on current AWS accounts (older docs/tutorials often say `t2.micro`, but many accounts now only qualify for free tier on `t3.micro`/`t4g.micro`).
   - Configures `aws_security_group` opening inbound ports `22` (SSH), `80` (HTTP), and `3000` (Next.js Application), with all egress allowed.
   - Attaches a 20GB `gp3` root volume.
   - Attaches a stable **Elastic IP** to the instance, so the public IP no longer changes on every apply/destroy cycle (needed because the GitHub OAuth callback URL must match exactly).
   - Supports pre-existing SSH key pairs (`var.use_existing_key = true`, the default) or dynamic RSA key generation (`tls_private_key`). In the default mode, the key pair must already be registered in your AWS account under that name — see the credential map below.

2. **Ansible (`ansible/`)**:
   - Installs its own required collection (`ansible.posix`) automatically — `deploy.sh`/`deploy.ps1` run `ansible-galaxy collection install -r ansible/requirements.yml` before invoking the playbook, so you don't need to do this by hand.
   - Automatically installs Docker Engine and Docker Compose v2 plugin.
   - Configures user permissions (adding `ubuntu` to `docker` group).
   - Synchronizes application source code to `/home/ubuntu/app` (excluding local state, node_modules, git data, and — importantly — your local `.env`, which is never shipped to the server).
   - Handles environment configuration by creating `.env` from `.env.example` (only on a fresh box with no `.env` yet), injecting a securely generated `NEXTAUTH_SECRET`, the application secrets from your local `deploy.env` (GitHub OAuth, Supabase, etc.), and `NEXTAUTH_URL`/`APP_URL` set to the instance's stable Elastic IP.
   - Orchestrates container lifecycle: `docker compose down --remove-orphans` and `docker compose up -d --build`.
   - Polls `http://127.0.0.1:3000` until HTTP 200/302 OK status is achieved.

3. **Orchestration Scripts (`deploy.sh` / `deploy.ps1`)**:
   - One-click, single-command execution supporting Windows PowerShell, Linux, macOS, Git Bash, and WSL.
   - Verify AWS auth, verify the AWS-side key pair actually exists (not just the local `.pem`), install the required Ansible collection, and print a one-time reminder to update your GitHub OAuth App's callback URL after a fresh deploy.

---

## 🔑 Key & Credential Placement Map

| Credential / Key | Exact File & Location | Action / Instructions |
| :--- | :--- | :--- |
| **SSH Private Key (`.pem`)** | `keys/fa1-key.pem` | Place your private key file inside `keys/fa1-key.pem`. Ensure permissions: `chmod 400 keys/fa1-key.pem`. (Strictly ignored by `.gitignore`). |
| **AWS-side key pair** | Your AWS account (EC2 → Key Pairs) | The `.pem` file alone is not enough — `use_existing_key=true` (the default) requires a key pair **named `fa1-key`** to already exist in your AWS account/region. If you generated the `.pem` elsewhere, import its public half: `aws ec2 import-key-pair --key-name fa1-key --public-key-material fileb://<(ssh-keygen -y -f keys/fa1-key.pem)`. `deploy.sh`/`deploy.ps1` check this for you and fail fast with instructions if it's missing. |
| **AWS Access Key ID** | `aws.env` or `~/.aws/credentials` | Run `aws configure` OR copy `aws.env.example` to `aws.env` and paste your ID into `export AWS_ACCESS_KEY_ID="..."`. |
| **AWS Secret Access Key** | `aws.env` or `~/.aws/credentials` | Run `aws configure` OR copy `aws.env.example` to `aws.env` and paste your secret into `export AWS_SECRET_ACCESS_KEY="..."`. |
| **AWS Session Token** | `aws.env` or `~/.aws/credentials` | Optional: Paste token into `aws.env` (`export AWS_SESSION_TOKEN="..."`) if using AWS Academy / Learner Lab. |
| **Application secrets** (GitHub OAuth, Supabase, Groq, Jira) | `deploy.env` | Copy `deploy.env.example` to `deploy.env` and fill in the same real values you use in your local `.env`. These are injected into the server's `.env` only on a fresh deploy — your local `.env` itself is never copied to the server. (Ignored by `.gitignore`.) |

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
- Make sure a key pair named `fa1-key` also exists in your AWS account (see the credential map above) — not just the local `.pem` file.
- Configure AWS credentials:
  ```bash
  aws configure
  # OR:
  cp aws.env.example aws.env
  # (edit aws.env with your keys)
  ```
- Configure application secrets (GitHub OAuth, Supabase, etc.):
  ```bash
  cp deploy.env.example deploy.env
  # (edit deploy.env with the same real values from your local .env)
  ```
  `deploy.sh`/`deploy.ps1` source both `aws.env` and `deploy.env` automatically — no need to `source` them yourself.

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

**One-time manual step on a fresh deploy:** the script also prints a GitHub OAuth callback URL, e.g. `http://<EC2_PUBLIC_IP>:3000/api/auth/callback/github`. Register that exact URL on your GitHub OAuth App (GitHub Settings → Developer settings → OAuth Apps → your app) or GitHub login on the deployed instance will fail. Because the instance now has a stable Elastic IP, you only need to do this once — it survives redeploys as long as you don't fully `destroy` the instance.

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
This runs `terraform destroy -auto-approve` inside `terraform/` to terminate the EC2 instance, release the Elastic IP, and remove security groups. If you redeploy afterward, you'll get a **new** IP and will need to update the GitHub OAuth callback URL again.
