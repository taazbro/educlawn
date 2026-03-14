# EduClaw

`EduClaw` is the school-safe product line built from the local `openclaw` repo shape.

It keeps the parts that matter for education:
- local-first gateway thinking
- onboarding wizard flow
- session isolation
- skills and plugin concepts
- pairing and approval boundaries

It explicitly removes or blocks the parts that do not belong in a classroom runtime:
- unrestricted shell execution
- silent external messaging
- uncontrolled browser automation
- destructive filesystem actions
- personal-device control surfaces

## What EduClaw Adds

- `Teacher OS`: lesson planning, rubric design, feedback, dashboards
- `Student OS`: project coaching, research support, citation tutoring, revision help
- `Shared Classroom Layer`: evidence libraries, provenance, audit logs, approvals
- `EduClaw Control Plane`: generated local YAML config for bounded classroom orchestration

## Security Model

EduClaw now runs with a classroom protection model instead of implicit trust:

- bootstrap-issued `teacher`, `student`, and `reviewer` access keys
- HMAC-hashed classroom access credentials stored on disk, not plaintext keys
- signed `educlaw-control-plane.yaml` attestations with companion JSON proof files
- prompt risk scoring for policy override, secret exfiltration, shell, browser, and external-send requests
- approval gates for sensitive actions and elevated-risk prompts
- tamper-evident audit and approval logs with chained HMAC record hashes
- bounded file upload policy for classroom materials

The intended result is OpenClaw-shaped orchestration with a school-safe permission model:
- no unrestricted shell by default
- no silent external messaging
- no uncontrolled browser automation
- no hidden destructive filesystem actions
- no sensitive classroom action without a local approval path

## Runtime Contract

- `OpenClaw` is treated as a local source architecture and capability inventory.
- `EduClaw` is generated inside this repo and wired into the existing FastAPI, React, and desktop shell.
- The generated control plane lives under `studio_workspace/educlaw/` at runtime.

## API

- `GET /api/v1/educlaw/overview`
- `GET /api/v1/educlaw/source`
- `POST /api/v1/educlaw/bootstrap`

## Bootstrap Result

Bootstrapping EduClaw:
- creates a bounded classroom in Education OS
- creates a starter assignment
- writes `educlaw-control-plane.yaml`
- writes `educlaw-control-plane.attestation.json`
- returns local classroom bootstrap keys once so the desktop/web client can store them locally
- preserves the existing local-first project studio and legacy MLK experience
