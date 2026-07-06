# GitInsight - Real-Time GitHub Repository Analytics Dashboard

A production-ready full-stack template built on **Next.js App Router**, **Prisma ORM**, **Tailwind CSS**, and **Recharts** to audit and track repository statistics in real-time.

---

## Key Features

1. **OAuth Authentication & Token Storage:** Integrates NextAuth.js to log in via GitHub, requests the `repo` scope, and securely caches the user's `access_token` in the database.
2. **Historical Sync Engine:** On demand, triggers a background fetch to download the last 100 commits and PRs using the GitHub REST API and populates database records.
3. **Cryptographic Webhook Receiver:** Securely receives updates from GitHub using signature validation (`X-Hub-Signature-256`) and timing-safe checks.
4. **Third-Party Repo Support (Fallback Polling):** If a user doesn't own a repository, webhooks cannot be registered automatically. The app marks `webhookEnabled = false` and syncs statistics using an API polling mechanism.
5. **Interactive Recharts Dashboard:** Visualizes daily commits frequencies (last 30 days), contributor leaderboard, and PR merge cycle durations.

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

---

## Directory Layout

```
github-tracker/
├── prisma/
│   └── schema.prisma          # Prisma schema models
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Main html layout with NextAuth context
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
│   │   │   └── webhooks/
│   │   │       └── github/
│   │   │           └── route.ts # Webhook signature verifier & events handler
│   ├── components/
│   │   ├── MetricCharts.tsx   # Dashboard widgets (Recharts)
│   │   ├── RepoOnboarding.tsx # Onboarding selections
│   │   ├── DashboardOverview.tsx # State orchestrator
│   │   ├── Providers.tsx      # NextAuth Context Wrapper
│   │   └── LoginButton.tsx    # Interactive OAuth button
│   ├── lib/
│   │   ├── db.ts              # PrismaClient global cache
│   │   └── utils.ts           # Utility functions (cn merge helper)
├── .env.example               # Secrets template configuration
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Setup & Running Guide

### 1. Database Setup
1. Configure your Postgres connection string in your `.env` file (copied from `.env.example`).
2. Run Prisma migrations to generate database tables:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Generate the Prisma Client typing libraries:
   ```bash
   npx prisma generate
   ```

### 2. Configure GitHub OAuth App
1. Go to **GitHub Settings -> Developer settings -> OAuth Apps -> New OAuth App**.
2. Set the callback URL to: `http://localhost:3000/api/auth/callback/github`.
3. Save the generated `Client ID` and `Client Secret` to your `.env` file.

### 3. Run Locally
1. Install node dependencies:
   ```bash
   npm install
   ```
2. Start the hot-reloading development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser. Connect your account to begin onboarding and analytics.
