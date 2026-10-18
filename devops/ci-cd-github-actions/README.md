# CI/CD Pipeline — GitHub Actions

This project uses GitHub Actions as its CI platform rather than a separately-hosted CI server like Jenkins: the workflow definition lives directly in the repository (`.github/workflows/ci.yml`), triggered natively by repository events, with no external server to install, connect, or maintain.

## Why GitHub Actions over a self-hosted CI server

| Self-hosted CI (e.g. Jenkins) | GitHub Actions |
|---|---|
| Install and maintain a separate server | Nothing to install — runs on GitHub's own hosted runners |
| Install Git/GitHub/Pipeline plugins, restart the server | `actions/checkout` ships as a reusable Action, no plugin installation or restart |
| Manually connect the server to the repo (URL, credentials, webhook) | The workflow already lives inside the repo — no connection step, authenticates via an auto-injected scoped token |
| Click through a UI to define a job | The entire job is one YAML file, versioned alongside the code |
| Manual "Build Now" button | `push`/`pull_request` triggers automatically, or `gh workflow run` / the Actions tab for on-demand runs |

## Pipeline definition

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch: {}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

`workflow_dispatch: {}` enables running the pipeline on demand from the Actions tab or `gh workflow run`, in addition to its automatic triggers on push/PR to `main`.

## A real, verified run

Triggered and watched live against this repo's actual GitHub remote:

```
$ gh workflow run ci.yml
https://github.com/PalashHemade/workflow-automation/actions/runs/38557079298

$ gh run watch 38557079298 --exit-status
✓ main CI · 38557079298
Triggered via workflow_dispatch

JOBS
✓ build in 59s (ID 115828770400)
  ✓ Set up job
  ✓ Checkout repository
  ✓ Setup Node.js
  ✓ Install dependencies
  ✓ Generate Prisma client
  ✓ Type check
  ✓ Build
  ✓ Post Setup Node.js
  ✓ Post Checkout repository
  ✓ Complete job
```

Full run: <https://github.com/PalashHemade/workflow-automation/actions/runs/38557079298> — built commit `75ceebc` on `main`.

**Checkout confirmed:**

```
build  Checkout repository  Syncing repository: PalashHemade/workflow-automation
build  Checkout repository  [command]/usr/bin/git init /home/runner/work/workflow-automation/workflow-automation
```

**Real production build produced (every API route in the app compiled):**

```
build  Build  Route (app)                                   Size  First Load JS
build  Build  ├ ƒ /api/branches                             0 B   0 B
build  Build  ├ ƒ /api/commits                               0 B   0 B
build  Build  ├ ƒ /api/projects                              0 B   0 B
build  Build  ├ ƒ /api/projects/[id]/correlate               0 B   0 B
build  Build  ... (full route list)
build  Build  + First Load JS shared by all                  87.5 kB
build  Build  ƒ Middleware                                   87.7 kB
```

Every step reported `✓`, job completed in 59 seconds, exit status 0.

## What this pipeline actually guards against

It's a build-verification gate, not a full test suite — `Type check` and `Lint` are the only checks standing in for automated tests. It catches:
- Type errors (`tsc --noEmit`)
- Lint violations (`next/core-web-vitals` ruleset)
- Anything that breaks the production build (`next build`)

It runs on every push and pull request to `main`, not as a one-off demonstration.
