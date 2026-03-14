# MLK Legacy Project

This repository now contains two tracks:

- `Legacy_of_Justice.html`: the preserved original standalone experience
- `backend/`: FastAPI + SQLAlchemy + pandas + scikit-learn intelligence platform
- `frontend/`: React + TypeScript control room for analytics, live inference, local agents, mission planning, and protected admin operations

## Run the platform

Backend:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`.

## Admin access

The public dashboard works without authentication. Admin-only features include:

- workflow execution
- secure pipeline retraining
- scheduler status
- workflow history
- operations agent briefing
- event-pipeline monitoring
- experiment policy metrics
- benchmark execution

## Local AI and agents

The platform now includes local agents that run entirely inside the backend without any external API:

- `Mentor Agent`: learner support and intervention guidance
- `Strategist Agent`: next-scene and mission sequencing
- `Historian Agent`: historical framing and reflection prompts
- `Planner Agent`: multi-step mission construction across temporal state, graph context, and experiments
- `Operations Agent`: admin-only platform health briefing

The agent layer now also includes:

- persistent learner memory across agent runs
- local hybrid retrieval with offline embeddings plus vector search for scene-aware guidance
- temporal learner modeling across persisted sessions
- local knowledge graph context for scenes, people, laws, and themes
- experiment-policy assignment and policy metrics
- mission plans with checkpoints, fallback branches, and completion criteria
- benchmark reports for retrieval, planner, temporal, graph, experiment, and event layers
- event logging for evaluations, agent runs, workflows, snapshots, experiments, and benchmarks
- scheduled benchmark evaluation jobs alongside scheduled ETL and model retraining
- a public memory endpoint at `/api/v1/agents/memory/{learner_id}`

Core advanced endpoints:

- `POST /api/v1/planner/run`
- `GET /api/v1/planner/latest/{learner_id}`
- `GET /api/v1/temporal/learner/{learner_id}`
- `GET /api/v1/graph/context`
- `POST /api/v1/experiments/recommend`
- `GET /api/v1/admin/pipeline/events`
- `GET /api/v1/admin/experiments/metrics`
- `POST /api/v1/admin/benchmarks/run`
- `GET /api/v1/admin/benchmarks/latest`

Default local credentials:

- username: `admin`
- password: `mlk-admin-demo`

## Environment

Useful backend overrides:

- `MLK_DATABASE_URL`: switch from SQLite to PostgreSQL
- `MLK_ADMIN_USERNAME`
- `MLK_ADMIN_PASSWORD`
- `MLK_AUTH_SECRET`
- `MLK_WORKFLOW_SCHEDULER_ENABLED`
- `MLK_ETL_INTERVAL_SECONDS`
- `MLK_RETRAIN_INTERVAL_SECONDS`
- `MLK_BENCHMARK_INTERVAL_SECONDS`
