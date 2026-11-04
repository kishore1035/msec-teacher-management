# Production Deployment, Backup & Disaster Recovery Guide (`DEPLOYMENT.md`)

## 1. Production Environment Checklist

Before starting the service in production (`NODE_ENV=production`), configure the following environment variables:

```dotenv
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/teacher_management_db?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<cryptographically-random-secret-min-32-chars>
JWT_REFRESH_SECRET=<cryptographically-random-secret-min-32-chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://erp.msec.ac.in,https://admin.msec.ac.in
LOG_LEVEL=info
REQUEST_PAYLOAD_LIMIT=10mb
MAX_FILE_UPLOAD_SIZE_MB=50
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<production-gemini-api-key>
```

---

## 2. Building & Starting Production Directly (Node.js)

```bash
# 1. Install dependencies
npm ci

# 2. Compile TypeScript to dist/
npm run build

# 3. Start production server
NODE_ENV=production npm start
```

---

## 3. Containerized Deployment (Docker & Docker Compose)

### Build Production Docker Image
```bash
docker build -t msec-erp-backend:1.0.0 .
```

### Run with Docker Compose
```bash
docker compose up -d --build
```

### Health & Readiness Verification
- **Liveness Probe:** `GET /health/live` (returns `200 OK` if process is alive)
- **Readiness Probe:** `GET /health/ready` (returns `200 OK` when MongoDB, file storage, and AI provider are ready; `503 Service Unavailable` otherwise)
- **General Health:** `GET /health` or `GET /api/v1/health`

---

## 4. Database & File Storage Backup Strategy

### Backup Script (`scripts/backup-db.sh`)
Performs a non-destructive hot backup of both MongoDB (`mongodump --gzip`) and file storage (`uploads/`), generating a `sha256sums.txt` integrity manifest:

```bash
MONGODB_URI="mongodb://localhost:27017/teacher_management_db" \
BACKUP_ROOT="./backups" \
BACKUP_RETENTION_DAYS=30 \
bash scripts/backup-db.sh
```

### Restore Script (`scripts/restore-db.sh`)
Verifies SHA-256 checksums before restoring MongoDB collections and `uploads/` files in non-destructive mode (never passes `--drop` by default):

```bash
MONGODB_URI="mongodb://localhost:27017/teacher_management_db" \
bash scripts/restore-db.sh ./backups/<TIMESTAMP>
```

### Recommended Backup & Retention Schedule

| Backup Tier | Frequency | Retention Window | Storage Target |
| :--- | :--- | :--- | :--- |
| **Incremental / Oplog** | Continuous (MongoDB Replica Set) | 7 Days | Primary / Secondary Replica Volumes |
| **Daily Snapshot** | Daily at 02:00 UTC | 30 Days | Off-host Object Storage (S3 / GCS) |
| **Weekly Archive** | Weekly (Sunday 03:00 UTC) | 180 Days | Cold Archive Storage |
| **End-of-Semester Archive** | After each semester result publication | 7 Years (Institutional Compliance) | Immutable Compliance Bucket |
