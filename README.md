# EDURA Frontend — Next.js & Redux LMS

[![Frontend CI](https://github.com/Edura-LMS-Zynaptrix/edura-frontend/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Edura-LMS-Zynaptrix/edura-frontend/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/Edura-LMS-Zynaptrix/edura-frontend/branch/develop/graph/badge.svg)](https://codecov.io/gh/Edura-LMS-Zynaptrix/edura-frontend)

This repository contains the Next.js frontend application for the EDURA Learning Management System (LMS). It is one part of the EDURA project:

| Repository                                                                | Contents                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [edura-backend](https://github.com/Edura-LMS-Zynaptrix/edura-backend)     | The 11 FastAPI microservices                                                            |
| **edura-frontend** (this repo)                                            | Next.js web application                                                                 |
| [edura-infra](https://github.com/Edura-LMS-Zynaptrix/edura-infra)         | Docker Compose, Nginx gateway, RabbitMQ setup, Kubernetes manifests and deploy pipeline |
| [edura-tests](https://github.com/Edura-LMS-Zynaptrix/edura-tests)         | Integration, smoke and performance tests                                                |
| [edura-documents](https://github.com/Edura-LMS-Zynaptrix/edura-documents) | SRS, SDS, ADRs, retrospectives and test evidence                                        |

## Deployed application

| Environment | URL                          |
| ----------- | ---------------------------- |
| Staging     | https://staging.eduralms.com |
| Production  | https://eduralms.com         |

Staging deploys automatically on every push to `develop`. Production deploys on a push to `main`, after approval in the GitHub `production` environment.

## Stack

- Next.js 15 App Router and React 19
- Redux Toolkit (State Management)
- Tailwind CSS for styling
- Jest and React Testing Library for tests

## Prerequisites

- [Git](https://git-scm.com/)
- [Node.js 20](https://nodejs.org/) (the CI and the Docker image use Node 20) with npm
- A running EDURA backend for the pages to show real data: either run it locally (see the [edura-backend README](https://github.com/Edura-LMS-Zynaptrix/edura-backend#readme)) or point the app at staging
- Optional: a Google OAuth _Web application_ client ID if you want to use Google Sign-In (Google Cloud Console → APIs & Services → Credentials)

## Run the app locally (step by step)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Edura-LMS-Zynaptrix/edura-frontend.git
   cd edura-frontend
   ```
2. **Install the dependencies:**
   ```bash
   npm ci
   ```
3. **Create the environment file** and fill it in:

   ```bash
   cp .env.example .env              # Windows PowerShell: Copy-Item .env.example .env
   ```

   | Variable                       | Meaning                                                                                                                            |
   | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`          | Base URL of the Nginx gateway. Use `http://localhost` for the local Docker stack, or `https://staging.eduralms.com` to use staging |
   | `NEXT_PUBLIC_APP_NAME`         | Application name (`Edura`)                                                                                                         |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID. Leave empty to disable Google Sign-In                                                                      |

4. **Start the development server:**
   ```bash
   npm run dev
   ```
5. **Open** http://localhost:3000.

`NEXT_PUBLIC_*` values are compiled into the bundle at build time. After changing `.env`, restart `npm run dev`.

### Build and run the production bundle

```bash
npm run build
npm start        # serves on http://localhost:3000
```

The production Docker image is built with `docker build --build-arg NEXT_PUBLIC_API_URL=<url> --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=<id> -t edura-frontend .`.

## Testing

```bash
npm test                 # run all unit tests once
npm run test:coverage    # same, with a coverage report in coverage/
npm run test:watch       # re-run on change
```

Tests live in `__tests__` folders next to the code they cover. Coverage on new code must be at least 80%.

## Linting & Formatting

```bash
npm run lint             # ESLint (next lint)
npm run typecheck        # TypeScript, no emit
npm run format:check     # Prettier check (use `npx prettier --write .` to fix)
```

## Continuous integration

Every pull request and every push to `develop`, `main`, `feature/**`, `fix/**`, `hotfix/**` and `release/**` runs the **Frontend CI** workflow, with four jobs: `Lint & Format`, `Build`, `Unit Tests` (with a coverage artifact) and `Security Scan`. The security scan uses `audit-ci` with a documented allowlist of accepted advisories (`audit-ci.jsonc`, recorded in ADR-14 in edura-documents).

## Branching and releases

`main` holds released code and `develop` is the integration branch. Work happens on `feature/<ticket-id>-<slug>` or `fix/<ticket-id>-<slug>` branches and reaches `develop` through a reviewed pull request. Releases follow Semantic Versioning (`vMAJOR.MINOR.PATCH`); see the [Releases](https://github.com/Edura-LMS-Zynaptrix/edura-frontend/releases) page.
