# IntelHub AWS Deployment Plan

This plan summarizes how to deploy the IntelHub platform to Amazon Web Services, tracking what is already complete and what remains. Each checklist item is marked as completed (`[x]`) or still pending (`[ ]`).

---

## 1. Architecture Snapshot
- **Frontend**: React 18 + Vite single-page app. Planned hosting on Amazon S3 with Amazon CloudFront (optional Route 53 + ACM for custom domain and TLS).
- **Backend**: FastAPI application packaged as an AWS Lambda function via Mangum, exposed through API Gateway HttpApi.
- **Persistence**: Six DynamoDB tables in `ap-south-1` (`IntelHubCompetitors`, `IntelHubWishlist`, `IntelHubVendors`, `IntelHubMasterProducts`, `IntelHubTags`, `IntelHubTagIndex`). All use PAY_PER_REQUEST billing.
- **Observability**: AWS CloudWatch Logs enabled by Lambda. Future enhancements include alarms, dashboards, and tracing.
- **Automation**: AWS SAM template (`backend/template.yaml`) defines the Lambda, IAM roles, and API integration. CI/CD pipeline is a recommended follow-up.

---

## 2. High-Level Checklist
| Phase | Description | Status |
| ----- | ----------- | ------ |
| Phase 0 | Prerequisites & local tooling | ✅ Completed |
| Phase 1 | Backend API infrastructure (Lambda + API Gateway + DynamoDB) | ✅ Completed |
| Phase 2 | Frontend hosting (S3 + CloudFront + config) | 🔄 In progress |
| Phase 3 | Observability, data management, and security hardening | ⏳ Pending |
| Phase 4 | CI/CD and operational readiness | ⏳ Pending |

Legend: ✅ Completed, 🔄 In progress, ⏳ Pending.

---

## 3. Phase 0 – Prerequisites (Completed)
- [x] **AWS Account & Permissions** – IAM user/role with rights to DynamoDB, Lambda, API Gateway, CloudFormation, S3, CloudFront.
- [x] **AWS CLI profile (`intelhub-dev`)** – Configured with access key, secret, and `ap-south-1` region.
- [x] **SAM CLI + Docker** – Installed and verified by running `sam build --use-container`.
- [x] **Node.js + npm** – Installed for building the Vite frontend.
- [x] **Python 3.11 environment** – Used to run FastAPI and package Lambda dependencies.

---

## 4. Phase 1 – Backend API Deployment (In Progress)
### 4.1 Prepare Infrastructure as Code
- [x] Update FastAPI entry point with `handler = Mangum(app)` (`backend/app/main.py`).
- [x] Define AWS SAM template (`backend/template.yaml`) with environment variables and DynamoDB permissions.

### 4.2 Provision Data Layer
- [x] Create DynamoDB tables with PAY_PER_REQUEST billing:
  | Table | Hash Key | Sort Key | Status |
  | ----- | -------- | -------- | ------ |
  | IntelHubCompetitors | `business_name` | — | ✅ Done |
  | IntelHubWishlist | `wish_id` | — | ✅ Done |
  | IntelHubVendors | `vendor_id` | — | ✅ Done |
  | IntelHubMasterProducts | `product_id` | — | ✅ Done |
  | IntelHubTags | `tag_slug` | — | ✅ Done |
  | IntelHubTagIndex | `tag_slug` | `entity_key` | ✅ Done |

### 4.3 Package & Deploy Lambda
- [x] Build artifacts: `sam build --use-container --profile intelhub-dev`.
- [x] Deploy stack: `sam deploy --template-file .aws-sam/build/template.yaml --stack-name intelhub-backend --s3-bucket intelhub-sam-artifacts-20251018 --capabilities CAPABILITY_IAM --region ap-south-1 --profile intelhub-dev --no-confirm-changeset --no-fail-on-empty-changeset` (creates Lambda, HttpApi, IAM roles with dependencies packaged).
  - Deployment bucket: `intelhub-sam-artifacts-20251018` (ap-south-1).
  - Stack name: `intelhub-backend`.
  - Parameters pointed to existing DynamoDB tables.
- [x] Record API Gateway URL output and add to documentation. _Completed_
  - Current invoke URL: `https://l6qpwod8le.execute-api.ap-south-1.amazonaws.com`

### 4.4 Post-Deployment Verification
- [x] Test health endpoint: `curl https://l6qpwod8le.execute-api.ap-south-1.amazonaws.com/health` → `{ "status": "ok", "service": "intelhub-backend" }` (validated 2025-10-18).
- [x] Smoke test CRUD routes (`/vendors`, `/wishlist`, `/tags`) via curl — all returned `200 OK` with empty arrays (2025-10-18).
- [x] Confirm CloudWatch Logs receiving entries for Lambda invocations (verified during health check debugging).
- [x] Enable CORS for CloudFront distribution using new SAM parameters (`FrontendBaseUrl`, `AllowedOriginRegex`) and validated `Access-Control-Allow-Origin` headers for `https://d196es8g9nmedw.cloudfront.net` (2025-10-18).

---

## 5. Phase 2 – Frontend SPA Hosting (Pending)
### 5.1 Build & Configure
- [x] Update `frontend/.env` with `VITE_API_BASE_URL` pointing to the deployed API Gateway URL (`https://l6qpwod8le.execute-api.ap-south-1.amazonaws.com`).
- [x] Install dependencies and build: `npm install && npm run build` (artifacts in `frontend/dist/`).

### 5.2 Deploy Static Assets
- [x] Create S3 bucket `intelhub-frontend-dev-20251018` in `ap-south-1` (static hosting disabled; reserved for CloudFront origin).
- [x] Upload `frontend/dist/` contents: `aws s3 sync frontend/dist s3://intelhub-frontend-dev-20251018 --delete`.
- [x] Configure bucket policy for CloudFront Origin Access Control (OAC `EW7YDE82Y23A2`).

### 5.3 Content Delivery & Domain
- [x] Create CloudFront distribution (`ESFQXR8L5TD1V`) pointing to the S3 bucket origin; enable gzip/Brotli, caching, and HTTPS.
- [ ] (Optional) Provision custom domain via Route 53 and ACM certificate.
- [x] Verify SPA loads correctly and can reach the API (`https://d196es8g9nmedw.cloudfront.net`).

---

## 6. Phase 3 – Observability, Data & Security (Pending)
- [ ] Enable CloudWatch alarms for Lambda errors, throttles, and DynamoDB capacity.
- [ ] Configure DynamoDB point-in-time recovery (PITR) for each table (if required for SLA).
- [ ] Set up AWS Backup plans or export strategies for long-term retention.
- [ ] Create initial data seeding scripts (Python/boto3) for competitors, vendors, and tags.
- [ ] Centralize configuration secrets (e.g., API keys, third-party creds) in AWS Systems Manager Parameter Store or Secrets Manager.

---

## 7. Phase 4 – Automation & Operational Readiness (Pending)
- [ ] Implement CI/CD pipeline (GitHub Actions or AWS CodePipeline) to build frontend/backend and run `sam deploy` automatically.
- [ ] Add automated tests (unit + integration) to gate deployments.
- [ ] Document rollback and recovery procedures, including DynamoDB restore workflow.
- [ ] Define monitoring dashboards (CloudWatch or third-party) and on-call notifications.
- [ ] Prepare cost monitoring (AWS Budgets with alerts for monthly thresholds).

---

## 8. Reference Commands & Artifacts
- **List DynamoDB tables**: `aws dynamodb list-tables --region ap-south-1 --profile intelhub-dev`
- **Describe SAM stack**: `sam describe --stack-name intelhub-backend --profile intelhub-dev`
- **Frontend sync**: `aws s3 sync frontend/dist s3://intelhub-frontend-dev --delete`
- **CloudFront distribution**: `d196es8g9nmedw.cloudfront.net` (ID `ESFQXR8L5TD1V`)
- **Invalidate CloudFront cache** (post-deploy): `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"`

---

Keep this document updated after each deployment milestone. Update checkbox statuses and add links to CloudFormation stack outputs, CloudFront distribution IDs, and S3 bucket names for quick reference.
