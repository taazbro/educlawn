# MLK Legacy Intelligence Backend

FastAPI service for:

- ingesting learner profiles and telemetry
- engineering cohort features through SQLAlchemy + pandas
- training narrative-path and engagement-risk models
- serving analytics dashboards, local agents, admin auth, workflow orchestration, mission planning, and recommendation APIs

Local agents included:

- `mentor`
- `strategist`
- `historian`
- `planner`
- `operations` (admin-only briefing)

Advanced local-agent features:

- persistent agent memory stored in the database
- local hybrid retrieval with offline embeddings and vector search
- temporal learner modeling across persisted sessions
- local knowledge graph context for scene and theme reasoning
- experiment-policy assignment and metrics
- mission plan persistence with checkpoints and fallback branches
- benchmark reporting and event-pipeline logging
- scheduled benchmark evaluation jobs in the workflow orchestrator
- learner memory endpoint at `/api/v1/agents/memory/{learner_id}`

Advanced API surfaces:

- `POST /api/v1/planner/run`
- `GET /api/v1/planner/latest/{learner_id}`
- `GET /api/v1/temporal/learner/{learner_id}`
- `GET /api/v1/graph/context`
- `POST /api/v1/experiments/recommend`
- `GET /api/v1/admin/pipeline/events`
- `GET /api/v1/admin/experiments/metrics`
- `POST /api/v1/admin/benchmarks/run`
- `GET /api/v1/admin/benchmarks/latest`

Run locally:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Environment variables:

- `MLK_DATABASE_URL` for PostgreSQL or alternate SQLite targets
- `MLK_ADMIN_USERNAME`
- `MLK_ADMIN_PASSWORD`
- `MLK_AUTH_SECRET`
- `MLK_WORKFLOW_SCHEDULER_ENABLED`
- `MLK_ETL_INTERVAL_SECONDS`
- `MLK_RETRAIN_INTERVAL_SECONDS`
- `MLK_BENCHMARK_INTERVAL_SECONDS`
