# Civic Project Studio Backend

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

## Important Environment Variables

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
- `MLK_EAGER_MODEL_TRAINING`
- `MLK_MODEL_CACHE_DIR`
