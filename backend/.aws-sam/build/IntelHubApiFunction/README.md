# IntelHub Backend

This package exposes the IntelHub REST API and Lambda handler for competitor intelligence workflows.

## Current capabilities
- FastAPI service with `/health` and DynamoDB-backed CRUD endpoints for `/competitors`
- Pydantic domain model for competitor social metrics
- Automatic DynamoDB table provisioning when a local endpoint is configured
- Mangum adapter (`handler`) for AWS Lambda deployment

## Environment variables

| Name | Description | Default |
| ---- | ----------- | ------- |
| `AWS_REGION` | AWS region used for boto3 client | `us-east-1` |
| `DYNAMODB_ENDPOINT` | Optional endpoint for local DynamoDB/LocalStack | _unset_ |
| `TABLE_NAME` | DynamoDB table name | `IntelHubCompetitors` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins for the API. When unset, a set of common localhost origins are allowed. | _unset_ |
| `ALLOWED_ORIGIN_REGEX` | Optional regular expression for matching additional origins | `https?://(localhost|127\.0\.0\.1)(:\d+)?$` |

When `DYNAMODB_ENDPOINT` is provided (for example `http://localhost:8000`), the application will create the table on startup if it is missing.

If DynamoDB is unavailable or credentials are missing, the API automatically falls back to an in-memory repository so you can exercise the endpoints locally without external dependencies.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

Use AWS credentials with rights to DynamoDB, or run DynamoDB Local and set `DYNAMODB_ENDPOINT` along with test credentials (e.g. `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`).
