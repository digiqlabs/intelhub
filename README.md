aws configure --profile intelhub-dev# IntelHub

IntelHub helps growth teams monitor competitors and surface actionable insights from social media metrics.

## Project structure

```
.
├── backend/           # FastAPI service for data ingestion and REST APIs
├── frontend/          # React + Vite single-page app for analytics dashboards
├── docker-compose.yml # Multi-service orchestration for local development
├── .env               # Active environment variables for Docker services
└── .env.example       # Template for environment configuration
```

### Backend

* Python 3.11 / FastAPI service in `backend/`
* Default entrypoint: `app/main.py` with `/health` check for smoke testing
* Dependencies managed with `requirements.txt`

### Frontend

* React 18 + Vite project in `frontend/`
* Development scripts defined in `package.json`
* Production image built via multi-stage Dockerfile

## Getting started

1. Copy `.env.example` to `.env` (or use the provided `.env`) and adjust credentials/secrets.
2. Build services: `docker compose build`
3. Start the stack: `docker compose up`
4. Visit the dashboard at <http://localhost:5173> and the API docs at <http://localhost:8002/docs>

### Docker services

| Service | Image / Build | Port |
| ------- | ------------- | ---- |
| `dynamodb` | `amazon/dynamodb-local` | 8000 |
| `dynamodb-admin` | `aaronshaf/dynamodb-admin` | 8001 |
| `api` | `backend/` FastAPI dev server | 8002 |
| `web` | `frontend/` Vite dev server | 5173 |

> **Note:** The frontend uses generated placeholder data. Connect real data sources and tasks in upcoming iterations.