#!/bin/bash

# Champion English School - Automated Backup Script
# Usage: ./backup.sh [full|incremental] [output_dir]

set -e

# Configuration
BACKUP_TYPE="${1:-full}"
OUTPUT_DIR="${2:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/champion_school_${BACKUP_TYPE}_${TIMESTAMP}.sql"
LOG_FILE="${OUTPUT_DIR}/backup_${TIMESTAMP}.log"

# Database connection (update these or set via environment)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-champion_school}"
DB_USER="${DB_USER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

# Create backup directory
mkdir -p "$OUTPUT_DIR"

log "Starting ${BACKUP_TYPE} backup..."
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "Output: ${BACKUP_FILE}"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    error "pg_dump is not installed. Please install postgresql-client."
fi

# Perform backup
case "$BACKUP_TYPE" in
    full)
        log "Performing full database backup..."
        
        # Export schema and data
        PGPASSWORD="${DB_PASSWORD}" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -F c \
            -b \
            -v \
            -f "${BACKUP_FILE}.dump" 2>&1 | tee -a "$LOG_FILE"
        
        # Also create SQL format backup for easy inspection
        PGPASSWORD="${DB_PASSWORD}" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-password \
            > "${BACKUP_FILE}" 2>&1 | tee -a "$LOG_FILE"
        
        log "Full backup completed: ${BACKUP_FILE}"
        ;;
    
    incremental)
        warn "Incremental backup requires WAL archiving to be configured."
        warn "Creating differential backup based on recent changes..."
        
        # Backup only tables that change frequently
        TABLES="attendance_records assignment_submissions discussion_messages notifications audit_logs"
        
        for table in $TABLES; do
            log "Backing up table: $table"
            PGPASSWORD="${DB_PASSWORD}" pg_dump \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                -t "$table" \
                --data-only \
                >> "${BACKUP_FILE}" 2>&1 | tee -a "$LOG_FILE"
        done
        
        log "Incremental backup completed: ${BACKUP_FILE}"
        ;;
    
    *)
        error "Unknown backup type: ${BACKUP_TYPE}. Use 'full' or 'incremental'."
        ;;
esac

# Compress backup
log "Compressing backup..."
if command -v gzip &> /dev/null; then
    gzip -9 "${BACKUP_FILE}" 2>&1 | tee -a "$LOG_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    log "Compressed backup: ${BACKUP_FILE}"
fi

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup size: ${BACKUP_SIZE}"

# Upload to cloud storage (optional - configure S3/Cloudflare R2)
if [ -n "$BACKUP_S3_BUCKET" ]; then
    log "Uploading backup to S3 bucket: ${BACKUP_S3_BUCKET}"
    
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/$(basename $BACKUP_FILE)" \
            --storage-class STANDARD_IA 2>&1 | tee -a "$LOG_FILE"
        log "Upload completed successfully"
    else
        warn "AWS CLI not found. Skipping S3 upload."
    fi
fi

# Cleanup old backups (keep last 30 days)
log "Cleaning up old backups..."
find "$OUTPUT_DIR" -name "champion_school_*.sql*" -mtime +30 -delete 2>&1 | tee -a "$LOG_FILE"
find "$OUTPUT_DIR" -name "backup_*.log" -mtime +30 -delete 2>&1 | tee -a "$LOG_FILE"
log "Cleanup completed"

# Log backup to database (if using local DB)
log "Recording backup in audit_logs table..."
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "INSERT INTO backup_logs (backup_type, tables_backed_up, status, backup_file_path, backup_size, started_at, completed_at, created_by) 
        VALUES ('${BACKUP_TYPE}', '[\"all\"]'::jsonb, 'completed', '${BACKUP_FILE}', '${BACKUP_SIZE}', now(), now(), 'system');" \
    2>&1 | tee -a "$LOG_FILE" || warn "Failed to record backup in database"

log "=========================================="
log "Backup completed successfully!"
log "Type: ${BACKUP_TYPE}"
log "File: ${BACKUP_FILE}"
log "Size: ${BACKUP_SIZE}"
log "Location: ${OUTPUT_DIR}"
log "=========================================="

exit 0
