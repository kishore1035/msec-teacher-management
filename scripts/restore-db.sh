#!/usr/bin/env bash
# ==============================================================================
# MSEC Teacher Management Dashboard & Academic ERP Backend
# Safe, Non-Destructive MongoDB & File Storage Restore Script
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup-directory>" >&2
  exit 1
fi

SOURCE_DIR="$1"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/teacher_management_db}"
TARGET_ROOT="${TARGET_ROOT:-.}"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "ERROR: Backup directory '${SOURCE_DIR}' does not exist." >&2
  exit 1
fi

# 1. Verify SHA-256 checksums before restoring
if [ -f "${SOURCE_DIR}/sha256sums.txt" ]; then
  echo "Verifying backup archive integrity..."
  (
    cd "${SOURCE_DIR}"
    sha256sum -c sha256sums.txt
  )
fi

# 2. Restore MongoDB archive (NOTE: --drop is intentionally omitted to prevent destructive data loss)
MONGO_ARCHIVE=$(find "${SOURCE_DIR}" -maxdepth 1 -name "mongodb_*.archive.gz" | head -n 1 || true)
if [ -n "${MONGO_ARCHIVE}" ]; then
  if command -v mongorestore >/dev/null 2>&1; then
    echo "Restoring MongoDB archive from ${MONGO_ARCHIVE} (non-destructive mode)..."
    mongorestore \
      --uri="${MONGODB_URI}" \
      --gzip \
      --archive="${MONGO_ARCHIVE}"
  else
    echo "ERROR: 'mongorestore' not found in PATH. Install mongodb-database-tools." >&2
    exit 1
  fi
fi

# 3. Restore uploads directory
UPLOADS_ARCHIVE=$(find "${SOURCE_DIR}" -maxdepth 1 -name "uploads_*.tar.gz" | head -n 1 || true)
if [ -n "${UPLOADS_ARCHIVE}" ]; then
  echo "Restoring file storage archive ${UPLOADS_ARCHIVE} into ${TARGET_ROOT}..."
  tar -xzf "${UPLOADS_ARCHIVE}" -C "${TARGET_ROOT}" --keep-old-files
fi

echo "Restore completed successfully."
