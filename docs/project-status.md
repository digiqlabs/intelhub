# IntelHub Deployment & Architecture Status

## Use Case & Objectives
- Deliver a competitor and vendor intelligence platform where growth teams curate wishlists, manage vendors, and track competitors in one place.
- Provide a React/Vite web experience backed by FastAPI services to persist competitors, wishlist items, vendors, tags, and master products.
- Enable a cloud-native deployment path on AWS free-tier friendly services so the stack can scale from local development to production with minimal re-work.

## Architecture Overview
### High-Level Flow
1. Browser loads the React SPA (local Vite dev server today, planned S3/CloudFront static hosting in AWS).
2. Frontend uses Axios to call the `/competitors`, `/wishlist`, `/vendors`, `/tags`, and `/master-products` APIs exposed by the FastAPI service.
3. The FastAPI service (running locally or as an AWS Lambda via Mangum) coordinates with DynamoDB tables for persistence, automatically normalizing tags and maintaining tag index relationships.
4. DynamoDB tables store the canonical data for each entity type with PAY_PER_REQUEST billing for predictable costs at low traffic.

### Application Components
- **Frontend**: React 18 + Vite SPA under `frontend/`, featuring vendor tables with search/filter/pagination and wishlist/competitor management UIs.
- **Backend**: FastAPI application in `backend/app/main.py`, packaged as a Lambda handler via Mangum (`handler = Mangum(app)`), with repositories that fall back to in-memory storage when DynamoDB is unavailable.
- **Data Layer**: Six DynamoDB tables (`IntelHubCompetitors`, `IntelHubWishlist`, `IntelHubVendors`, `IntelHubMasterProducts`, `IntelHubTags`, `IntelHubTagIndex`) providing normalized storage with tag indexing.
- **Infrastructure as Code**: AWS SAM template (`backend/template.yaml`) defining the Lambda function, HttpApi event source, and IAM policies required to access each table.

### Deployment Topology (Target State)
- **Presentation**: Amazon S3 bucket for static assets fronted by CloudFront (optional Route 53 + ACM for custom domains).
- **API Tier**: AWS Lambda (Python 3.11) behind API Gateway HttpApi, deployed via SAM.
- **Persistence**: DynamoDB tables in `ap-south-1` using on-demand capacity. Optional future enhancements include backups with AWS Backup and point-in-time recovery.
- **Observability**: CloudWatch Logs automatically enabled through Lambda; future work could add structured logging and alarm rules.

## AWS Resource Plan
| Order | Resource / Step | Description | Status |
| ----- | ---------------- | ----------- | ------ |
| 1 | AWS CLI profile `intelhub-dev` | Configured access key, secret, and default region (`ap-south-1`). | ✅ Completed |
| 2 | DynamoDB tables | Created all six IntelHub tables with PAY_PER_REQUEST billing. | ✅ Completed |
| 3 | SAM backend packaging | Added `handler = Mangum(app)` and `backend/template.yaml`; ran `sam build --use-container`. | ✅ Completed |
| 4 | SAM deploy stack | Run `sam deploy --guided` to create Lambda + HttpApi + IAM roles. | ⏳ Pending |
| 5 | Frontend hosting | Provision S3 bucket, upload build artifacts, optionally add CloudFront/Route 53. | ⏳ Pending |
| 6 | Secrets & config | Store environment configuration (e.g., API base URLs) via SSM Parameter Store or Secrets Manager for production. | ⏳ Pending |
| 7 | CI/CD automation | Create GitHub Actions or AWS CodePipeline for continuous deployment. | ⏳ Pending |

## Completed Work Highlights
- Stabilized wishlist and competitor UIs by rebuilding the wishlist modal, ensuring empty states render correctly.
- Hardened backend repositories with DynamoDB fallbacks and tag normalization, including automatic tag creation and 10-digit phone sanitization.
- Enhanced vendor management UI with a searchable, filterable, paginated table and improved form validation (optional catalog text, prefixed website URLs).
- Guided user through AWS CLI profile configuration, signature troubleshooting, and DynamoDB table creation using the `intelhub-dev` profile.
- Added SAM infrastructure definitions and executed a container-based `sam build`, producing deployable artifacts in `.aws-sam/build`.
- Documented and executed cleanup steps (e.g., removing GCP CLI) to keep the development environment streamlined.

## Remaining Work & Recommendations
- **Deploy backend**: Run `sam deploy --guided --profile intelhub-dev` (or reuse `samconfig.toml`) to create the Lambda, HttpApi, and IAM roles. Capture the generated API endpoint for frontend configuration.
- **Connect frontend to deployed API**: Update environment variables in `frontend/.env` to point Axios to the live API Gateway endpoint once available.
- **Host the frontend**: Create an S3 bucket (e.g., `intelhub-frontend-dev`), run `npm run build`, upload the `dist/` contents, and optionally configure CloudFront for CDN caching and HTTPS.
- **Add monitoring**: Enable CloudWatch alarms for Lambda errors/throttles and DynamoDB capacity, and consider structured logging improvements.
- **Security hardening**: Scope IAM roles to least privilege, enable DynamoDB backups/PITR, and document credentials rotation procedures.
- **Data migration tooling**: Prepare scripts for seeding initial competitor/vendor data into DynamoDB (via `boto3` or AWS Data Pipeline).
- **CI/CD**: Automate builds and deployments with GitHub Actions or SAM pipelines to avoid manual steps.

## Verification & Operational Checks
- **DynamoDB**: `aws dynamodb list-tables --region ap-south-1 --profile intelhub-dev` to confirm tables exist; use `describe-table` for status and key schema audits.
- **SAM stack**: After deployment, run `sam describe --stack-name intelhub-backend --profile intelhub-dev` (or use the AWS console) to confirm Lambda, API Gateway, and IAM resources are active.
- **Backend health**: Hitting `/health` on the deployed API should return `{"status":"ok","service":"intelhub-backend"}`.
- **Frontend build**: `npm install && npm run build` in `frontend/` should succeed before uploading to S3.

## Design Considerations
- **Scalability**: DynamoDB on-demand mode scales automatically with traffic; Lambda and API Gateway handle burst scaling out of the box.
- **Cost Control**: All selected AWS services (Lambda, DynamoDB on-demand, S3, CloudFront) operate comfortably within the free tier for low load.
- **Extensibility**: Tag indexing via `IntelHubTagIndex` unlocks future cross-entity tag queries; SAM template can be extended with additional Lambda functions or Step Functions as workflows grow.
- **Local Development**: Docker Compose setup (DynamoDB Local + FastAPI + Vite) remains available for iterative development without touching cloud resources.
