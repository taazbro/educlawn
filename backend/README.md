# EduClawn Backend

FastAPI service for two parallel product layers:

- the existing MLK intelligence platform with analytics, temporal learner modeling, experimentation, graph context, and benchmark workflows
- the new generic project studio engine for document ingestion, provenance, graph compilation, local agents, and export

## Studio Capabilities

- project creation from typed manifests
- local document extraction for text, HTML, PDF, and optional image OCR through `tesseract`
- per-project vector search using TF-IDF + SVD embeddings
- knowledge-graph compilation from uploaded sources
- agent artifact generation for research, planning, writing, citation, design, QA, teacher review, and export
- static site, React scaffold, PDF, and zipped bundle export
- optional local-LLM refinement via an Ollama-compatible endpoint
- optional provider-AI runtime mode through encrypted local provider profiles
- project compile augmentation for research, writing, review, and classroom-safe drafting

## Existing MLK Intelligence Capabilities

- learner warehouse snapshots
- recommendation and engagement-risk models
- local mentor, strategist, historian, planner, and operations agents
- temporal learner modeling
- experimentation policy assignment and metrics
- benchmark reporting and scheduled evaluation jobs
- admin workflow orchestration

## Run Locally

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

## Provider AI Support

EduClawn supports encrypted local provider profiles for:

- OpenAI
- Anthropic
- Google Gemini
- Groq
- Mistral
- Cohere
- xAI

Each profile can run in one of two modes:

- `user-key`: the end user brings their own provider API key
- `managed-subscription`: a locally managed provider seat is used by EduClawn agents on behalf of the workflow

Provider-backed execution is available in:

- Studio projects with `local_mode=provider-ai`
- Education assignments with `local_mode=provider-ai`
- Education agent runs with an explicit `ai_profile_id` override

Provider secrets are encrypted locally with `cryptography`/`AESGCM` using `EDUCLAWN_SECURITY_SECRET`.

## Core Studio Endpoints

- `GET /api/v1/studio/overview`
- `GET /api/v1/studio/templates`
- `GET /api/v1/studio/agents/catalog`
- `GET /api/v1/studio/projects`
- `POST /api/v1/studio/projects`
- `POST /api/v1/studio/projects/{slug}/documents`
- `POST /api/v1/studio/projects/{slug}/search`
- `GET /api/v1/studio/projects/{slug}/graph`
- `POST /api/v1/studio/projects/{slug}/compile`
- `GET /api/v1/studio/projects/{slug}/artifacts`
- `GET /api/v1/studio/projects/{slug}/download/{export_type}`

## Provider AI Endpoints

- `GET /api/v1/ai/catalog`
- `GET /api/v1/ai/profiles`
- `POST /api/v1/ai/profiles`
- `PUT /api/v1/ai/profiles/{profile_id}`
- `DELETE /api/v1/ai/profiles/{profile_id}`
- `POST /api/v1/ai/profiles/{profile_id}/test`
- `GET /api/v1/ai/usage`

## Important Environment Variables

- `EDUCLAWN_DATABASE_URL`
- `EDUCLAWN_DB_PATH`
- `EDUCLAWN_ADMIN_USERNAME`
- `EDUCLAWN_ADMIN_PASSWORD`
- `EDUCLAWN_AUTH_SECRET`
- `EDUCLAWN_WORKFLOW_SCHEDULER_ENABLED`
- `EDUCLAWN_ETL_INTERVAL_SECONDS`
- `EDUCLAWN_RETRAIN_INTERVAL_SECONDS`
- `EDUCLAWN_BENCHMARK_INTERVAL_SECONDS`
- `EDUCLAWN_STUDIO_ROOT`
- `EDUCLAWN_STUDIO_TEMPLATE_DIR`
- `EDUCLAWN_COMMUNITY_ROOT`
- `EDUCLAWN_LOCAL_LLM_MODEL`
- `EDUCLAWN_LOCAL_LLM_BASE_URL`
- `EDUCLAWN_SECURITY_SECRET`
- `EDUCLAWN_EAGER_MODEL_TRAINING`
- `EDUCLAWN_MODEL_CACHE_DIR`
- `EDUCLAWN_EDU_MATERIAL_MAX_BYTES`

Legacy `MLK_*` aliases are still accepted for backward compatibility.
