# GitInsight — Engineering Intelligence Platform

A full-stack platform built on **Next.js App Router**, **Prisma ORM**, **Tailwind CSS**, and **Recharts** that correlates GitHub activity with Jira project management data — tracking commits, pull requests, sprints, and stories together, and using an AI agent layer to surface insights (risk, sprint health, architectural summaries) a team would otherwise have to piece together by hand.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture & Technical Explanations](#architecture--technical-explanations)
- [Directory Layout](#directory-layout)
- [Prerequisites](#prerequisites)
- [Setup & Running Guide](#setup--running-guide)
- [CI/CD Pipeline](#cicd-pipeline)
- [Cloud Deployment (AWS)](#cloud-deployment-aws)
- [DevOps Showcase](#devops-showcase)
- [DevOps Command Reference](DEVOPS-COMMANDS.md) — every command in this repo (local dev, Docker, CI, Terraform, Ansible, Kubernetes, Helm), in one place

---

## Key Features

1. **OAuth Authentication & Token Storage** — Integrates NextAuth.js to log in via GitHub, requests the `repo` scope, and securely caches the user's `access_token` in the database.
2. **Historical Sync Engine** — On demand, triggers an asynchronous background sync to ingest historical commits and PR cycles using the GitHub REST API, with retry handling.
3. **Cryptographic Webhook Receiver** — Securely receives real-time updates from GitHub (pushes, pull requests, reviews, comments) using SHA-256 signature validation (`X-Hub-Signature-256`) and timing-safe comparison.
4. **Third-Party Repo Support (Fallback Polling)** — If the user doesn't own a repository, the system falls back to automated background polling instead of webhooks.
5. **Multi-Repo Engineering Projects** — An `EngineeringProject` is a higher-level aggregate that can span **multiple GitHub repositories** (a `ProjectRepository` join table, one project : many repos), for teams that split work across microservices/polyrepos while still tracking it as one project.
6. **Jira Integration & Correlation** — Connects to Atlassian Cloud via OAuth 2.0, syncs a Jira project's issues (classified into `Story`/`JiraTask`, linked to sprints/epics), and a correlation engine scans commit messages, branch names, and PR titles/descriptions for Jira issue keys to automatically link a story to the commits/PRs that actually implemented it (with a confidence score per match).
7. **AI Agent Insights** — A multi-agent framework (Groq + Llama 3.3 70B) runs structured analysis over a project's data: a `SummaryAgent` produces architectural/risk summaries, and a `SprintHealthAgent` flags sprint bottlenecks, unlinked commits, and deployment risk — both persisted as `AIInsight` records with full execution logs.
8. **Canonical Project Event Timeline** — Structures all activity (commits, PRs, reviews, inline comments, branch events, Jira issue events, sync runs, agent runs) into an immutable, audit-ready `ProjectEvent` stream.
9. **Interactive Analytics Workspace** — Repository-level engineering metrics (PR review cycle time, review-outcome breakdown, file-churn hotspots, weekly churn trend) and project-level metrics blending Jira + GitHub (sprint velocity, bug rate, DORA-style lead/cycle time and deployment frequency).
10. **Background Sync Logs & Log Pruner** — Keeps records of all background sync processes and automatically prunes log histories older than 30 days.
11. **Premium Theme Switching** — Seamless dark/light mode toggle via a responsive header switch.

---

## Architecture & Technical Explanations

### 1. Webhook Cryptographic Verification
When GitHub sends webhook POST events (e.g. `push`, `pull_request`) to `/api/webhooks/github`:
* **Raw Body Check** — the request body is read as raw text (`await req.text()`) before any JSON parsing, so formatting variations can't alter the signature.
* **HMAC Verification** — a SHA-256 HMAC of the raw body is computed using `GITHUB_WEBHOOK_SECRET`.
* **Timing-Safe Equals** — the computed digest is compared to the `x-hub-signature-256` header via `crypto.timingSafeEqual` to avoid timing side-channel attacks.

### 2. Preventing Duplicate Database Entries
Strict relational boundaries and unique indexes prevent duplicate records when concurrent historical syncs and webhook events race:
* **Repository** — unique index on `githubId`.
* **Commit** — unique index on `sha`; Prisma `upsert` creates-or-updates.
* **PullRequest** — unique index on `githubId`, plus a composite index for per-repo numbering.
* **Contributor** — unique index on `login`; dynamically fetched/registered and linked to commits/PRs.

### 3. Multi-Repo Project Model
`EngineeringProject` and `Repository` are linked **1-to-many** via a `ProjectRepository` join table (`@@unique` on `repositoryId`, so a repo belongs to at most one project, while a project can aggregate several repos). The project is the aggregate root for everything cross-repo: Jira stories/epics/sprints, `ProjectIntegration`s, `ProjectMetrics`, `ProjectKnowledge` (AI memory), `AIInsight`s, and the unified `ProjectEvent` timeline.

### 4. Jira ↔ GitHub Correlation Engine
`jiraSync.ts` pulls a Jira project's issues via JQL into `Story`/`JiraTask` records. Separately, `correlationEngine.ts` scans commit messages, branch names, and PR titles/descriptions for Jira issue keys (e.g. `AUTH-123`) and creates `StoryCommit`/`StoryPullRequest` links, each tagged with a match method (`COMMIT`, `BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`, `MANUAL`) and a confidence score — giving end-to-end traceability from a Jira story to the code that implemented it.

### 5. AI Agent System
Every agent extends `BaseAgent`, which enforces a fixed lifecycle: **Goal → Plan → Tool Selection → Retrieve** (Prisma-backed tools fetch data, compressed via a `ContextManager`) **→ Analyze** (the only LLM call, via `LLMFactory`, producing schema-validated structured output) **→ Reflect** (confidence check) **→ Act** (persist results) **→ Remember** (logged as a `ProjectEvent`). An `AgentOrchestrator` looks agents up by name in an `AgentRegistry` and runs them through an `AgentChain` (sequential, output-feeds-next-input, short-circuits on failure). LLM calls go through Groq (`llama-3.3-70b-versatile` by default), with a mock provider for offline/test use.

### 6. Access Control Middleware
`src/middleware.ts` gates every `/api/*` route behind an app access-token check (skipping NextAuth and webhook routes, with a dev-mode bypass), forwarding the authenticated user ID downstream via an `x-user-id` header.

---

## Directory Layout

```
github-tracker/
├── prisma/
│   └── schema/                # Prisma schema models, split by domain (project, github, jira, agents, auth)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/              # NextAuth + Jira OAuth callback routes
│   │   │   ├── repos/             # Register/list/sync GitHub repos
│   │   │   ├── projects/          # EngineeringProject CRUD, repositories, insights, knowledge, sync, correlate
│   │   │   ├── jira/              # Jira workspace/project endpoints
│   │   │   ├── agents/            # Triggers AgentOrchestrator runs
│   │   │   ├── analytics/         # Repo-level engineering metrics (churn, review cycle time, ...)
│   │   │   ├── metrics/           # Stats aggregator API
│   │   │   ├── timeline/          # Filtered, paginated ProjectEvent stream
│   │   │   ├── commits/ pulls/ branches/   # Repo-scoped data APIs
│   │   │   ├── webhook-events/    # Webhook delivery logs
│   │   │   ├── webhooks/github/   # Signature-verified webhook receiver
│   │   │   ├── cron/sync/         # Scheduled background sync endpoint
│   │   │   └── system/status/
│   │   └── layout.tsx / page.tsx
│   ├── agents/                # AI agent framework: base, orchestrator, registry, chain, tools, repositories, memory
│   ├── llm/                   # LLM provider abstraction (Groq), prompts, structured-output schemas
│   ├── lib/
│   │   ├── project/            # EngineeringProject services, correlationEngine, projectAnalytics
│   │   ├── jira/                # Jira OAuth client + issue sync
│   │   ├── github/              # GitHub REST fetch helpers (retry-aware)
│   │   ├── events/              # ProjectEvent timeline helpers
│   │   ├── auth/                # Auth helpers
│   │   ├── core/                # Incremental sync engine, background polling scheduler, log pruner
│   │   └── db.ts                # PrismaClient global cache
│   ├── middleware.ts + middleware/   # API access-token gate (authGuard, publicRoutes)
│   ├── components/
│   │   ├── marketing/           # Landing page
│   │   ├── ui/                  # Shared design-system primitives (Button, Card, Modal, Table, Tabs, ...)
│   │   └── *.tsx                # Dashboard views (Overview, Commits, PRs, Branches, Webhooks, Insights, ...)
│   └── types/
├── terraform/                  # AWS EC2 + Elastic IP infrastructure-as-code
├── ansible/                    # Automated Docker/app deployment onto the provisioned EC2 instance
├── devops/                     # Standalone DevOps demos (CI/CD, Kubernetes, Helm, Ansible) — see below
├── deploy.sh / deploy.ps1 / destroy.sh / destroy.ps1   # One-command deploy/teardown orchestration
├── Dockerfile                  # Multi-stage production build (Node 20 Alpine)
├── docker-compose.yml          # Full local stack: Next.js app + PostgreSQL 16
├── .github/workflows/ci.yml    # CI pipeline (see below)
├── .env.example
└── package.json
```

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** (for manual setup)
- **Docker** and **Docker Compose** (for containerized setup)
- A **GitHub OAuth App** (see below)
- Optional: a **Jira OAuth 2.0 app** (for Jira integration) and a **Groq API key** (for AI agent insights) — the app runs fine without either, those features just stay inactive.

---

## Setup & Running Guide

### 1. Create your `.env` file

```bash
cp .env.example .env
```

At minimum, fill in:
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from your GitHub OAuth App
- `GITHUB_WEBHOOK_SECRET` — any strong random string

Optional (feature-gated — leave as placeholders to skip):
- `JIRA_CLIENT_ID` / `JIRA_CLIENT_SECRET` / `JIRA_REDIRECT_URI` — enables Jira sync and correlation
- `GROQ_API_KEY` / `LLM_PROVIDER` / `LLM_MODEL` — enables the AI agent insights feature

### 2. Configure GitHub OAuth App

1. **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
3. Save the `Client ID`/`Client Secret` into `.env`.

---

### Option A: Run with Docker (recommended)

```bash
docker compose up --build        # foreground
docker compose up --build -d     # background
```

The app is available at **http://localhost:3000**; database migrations run automatically on startup.

```bash
docker compose logs -f app       # live logs
docker compose up --build        # restart after code changes
docker compose down              # stop
docker compose down -v           # stop + wipe DB volume (fresh start)
```

> `DATABASE_URL` is automatically overridden inside Docker to the internal `db` hostname — no change needed in `.env`.

### Option B: Run manually (for development)

```bash
npx prisma migrate dev --name init   # create tables
npx prisma generate                  # generate Prisma client
npm install
npm run dev
```

Open **http://localhost:3000**, connect your GitHub account to begin onboarding.

---

## CI/CD Pipeline

Defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml), running on every push/PR to `main` (and on demand via the Actions tab — `workflow_dispatch`):

| Step | What it does |
|---|---|
| **Checkout repository** | `actions/checkout@v4` |
| **Setup Node.js** | Node 20, npm cache |
| **Install dependencies** | `npm ci` |
| **Generate Prisma client** | `npx prisma generate` |
| **Type check** | `npx tsc --noEmit` |
| **Lint** | `npm run lint` (`next lint`, `next/core-web-vitals` ruleset) |
| **Build** | `npm run build` — full production build |

This is a build-verification gate (type errors, lint issues, and build failures all fail the run) — there is currently no automated test suite wired in; `Type check` and `Lint` are the only checks standing in for one.

---

## Cloud Deployment (AWS)

A one-command Terraform + Ansible pipeline provisions a free-tier-eligible EC2 instance (stable Elastic IP, security group for ports 22/80/3000) and deploys the Dockerized app onto it — see [`terraform_ansible_deployment.md`](terraform_ansible_deployment.md) for the full credential setup and execution steps. Quick version, once credentials are in place:

```bash
# Windows
.\deploy.ps1
# Linux / macOS / Git Bash / WSL
./deploy.sh
```

```bash
# Teardown (avoid ongoing AWS cost)
.\destroy.ps1   # or ./destroy.sh
```

---

## DevOps Showcase

Beyond the application itself, [`devops/`](devops/) hosts standalone infrastructure/tooling demonstrations, each in its own folder with its own README documenting real, executed commands and output:

- [`devops/docker-compose-example/`](devops/docker-compose-example/compose.yaml) — standalone Docker Compose setup (no write-up yet, just the compose file)
- [`devops/ci-cd-github-actions/`](devops/ci-cd-github-actions/README.md) — CI/CD pipeline walkthrough: automated source checkout and build via GitHub Actions
- [`devops/kubernetes-helm/`](devops/kubernetes-helm/README.md) — Kubernetes architecture walkthrough + Helm chart lifecycle (create, template, install, upgrade, uninstall)
- [`devops/kubernetes-ansible/`](devops/kubernetes-ansible/README.md) — Kubernetes objects/Services + Ansible configuration-management case study
