# EduClaw / Civic Project Studio

`EduClaw` is a local-first open-source education platform for students and teachers.

It combines:

- a desktop app that behaves like normal software
- a reusable project engine for building cited local projects
- a bounded classroom agent system for teachers and students
- a preserved legacy MLK experience in `Legacy_of_Justice.html`

The current product direction is:

- `EduClaw`: the school-safe agent operating system
- `Civic Project Studio`: the local project engine and studio UI

This repo intentionally keeps the original `Legacy_of_Justice.html` as a preserved artifact and first template seed. It is not deleted.

## What The Product Does

Students and teachers can:

- create projects from typed manifests and templates
- upload local documents and classroom evidence
- extract and search evidence locally
- generate provenance-backed project artifacts
- run bounded local agents with approval gates
- compile projects into multiple export formats
- use the desktop app without running terminal commands every time

## Main Product Layers

### 1. EduClaw

A school-safe, OpenClaw-shaped orchestration layer with:

- `Teacher OS`
- `Student OS`
- `Shared Classroom Layer`
- approvals
- audit trails
- signed control planes
- classroom access keys

### 2. Civic Project Studio

A local project engine that provides:

- project manifests
- template registry
- document ingestion
- provenance and retrieval
- knowledge graph compilation
- artifact-producing agents
- export pipeline

### 3. Desktop App

A packaged Electron desktop shell that:

- starts the backend automatically
- opens the studio with no terminal work
- stores workspace state locally
- restores recent projects
- supports bundle file opening
- includes updater/install scaffolding

## Current Capabilities

### Project Engine

- typed `project.yaml` manifests
- local document ingestion
- local retrieval and evidence search
- provenance chunking
- knowledge graph generation
- standards alignment
- teacher comments and revision history
- export generation

### Agent Runtime

- research
- planning
- writing
- history support
- citation support
- design support
- QA
- teacher review
- export support

### Education OS

- classroom creation
- assignment creation
- protected evidence uploads
- student project launch
- teacher/student/shared bounded agents
- approval queue
- audit log
- classroom-safe collaboration model

### Security

- classroom bootstrap access keys for `teacher`, `student`, and `reviewer`
- HMAC-hashed stored credentials
- prompt risk scoring
- approval-required flows for sensitive actions
- tamper-evident approval and audit chains
- upload policy enforcement for classroom materials
- signed EduClaw control-plane attestations

### Desktop Product Features

- first-run onboarding
- workspace chooser
- release notes access
- recent-project restore
- `.cpsbundle` file association support
- crash recovery for renderer/backend failures
- launch-at-login control
- macOS move-to-Applications prompt
- auto-update scaffolding for packaged releases

## Desktop Use

If you want to use it like normal software, use the packaged desktop app.

Artifacts produced by the desktop packaging flow include:

- `desktop/release/mac-arm64/Civic Project Studio.app` from `npm run pack`
- `.dmg` and `.zip` artifacts from `npm run dist:mac`
- Windows installer artifacts from `npm run dist:win`
- Linux package artifacts from `npm run dist:linux`

The desktop app starts the bundled backend automatically and serves the studio locally at `/desktop/`. Users do not need to run the backend and frontend manually to use the packaged app.

## Export Formats

Projects can be exported as:

- static site
- React app scaffold
- PDF report
- rubric report
- `.cpsbundle` project bundle

## Local Modes

- `no-llm`: deterministic local generation and scoring
- `local-llm`: optional local model refinement through an Ollama-compatible endpoint

If no local LLM is available, the platform falls back to deterministic local behavior.

## Repository Structure

- `backend/`: FastAPI backend, agents, security, ingestion, exports, analytics
- `frontend/`: React + TypeScript studio UI
- `desktop/`: Electron shell, packaging config, release assets
- `docs/`: template, plugin, and EduClaw docs
- `community/`: sample projects and community packs
- `studio/`: starter manifests and template assets
- `educlaw/`: EduClaw example manifests
- `Legacy_of_Justice.html`: preserved original standalone MLK experience

## Run In Developer Mode

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Run The Desktop Shell From Source

```bash
cd desktop
npm install
npm run dev
```

## Package The Desktop App

```bash
cd desktop
npm run pack
```

Platform-targeted packaging commands:

```bash
cd desktop
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Docker Compose

```bash
docker compose up --build
```

Then open:

- studio UI: `http://127.0.0.1:5173`
- backend API: `http://127.0.0.1:8000`
- preserved legacy page: `http://127.0.0.1:8000/legacy`

## EduClaw Security Model

EduClaw is intentionally not a general unrestricted agent.

It is built as bounded educational orchestration:

- no unrestricted shell execution
- no silent external messaging
- no uncontrolled browser automation
- no hidden destructive filesystem actions
- no sensitive classroom action without approval and audit coverage

See `docs/EDUCLAW.md` for the detailed contract.

## Templates

Templates in the studio include examples such as:

- MLK Legacy Lab
- Research Portfolio
- Civic Campaign Simulator
- Museum Exhibit Site
- Lesson Module
- Documentary Story Project
- science-fair style flows
- debate prep flows
- reading intervention flows

## Project Manifest Example

```yaml
version: "1.0"
title: Neighborhood Memory Archive
summary: A locally built historical project
topic: Neighborhood memory and public history
audience: Middle and high school students
template_id: documentary-story
local_mode: no-llm
goals:
  - Explain the issue
  - Curate source evidence
  - Build an interactive local project
rubric:
  - Evidence Quality
  - Clarity
  - Audience Fit
```

## Admin Access

Default local admin credentials:

- username: `admin`
- password: `mlk-admin-demo`

Admin surfaces include:

- scheduler state
- benchmark reporting
- experiment metrics
- workflow orchestration
- older MLK intelligence admin flows

## Important Environment Variables

Useful backend overrides:

- `MLK_DATABASE_URL`
- `MLK_DB_PATH`
- `MLK_ADMIN_USERNAME`
- `MLK_ADMIN_PASSWORD`
- `MLK_AUTH_SECRET`
- `MLK_WORKFLOW_SCHEDULER_ENABLED`
- `MLK_ETL_INTERVAL_SECONDS`
- `MLK_RETRAIN_INTERVAL_SECONDS`
- `MLK_BENCHMARK_INTERVAL_SECONDS`
- `MLK_STUDIO_ROOT`
- `MLK_STUDIO_TEMPLATE_DIR`
- `MLK_COMMUNITY_ROOT`
- `MLK_LOCAL_LLM_MODEL`
- `MLK_LOCAL_LLM_BASE_URL`
- `MLK_MODEL_CACHE_DIR`
- `MLK_EDUCLAW_SECURITY_SECRET`
- `MLK_EDU_MATERIAL_MAX_BYTES`

## Packaging, Signing, And Releases

The desktop release pipeline now includes:

- macOS packaging
- Windows packaging configuration
- Linux packaging configuration
- GitHub Actions workflow for desktop release builds
- updater metadata publishing configuration

Files to inspect:

- `desktop/README.md`
- `desktop/signing.env.example`
- `.github/workflows/desktop-release.yml`

For full macOS public distribution you still need real credentials:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `GH_TOKEN`

Without those, local builds remain ad-hoc signed and not notarized.

## Open Source

- code license: `Apache-2.0`
- educational content contributions: `CC-BY` or `CC-BY-SA` recommended

## Contributing And SDK Docs

- `CONTRIBUTING.md`
- `docs/TEMPLATE_SDK.md`
- `docs/PLUGIN_SDK.md`
- `docs/EDUCLAW.md`
- `desktop/README.md`

## Verification

The current repo state has been validated with:

- `cd backend && uv run pytest`
- `cd frontend && npm run build`
- `cd desktop && npm run pack`

The packaged macOS app was also smoke-tested against:

- `/health`
- `/desktop/`
- `/api/v1/studio/system/status`

## Legacy Note

`Legacy_of_Justice.html` is still preserved in this repository and still served by the platform. It remains available as a historical standalone artifact and template seed.
