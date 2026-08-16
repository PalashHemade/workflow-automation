# GitInsight - Real-Time GitHub Repository Analytics Dashboard

A production-ready full-stack workspace built on **Next.js App Router**, **Prisma ORM**, **Tailwind CSS**, and **Recharts** to audit and track repository statistics, commit history, pull request cycles, and inline reviews in real-time.

---

## Key Features

1. **OAuth Authentication & Token Storage:** Integrates NextAuth.js to log in via GitHub, requests the `repo` scope, and securely caches the user's `access_token` in the database.
2. **Historical Sync Engine:** On demand, triggers an asynchronous background sync to ingest historical commits and PR cycles using the GitHub REST API and populates database records with retry capabilities.
3. **Cryptographic Webhook Receiver:** Securely receives real-time updates from GitHub (pushes, pull requests, reviews, and comments) using SHA-256 signature validation (`X-Hub-Signature-256`) and timing-safe checks.
4. **Third-Party Repo Support (Fallback Polling):** If the user doesn't own a repository, the system configures automated background polling sync as a fallback.
5. **Canonical Project Event Timeline:** Structures all activities (commits, PRs, review submissions, inline diff comments, branch creation/deletions, sync events) into an immutable, audit-ready `ProjectEvent` stream.
6. **Interactive Analytics Workspace:** Visualizes daily commits frequencies, contributor leaderboards, PR merge cycle durations, and custom analytics.
7. **Background Sync Logs & Log Pruner:** Keeps records of all background sync processes and automatically prunes log histories older than 30 days.
8. **Premium Theme Switching:** Seamlessly toggles between a sleek dark mode (retaining vibrant gradient glows) and a clean light mode via a responsive header switch.

---

## Technical Explanations

### 1. Webhook Cryptographic Verification
When GitHub sends webhook POST events (e.g. `push`, `pull_request`) to `/api/webhooks/github`, we verify their signature before parsing the payload:
* **Raw Body Check:** We fetch the request body as raw text (`await req.text()`). We *do not* parse it into JSON beforehand to ensure formatting variations do not alter the signature.
* **HMAC Verification:** We compute a SHA-256 HMAC of the raw body using the `GITHUB_WEBHOOK_SECRET` key.
* **Timing-Safe Equals:** We compare our computed digest to the header `x-hub-signature-256` using `crypto.timingSafeEqual` to avoid timing side-channel attacks.

### 2. Preventing Duplicate Database Entries
To avoid duplicate entries when concurrent historical syncs and webhook events insert the same commits or PRs, we enforce strict relational boundaries and indexes:
* **Repository:** A unique index on `githubId` ensures single registration.
* **Commit:** A unique index on `sha` prevents duplication of commit records. We use Prisma's `upsert` queries to either create or update existing hashes.
* **PullRequest:** A unique index on `githubId` prevents duplicate records of pull requests. A composite key index is also maintained for tracking repo numbers.
* **Contributor:** A unique index on `login` (username) prevents duplicate author records. The sync engine dynamically fetches or registers contributor logins, and links them to commits/PRs.

### 3. Timeline Event Stream
* Activities are normalized into a unified `ProjectEvent` table containing generic fields (`title`, `description`, `actorName`, `importance`, `source`) alongside event-specific payloads in a JSON metadata field.
* Events are cross-linked via `parentEventId` (e.g., matching a review submission or commit back to its parent pull request opened event), allowing the building of relational graphs for development activity.

---

## Directory Layout

```
github-tracker/
├── prisma/
│   ├── schema.prisma          # Prisma schema models (NextAuth + Git Analytics)
│   └── migrations/            # SQL migration history files
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Main HTML layout with NextAuth context
│   │   ├── page.tsx           # Dashboard view or Landing page
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts   # NextAuth OAuth router
│   │   │   ├── repos/
│   │   │   │   ├── route.ts   # Register and list repos
│   │   │   │   └── sync/
│   │   │   │       └── route.ts # Historical REST API sync & Webhook creator
│   │   │   ├── metrics/
│   │   │   │   └── route.ts   # Stats aggregator API
│   │   │   ├── timeline/
│   │   │   │   └── route.ts   # Filtered, paginated event stream API
│   │   │   ├── cron/
│   │   │   │   └── sync/
│   │   │   │       └── route.ts # Cron endpoint to run background syncs
│   │   │   └── webhooks/
│   │   │       └── github/
│   │   │           └── route.ts # Webhook signature verifier & events handler
│   ├── components/
│   │   ├── DashboardOverview.tsx # State orchestrator & tab navigations
│   │   ├── MetricCharts.tsx      # Dashboard widgets (Recharts)
│   │   ├── RepoTimeline.tsx      # Paginated event pipeline timeline list
│   │   ├── CommitList.tsx        # Tracked commits list
│   │   ├── PullRequestList.tsx   # Tracked PR cycles, files, and diff details
│   │   ├── BranchList.tsx        # Default and active git branches list
│   │   ├── WebhookEventLog.tsx   # Webhook payloads delivery logs
│   │   ├── SyncHistory.tsx       # Historical sync run reports
│   │   ├── RepoSettings.tsx      # Tracking controls and webhook options
│   ├── lib/
│   │   ├── db.ts              # PrismaClient global cache
│   │   ├── github.ts          # Octokit-style REST fetch helpers with retry logs
│   │   ├── syncEngine.ts      # Core incremental pull synchronization engine
│   │   ├── scheduler.ts       # Stateless background polling sync scheduler
│   │   ├── cleaner.ts         # Periodic log pruner
│   │   ├── eventHelper.ts     # Helpers to create project event timeline nodes
│   │   └── utils.ts           # Class merging utilities (Tailwind merges)
├── Dockerfile                 # Multi-stage production build (Node 20 Alpine)
├── docker-compose.yml         # Full stack: Next.js app + PostgreSQL 16
├── .dockerignore              # Files excluded from Docker build context
├── .env.example               # Secrets template configuration
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** (for manual setup)
- **Docker** and **Docker Compose** (for containerized setup)
- A **GitHub OAuth App** (see [Configure GitHub OAuth App](#2-configure-github-oauth-app) below)

---

## Setup & Running Guide

### 1. Create your `.env` file

Copy the example environment template and fill in your own values:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder values. At minimum you need:
- `NEXTAUTH_SECRET` — generate one with `openssl rand -base64 32`
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` — from your GitHub OAuth App
- `GITHUB_WEBHOOK_SECRET` — any strong random string

The Jira and Groq variables are optional and can be left as-is if you don't need those integrations.

### 2. Configure GitHub OAuth App

1. Go to **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set the **Authorization callback URL** to: `http://localhost:3000/api/auth/callback/github`.
3. Save the generated `Client ID` and `Client Secret` into your `.env` file.

---

### Option A: Run with Docker (recommended)

This is the fastest way to get everything running. Docker Compose starts both the Next.js app and a PostgreSQL database — no local Postgres installation needed.

```bash
# Build and start the full stack
docker compose up --build

# Or run in the background
docker compose up --build -d
```

The app will be available at **http://localhost:3000**. Database migrations run automatically on startup.

#### Useful Docker commands

```bash
# View live logs
docker compose logs -f app

# Restart after code changes
docker compose up --build

# Stop all containers
docker compose down

# Stop and wipe the database volume (fresh start)
docker compose down -v
```

> **Note:** The `DATABASE_URL` is automatically overridden inside Docker to use the internal `db` hostname. You don't need to change it in your `.env`.

---

### Option B: Run manually (for development)

Use this approach if you prefer hot-reloading during development.

#### Database Setup
1. Ensure you have a PostgreSQL instance running locally and that `DATABASE_URL` in `.env` points to it.
2. Run Prisma migrations to create database tables:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Generate the Prisma Client:
   ```bash
   npx prisma generate
   ```

#### Start the dev server
```bash
npm install
npm run dev
```

Open **http://localhost:3000** in your browser. Connect your GitHub account to begin onboarding and analytics.
