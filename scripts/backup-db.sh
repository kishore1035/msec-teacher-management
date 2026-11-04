#!/usr/bin/env bash
# ==============================================================================
# MSEC Teacher Management Dashboard & Academic ERP Backend
# Safe, Non-Destructive MongoDB & File Storage Backup Script
# ==============================================================================
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/teacher_management_db}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting non-destructive backup to ${BACKUP_DIR}..."

# 1. MongoDB logical dump with gzip compression
if command -v mongodump >/dev/null 2>&1; then
  mongodump \
    --uri="${MONGODB_URI}" \
    --gzip \
    --archive="${BACKUP_DIR}/mongodb_${TIMESTAMP}.archive.gz"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] MongoDB archive created: mongodb_${TIMESTAMP}.archive.gz"
else
  echo "WARNING: 'mongodump' utility not found in PATH. Install mongodb-database-tools to run database dumps." >&2
fi

# 2. File storage archive (assignments, study materials, announcements, reports)
if [ -d "${UPLOADS_DIR}" ]; then
  tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "$(dirname "${UPLOADS_DIR}")" "$(basename "${UPLOADS_DIR}")"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] File storage archive created: uploads_${TIMESTAMP}.tar.gz"
fi

# 3. Generate SHA-256 integrity manifest
(
  cd "${BACKUP_DIR}"
  if ls *.gz >/dev/null 2>&1; then
    sha256sum *.gz > sha256sums.txt
  fi
)

# 4. Prune backups older than RETENTION_DAYS (only within BACKUP_ROOT)
if [ -d "${BACKUP_ROOT}" ] && [ "${RETENTION_DAYS}" -gt 0 ]; then
  find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -print
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully."
